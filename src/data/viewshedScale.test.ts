import { describe, expect, it } from "vitest";
import { createViewshedScale, scalePercent, viewshedColor } from "./viewshedScale";
import type { ViewScore } from "./viewshed";
import { viewshedOverlays } from "./viewshedMap";
import { pair, sourceA, viewshedFixture } from "../test/viewshedFixture";

function scores(...values: number[]): ViewScore[] {
  return values.map((value, i) => ({ target_h3: String(i), lower: value, upper: value,
    average_viewability: value, input_unknown_fraction: 0 }));
}
describe("viewshed display scales", () => {
  it("reveals small differences using all active scores without changing scores", () => {
    const rows = scores(0, .01, .02);
    const before = JSON.stringify(rows);
    const auto = createViewshedScale(rows, "lower", "viridis", "auto", [0, 1]);
    expect(auto.edges[0]).toBe(0);
    expect(auto.edges[10]).toBe(.02);
    expect(viewshedColor(.02, auto)).toBe(auto.colors[9]);
    expect(viewshedColor(0, auto)).toBe(auto.colors[0]);
    expect(JSON.stringify(rows)).toBe(before);
    const fixed = createViewshedScale(rows, "lower", "viridis", "fixed", [0, .02]);
    expect(fixed.edges[10]).toBe(1);
    expect(viewshedColor(.02, fixed)).not.toBe(viewshedColor(.02, auto));
  });
  it("clips custom colors at endpoints while retaining original values and missingness", () => {
    const rows = [pair()];
    const scale = createViewshedScale(rows, "lower", "warm", "custom", [.1, .2]);
    expect(viewshedColor(.4, scale)).toBe(scale.colors[9]);
    expect(viewshedColor(0, scale)).toBe(scale.colors[0]);
    expect(viewshedColor(null, scale)).toBe("#a9b3bb");
    const overlay = viewshedOverlays({ data: viewshedFixture(), scores: rows, source: sourceA, selection: null, metric: "lower", mode: "source", colorScale: scale });
    expect(overlay.targets.features[0].properties?.color).toBe(scale.colors[9]);
    expect(rows[0].lower).toBe(.4);
    expect(rows[0].average_viewability).toBeNull();
    expect(() => createViewshedScale(rows, "lower", "ocean", "custom", [.2, .1])).toThrow("minimum");
  });
  it("omits unknown complete scores from limits and handles an all-unknown or constant layer", () => {
    const unknown = createViewshedScale([pair()], "average_viewability", "viridis", "auto", [0, 1]);
    expect(unknown.count).toBe(0);
    expect(viewshedColor(null, unknown)).toBe("#a9b3bb");
    const constant = createViewshedScale(scores(.02, .02), "lower", "ocean", "auto", [0, 1]);
    expect(constant.edges[0]).toBe(constant.edges[10]);
    expect(viewshedColor(.02, constant)).toBe(constant.colors[5]);
    expect(scalePercent(.000012345)).toBe("0.00123%");
  });
  it("uses quantiles across all scores, keeps ties together and reports repeated breaks", () => {
    const scale = createViewshedScale(scores(0, 0, 0, .01, .03, .2), "lower", "viridis", "quantile", [0, 1]);
    expect(scale.mode).toBe("quantile");
    expect(scale.edges[5]).toBeCloseTo(.005);
    expect(scale.repeatedQuantiles).toBe(true);
    expect(viewshedColor(0, scale)).toBe(scale.colors[0]);
  });
  it("uses a zero-safe percentage log scale, with raw legend limits and unchanged scores", () => {
    const rows = scores(0, .001, .01, .1, 1);
    const before = JSON.stringify(rows);
    const log = createViewshedScale(rows, "lower", "viridis", "log", [0, 1]);
    const fixed = createViewshedScale(rows, "lower", "viridis", "fixed", [0, 1]);
    expect(log.count).toBe(5);
    expect(log.edges[0]).toBe(0);
    expect(log.edges[10]).toBe(1);
    expect(log.edges[5]).toBeCloseTo((Math.sqrt(101) - 1) / 100, 12);
    expect(log.edges.every((edge, i) => i === 0 || edge > log.edges[i - 1])).toBe(true);
    expect(viewshedColor(0, log)).toBe(log.colors[0]);
    expect(viewshedColor(1, log)).toBe(log.colors[9]);
    expect(viewshedColor(.01, log)).not.toBe(viewshedColor(.01, fixed));
    expect(viewshedColor(null, log)).toBe("#a9b3bb");
    expect(JSON.stringify(rows)).toBe(before);
    const constant = createViewshedScale(scores(.02, .02), "lower", "ocean", "log", [0, 1]);
    expect(constant.edges[0]).toBe(constant.edges[10]);
    expect(viewshedColor(.02, constant)).toBe(constant.colors[5]);
    const unknown = createViewshedScale([pair()], "average_viewability", "ocean", "log", [0, 1]);
    expect(unknown.count).toBe(0);
    expect(viewshedColor(null, unknown)).toBe("#a9b3bb");
  });

});
