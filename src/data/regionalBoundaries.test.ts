import { expect, it } from "vitest";
import type { SeascapeFeature } from "./seascape";
import { regionalBoundaryFeatures, regionalCountColumn, regionalAssignmentColumn, savedRegionalBoundary } from "./regionalBoundaries";

it("keeps exactly the named count and assignment at each resolution and migrates removed choices", () => {
  const fields = [6, 8].flatMap(resolution => [regionalCountColumn, regionalAssignmentColumn,
    "county_regional_boundaries__recorded_line_union_length_m", regionalCountColumn + "_status", regionalAssignmentColumn + "_status"]
    .map(column => ({ id: "GOVERNANCE__" + column, dataset: "governance", column, resolution,
      membershipColumn: column === regionalAssignmentColumn ? column : undefined }) as SeascapeFeature));
  const other = { id: "other", dataset: "seascape" } as SeascapeFeature;
  const selected = regionalBoundaryFeatures([...fields, other]);
  expect(selected).toHaveLength(5);
  expect(selected.at(-1)).toBe(other);
  for (const resolution of [6, 8]) {
    const candidates = selected.filter(field => field.resolution === resolution);
    expect(candidates.map(field => field.name)).toEqual(["County / District Count", "County / District Assignment"]);
    expect(candidates.every(field => field.family === "Regional Boundaries")).toBe(true);
    expect(savedRegionalBoundary(candidates, "GOVERNANCE__county_regional_boundaries__recorded_point_feature_count_status")?.column).toBe(regionalCountColumn);
  }
});
