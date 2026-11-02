import { describe, expect, it } from "vitest";
import { biogenicHabitatFeatures, anthropogenicPublicValues } from "./biogenicHabitats";
import type { SeascapeFeature } from "./seascape";

it("presents the compact reef metric as boolean categories and preserves source values", () => {
  const field = { id: "anthropogenic_static__has_mapped_artificial_reef", column: "has_mapped_artificial_reef", family: "Anthropogenic", dataset: "seascape", kind: "numeric", arrowType: "int64", qualifiers: ["reef_records"], definition: "False is not absence" } as SeascapeFeature;
  const [actual] = biogenicHabitatFeatures([field]);
  expect(actual.kind).toBe("categorical");
  expect(actual.categories).toEqual([0, 1]);
  expect(actual.qualifiers).toBe(field.qualifiers);
  expect(actual.definition).toBe(field.definition);
  expect(anthropogenicPublicValues(actual, [0, 1])).toEqual([0, 1]);
  expect(biogenicHabitatFeatures([{...field,dataset:"governance"}])).toEqual([{...field,dataset:"governance"}]);
});
const f = (column: string, family = "Bivalve") => ({ id: column, column, family, dataset: "seascape", unit: "m2", qualifiers: ["SOURCE_MAP_DATES_JSON"], productId: column, resolution: 6 } as SeascapeFeature);
describe("Biogenic Habitats presentation", () => {
  it("retains the three delivered integer mapped-presence choices", () => {
    const flags = ["SEAGRASS_EXTENT_BOOL", "BIVALVE_EXTENT_BOOL", "KELP_EXTENT_BOOL"].map(column => ({ ...f(column, "Biogenic Habitats"), kind: "numeric" as const, arrowType: "int64", unit: "1" }));
    const actual = biogenicHabitatFeatures(flags);
    expect(actual).toHaveLength(3);
    expect(actual.map(x => x.column)).toEqual(flags.map(x => x.column));
    expect(actual.every(x => x.kind === "numeric" && x.arrowType === "int64")).toBe(true);
  });
  it("keeps exactly four scientific choices and all native identities", () => {
    const original = [f("ANNUAL_KELP_EXTENT_M2", "Kelp"), f("KELP_EXTENT_ALL_TIME_M2", "Kelp"), f("SEAGRASS_EXTENT_ALL_TIME_M2", "Seagrass"), f("BIVALVE_EXTENT_ALL_TIME_M2")];
    const result = biogenicHabitatFeatures([...original, f("BIVALVE__OLD_AREA"), f("ANNUAL_SEAGRASS_EXTENT_M2", "Seagrass")]);
    expect(result.map(x => x.name)).toEqual(["Annual Kelp Extent", "Kelp Extent (All Time)", "Seagrass Extent (All Time)", "Bivalve Extent (All-Time)"]);
    expect(new Set(result.map(x => x.family))).toEqual(new Set(["Biogenic Habitats"]));
    result.forEach((x, i) => { expect(x.productId).toBe(original[i].productId); expect(x.qualifiers).toBe(original[i].qualifiers); expect(x.unit).toBe(original[i].unit); });
  });
  it("does not rename old proxy area into extent or affect Governance and Coastal Features", () => {
    expect(biogenicHabitatFeatures([f("BIVALVE__MAPPED_BIVALVE_ASSOC_POLYGON_UNION_IN_HEX_M2"), f("OLD_KELP_AREA", "Kelp"), f("OLD_SEAGRASS_AREA", "Seagrass")])).toEqual([]);
    const unrelated = [{...f("BIVALVE__OLD_AREA"), dataset: "governance"}, f("COAST_LENGTH", "Coastal Features")];
    expect(biogenicHabitatFeatures(unrelated)).toEqual(unrelated);
  });
});

