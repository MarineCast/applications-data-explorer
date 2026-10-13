import { expect, it } from "vitest";
import { calendarSlices, correlateLayers, summarizeBox } from "./compareInsights";
import type { NativeProduct, SourceValue } from "./seascape";

it("joins exact cell identity, excludes null/unsupported values and retains paired zero", () => {
  const left = new Map<string, SourceValue>([["a", 0], ["b", 1], ["c", 2], ["d", null], ["e", 4], ["f", false]]);
  const right = new Map<string, SourceValue>([["c", 8], ["a", 4], ["b", 6], ["d", 10], ["g", 11], ["f", 12]]);
  const result = correlateLayers(left, right);
  expect(result.pairs.map(p => p.id)).toEqual(["a", "b", "c"]);
  expect(result.pairs[0].x).toBe(0);
  expect(result.excluded).toBe(4);
  expect(result.pearson).toBeCloseTo(1);
  expect(result.spearman).toBeCloseTo(1);
});
it("uses average ranks for ties and reports unavailable correlation for constant or insufficient pairs", () => {
  const x = new Map([["a", 1], ["b", 1], ["c", 3]]), y = new Map([["a", 1], ["b", 3], ["c", 3]]);
  expect(correlateLayers(x, y).spearman).toBeCloseTo(.5);
  expect(correlateLayers(new Map([["a", .1], ["b", .1], ["c", .1]]), y).pearson).toBeNull();
  expect(correlateLayers(new Map([["a", 0]]), y).spearman).toBeNull();
  expect(correlateLayers(new Map(), y).pearson).toBeNull();
  const extreme = correlateLayers(new Map([["a", -1e308], ["b", 0], ["c", 1e308]]), new Map([["a", 1], ["b", 0], ["c", -1]]));
  expect(extreme.pearson).toBeCloseTo(-1);
});
it("calculates empirical box quantiles with original endpoints and missingness", () => {
  expect(summarizeBox([30, null, 0, 20, 10])).toEqual({ count: 4, missing: 1, min: 0, q1: 7.5, median: 15, q3: 22.5, max: 30 });
  expect(summarizeBox([null])).toBeUndefined();
  expect(summarizeBox([0, 0])?.median).toBe(0);
  expect(summarizeBox([-1e308, 1e308])?.q1).toBe(-5e307);
});
it("distinguishes calendar years from bearings and preserves recorded gaps", () => {
  const slices = { "1992": { label: "1992 survey" } as NativeProduct, "1990": {} as NativeProduct };
  const calendar = calendarSlices({ axis: "Survey year", defaultSlice: "1992", slices });
  expect(calendar?.grain).toBe("year");
  expect(calendar?.entries.map(e => e.key)).toEqual(["1990", "1992"]);
  expect(calendar?.entries[1].time).toBe(Date.parse("1992-01-01T00:00:00Z"));
  expect(calendarSlices({ axis: "Bearing", defaultSlice: "1992", slices })).toBeUndefined();
  expect(calendarSlices({ axis: "Year", defaultSlice: "unknown", slices: { unknown: {} as NativeProduct } })).toBeUndefined();
  expect(calendarSlices({ axis: "Date", defaultSlice: "2024-02-30", slices: { "2024-02-30": {} as NativeProduct } })).toBeUndefined();
});
