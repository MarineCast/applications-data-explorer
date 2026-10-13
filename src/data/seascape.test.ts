import { webcrypto, createHash } from "node:crypto";
import { latLngToCell } from "h3-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeColumn,
  loadSeascapeCatalog,
  loadSeascapeLayer,
  loadSeascapeValues,
  sourceValue,
} from "./seascape";
import type { SeascapeCatalog, SeascapeFeature, SourceValue } from "./seascape";
import { cellGeoJSON } from "./map";
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
describe("native seascape product adapter", () => {
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
    const geo = cellGeoJSON("temperature", 11, "all", layer);
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
  it("reports a missing local cache and invalid column alignment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );
    await expect(loadSeascapeCatalog()).rejects.toThrow("cache is missing");
    expect(() => decodeColumn({ values: [0] }, 2)).toThrow("row count");
    expect(() => decodeColumn({ dictionary: [null], indices: [1] }, 1)).toThrow(
      "categorical index",
    );
  });
});
