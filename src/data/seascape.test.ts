import { webcrypto, createHash } from "node:crypto";
import { latLngToCell } from "h3-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkedAsset,
  decodeColumn,
  loadSeascapeCatalog,
  loadSeascapeLayer,
  loadSeascapeValues,
  sourceValue,
} from "./seascape";
import type { SeascapeCatalog, SeascapeFeature, SourceValue } from "./seascape";
import { cellGeoJSON } from "./map";
import { biogenicHabitatFeatures } from "./biogenicHabitats";
let serial = 0;
function sourceFixture(ids: string[], values: SourceValue[]) {
  const root = `/test-${++serial}`;
  const bodies = new Map<string, string>();
  const asset = (name: string, data: unknown) => {
    const url = `${root}/${name}`;
    const body = JSON.stringify(data);
    bodies.set(url, body);
    return { url, sha256: createHash("sha256").update(body).digest("hex") };
  };
  const sourceSha256 = "source-parquet-checksum";
  const field: SeascapeFeature = {
    id: "BATHYMETRY",
    resolution: 6,
    name: "Depth",
    family: "PREFERRED",
    unit: "m",
    range: [0, 30],
    available: 1,
    rows: ids.length,
    role: "preferred_exact_source_alias",
    qualifiers: ["STATUS"],
    sourceRelease: "frozen-source",
    sourcePath: "depth.parquet",
    sourceSha256,
    definition: "positive down",
    modelingEligibility: "not_assigned",
    arrowType: "double",
  };
  const product = {
    rows: ids.length,
    sourceSha256,
    sourcePath: "depth.parquet",
    cells: asset("cells", { ids, resolution: 6, sourceSha256 }),
    columns: {
      BATHYMETRY: asset("depth", { values }),
      STATUS: asset("status", {
        dictionary: ["unknown coverage", null],
        indices: values.map((v) => (v === null ? 1 : 0)),
      }),
    },
  };
  const catalog: SeascapeCatalog = {
    version: 1,
    release: "frozen-release",
    artifact: "test",
    manifestSha256: "test",
    receiptStatus: "published_partial",
    publishedAt: "2026-10-07",
    sourceCompleteness: "partial",
    resolutions: { "6": product, "8": product },
    features: [field],
  };
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(bodies.get(url) ?? "missing", {
          status: bodies.has(url) ? 200 : 404,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
  return { catalog, field, bodies, asset };
}
afterEach(() => vi.unstubAllGlobals());
it("loads integer reef evidence as False/True categories without losing zeros or source values", async () => {
  const ids = [latLngToCell(48.45, -123.5, 6), latLngToCell(49, -123.5, 6)];
  const fixture = sourceFixture(ids, [0, 1]);
  const product = fixture.catalog.resolutions["6"];
  product.columns.has_mapped_artificial_reef = product.columns.BATHYMETRY;
  const [field] = biogenicHabitatFeatures([{ ...fixture.field, id: "anthropogenic_static__has_mapped_artificial_reef", column: "has_mapped_artificial_reef", family: "Anthropogenic", dataset: "seascape", kind: "numeric", arrowType: "int64" }]);
  const layer = await loadSeascapeLayer(fixture.catalog, field);
  expect(layer.categories).toEqual(["0", "1"]);
  expect([...layer.values.values()]).toEqual([0, 1]);
  expect([...layer.rawValues!.values()]).toEqual([0, 1]);
  expect(cellGeoJSON(layer).features).toHaveLength(2);
  expect([...await loadSeascapeValues(fixture.catalog, field)].map(([, value]) => value)).toEqual([0, 1]);
});
describe("native seascape product adapter", () => {
  function flatFixture() {
    const f = sourceFixture([latLngToCell(48.45, -123.5, 6)], [0]);
    f.field.id = "bathymetry_static__BATHYMETRY__BATHYMETRY";
    f.field.column = "BATHYMETRY";
    f.field.productId = "seascape-bathymetry-static-r6";
    f.field.dataset = "seascape";
    Object.assign(f.catalog, {
      version: 2, release: "current", artifact: "Seascape area Parquets",
      receiptStatus: "current flat data",
      products: { [f.field.productId]: f.catalog.resolutions["6"] },
      datasets: { seascape: { name: "Seascape", release: "current", status: "current area Parquets", limitations: "Partial coverage" } },
    });
    const serve = () => f.bodies.set("/local-data/seascape/catalog.json", JSON.stringify(f.catalog));
    return { ...f, serve };
  }
  it("accepts the current flat v2 exporter contract and reads checked native values", async () => {
    const f = flatFixture();
    f.serve();
    const catalog = await loadSeascapeCatalog();
    expect(catalog.receiptStatus).toBe("current flat data");
    const layer = await loadSeascapeLayer(catalog, catalog.features[0]);
    expect([...layer.values.values()]).toEqual([0]);
    expect(layer.sourceLabel).toContain("current area Parquets");
  });
  it.each(["published_partial", "PASS_atomic_immutable_verified"])("retains v2 receipt compatibility: %s", async status => {
    const f = flatFixture();
    f.catalog.receiptStatus = status;
    f.catalog.release = "historical";
    f.serve();
    await expect(loadSeascapeCatalog()).resolves.toMatchObject({ receiptStatus: status });
  });
  it("rejects unknown flat formats, versions and missing dataset/product bindings", async () => {
    for (const change of [
      (c: SeascapeCatalog) => { c.version = 3; },
      (c: SeascapeCatalog) => { c.receiptStatus = "current something else"; },
      (c: SeascapeCatalog) => { c.artifact = "unknown flat format"; },
      (c: SeascapeCatalog) => { delete c.datasets; },
      (c: SeascapeCatalog) => { delete c.products; },
      (c: SeascapeCatalog) => { c.features[0].productId = "missing"; },
    ]) {
      const f = flatFixture();
      change(f.catalog);
      f.serve();
      await expect(loadSeascapeCatalog()).rejects.toThrow("Unsupported seascape catalog");
    }
  });
  it("rejects flat catalogs whose native columns or default slice are missing", async () => {
    const f = flatFixture();
    delete f.catalog.resolutions["6"].columns.BATHYMETRY;
    f.serve();
    await expect(loadSeascapeCatalog()).rejects.toThrow("Invalid native product or column binding");
    const sliced = flatFixture();
    sliced.catalog.products![sliced.field.productId!] = { axis: "Date", defaultSlice: "missing", slices: { "2024": sliced.catalog.resolutions["6"] } };
    sliced.serve();
    await expect(loadSeascapeCatalog()).rejects.toThrow("Invalid native product or column binding");
  });
  it("loads exact temporal columns and native identity without loading unrelated qualifiers", async () => {
    const ids = [latLngToCell(48.8, -123.2, 6), latLngToCell(48.45, -123.5, 6)];
    const f = sourceFixture(ids, [0, null]);
    const product = f.catalog.resolutions["6"];
    f.field.productId = "annual";
    f.catalog.products = { annual: { axis: "Year", defaultSlice: "2024", slices: { "2024": product } } };
    const result = await loadSeascapeValues(f.catalog, f.field, "2024");
    expect([...result]).toEqual([[ids[0], 0], [ids[1], null]]);
    expect(vi.mocked(fetch).mock.calls.map(call => call[0])).not.toContain(product.columns.STATUS.url);
    await expect(loadSeascapeValues(f.catalog, f.field, "1993")).rejects.toThrow("Unavailable source slice");
    product.columns.BATHYMETRY = { ...product.columns.BATHYMETRY, sha256: "invalid" };
    await expect(loadSeascapeValues(f.catalog, f.field, "2024")).rejects.toThrow("checksum mismatch");
  });
  it("loads governance from its own native table, retaining zero/null and status", async () => {
    const ids = [latLngToCell(48.8, -123.2, 6), latLngToCell(48.45, -123.5, 6)];
    const f = sourceFixture(ids, [0, null]);
    f.field.id = "GOVERNANCE__ports__recorded_feature_count";
    f.field.column = "BATHYMETRY";
    f.field.productId = "governance-r6";
    f.field.dataset = "governance";
    f.catalog.products = { "governance-r6": f.catalog.resolutions["6"] };
    f.catalog.datasets = { governance: { name: "Governance", release: "v2", status: "research only", limitations: "Not current law" } };
    // Invalid legacy support must not be used for a product-bound field.
    f.catalog.resolutions["6"] = { ...f.catalog.resolutions["6"], rows: 999 };
    const layer = await loadSeascapeLayer(f.catalog, f.field);
    expect(layer.cells.map((c) => c.id)).toEqual(ids);
    expect(layer.rawValues?.get(ids[0])).toBe(0);
    expect(layer.rawValues?.get(ids[1])).toBeNull();
    expect(layer.sourceLabel).toContain("research only");
    expect(layer.qualifiers.STATUS).toEqual(["unknown coverage", null]);
  });
  it("keeps category labels and nulls separate from numeric display indices", async () => {
    const ids = [latLngToCell(48.45, -123.5, 6), latLngToCell(48.8, -123.2, 6)];
    const f = sourceFixture(ids, ["valley", null]);
    f.field.kind = "categorical";
    f.field.categories = ["ridge", "valley"];
    const layer = await loadSeascapeLayer(f.catalog, f.field);
    expect(layer.values.get(ids[0])).toBe(1);
    expect(layer.rawValues?.get(ids[0])).toBe("valley");
    expect(layer.rawValues?.get(ids[1])).toBeNull();
    expect(layer.categories).toEqual(["ridge", "valley"]);
    f.field.categories = ["ridge"];
    await expect(loadSeascapeLayer(f.catalog, f.field)).rejects.toThrow("Unregistered source category");
  });
  it("selects exact annual slices without averaging or manufacturing absent years", async () => {
    const id = latLngToCell(48.45, -123.5, 6);
    const f = sourceFixture([id], [0]);
    const product = f.catalog.resolutions["6"];
    f.field.productId = "kelp-r6";
    f.catalog.products = { "kelp-r6": { axis: "Survey year", defaultSlice: "2024", slices: {
      "1989": { ...product, label: "1989" },
      "2024": { ...product, label: "2024", columns: { ...product.columns, BATHYMETRY: f.asset("2024", { values: [7.123456789] }) } },
    } } };
    const latest = await loadSeascapeLayer(f.catalog, f.field);
    const early = await loadSeascapeLayer(f.catalog, f.field, "1989");
    expect(latest.rawValues?.get(id)).toBe(7.123456789);
    expect(latest.slice).toEqual({ axis: "Survey year", value: "2024", label: "2024" });
    expect(early.rawValues?.get(id)).toBe(0);
    await expect(loadSeascapeLayer(f.catalog, f.field, "1993")).rejects.toThrow("Unavailable source slice");
  });
  it("preserves native identity, stored zero, nulls and categorical quality fields", async () => {
    const ids = [latLngToCell(48.45, -123.5, 6), latLngToCell(48.8, -123.2, 6)];
    const { catalog, field } = sourceFixture(ids, [0, null]);
    const layer = await loadSeascapeLayer(catalog, field);
    expect(layer.cells.map((c) => c.id)).toEqual(ids);
    expect(layer.values.get(ids[0])).toBe(0);
    expect(layer.values.get(ids[1])).toBeNull();
    expect(layer.qualifiers.STATUS).toEqual(["unknown coverage", null]);
    const geo = cellGeoJSON(layer);
    expect(geo.features.map((f) => f.properties?.value)).toEqual([0, null]);
    expect(geo.features[1].properties?.color).toBe("#d4d8d4");
    expect(geo.features[0].geometry.coordinates[0][0]).toEqual(
      geo.features[0].geometry.coordinates[0].at(-1),
    );
    expect(sourceValue(null)).toBe("Unavailable / unknown");
    expect(sourceValue(false)).toBe("false");
  });
  it("rejects corrupted bytes instead of displaying stale or invented values", async () => {
    const { catalog, field, bodies } = sourceFixture(
      [latLngToCell(48.45, -123.5, 6)],
      [24],
    );
    bodies.set(
      catalog.resolutions["6"].columns.BATHYMETRY.url,
      JSON.stringify({ values: [25] }),
    );
    await expect(loadSeascapeLayer(catalog, field)).rejects.toThrow(
      "checksum mismatch",
    );
  });
  it("rejects duplicate cell identities and mixed H3 resolutions", async () => {
    const id = latLngToCell(48.45, -123.5, 6);
    let f = sourceFixture([id, id], [0, null]);
    await expect(loadSeascapeLayer(f.catalog, f.field)).rejects.toThrow(
      "Invalid native H3 support",
    );
    f = sourceFixture([latLngToCell(48.45, -123.5, 8)], [0]);
    await expect(loadSeascapeLayer(f.catalog, f.field)).rejects.toThrow(
      "Invalid H3 cell/resolution",
    );
  });
  it("reports unreadable source files and invalid column alignment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );
    await expect(loadSeascapeCatalog()).rejects.toThrow("files could not be read");
    expect(() => decodeColumn({ values: [0] }, 2)).toThrow("row count");
    expect(() => decodeColumn({ dictionary: [null], indices: [1] }, 1)).toThrow(
      "categorical index",
    );
  });
});

describe("Governance membership integration", () => {
  async function fixture() {
    const payload = (await import("./governanceMemberships.fixture.json")).default;
    const f = sourceFixture([48,48.5,49,49.5].map(lat => latLngToCell(lat,-123.5,6)),payload.counts);
    const numeric = { ...f.field, dataset:"governance", productId:"governance-r6", column:"BATHYMETRY" };
    const identity = { ...numeric, id:"identities", column:payload.column, membershipColumn:payload.column, kind:"categorical" as const,
      qualifiers:[payload.countColumn,payload.statusColumn] };
    const product = f.catalog.resolutions["6"] as import("./seascape").NativeProduct;
    product.columns[payload.countColumn] = f.asset("counts",{values:payload.counts});
    product.columns[payload.statusColumn] = f.asset("membership-status",{values:payload.statuses});
    product.columns[`${payload.countColumn}_status`] = f.asset("count-status",{values:payload.statuses});
    const binding = { rows:payload.rows, group:payload.group, column:payload.column, countColumn:payload.countColumn, statusColumn:payload.statusColumn,
      asset:f.asset("memberships",payload) };
    product.memberships = {[payload.column]:binding};
    Object.assign(f.catalog,{version:2,products:{"governance-r6":product},features:[identity,numeric], datasets:{governance:{name:"Governance",status:"research",release:"current",limitations:"Partial"}}});
    f.bodies.set("/local-data/seascape/catalog.json",JSON.stringify(f.catalog));
    return {...f,payload,identity,numeric,product,binding};
  }
  it("loads exact checked native memberships and switches back to numeric values without category leakage", async () => {
    const f=await fixture();
    const catalog=await loadSeascapeCatalog();
    const layer=await loadSeascapeLayer(catalog,f.identity);
    expect(layer.governanceMemberships?.counts).toEqual([2,null,0,1]);
    expect(layer.governanceMemberships?.cells[0]).toHaveLength(2);
    expect(layer.governanceMemberships?.cells[1]).toBeNull();
    expect(layer.rawValues?.get(layer.cells[2].id)).toBe("No recorded features · verified empty support");
    expect(layer.categoryMemberships?.get(layer.cells[0].id)).toEqual([0,1]);
    expect(layer.categories).toContain("dfo.marine: 21-0");
    expect([...await loadSeascapeValues(catalog,f.identity)]).toEqual([...layer.rawValues!]);
    const numeric=await loadSeascapeLayer(catalog,f.numeric);
    expect(numeric.categories).toBeUndefined();
    expect(numeric.categoryMemberships).toBeUndefined();
    expect([...numeric.values.values()]).toEqual([2,null,0,1]);
  });
  it("loads tribal boolean assignment support without changing boolean rendering",async()=>{
    const f=await fixture();
    const group="tribal_first_nations_areas",column=group+"__feature_memberships_v1",countColumn=group+"__recorded_feature_count",statusColumn=column+"_status";
    const payload={...f.payload,group,column,countColumn,statusColumn};
    const context={dfo:{country:"Canada",agency:"DFO",boundary_type:"Administrative reference"}};
    const identity={...f.identity,id:"GOVERNANCE__"+column,column,membershipColumn:column,qualifiers:[countColumn,statusColumn],sourceContext:context};
    f.product.memberships={[column]:{rows:payload.rows,group,column,countColumn,statusColumn,asset:f.asset("tribal-memberships",payload)}};
    f.product.columns[countColumn]=f.asset("tribal-counts",{values:payload.counts});
    f.product.columns[statusColumn]=f.asset("tribal-support",{values:payload.statuses});
    f.product.columns[countColumn+"_status"]=f.asset("tribal-count-support",{values:payload.statuses});
    const area={...f.numeric,id:"GOVERNANCE__"+group+"__mapped_area",column:group+"__mapped_area",kind:"categorical" as const,categories:[false,true],qualifiers:[]};
    f.product.columns[area.column]=f.asset("tribal-boolean",{values:[true,null,false,true]});
    f.catalog.features=[area,identity];
    const layer=await loadSeascapeLayer(f.catalog,area);
    expect([...layer.rawValues!.values()]).toEqual([true,null,false,true]);
    expect(layer.categories).toEqual(["false","true"]);
    expect(layer.categoryMemberships).toBeUndefined();
    expect(layer.governanceMemberships?.counts).toEqual([2,null,0,1]);
    expect(layer.field).toBe(area);
    expect(layer.governanceSourceContext).toEqual(context);
  });
  it("loads hidden boundary line provenance with a boolean categorical legend and rejects mismatched support",async()=>{
    const f=await fixture();
    const column="federal_waters__international_boundary";
    const field={...f.numeric,id:"GOVERNANCE__"+column,column,supportMembershipColumn:f.payload.column,kind:"categorical" as const,categories:[false,true],qualifiers:[]};
    f.product.columns[column]=f.asset("boundary-boolean",{values:[true,null,false,true]});
    f.catalog.features=[field];
    const layer=await loadSeascapeLayer(f.catalog,field);
    expect([...layer.rawValues!.values()]).toEqual([true,null,false,true]);
    expect([...layer.values.values()]).toEqual([1,null,0,1]);
    expect(layer.categories).toEqual(["false","true"]);
    expect(layer.categoryMemberships).toBeUndefined();
    expect(layer.governanceMemberships?.cells).toEqual((await import("./governanceMemberships")).decodeGovernanceMemberships(f.payload,f.payload).cells);
    f.product.columns[column]=f.asset("boundary-corrupt",{values:[false,null,false,true]});
    await expect(loadSeascapeLayer(f.catalog,field)).rejects.toThrow("boolean/membership support mismatch");
  });
  it("loads the combined Assignment binding while designated Count stays independent",async()=>{
    const f=await fixture();
    const group="marine_conservation_assignment",column=group+"__feature_memberships_v1",countColumn=group+"__recorded_feature_count",statusColumn=column+"_status";
    const reference={...f.payload.dictionary[0],feature_id:"conservation_reference:interim:cpcad_parent:714320000",records:f.payload.dictionary[0].records.map(r=>({...r,feature_name:"Gulf Islands",area_hierarchy_level:"Interim"}))};
    const payload={...f.payload,group,column,countColumn,statusColumn,dictionary:[...f.payload.dictionary,reference],indices:[[0,1,2],null,[],[1]],counts:[3,null,0,1]};
    const identity={...f.identity,id:"GOVERNANCE__marine_conservation_areas__feature_memberships_v1",column,membershipColumn:column,qualifiers:[countColumn,statusColumn],assignmentSemantics:"conservation_status" as const};
    f.product.memberships![column]={rows:payload.rows,group,column,countColumn,statusColumn,asset:f.asset("all-status-memberships",payload)};
    f.product.columns[countColumn]=f.asset("all-status-counts",{values:payload.counts});
    f.product.columns[statusColumn]=f.asset("all-status-support",{values:payload.statuses});
    f.product.columns[countColumn+"_status"]=f.asset("all-status-count-support",{values:payload.statuses});
    f.catalog.features=[identity,f.numeric];
    const layer=await loadSeascapeLayer(f.catalog,identity);
    expect(layer.id).toBe("GOVERNANCE__marine_conservation_areas__feature_memberships_v1");
    expect(layer.governanceMemberships?.counts).toEqual([3,null,0,1]);
    expect(layer.categories).toContain("Interim: Gulf Islands");
    expect([...layer.categoryMemberships!.values()][0]).toHaveLength(3);
    expect(layer.governanceMemberships?.cells[1]).toBeNull();
    const count=await loadSeascapeLayer(f.catalog,f.numeric);
    expect([...count.values.values()]).toEqual([2,null,0,1]);
  });
  it("rejects checksum, scalar-support and cell-alignment corruption", async () => {
    for (const problem of ["checksum","counts","cells","binding"]) {
      const f=await fixture();
      if(problem==="checksum") f.bodies.set(f.binding.asset.url,"{}");
      if(problem==="counts") f.product.columns[f.payload.countColumn]=f.asset("wrong-counts",{values:[9,null,0,1]});
      if(problem==="cells") f.product.cells=f.asset("wrong-cells",{ids:[latLngToCell(48,-123,6)],resolution:6,sourceSha256:f.product.sourceSha256});
      if(problem==="binding") f.binding.rows=3;
      await expect(loadSeascapeLayer(f.catalog,f.identity)).rejects.toThrow(/checksum|support|alignment|misaligned/);
    }
  });
});


it.each(["wildlife_refuges__recorded_polygon_union_area_fraction", "marine_conservation_areas__recorded_polygon_union_area_fraction"])("displays %s as percent while retaining exact raw fractions and nulls", async column => {
  const ids = [48.1, 48.5, 49, 49.5].map(lat => latLngToCell(lat, -123.5, 6));
  const f = sourceFixture(ids, [.425, 0, 1, null]);
  Object.assign(f.field, { dataset: "governance", id: `GOVERNANCE__${column}`, unit: "fraction", range: [0, 1] });
  f.field.column = column;
  f.catalog.resolutions["6"].columns[f.field.column] = f.catalog.resolutions["6"].columns.BATHYMETRY;
  const layer = await loadSeascapeLayer(f.catalog, f.field);
  expect([...layer.values.values()]).toEqual([42.5, 0, 100, null]);
  expect([...layer.rawValues!.values()]).toEqual([.425, 0, 1, null]);
  expect(layer.unit).toBe("%");
  expect(layer.field.unit).toBe("fraction");
  expect(layer.range).toEqual([0, 100]);
});


it("keeps tribal boolean true, false and unknown distinct as categorical values and legend labels", async () => {
  const ids=[48,48.5,49].map(lat=>latLngToCell(lat,-123.5,6));
  const f=sourceFixture(ids,[true,false,null]);
  Object.assign(f.field,{dataset:"governance",id:"GOVERNANCE__tribal_first_nations_areas__mapped_area",column:"tribal_first_nations_areas__mapped_area",kind:"categorical",categories:[false,true],unit:"boolean"});
  f.catalog.resolutions["6"].columns[f.field.column!]=f.catalog.resolutions["6"].columns.BATHYMETRY;
  const layer=await loadSeascapeLayer(f.catalog,f.field);
  expect([...layer.rawValues!.values()]).toEqual([true,false,null]);
  expect([...layer.values.values()]).toEqual([1,0,null]);
  expect(layer.categories).toEqual(["false","true"]);
});

it("bounds Oceanography playback asset retention and refetches evicted days", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const body = JSON.stringify({ values: [1, null] });
  const fetcher = vi.fn(async () => new Response(body));
  vi.stubGlobal("fetch", fetcher);
  const binding = (i: number) => ({ url: `/local-data/seascape/ocean-cache-test/assets/${i}.json`, sha256: createHash("sha256").update(body).digest("hex") });
  for (let i = 0; i < 20; i++) await checkedAsset(binding(i));
  await checkedAsset(binding(19));
  expect(fetcher).toHaveBeenCalledTimes(20);
  await checkedAsset(binding(0));
  expect(fetcher).toHaveBeenCalledTimes(21);
});

