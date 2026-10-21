import type { SeascapeFeature } from "./seascape";

export const regionalPrefix = "county_regional_boundaries__";
export const regionalCountColumn = regionalPrefix + "recorded_feature_count";
export const regionalAssignmentColumn = regionalPrefix + "feature_memberships_v1";
const names: Record<string, string> = {
  [regionalCountColumn]: "County / District Count",
  [regionalAssignmentColumn]: "County / District Assignment",
};

export function regionalBoundaryFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.filter(field => {
    if (field.dataset !== "governance") return true;
    const column = field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
    if (!column.startsWith(regionalPrefix)) return true;
    if (!names[column]) return false;
    field.name = names[column];
    field.family = "Regional Boundaries";
    field.role = field.membershipColumn ? "recorded_feature_identity" : "scientific_metric";
    return true;
  });
}

export function savedRegionalBoundary(candidates: SeascapeFeature[], preferred: string) {
  if (!/^GOVERNANCE__(?:dynamic__)?county_regional_boundaries__/.test(preferred)) return undefined;
  return candidates.find(field => field.column === regionalCountColumn && field.id.startsWith(preferred.startsWith("GOVERNANCE__dynamic__") ? "GOVERNANCE__dynamic__" : "GOVERNANCE__county_regional_boundaries__"));
}
