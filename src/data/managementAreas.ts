import type { SeascapeFeature } from "./seascape";

export const managementAreasFamily = "Fisheries Management Areas";
export const managementAreaCountColumn = "management_areas__recorded_feature_count";
const names: Record<string, string> = {
  [managementAreaCountColumn]: "Management Area Count",
  management_areas__feature_memberships_v1: "Management Area",
};

/** Limit map choices while retaining original column bindings and support assets. */
export function managementAreaFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.filter(field => {
    if (field.dataset !== "governance") return true;
    const column = field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
    if (!column.startsWith("management_areas__")) return true;
    if (!names[column]) return false;
    field.name = names[column];
    field.family = managementAreasFamily;
    field.role = field.membershipColumn ? "recorded_feature_identity" : "scientific_metric";
    return true;
  });
}
