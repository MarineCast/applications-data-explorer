import type { SeascapeFeature } from "./seascape";
export const tribalPrefix = "tribal_first_nations_areas__";
export const tribalAreaColumn = tribalPrefix + "mapped_area";
export const tribalAssignmentColumn = tribalPrefix + "feature_memberships_v1";
const names: Record<string, string> = {
  [tribalAreaColumn]: "Tribal / First Nations Area",
  [tribalAssignmentColumn]: "Tribal / First Nations Assignment",
};
/** Hide redundant source/support choices without mutating retained products. */
export function tribalAreaFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.filter(field => {
    if (field.dataset !== "governance") return true;
    const column = field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
    if (!column.startsWith(tribalPrefix)) return true;
    if (!names[column]) return false;
    field.name = names[column];
    field.role = field.membershipColumn ? "recorded_feature_identity" : "scientific_metric";
    return true;
  });
}
