import type { GovernanceMembership } from "./governanceMemberships";
import type { SeascapeFeature } from "./seascape";

export const exclusionZoneCount = "exclusion_zones__recorded_feature_count";
export const exclusionZoneAssignment = "exclusion_zones__feature_memberships_v1";
export const exclusionZoneNames: Record<string,string> = {
  [exclusionZoneCount]: "Exclusion Zone Count",
  [exclusionZoneAssignment]: "Exclusion Zone Assignment",
};
const column = (field: SeascapeFeature) => field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");

/** Presentation only: source restriction/activity distinctions and every native value survive. */
export function exclusionZoneFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.filter(field => {
    if (field.dataset !== "governance" || !column(field).startsWith("exclusion_zones__")) return true;
    const name=exclusionZoneNames[column(field)];
    if (!name) return false;
    field.name=name; field.family="Exclusion Zones";
    field.role=field.membershipColumn ? "recorded_feature_identity" : "scientific_metric";
    return true;
  });
}

export function savedExclusionZone(features: SeascapeFeature[], preferred: string): SeascapeFeature | undefined {
  const key=preferred.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
  if (!key.startsWith("exclusion_zones__")) return undefined;
  const target=key.endsWith("__feature_memberships_v1") ? exclusionZoneAssignment : exclusionZoneCount;
  return features.find(field => column(field)===target);
}


const friendlyZoneNames: Readonly<Record<string, string>> = {
  "tc.2026:pender": "Pender Island Vessel Restriction Zone",
  "tc.2026:saturna": "Saturna Island Vessel Restriction Zone",
  "us.cfr33.165.1336:a2": "Lockheed Shipyard Seabed Restriction Area",
  "us.cfr33.165.1329:a1": "Thea Foss Waterway Seabed Restriction Area 1",
  "us.cfr33.165.1329:a2": "Thea Foss Waterway Seabed Restriction Area 2",
  "ca.dnd.notmar35:wg_active": "Nanoose (WG) Exercise Area — When Active",
};

/** Readable headings; canonical keys and original source records remain intact. */
export function exclusionZoneLabel(member: GovernanceMembership): string | undefined {
  if (!/^(ca\.dfo\.closure:|ca\.dnd\.notmar35:|us\.cfr33\.|wa\.wac220(?:302|303):|us\.fws\.access:)/.test(member.feature_id)
      && !/^tc\.2026:(?:pender|saturna)$/.test(member.feature_id)) return undefined;
  if (friendlyZoneNames[member.feature_id]) return friendlyZoneNames[member.feature_id];
  const names = member.records.map(record => record.feature_name?.trim()).filter((name): name is string => Boolean(name));
  return [...new Set(names)].map(name => name.replace(/\bRNA\b/g, "Regulated Navigation Area")).join(" / ") || "Name not supplied";
}
