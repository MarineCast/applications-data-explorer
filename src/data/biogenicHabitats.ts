import type { SeascapeFeature } from "./seascape";

const spatialInternal = new Set(["GRAPH_QC_REASON", "GRAPH_CONNECTION_STATUS", "PARENT_H3_INDEX", "IS_HIERARCHY_ONLY_PARENT", "IS_AOI_BOUNDARY_CELL", "HAS_WATER_OVERLAP", "GRAPH_NODE_ELIGIBLE", "CONNECTOR_WATER_PATH_FRACTION", "CONNECTOR_TARGET_H3_INDEX", "CONNECTOR_DISTANCE_M"]);

const anthropogenicRetired = new Set(["COMPREHENSIVE_SURVEY_COVERAGE_ESTABLISHED", "FULL_H3_WITHIN_SOURCE_RECTANGLE", "GENERALIZED_FALLBACK", "GLOBAL_INVENTORY_COMPLETE", "NATIVE_LAND_FOOTPRINT_UNKNOWN", "NETWORK_DISTANCE_QC_REASON", "OBSERVATION_PERIOD", "OVERWATER_QC", "POLICY_EDGE_REVIEW", "SOURCE_COVERAGE", "AQUACULTURE_MAPPED_AREA_M2", "AQUACULTURE_POSITIVE_MAPPED_WATER_FRAC", "ARMORING_AVAILABILITY_DISAGREEMENT_LENGTH_M", "ARTIFICIAL_REEF_MAPPED_POSITIVE_EVIDENCE", "DISPOSAL_SITE_POSITIVE_MAPPED_WATER_FRAC", "MAPPED_WATER_AREA_M2", "MAPPED_WATER_SHARE_OF_FULL_CELL", "PROJECTED_PRECISION_NORMALIZATION_TILE_BOUNDS_INTERSECT_CELL"]);
const anthropogenicNames: Record<string, string> = {"AQUACULTURE_MAPPED_POSITIVE_EVIDENCE": "Aquaculture", "ARTIFICIAL_REEF_MAPPED_POSITIVE_EVIDENCE": "Artificial Reef", "DISPOSAL_SITE_MAPPED_POSITIVE_EVIDENCE": "Disposal Site", "DREDGED_CHANNEL_MAPPED_POSITIVE_EVIDENCE": "Dredged Channel"};
const anthropogenicDefinitions: Record<string, string> = {"AQUACULTURE_MAPPED_POSITIVE_EVIDENCE": "True means a qualified mapped aquaculture point intersects this native cell. This is mapped presence, not footprint area, activity or regulatory growing-area classification. False means no mapped positive evidence, including unknown values filled False by the requested public-display policy. False does not establish ecological or physical absence. Original nullable evidence and source coverage/QC are retained internally.", "ARTIFICIAL_REEF_MAPPED_POSITIVE_EVIDENCE": "True means mapped artificial-reef inventory evidence intersects this native cell. It does not establish present activity or comprehensive reef coverage. False means no mapped positive evidence, including unknown values filled False by the requested public-display policy. False does not establish ecological or physical absence. Original nullable evidence and source coverage/QC are retained internally.", "DISPOSAL_SITE_MAPPED_POSITIVE_EVIDENCE": "True means positive mapped disposal-site polygon area in this native cell, qualified by positive_mapped_polygon_inventory QC. It does not establish current disposal activity. False means no mapped positive evidence, including unknown values filled False by the requested public-display policy. False does not establish ecological or physical absence. Original nullable evidence and source coverage/QC are retained internally.", "DREDGED_CHANNEL_MAPPED_POSITIVE_EVIDENCE": "True means positive mapped dredged-channel polygon area in this native cell, qualified by positive_mapped_polygon_inventory QC. It does not establish current dredging activity. False means no mapped positive evidence, including unknown values filled False by the requested public-display policy. False does not establish ecological or physical absence. Original nullable evidence and source coverage/QC are retained internally."};

const names: Record<string, string> = {
  ANNUAL_KELP_EXTENT_M2: "Annual Kelp Extent",
  KELP_EXTENT_ALL_TIME_M2: "Kelp Extent (All Time)",
  SEAGRASS_EXTENT_ALL_TIME_M2: "Seagrass Extent (All Time)",
  BIVALVE_EXTENT_ALL_TIME_M2: "Bivalve Extent (All-Time)",
};

/** Presentation only: preserve producer identity, units, temporal axis and qualifiers. */
export function biogenicHabitatFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.flatMap(field => {
    if ((field.dataset ?? "seascape") !== "seascape") return [field];
    const native = (field.column ?? field.id).split("__").at(-1)!;
    if (field.family === "Anthropogenic") {
      if (anthropogenicNames[native]) return [{ ...field, name: anthropogenicNames[native], definition: anthropogenicDefinitions[native], categories: [false, true], range: [0, 1], available: field.rows }];
      if (anthropogenicRetired.has(native) || ["AQUACULTURE", "ARTIFICIAL_REEF", "DISPOSAL_SITE", "DREDGED_CHANNEL"].some(group => native.includes(group))) return [];
    }
    if (field.family === "Spatial Support" && spatialInternal.has((field.column ?? field.id).split("__").at(-1)!)) return [];
    const groups: Record<string, string> = { "Mapped Substrate Classes": "Substrate", "Shoreline": "Coastal Environment", "Coast Complexity": "Coastal Environment", "Coastal Complexity": "Coastal Environment", "Nearshore Transitions": "Coastal Environment" };
    if (groups[field.family]) return [{ ...field, family: groups[field.family] }];
    const column = (field.column ?? field.id).split("__").at(-1)!;
    if (names[column]) return [{ ...field, name: names[column], family: "Biogenic Habitats" }];
    const retired = ["Bivalve", "Bi-Valve", "Biogenic Habitats", "Kelp", "Annual Kelp Footprints", "Mapped Kelp Mosaic", "Seagrass", "Seagrass Evidence", "Sentinel-2 Seagrass Habitat"].includes(field.family)
      || (field.column ?? field.id).startsWith("BIVALVE__")
      || column === "ANNUAL_SEAGRASS_EXTENT_M2";
    return retired ? [] : [field];
  });
}


/** User-authorized public policy for these four booleans only; raw qualifiers stay intact. */
export function anthropogenicPublicValues<T>(field: SeascapeFeature, values: T[]): (T | boolean)[] {
  const native = (field.column ?? field.id).split("__").at(-1)!;
  if ((field.dataset ?? "seascape") === "seascape" && field.family === "Anthropogenic" && anthropogenicNames[native]) return values.map(value => value === null ? false : value);
  return values;
}
