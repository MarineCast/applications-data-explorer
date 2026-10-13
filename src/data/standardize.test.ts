import { describe, expect, it } from "vitest";
import type { MapLayer } from "./map";
import { standardizeLayer } from "./standardize";

function layer(values: (number | null)[]): MapLayer {
  return {
    id: "depth",
    name: "Depth",
    unit: "m",
    resolution: 6,
    range: [0, 10],
    cells: [],
    sourceLabel: "local",
    values: new Map(values.map((value, i) => [String(i), value])),
  };
}

describe("full native layer standardization", () => {
  it("uses population standard deviation and preserves native identity, nulls and original values", () => {
    const original = layer([1, 2, 3, null]);
    const result = standardizeLayer(original);
    expect(result).toMatchObject({ count: 3, mean: 2, unavailable: null });
    expect(result.std).toBeCloseTo(Math.sqrt(2 / 3), 12);
    const values = [...result.layer.values.values()];
    expect(values[0]).toBeCloseTo(-Math.sqrt(1.5), 12);
    expect(values[1]).toBe(0);
    expect(values[2]).toBeCloseTo(Math.sqrt(1.5), 12);
    expect(values[3]).toBeNull();
    expect(result.layer.unit).toBe("z");
    expect(result.layer.cells).toBe(original.cells);
    expect([...result.layer.values.keys()]).toEqual([
      ...original.values.keys(),
    ]);
    expect([...original.values.values()]).toEqual([1, 2, 3, null]);
  });

  it("retains small differences around large offsets", () => {
    const result = standardizeLayer(layer([1e12, 1e12 + 1, 1e12 + 2]));
    expect(result.mean).toBe(1e12 + 1);
    expect(result.std).toBeCloseTo(Math.sqrt(2 / 3), 12);
    expect(result.layer.values.get("0")).toBeCloseTo(-Math.sqrt(1.5), 12);
    expect(result.layer.values.get("2")).toBeCloseTo(Math.sqrt(1.5), 12);
  });

  it.each([1e200, 1e308])(
    "avoids overflowing variance at magnitude %s",
    (magnitude) => {
      const result = standardizeLayer(layer([-magnitude, magnitude]));
      expect(result.mean).toBe(0);
      expect(result.std).toBe(magnitude);
      expect([...result.layer.values.values()]).toEqual([-1, 1]);
      expect(result.unavailable).toBeNull();
    },
  );

  it.each([0, -5])(
    "keeps a constant %s source intact and reports undefined standardization",
    (value) => {
      const original = layer([value, value, null]);
      const result = standardizeLayer(original);
      expect(result).toMatchObject({
        count: 2,
        mean: value,
        std: 0,
        unavailable: "constant",
      });
      expect([...result.layer.values.values()]).toEqual([null, null, null]);
      expect([...original.values.values()]).toEqual([value, value, null]);
    },
  );

  it("reports empty finite support without fabricating zeros", () => {
    for (const values of [[], [null, null], [NaN, Infinity, null]]) {
      const result = standardizeLayer(layer(values));
      expect(result).toMatchObject({
        count: 0,
        mean: null,
        std: null,
        unavailable: "empty",
      });
      expect([...result.layer.values.values()]).toEqual(values.map(() => null));
    }
  });
});
