import { exclusionZoneLabel } from "./exclusionZones";
/** Dedicated decoder for Governance membership assets. Scalar SourceValue stays primitive. */
export const governanceRecordFields = [
  "source_dataset_id", "source_feature_id", "feature_name", "feature_type", "authority", "jurisdiction", "region",
  "area_system_id", "area_code", "area_title", "area_hierarchy_level", "parent_area_code",
] as const;
export type GovernanceRecord = { [K in typeof governanceRecordFields[number]]: K extends "source_dataset_id" | "source_feature_id" ? string : string | null } & {
  geometry_part_ids: readonly string[];
};
export interface GovernanceMembership { feature_id: string; records: readonly GovernanceRecord[]; }
export type GovernanceSupport = "observed" | "unknown" | "unavailable" | "not_applicable" | "partial";
export interface MembershipBinding {
  rows: number; group: string; column: string; countColumn: string; statusColumn: string;
}
export interface GovernanceMembershipData extends MembershipBinding {
  cells: readonly (readonly GovernanceMembership[] | null)[];
  counts: readonly (number | null)[];
  statuses: readonly GovernanceSupport[];
}
const states = new Set(["observed", "unknown", "unavailable", "not_applicable", "partial"]);
function invalid(reason: string): never { throw new Error(`Invalid Governance memberships: ${reason}.`); }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function decodeEntry(value: unknown): GovernanceMembership {
  if (!object(value) || !exactKeys(value, ["feature_id", "records"]) || !text(value.feature_id) || !Array.isArray(value.records) || !value.records.length)
    return invalid("feature identity/source records");
  const keys = new Set<string>();
  const records = value.records.map((record: unknown): GovernanceRecord => {
    if (!object(record) || !exactKeys(record, [...governanceRecordFields, "geometry_part_ids"])) return invalid("source record fields");
    if (!text(record.source_dataset_id) || !text(record.source_feature_id)) return invalid("source identity");
    for (const field of governanceRecordFields.slice(2)) if (record[field] !== null && typeof record[field] !== "string") return invalid("categorical value type");
    if (!Array.isArray(record.geometry_part_ids) || !record.geometry_part_ids.length || !record.geometry_part_ids.every(text) ||
      new Set(record.geometry_part_ids).size !== record.geometry_part_ids.length) return invalid("part lineage");
    const key = JSON.stringify(governanceRecordFields.map(field => record[field]));
    if (keys.has(key)) return invalid("duplicate paired source record");
    keys.add(key);
    // Preserve Python producer ordering, including Unicode and nulls; never locale-sort IDs.
    return Object.freeze({ ...record, geometry_part_ids: Object.freeze([...record.geometry_part_ids]) }) as GovernanceRecord;
  });
  return Object.freeze({ feature_id: value.feature_id, records: Object.freeze(records) });
}

export function decodeGovernanceMemberships(payload: unknown, expected: MembershipBinding): GovernanceMembershipData {
  if (!object(payload) || payload.kind !== "governance-memberships" || payload.schemaVersion !== 1) return invalid("unsupported asset contract");
  if (!Number.isSafeInteger(expected.rows) || expected.rows < 0 || !text(expected.group) ||
    expected.column !== `${expected.group}__feature_memberships_v1` || expected.countColumn !== `${expected.group}__recorded_feature_count` ||
    expected.statusColumn !== `${expected.column}_status`) return invalid("expected product binding");
  for (const key of ["rows", "group", "column", "countColumn", "statusColumn"] as const)
    if (payload[key] !== expected[key]) return invalid("asset/native product binding mismatch");
  if (!Array.isArray(payload.dictionary) || !Array.isArray(payload.indices) || !Array.isArray(payload.counts) || !Array.isArray(payload.statuses) ||
    [payload.indices, payload.counts, payload.statuses].some(rows => rows.length !== expected.rows)) return invalid("row alignment");
  const dictionary = payload.dictionary.map(decodeEntry);
  const counts = payload.counts as unknown[];
  const statuses = payload.statuses as unknown[];
  const cells = payload.indices.map((row: unknown, i: number): readonly GovernanceMembership[] | null => {
    const status = statuses[i], count = counts[i];
    if (typeof status !== "string" || !states.has(status)) return invalid("support state");
    if (row === null) {
      if (count !== null || status === "observed") return invalid("null/count support mismatch");
      return null;
    }
    if (!Array.isArray(row) || !Number.isSafeInteger(count) || (count as number) < 0 || count !== row.length ||
      (!row.length && status !== "observed") || !["observed", "partial"].includes(status)) return invalid("membership/count support mismatch");
    const members = row.map((index: unknown) => {
      if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0 || index >= dictionary.length) return invalid("dictionary reference");
      return dictionary[index];
    });
    if (new Set(members.map(member => member.feature_id)).size !== members.length) return invalid("duplicate feature identity");
    return Object.freeze(members);
  });
  return Object.freeze({ ...expected, cells: Object.freeze(cells), counts: Object.freeze([...counts]) as readonly (number | null)[],
    statuses: Object.freeze([...statuses]) as readonly GovernanceSupport[] });
}

function countyOrDistrict(member: GovernanceMembership): boolean {
  return member.records.length > 0 && member.records.every(record =>
    record.feature_type === "county_equivalent_statistical_reference" ||
    record.feature_type === "regional_district_administrative_reference");
}

/** Reference status qualifies a display identity without changing any source/site ID. */
export function conservationReferenceStatus(member: GovernanceMembership): "Proposed" | "Interim" | undefined {
  if (member.feature_id.startsWith("conservation_reference:proposed:")) return "Proposed";
  if (member.feature_id.startsWith("conservation_reference:interim:")) return "Interim";
}

