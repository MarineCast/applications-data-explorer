import { describe, it, expect } from "vitest";
import { isValidCell } from "h3-js";
import {
  cells,
  valueFor,
} from "../test/demoFixture";
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
  it("keeps missingness distinct across the fixture regions", () => {
    const north = cells.filter(c => c.zone === "north"), south = cells.filter(c => c.zone === "south");
    expect(north.length + south.length).toBe(cells.length);
    const values = north.map(c => valueFor(c, "temperature", 0));
    expect(values).toContain(null);
    expect(values.some(value => value !== null)).toBe(true);
  });
});
