import { expect, it } from "vitest";
import { summarizeInsights } from "./insights";

it("counts every numeric cell once, preserving zero, nulls, endpoints and signed units", () => {
  const summary = summarizeInsights([-10, 0, 10, 20, null]);
  expect(summary).toMatchObject({ total: 5, count: 4, missing: 1, min: -10, max: 20, mean: 5, median: 5 });
  expect(summary.histogram.reduce((sum, bin) => sum + bin.count, 0)).toBe(4);
  expect(summary.distribution.reduce((sum, bin) => sum + bin.count, 0)).toBe(4);
  expect(summary.histogram[0].count).toBe(1);
  expect(summary.histogram.at(-1)?.count).toBe(1);
});
it("handles constant, unavailable and empty support without fabricated distributions", () => {
  expect(summarizeInsights([0, 0, null])).toMatchObject({ count: 2, missing: 1, min: 0, max: 0, mean: 0, median: 0,
    histogram: [{ min: 0, max: 0, count: 2 }], distribution: [{ min: 0, max: 0, count: 2 }] });
  expect(summarizeInsights([null, NaN, Infinity])).toMatchObject({ count: 0, missing: 3, mean: null, median: null, histogram: [] });
  expect(summarizeInsights([])).toMatchObject({ total: 0, count: 0, missing: 0 });
});
it("retains category identity and boolean false without computing numeric means", () => {
  const summary = summarizeInsights([false, false, true, "false", null], true);
  expect(summary).toMatchObject({ total: 5, count: 4, missing: 1, mean: null, median: null, histogram: [] });
  expect(summary.categories).toEqual([{ value: false, count: 2 }, { value: true, count: 1 }, { value: "false", count: 1 }]);
});
it("keeps means, medians and bin counts finite across extreme source values", () => {
  const summary = summarizeInsights([-1e308, 0, 1e308, null]);
  expect(summary.mean).toBe(0);
  expect(summary.median).toBe(0);
  expect(summary.histogram.reduce((sum, bin) => sum + bin.count, 0)).toBe(3);
  expect(summary.histogram.every(bin => Number.isFinite(bin.min) && Number.isFinite(bin.max))).toBe(true);
  expect(summarizeInsights([1e308, 1e308]).median).toBe(1e308);
});
