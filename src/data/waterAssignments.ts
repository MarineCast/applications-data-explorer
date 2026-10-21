import type { SeascapeFeature } from "./seascape";
import type { GovernanceMembershipData, GovernanceRecord } from "./governanceMemberships";
export const waterFamilies = {
  state_provincial_waters: { name: "State / Province Assignment", labels: ["Washington", "British Columbia", "Oregon"], codes: ["WA", "BC", "OR"] },
  federal_waters: { name: "Country Assignment", labels: ["United States", "Canada", "International"], codes: ["USA", "CAN", "INT"] },
};
export const internationalBoundaryColumn = "federal_waters__international_boundary";
export const internationalBoundaryMembers = internationalBoundaryColumn + "__feature_memberships_v1";
export type WaterFamily = keyof typeof waterFamilies;
export const waterAssignmentColumn = (family: WaterFamily) => `${family}__assignment__feature_memberships_v1`;
export function waterAssignmentFamily(column = ""): WaterFamily | undefined {
  return (Object.keys(waterFamilies) as WaterFamily[]).find(family => column === waterAssignmentColumn(family));
}
export function waterAssignmentFeatures(features: SeascapeFeature[]) {
  return features.filter(field => {
    if (field.dataset !== "governance") return true;
    const column = field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
    if (column.startsWith("international_boundaries__")) return false;
    if (column === internationalBoundaryColumn) {
      field.name = "International Boundary"; field.role = "scientific_metric";
      field.kind = "categorical"; field.categories = [false, true];
      return true;
    }
    const family = (Object.keys(waterFamilies) as WaterFamily[]).find(key => column.startsWith(`${key}__`));
    if (!family) return true;
    if (column !== waterAssignmentColumn(family)) return false;
    field.name = waterFamilies[family].name;
    field.role = "recorded_feature_identity";
    return true;
  });
}
export function normalizeWaterCountry(value: string | null) {
  const key = (value ?? "").trim().toUpperCase().replaceAll("_", " ");
  return ["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(key) ? "USA"
    : ["CA", "CAN", "CANADA"].includes(key) ? "CAN" : undefined;
}
export function waterAssignmentCode(family: WaterFamily, record: GovernanceRecord) {
  const country = normalizeWaterCountry(record.jurisdiction);
  if (family === "federal_waters") {
    if (record.feature_type === "high_seas_polygon") return record.jurisdiction?.trim().toUpperCase() === "INTERNATIONAL" ? "INT" : undefined;
    return ["federal_administrative_water_polygon", "geographic_country_water_polygon"].includes(record.feature_type ?? "") ? country : undefined;
  }
  if (!["state_water_polygon", "provincial_water_polygon", "geographic_state_water_polygon", "geographic_province_water_polygon"].includes(record.feature_type ?? "")) return undefined;
  const region = (record.region ?? "").trim().toUpperCase().replaceAll("_", " ");
  const code = ({ WA:"WA", WASHINGTON:"WA", "US-WA":"WA", OR:"OR", OREGON:"OR", "US-OR":"OR", BC:"BC", "BRITISH COLUMBIA":"BC", "CA-BC":"BC" } as Record<string,string>)[region];
  return (country === "USA" && ["WA", "OR"].includes(code)) || (country === "CAN" && code === "BC") ? code : undefined;
}
export function waterAssignmentView(data: GovernanceMembershipData, cellIds: readonly string[], family: WaterFamily, limitation?: string) {
  if (cellIds.length !== data.rows) throw new Error("Water assignment cell alignment mismatch.");
  const spec = waterFamilies[family];
  const categories = [...spec.labels], categoryKeys = spec.codes.map(code => `water:${family}:${code}`);
  const categoryMemberships = new Map<string, readonly number[] | null>();
  const values = new Map<string, number | null>();
  let unknown = 0, empty = 0;
  data.cells.forEach((row, i) => {
    const codes = [...new Set((row ?? []).flatMap(member => member.records.map(record => waterAssignmentCode(family, record))).filter((code): code is string => !!code))];
    const indices = spec.codes.flatMap((code, index) => codes.includes(code) ? [index] : []);
    const verifiedEmpty = row?.length === 0 && data.statuses[i] === "observed";
    categoryMemberships.set(cellIds[i], indices.length ? indices : verifiedEmpty ? [] : null);
    if (!indices.length) { if (verifiedEmpty) empty++; else unknown++; values.set(cellIds[i], null); return; }
    if (indices.length > 1 && categories.length === 3) { categories.push("Multiple water assignments"); categoryKeys.push("multiple-memberships"); }
    values.set(cellIds[i], indices.length > 1 ? 3 : indices[0]);
  });
  return { values, categories, categoryKeys, categoryMemberships,
    legend: { mode:"categorical" as const, entries:categories.map((label,i)=>({key:categoryKeys[i],label,role:i===3?"mixed" as const:"feature" as const})),
      support:[{key:"unknown",label:limitation ?? "Unknown water assignment support",cells:unknown},
               {key:"empty",label:"No assignment under verified complete support",cells:empty}] } };
}

/** Old saved line/source/status selections keep their family and native resolution. */
export function savedWaterAssignment(candidates: SeascapeFeature[], preferred: string) {
  if (/^GOVERNANCE__(?:dynamic__)?international_boundaries__/.test(preferred)) return candidates.find(field => field.column === internationalBoundaryColumn);
  const family = (Object.keys(waterFamilies) as WaterFamily[]).find(key => new RegExp(`^GOVERNANCE__(?:dynamic__)?${key}__`).test(preferred));
  return family ? candidates.find(field => field.column === waterAssignmentColumn(family)) : undefined;
}

/** Fixed, distinct region colors across resolutions and crossing-cell stripes. */
export const geographicWaterColors = ["#3b82f6", "#14b8a6", "#f59e0b", "#94a3b8"];
