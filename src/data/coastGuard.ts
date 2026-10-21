import type { SeascapeFeature } from "./seascape";

export const coastGuardAssignmentColumn = "coast_guard_sectors__feature_memberships_v1";

export function coastGuardFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.filter(field => {
    if (field.dataset !== "governance") return true;
    const column = field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
    if (!column.startsWith("coast_guard_sectors__")) return true;
    if (column !== coastGuardAssignmentColumn) return false;
    field.name = "Coast Guard Assignment";
    field.family = "Coast Guard Sectors";
    field.role = "recorded_feature_identity";
    return true;
  });
}

export function savedCoastGuard(candidates: SeascapeFeature[], preferred: string) {
  if (!/^GOVERNANCE__(?:dynamic__)?coast_guard_sectors__/.test(preferred)) return undefined;
  const dynamic = preferred.startsWith("GOVERNANCE__dynamic__");
  return candidates.find(field => field.column === coastGuardAssignmentColumn && field.id.startsWith("GOVERNANCE__dynamic__") === dynamic);
}
