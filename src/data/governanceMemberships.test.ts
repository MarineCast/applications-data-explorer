import { describe, expect, it } from "vitest";
import fixture from "./governanceMemberships.fixture.json";
import { decodeGovernanceMemberships, governanceIdentityView, governanceMembershipLabel } from "./governanceMemberships";

const binding = { rows: fixture.rows, group: fixture.group, column: fixture.column, countColumn: fixture.countColumn, statusColumn: fixture.statusColumn };
const fresh = () => structuredClone(fixture);

describe("Governance membership assets", () => {
  it("decodes the Python-exported golden fixture without altering order, overlap, labels or codes", () => {
    const result = decodeGovernanceMemberships(fixture, binding);
    expect(result.cells[0]?.map(m => m.feature_id)).toEqual(["dfo:21-0", "wdfw:7"]);
    expect(result.cells[0]?.[0].records[0].area_code).toBe("21-0");
    expect(result.cells[0]?.[0].records[0].feature_name).toBeNull();
    expect(result.cells[0]?.[1].records[0].geometry_part_ids).toEqual(["part-a", "part-b"]);
    expect(result.cells[0]?.[1].records[0].region).toBeNull();
    expect(result.cells[1]).toBeNull();
    expect(result.cells[2]).toEqual([]);
    expect(result.counts).toEqual([2, null, 0, 1]);
    expect(result.statuses).toEqual(["partial", "unknown", "observed", "partial"]);
    expect(Object.isFrozen(result.cells[0])).toBe(true);
  });
  it("preserves multiple source records for one canonical feature without inflating count", () => {
    const payload = fresh();
    (payload.dictionary[1].records as unknown[]).push({ ...payload.dictionary[1].records[0], source_feature_id: "another-record", feature_name: "Alternate source name", geometry_part_ids: ["another-part"] });
    const result = decodeGovernanceMemberships(payload, binding);
    expect(result.cells[3]).toHaveLength(1);
    expect(result.cells[3]?.[0].records).toHaveLength(2);
    expect(result.counts[3]).toBe(1);
  });
  it.each(["version", "binding", "rows", "index", "duplicate-feature", "record", "part", "label", "count", "null", "empty", "support"])("rejects corrupt %s", change => {
    const p = fresh();
    if (change === "version") p.schemaVersion = 2;
    if (change === "binding") p.group = "another-group";
    if (change === "rows") p.indices.pop();
    if (change === "index") p.indices[0] = [99, 1];
    if (change === "duplicate-feature") p.indices[0] = [1, 1];
    if (change === "record") p.dictionary[0].records[0].source_dataset_id = "";
    if (change === "part") p.dictionary[0].records[0].geometry_part_ids = ["part", "part"];
    if (change === "label") Object.assign(p.dictionary[0].records[0], { region: 7 });
    if (change === "count") p.counts[0] = 3;
    if (change === "null") p.counts[1] = 0;
    if (change === "empty") p.statuses[2] = "partial";
    if (change === "support") p.statuses[0] = "unavailable";
    expect(() => decodeGovernanceMemberships(p, binding)).toThrow("Invalid Governance memberships");
  });
  it("builds categorical single/mixed native-cell values without choosing a dominant feature", () => {
    const data = decodeGovernanceMemberships(fixture, binding);
    const view = governanceIdentityView(data, ["a", "b", "c", "d"]);
    expect(view.kind).toBe("categorical");
    expect(view.legend.mode).toBe("categorical");
    expect(view.legend.entries.map(entry => entry.role)).toEqual(["feature", "feature", "mixed"]);
    expect(view.legend.support.map(entry => [entry.key, entry.cells])).toEqual([["unknown", 1], ["empty", 1], ["filtered", 0]]);
    expect(view.displayCapabilities).toEqual({ standardize: false, smooth: false, continuousScale: false });
    expect(view.categories).toEqual(["dfo.marine: 21-0", "wdfw.marine: 7", "Multiple recorded features"]);
    expect([...view.values.values()]).toEqual([2, null, null, 1]);
    expect(view.memberships.get("a")).toHaveLength(2);
    expect(view.memberships.get("b")).toBeNull();
    expect(view.memberships.get("c")).toEqual([]);
    const filtered = governanceIdentityView(data, ["a", "b", "c", "d"], "dfo");
    expect(filtered.categories).toEqual(["dfo.marine: 21-0"]);
    // A display filter never discards underlying overlapping memberships.
    expect(filtered.memberships.get("a")).toHaveLength(2);
    expect(filtered.values.get("d")).toBeNull();
    expect(filtered.legend.support.find(entry => entry.key === "filtered")?.cells).toBe(1);
    expect(governanceMembershipLabel(data.cells[0]![0])).toBe("dfo.marine: 21-0");
    expect(() => governanceIdentityView(data, ["a", "a", "b", "c"])).toThrow("cell identity");
  });
});

it("disambiguates identical source labels with canonical identities without inventing names", () => {
  const payload=fresh();
  payload.dictionary[0].records[0]={...payload.dictionary[1].records[0]};
  const data=decodeGovernanceMemberships(payload,binding),view=governanceIdentityView(data,["a","b","c","d"]);
  expect(view.categories[0]).toBe("wdfw.marine: 7 · dfo:21-0");
  expect(view.categories[1]).toBe("wdfw.marine: 7 · wdfw:7");
  expect(data.cells[0]?.[0].records[0].feature_name).toBe("San Juan Islands");
});

it("uses only original county/district names and retains distinct identities, overlaps and source details", () => {
  const payload = fresh();
  Object.assign(payload.dictionary[0].records[0], {source_dataset_id: "bc_abms_regional_districts", feature_type: "regional_district_administrative_reference", feature_name: "Capital Regional District"});
  Object.assign(payload.dictionary[1].records[0], {source_dataset_id: "census_counties_2025", feature_type: "county_equivalent_statistical_reference", feature_name: "San Juan County"});
  const data = decodeGovernanceMemberships(payload, binding);
  const view = governanceIdentityView(data, ["a", "b", "c", "d"]);
  expect(view.categories).toEqual(["Capital Regional District", "San Juan County", "Multiple recorded features"]);
  expect(view.legend.entries.map(entry => entry.label)).toEqual(view.categories);
  expect(view.categoryMemberships.get("a")).toEqual([0, 1]);
  expect(view.memberships.get("a")).toBe(data.cells[0]);
  expect(data.cells[0]?.[0].records[0].source_dataset_id).toBe("bc_abms_regional_districts");
  const keys = view.categoryKeys;
  payload.dictionary[1].records[0].feature_name = "Capital Regional District";
  const duplicate = governanceIdentityView(decodeGovernanceMemberships(payload, binding), ["a", "b", "c", "d"]);
  expect(duplicate.categories.slice(0, 2)).toEqual(["Capital Regional District", "Capital Regional District"]);
  expect(duplicate.categoryKeys).toEqual(keys);
  payload.dictionary[0].records[0].feature_name = null;
  expect(governanceMembershipLabel(decodeGovernanceMemberships(payload, binding).cells[0]![0])).toBe("Name not supplied");
});
