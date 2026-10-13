import { describe, expect, it } from "vitest";
import {
  colorForScale,
  createColorScale,
  createCategoryScale,
  missingColor,
  palettes,
} from "./colorScale";
import { cellGeoJSON } from "./map";
import { cells } from "./demo";
const values = (...numbers: (number | null)[]) =>
  new Map(numbers.map((value, i) => [String(i), value]));
describe("full-area map scales", () => {
  it("uses distinct categorical colors and preserves missingness without numeric interpolation", () => {
    const scale = createCategoryScale(values(0, 1, null), ["ridge", "valley"], "viridis");
    expect(scale.categories).toEqual(["ridge", "valley"]);
    expect(colorForScale(0, scale)).toBe(scale.colors[0]);
    expect(colorForScale(1, scale)).toBe(scale.colors[1]);
    expect(colorForScale(null, scale)).toBe(missingColor);
    expect(colorForScale(0.5, scale)).toBe(missingColor);
  });
  it("uses ten distinct colors and equal-width breaks, including zero and the maximum", () => {
    for (const palette of Object.values(palettes))
      expect(new Set(palette.colors).size).toBe(10);
    const scale = createColorScale(values(0, 100, null), "ocean", "equal");
    expect(scale.edges).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(
      Array.from({ length: 10 }, (_, i) => colorForScale(i * 10 + 5, scale)),
    ).toEqual(scale.colors);
    expect(colorForScale(0, scale)).toBe(scale.colors[0]);
    expect(colorForScale(100, scale)).toBe(scale.colors[9]);
    expect(colorForScale(null, scale)).toBe(missingColor);
  });
  it("uses interpolated quantiles rather than equal intervals and keeps ties together", () => {
    const scale = createColorScale(
      values(0, 1, 2, 3, 4, 5, 6, 7, 8, 100, null),
      "viridis",
      "quantile",
    );
    expect(scale.count).toBe(10);
    expect(scale.edges[5]).toBe(4.5);
    expect(scale.edges[9]).toBeCloseTo(17.2);
    expect(colorForScale(4, scale)).toBe(scale.colors[4]);
    const tied = createColorScale(values(0, 0, 0, 0, 100), "ocean", "quantile");
    expect(tied.repeatedQuantiles).toBe(true);
    expect(colorForScale(0, tied)).toBe(tied.colors[0]);
  });
  it("interpolates min/max stops and handles empty and constant products", () => {
    const scale = createColorScale(values(-10, 10), "ocean", "minmax");
    expect(colorForScale(-10, scale)).toBe(scale.colors[0]);
    expect(colorForScale(10, scale)).toBe(scale.colors[9]);
    expect(colorForScale(0, scale)).toBe("#5ba6ed");
    expect(createColorScale(values(null), "ocean", "quantile").count).toBe(0);
    const constant = createColorScale(values(0, 0, null), "warm", "equal");
    expect(colorForScale(0, constant)).toBe(constant.colors[5]);
    expect(colorForScale(null, constant)).toBe(missingColor);
  });
  it("binds GeoJSON colors to the same scale while retaining exact source values", () => {
    const scalar = 7.123456789;
    const source = new Map([
      [cells[0].id, scalar],
      [cells[1].id, null],
    ]);
    const scale = createColorScale(source, "warm", "quantile");
    const layer = {
      id: "depth",
      name: "Depth",
      unit: "m",
      range: [0, 10] as [number, number],
      resolution: 6,
      cells: cells.slice(0, 2),
      values: source,
      sourceLabel: "local",
    };
    const geo = cellGeoJSON("temperature", 0, "all", layer, undefined, scale);
    expect(geo.features[0].properties).toMatchObject({
      value: scalar,
      color: colorForScale(scalar, scale),
    });
    expect(geo.features[1].properties).toMatchObject({
      value: null,
      color: missingColor,
    });
  });
});
