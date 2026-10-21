import type { SeascapeFeature } from "./seascape";

export const administrativeBoundariesFamily = "Administrative Boundaries";
const prefixes = ["county_regional_boundaries__", "federal_waters__", "state_provincial_waters__", "tribal_first_nations_areas__"];

/** Group the existing map features without changing native IDs or source semantics. */
export function administrativeBoundaryFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  for (const field of features) {
    const column = field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
    if (field.dataset === "governance" && prefixes.some(prefix => column.startsWith(prefix))) {
      field.family = administrativeBoundariesFamily;
    }
  }
  return features;
}