/** Counties/districts display original names; other systems retain qualified codes. */
export function governanceMembershipLabel(member: GovernanceMembership): string {
  const exclusionLabel = exclusionZoneLabel(member);
  if (exclusionLabel !== undefined) return exclusionLabel;
  if (/^(noaa_critical_habitat_(polygon|line)|dfo_aquatic_critical_habitat|eccc_marbled_murrelet_marine_critical_habitat):/.test(member.feature_id)) {
    return [...new Set(member.records.map(record => record.feature_name?.trim() || "Name not supplied"))].join(" / ");
  }
  const referenceStatus = conservationReferenceStatus(member);
  if (referenceStatus) return `${referenceStatus}: ${governanceMembershipLabel({ ...member, feature_id: member.feature_id.replace(/^conservation_reference:(proposed|interim):/, "") })}`;
  if (/^(noaa_mpa_site|cpcad_parent|onms_site|dfo_regulation|dfo_unresolved_record|dfo_aoi_record):/.test(member.feature_id)) {
    const preferred = member.records.find(record => record.source_dataset_id === "noaa_mpa_inventory_2023")
      ?? member.records.find(record => record.source_dataset_id === "eccc_marine_classification")
      ?? member.records[0];
    return preferred.feature_name?.trim() || "Name not supplied";
  }
  if (countyOrDistrict(member)) {
    return [...new Set(member.records.map(record => record.feature_name?.trim() || "Name not supplied"))].join(" / ");
  }
  const labels = member.records.map(record => {
    const system = record.area_system_id ?? record.source_dataset_id;
    const label = record.area_code ?? record.feature_name ?? member.feature_id;
    return `${system}: ${label}`;
  });
  return [...new Set(labels)].join(" / ");
}

/** A categorical adapter for the existing native-cell renderer. All overlaps remain in data. */
export function governanceIdentityView(data: GovernanceMembershipData, cellIds: readonly string[], sourceDataset?: string) {
  if (cellIds.length !== data.rows || new Set(cellIds).size !== cellIds.length || cellIds.some(id => !text(id))) return invalid("cell identity alignment");
  // Stable identity order includes features that occur only in overlapping cells.
  const all = new Map<string, GovernanceMembership>();
  for (const row of data.cells) for (const member of row ?? []) {
    const records = sourceDataset ? member.records.filter(record => record.source_dataset_id === sourceDataset) : member.records;
    if (records.length) {
      const prior = /^(noaa_mpa_site|cpcad_parent|onms_site|dfo_regulation|dfo_aoi_record):/.test(member.feature_id) ? all.get(member.feature_id)?.records ?? [] : [];
      all.set(member.feature_id, { ...member, records: [...prior, ...records.filter(record => !prior.some(old => old.source_feature_id === record.source_feature_id))] });
    }
  }
  const ordered = [...all.keys()].sort();
  const labels = ordered.map(key => governanceMembershipLabel(all.get(key)!));
  const repetitions = new Map<string, number>();
  for (const label of labels) repetitions.set(label, (repetitions.get(label) ?? 0) + 1);
  // Equal regional names remain separate categories by canonical key, without
  // reintroducing source IDs into their display labels.
  const categories = labels.map((label,i) => repetitions.get(label)! > 1 && !countyOrDistrict(all.get(ordered[i])!) ? `${label} · ${ordered[i]}` : label);
  const categoryKeys: string[] = ordered.map(key => `feature:${key}`);
  const categoryIndex = new Map(categoryKeys.map((key, i) => [key, i]));
  const categoryMemberships = new Map<string, readonly number[] | null>();
  const values = new Map<string, number | null>();
  let unknownCells = 0, emptyCells = 0, filteredCells = 0;
  const selectedMemberships = new Map<string, readonly GovernanceMembership[] | null>();
  data.cells.forEach((row, i) => {
    const filtered = row === null ? null : row.flatMap(member => {
      const records = sourceDataset ? member.records.filter(record => record.source_dataset_id === sourceDataset) : member.records;
      return records.length ? [{ ...member, records }] : [];
    });
    selectedMemberships.set(cellIds[i], row);
    categoryMemberships.set(cellIds[i], filtered === null ? null : filtered.map(member => categoryIndex.get(`feature:${member.feature_id}`)!));
    if (filtered === null || !filtered.length) {
      if (row === null) unknownCells++;
      else if (!row.length) emptyCells++;
      else filteredCells++;
      values.set(cellIds[i], null); return;
    }
    const key = filtered.length === 1 ? `feature:${filtered[0].feature_id}` : "multiple-memberships";
    if (!categoryIndex.has(key)) {
      categoryIndex.set(key, categories.length); categoryKeys.push(key);
      categories.push(filtered.length === 1 ? governanceMembershipLabel(filtered[0]) : "Multiple recorded features");
    }
    values.set(cellIds[i], categoryIndex.get(key)!);
  });
  return { kind: "categorical" as const, values, categories, categoryKeys, categoryMemberships, memberships: selectedMemberships,
    legend: { mode: "categorical" as const,
      entries: categories.map((label, i) => ({ key: categoryKeys[i], label, role: categoryKeys[i] === "multiple-memberships" ? "mixed" as const : "feature" as const })),
      support: [
        { key: "unknown", label: "Unknown membership support", cells: unknownCells },
        { key: "empty", label: "No recorded features under verified empty support", cells: emptyCells },
        { key: "filtered", label: "No recorded membership matching the selected source", cells: filteredCells },
      ],
    },
    displayCapabilities: { standardize: false as const, smooth: false as const, continuousScale: false as const },
  };
}
