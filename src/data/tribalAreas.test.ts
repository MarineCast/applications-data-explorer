import { expect, it } from "vitest";
import { tribalAreaFeatures, tribalAreaColumn, tribalAssignmentColumn } from "./tribalAreas";
import type { SeascapeFeature } from "./seascape";
it("keeps exactly two combined map choices and excludes component/support fields at both resolutions", () => {
  const columns = [tribalAreaColumn, tribalAssignmentColumn, "tribal_first_nations_areas__bia_land_area_reference__recorded_feature_count", "tribal_first_nations_areas__nrcan_indian_reserve_reference__feature_memberships_v1", tribalAreaColumn + "_status"];
  const fields = [6, 8].flatMap(resolution => columns.map(column => ({id:"GOVERNANCE__"+column, column, resolution, dataset:"governance"}) as SeascapeFeature));
  const other = { id:"other", column:"ports__recorded_feature_count", dataset:"governance" } as SeascapeFeature;
  const result = tribalAreaFeatures([...fields, other]);
  expect(result).toHaveLength(5);
  for (const resolution of [6,8]) expect(result.filter(f => f.resolution === resolution).map(f => f.name)).toEqual(["Tribal / First Nations Area", "Tribal / First Nations Assignment"]);
  expect(result.at(-1)).toBe(other);
});
