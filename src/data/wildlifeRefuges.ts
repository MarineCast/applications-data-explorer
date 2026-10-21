import type { SeascapeFeature } from "./seascape";

export const wildlifeRefugeNames: Record<string, string> = {
  wildlife_refuges__recorded_feature_count: "Wildlife Refuge Count",
  wildlife_refuges__feature_memberships_v1: "Wildlife Refuge Assignment",
  wildlife_refuges__recorded_polygon_union_area_fraction: "Wildlife Refuge Coverage",
};

export function wildlifeRefugeFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.filter(field => {
    if (field.dataset !== "governance") return true;
    const column = field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
    if (!column.startsWith("wildlife_refuges__")) return true;
    const name = wildlifeRefugeNames[column];
    if (!name) return false;
    field.name = name;
    field.role = field.membershipColumn ? "recorded_feature_identity" : "scientific_metric";
    return true;
  });
}

export function isWildlifeCoverage(field?: SeascapeFeature): boolean {
  return field?.dataset === "governance" && (field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "")) === "wildlife_refuges__recorded_polygon_union_area_fraction";
}

export const refugePercent = (fraction: number) => `${(fraction * 100).toLocaleString(undefined, { maximumSignificantDigits: 7 })}%`;
