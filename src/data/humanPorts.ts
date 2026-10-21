import type { SeascapeFeature } from "./seascape";
export const humanPortLocations = "HUMAN_NATIVE__ports";
export const isLegacyGovernancePort = (id: string) => /^GOVERNANCE__(?:dynamic__)?ports__/.test(id);
export function savedPortFeature(features: SeascapeFeature[], preferred: string): SeascapeFeature | undefined {
  return isLegacyGovernancePort(preferred) ? features.find(f => f.id === humanPortLocations && f.dataset === "human" && f.geometryGroup === "ports") : undefined;
}
/** Hide old Governance port choices only when their verified Human replacement exists. */
export function humanPortFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.some(f => f.id === humanPortLocations)
    ? features.filter(f => !(f.dataset === "governance" && isLegacyGovernancePort(f.id))) : features;
}