it("groups physical families without changing identities, support or values", () => {
  for (const family of ["Mapped Substrate Classes", "Shoreline", "Coast Complexity", "Nearshore Transitions"]) {
    const field = f("coast_complexity_r6", family);
    expect(biogenicHabitatFeatures([field])).toEqual([{ ...field, family: family === "Mapped Substrate Classes" ? "Substrate" : "Coastal Environment" }]);
    const external = { ...field, dataset: "governance" };
    expect(biogenicHabitatFeatures([external])).toEqual([external]);
  }
  const unrelated = [f("x", "Coastal Bounds"), f("y", "Nearshore Other")];
  expect(biogenicHabitatFeatures(unrelated)).toEqual(unrelated);
});

it("removes only requested spatial internals from stale catalogs", () => {
  const removed = ["GRAPH_QC_REASON","GRAPH_CONNECTION_STATUS","PARENT_H3_INDEX","IS_HIERARCHY_ONLY_PARENT","IS_AOI_BOUNDARY_CELL","HAS_WATER_OVERLAP","GRAPH_NODE_ELIGIBLE","CONNECTOR_WATER_PATH_FRACTION","CONNECTOR_TARGET_H3_INDEX","CONNECTOR_DISTANCE_M"];
  const keep = [f("GRAPH_DEGREE","Spatial Support"),f("GRAPH_QC_REASON_DETAIL","Spatial Support"),{...f("GRAPH_QC_REASON","Spatial Support"),dataset:"governance"}];
  expect(biogenicHabitatFeatures([...removed.map(c=>f("h3_marine_support__"+c,"Spatial Support")),...keep])).toEqual(keep);
});

it("keeps four nullable boolean presence identities and hides other group measures", () => {
  const groups = ["AQUACULTURE", "ARTIFICIAL_REEF", "DISPOSAL_SITE", "DREDGED_CHANNEL"];
  const values = groups.map(g => ({...f(g+"_MAPPED_POSITIVE_EVIDENCE", "Anthropogenic"),kind:"categorical" as const,categories:[true,false]}));
  const retired=groups.map(g=>f("DISTANCE_TO_"+g+"_M","Anthropogenic"));
  const actual=biogenicHabitatFeatures([...values,...retired,f("SOURCE_COVERAGE","Anthropogenic")]);
  expect(actual.map(x=>x.name)).toEqual(["Aquaculture","Artificial Reef","Disposal Site","Dredged Channel"]);
  actual.forEach((x,i)=>{expect(x.id).toBe(values[i].id);expect(x.categories).toEqual([false,true]);expect(x.qualifiers).toBe(values[i].qualifiers);});
});

it("scopes the eight QC selector removals to Anthropogenic", () => {
  const columns = ["COMPREHENSIVE_SURVEY_COVERAGE_ESTABLISHED", "FULL_H3_WITHIN_SOURCE_RECTANGLE", "GENERALIZED_FALLBACK", "GLOBAL_INVENTORY_COMPLETE", "NATIVE_LAND_FOOTPRINT_UNKNOWN", "NETWORK_DISTANCE_QC_REASON", "OBSERVATION_PERIOD", "OVERWATER_QC"];
  const other = columns.map(c=>f(c,"Estuary"));
  expect(biogenicHabitatFeatures([...columns.map(c=>f("ANTHROPOGENIC__"+c,"Anthropogenic")),...other])).toEqual(other);
});

it("fills only the four approved public presence nulls, including old cached values", () => {
  for (const group of ["AQUACULTURE","ARTIFICIAL_REEF","DISPOSAL_SITE","DREDGED_CHANNEL"]) {
    const field=f(group+"_MAPPED_POSITIVE_EVIDENCE","Anthropogenic");
    expect(anthropogenicPublicValues(field,[true,false,null])).toEqual([true,false,false]);
    expect(anthropogenicPublicValues({...field,family:"Other"},[null])).toEqual([null]);
  }
  expect(anthropogenicPublicValues(f("SOURCE_COVERAGE","Anthropogenic"),[null])).toEqual([null]);
});
