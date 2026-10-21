import type { SeascapeFeature } from "./seascape";

export const criticalHabitatCount = "critical_habitat__recorded_feature_count";
export const criticalHabitatAssignment = "critical_habitat__feature_memberships_v1";
export const criticalHabitatUnknownLabel = "Unknown habitat coverage";
export const criticalHabitatCoverageNote = "NOAA (U.S.), DFO and ECCC (Canada) reference inventories are partial. Gray cells or gray hatching show unknown coverage; they do not establish absence of critical habitat.";
export function isCriticalHabitatFeature(id: string): boolean {
  return id.replace(/^GOVERNANCE__(?:dynamic__)?/, "").startsWith("critical_habitat__");
}
export const criticalHabitatNames: Record<string,string> = {
  [criticalHabitatCount]: "Critical Habitat Count",
  [criticalHabitatAssignment]: "Critical Habitat Assignment",
};
const column = (field: SeascapeFeature) => field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");

/** Presentation only: country/source distinctions and every native value survive. */
export function criticalHabitatFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.filter(field => {
    if (field.dataset !== "governance" || !column(field).startsWith("critical_habitat__")) return true;
    const name=criticalHabitatNames[column(field)];
    if (!name) return false;
    field.name=name; field.family="Critical Habitat";
    field.role=field.membershipColumn ? "recorded_feature_identity" : "scientific_metric";
    return true;
  });
}

export function savedCriticalHabitat(features: SeascapeFeature[], preferred: string): SeascapeFeature | undefined {
  const key=preferred.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
  if (!key.startsWith("critical_habitat__")) return undefined;
  const target=key.endsWith("__feature_memberships_v1") ? criticalHabitatAssignment : criticalHabitatCount;
  return features.find(field => column(field)===target);
}
