import { describe, it, expect } from "vitest";
import { isValidCell } from "h3-js";
import {
  cells,
  valueFor,
  filterCells,
  summarize,
  pairedValues,
  correlation,
  histogram,
} from "./demo";
describe("deterministic demo contract", () => {
  it("uses unique valid H3 cells and reproducible bounded values", () => {
    expect(new Set(cells.map((c) => c.id)).size).toBe(cells.length);
    expect(cells.every((c) => isValidCell(c.id))).toBe(true);
    for (const c of cells) {
      const value = valueFor(c, "viewability", 4);
      expect(valueFor(c, "viewability", 11)).toBe(value);
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
  it("keeps missingness distinct and summaries scoped to the selected region", () => {
    const north = filterCells("north"),
      south = filterCells("south");
    expect(north.length + south.length).toBe(cells.length);
    expect(north.every((c) => c.zone === "north")).toBe(true);
    const result = summarize(north, "temperature", 0);
    expect(result.available).toBeLessThan(result.count);
    expect(summarize([], "temperature", 0).mean).toBeNull();
  });
  it("excludes missing pairs and uses the requested season", () => {
    const pairs = pairedValues("south", "summer", "temperature", "chlorophyll");
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every((p) => [5, 6, 7].includes(p.month))).toBe(true);
    expect(
      correlation([
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
      ]),
    ).toBeCloseTo(1);
    expect(correlation([{ x: 1, y: 2 }])).toBeNull();
    expect(histogram([0, 1, 2, 3], [0, 3], 3).reduce((a, b) => a + b, 0)).toBe(
      4,
    );
  });
});