it('loads tide timestamps losslessly and maps support categorically, never as numeric times',async()=>{
 const ids=[latLngToCell(48.45,-123.5,6),latLngToCell(48.6,-123.7,6)];const f=sourceFixture(ids,[0,null]);
 Object.assign(f.field,{id:'tide_events',column:'high_tide_times_utc',productId:'tides',dataset:'oceanography',kind:'categorical',categories:['Station predictions available'],qualifiers:['low_tide_times_utc','high_tide_local_times','low_tide_local_times'],tideEvents:{stations:{s:{id:'s',name:'Station',provider:'noaa',timezone:'America/Los_Angeles'}},mapping:{[ids[0]]:{station:'s',distance_km:1,water_target_r8:'unused'}}}});
 const product={...f.catalog.resolutions['6'],columns:{high_tide_times_utc:f.asset('high',{values:[['2024-07-01T03:00:00+00:00'],null]}),low_tide_times_utc:f.asset('low',{values:[[],null]}),high_tide_local_times:f.asset('local-high',{values:[['2024-06-30T20:00:00-07:00'],null]}),low_tide_local_times:f.asset('local-low',{values:[[],null]})}};
 f.catalog.products={tides:{axis:'UTC event day',defaultSlice:'2024-07-01',slices:{'2024-07-01':product}}};
 const layer=await loadSeascapeLayer(f.catalog,f.field);expect([...layer.values.values()]).toEqual([0,null]);expect([...layer.rawValues!.values()]).toEqual(['Station predictions available',null]);expect(layer.tideEvents![ids[0]].high_tide_local_times).toEqual(['2024-06-30T20:00:00-07:00']);
 await expect(loadSeascapeLayer(f.catalog,f.field,'2024-07-04')).rejects.toThrow('Unavailable');
 product.columns.high_tide_local_times=f.asset('bad-local',{values:[['2024-07-01T20:00:00-07:00'],null]});await expect(loadSeascapeLayer(f.catalog,f.field)).rejects.toThrow('pairing');
});
