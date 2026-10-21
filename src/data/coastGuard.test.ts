import { expect, it } from "vitest";
import type { SeascapeFeature } from "./seascape";
import { coastGuardAssignmentColumn, coastGuardFeatures, savedCoastGuard } from "./coastGuard";
import { governanceIdentityView, type GovernanceRecord } from "./governanceMemberships";

it.each([6, 8] as const)("keeps one combined Coast Guard feature and restores component selections at R%s", resolution => {
  for (const prefix of ["GOVERNANCE__", "GOVERNANCE__dynamic__"]) {
    const columns = [coastGuardAssignmentColumn, "coast_guard_sectors__ccg_administrative_region__feature_memberships_v1",
      "coast_guard_sectors__uscg_sector__feature_memberships_v1", "coast_guard_sectors__uscg_sector__recorded_feature_count"];
    const fields = columns.map(column => ({id: prefix + column, column, dataset: "governance", resolution,
      membershipColumn: column.endsWith("__feature_memberships_v1") ? column : undefined}) as SeascapeFeature);
    const other = {id: "other", dataset: "seascape"} as SeascapeFeature;
    const selected = coastGuardFeatures([...fields, other]);
    expect(selected).toHaveLength(2); expect(selected[1]).toBe(other);
    expect(selected[0].name).toBe("Coast Guard Assignment");
    expect(selected[0].family).toBe("Coast Guard Sectors");
    for (const column of columns) expect(savedCoastGuard(selected, prefix + column)).toBe(selected[0]);
    expect(savedCoastGuard(selected, "GOVERNANCE__ports__count")).toBeUndefined();
  }
});

it("keeps derived Western water support in the same category as the original region", () => {
  const record: GovernanceRecord = { source_dataset_id: "ccg_western_region", source_feature_id: "ccg_western_region:1",
    feature_name: "Western", feature_type: "coast_guard_administrative_reference", authority: null,
    jurisdiction: null, region: null, area_system_id: null, area_code: null, area_title: null,
    area_hierarchy_level: null, parent_area_code: null, geometry_part_ids: ["ccg-part"] };
  const derived: GovernanceRecord = { ...record, source_dataset_id: "seascape_territorial_water_support",
    source_feature_id: "seascape_territorial_water_support:CAN:01", feature_type: "derived_ccg_region_model_water_assignment",
    area_system_id: "ccg_western_region", geometry_part_ids: ["water-part"] };
  const view = governanceIdentityView({ rows: 2, group: "coast_guard_sectors", column: coastGuardAssignmentColumn,
    countColumn: "coast_guard_sectors__recorded_feature_count", statusColumn: coastGuardAssignmentColumn + "_status",
    cells: [record, derived].map(r => [{feature_id: "ccg_western_region:1", records: [r]}]),
    counts: [1,1], statuses: ["partial","partial"] }, ["original", "water"]);
  expect(view.categories).toEqual(["ccg_western_region: Western"]);
  expect([...view.values.values()]).toEqual([0,0]);
  expect(view.memberships.get("water")?.[0].records[0]).toBe(derived);
});
