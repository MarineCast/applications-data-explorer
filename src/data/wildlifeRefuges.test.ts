import { expect, it } from "vitest";
import type { SeascapeFeature } from "./seascape";
import { refugePercent, wildlifeRefugeFeatures, wildlifeRefugeNames } from "./wildlifeRefuges";

it("normalizes legacy choices, removes support selectors, and leaves other families intact", () => {
  const field = (column: string) => ({ dataset: "governance", column, id: `GOVERNANCE__${column}`, name: "Old label" } as SeascapeFeature);
  const other = field("ports__recorded_feature_count_status");
  const choices = wildlifeRefugeFeatures([...Object.keys(wildlifeRefugeNames).map(field), field("wildlife_refuges__recorded_line_union_length_m"), field("wildlife_refuges__recorded_feature_count_status"), other]);
  expect(choices.map(f => f.name)).toEqual([...Object.values(wildlifeRefugeNames), "Old label"]);
  expect(choices.at(-1)).toBe(other);
  expect(refugePercent(.425)).toBe("42.5%");
  expect(refugePercent(0)).toBe("0%");
  expect(refugePercent(1)).toBe("100%");
});
