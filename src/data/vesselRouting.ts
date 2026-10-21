import type { SeascapeFeature } from "./seascape";
export const vesselRoutingFamily = "Vessel Routing & Regulations";
export const vesselRoutingRecorded = "vessel_routing_regulations__recorded_reference";
export const vesselRoutingRecordedName = "Routing / regulation recorded";
const column = (feature: SeascapeFeature) => feature.column ?? feature.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
const routing = (name: string) => /^(shipping_lanes|traffic_separation_schemes|speed_restriction_zones|vessel_routing_regulations)__/.test(name);
export const shippingLanesAssignment = "vessel_routing_regulations__shipping_lanes__feature_memberships_v1";
export const separationZonesAssignment = "vessel_routing_regulations__traffic_separation_zones__feature_memberships_v1";
const identityNames: Record<string,string> = {
  [shippingLanesAssignment]: "Shipping Lanes", [separationZonesAssignment]: "Shipping Lanes & Traffic Separation Zones",
  "speed_restriction_zones__feature_memberships_v1": "Speed Restriction Zones",
};
const groupedIdentity = (name: string) => (name === shippingLanesAssignment || /^(shipping_lanes|traffic_separation_schemes)__/.test(name)) && name.endsWith("__feature_memberships_v1")
  ? separationZonesAssignment : undefined;

export function vesselRoutingFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.filter(feature => {
    const name = column(feature);
    if (feature.dataset !== "governance" || !routing(name)) return true;
    if (name !== vesselRoutingRecorded && !feature.membershipColumn) return false;
    const grouped = groupedIdentity(name);
    if (grouped && features.some(candidate => candidate.dataset === "governance" && candidate.resolution === feature.resolution && candidate.productId === feature.productId && column(candidate) === grouped)) return false;
    feature.family = vesselRoutingFamily;
    if (identityNames[name]) feature.name = identityNames[name];
    feature.role = feature.membershipColumn ? "recorded_feature_identity" : "scientific_metric";
    if (name === vesselRoutingRecorded) {
      feature.name = vesselRoutingRecordedName; feature.kind = "categorical";
      feature.categories = [false, true]; feature.unit = "boolean";
    }
    return true;
  });
}

/** Old shipping/TSS identities open the union; measurements keep the native-resolution boolean. */
export function savedVesselRouting(features: SeascapeFeature[], preferred: string): SeascapeFeature | undefined {
  const key = preferred.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
  if (!routing(key)) return undefined;
  const target = groupedIdentity(key) ?? (key.endsWith("__feature_memberships_v1") ? undefined : vesselRoutingRecorded);
  return target ? features.find(feature => column(feature) === target) : undefined;
}
