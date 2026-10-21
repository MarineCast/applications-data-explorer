import { describe, expect, it } from "vitest";
import { cellToLatLng, gridDisk, latLngToCell } from "h3-js";
import type { Polygon, MultiPolygon } from "geojson";
import { createViewshedScale } from "./viewshedScale";
import { contourSegments, gaussianValues, surfaceColor, surfaceGrid, surfacePixels } from "./smoothSurface";
import type { SurfaceGrid } from "./smoothSurface";
import { createColorScale, missingColor } from "./colorScale";

function grid(values: number[], mask: number[], width: number, sigma = 1): SurfaceGrid {
  return { width, height: values.length / width, values: Float64Array.from(values), mask: Uint8Array.from(mask), sigma,
    coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]] };
}
const scale = createColorScale(new Map([["a", 0], ["b", 100]]), "ocean", "minmax");

describe("data-derived smooth surface", () => {
  it("normalizes by available Gaussian support, preserves zeros and leaves null/outside pixels unfilled", () => {
    const input = grid([0, 0, 100, 0], [1, 2, 1, 0], 4);
    const result = gaussianValues(input);
    const neighbourWeight = Math.exp(-2);
    expect(result[0]).toBeCloseTo(100 * neighbourWeight / (1 + neighbourWeight), 12);
    expect(result[2]).toBeCloseTo(100 / (1 + neighbourWeight), 12);
    expect(Number.isNaN(result[1])).toBe(true);
    expect(Number.isNaN(result[3])).toBe(true);
    const pixels = surfacePixels(input, result, scale);
    expect([...pixels.slice(4, 7)]).toEqual([1, 3, 5].map(offset => parseInt(missingColor.slice(offset, offset + 2), 16)));
    expect(pixels[7]).toBe(255);
    expect(pixels[15]).toBe(0);
    expect(gaussianValues(grid([0, 0], [1, 1], 2))[0]).toBe(0);
  });

  it("keeps a constant field constant at edges and around unavailable pixels", () => {
    const input = grid([7, 0, 0, 7, 7, 0], [1, 2, 0, 1, 1, 0], 3);
    const result = gaussianValues(input);
    input.mask.forEach((mask, i) => { if (mask === 1) expect(result[i]).toBeCloseTo(7, 12); });
    const constant = createColorScale(new Map([["a", 7]]), "ocean", "quantile");
    expect(surfaceColor(7, constant)).toEqual([1, 3, 5].map(offset => parseInt(constant.colors[5].slice(offset, offset + 2), 16)));
  });

  it("rasterizes full native support while keeping an unavailable neighbour distinct from the outside domain", () => {
    const ids = gridDisk(latLngToCell(48.5, -123.5, 6), 1).slice(0, 2);
    const result = surfaceGrid({ ids, values: new Float64Array([0, NaN]), scale, radius: 0.75, contours: false, maxSize: 64 });
    expect(new Set(result.mask)).toEqual(new Set([0, 1, 2]));
    result.mask.forEach((mask, i) => { if (mask === 1) expect(result.values[i]).toBe(0); });
    expect(result.coordinates[0][0]).toBeLessThan(result.coordinates[1][0]);
    expect(result.coordinates[0][1]).toBeGreaterThan(result.coordinates[2][1]);
  });

  it("blends numeric values before coloring and preserves fixed scale anchors", () => {
    const depth = createColorScale(new Map([["a", 0], ["b", 2000]]), "ocean", "depth");
    expect(surfaceColor(50, depth)).toEqual([1, 3, 5].map(offset => parseInt(depth.colors[1].slice(offset, offset + 2), 16)));
    expect(surfaceColor(25, depth)).not.toEqual(surfaceColor(0, depth));
    expect(surfaceColor(1000, depth)).toEqual(surfaceColor(2000, depth));
    const input = grid([-100, 100, 100, -100], [1, 1, 1, 1], 2);
    for (const value of gaussianValues(input)) expect(value).toBeGreaterThanOrEqual(-100);
    for (const value of gaussianValues(input)) expect(value).toBeLessThanOrEqual(100);
  });

  it("retains clipped coastlines, polygon holes, disjoint pieces and unavailable support", () => {
    const ids = gridDisk(latLngToCell(48.5, -123.5, 7), 1).slice(0, 2);
    const [lat, lon] = cellToLatLng(ids[0]), [otherLat, otherLon] = cellToLatLng(ids[1]);
    const ring = (x: number, y: number, size: number) => [[x-size, y-size], [x+size, y-size], [x+size, y+size], [x-size, y+size], [x-size, y-size]];
    const geometries: (Polygon | MultiPolygon)[] = [
      { type: "Polygon", coordinates: [ring(lon, lat, .004), ring(lon, lat, .001)] },
      { type: "MultiPolygon", coordinates: [[ring(otherLon-.003, otherLat, .001)], [ring(otherLon+.003, otherLat, .001)]] },
    ];
    const request = { ids, geometries, values: new Float64Array([0, NaN]), scale, radius: .75, contours: true, maxSize: 256 };
    const result = surfaceGrid(request);
    const y = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2;
    const at = (lon: number, lat: number) => {
      const col = Math.floor((lon-result.coordinates[0][0]) / (result.coordinates[1][0]-result.coordinates[0][0]) * result.width);
      const row = Math.floor((y(lat)-y(result.coordinates[0][1])) / (y(result.coordinates[2][1])-y(result.coordinates[0][1])) * result.height);
      return row * result.width + col;
    };
    expect(result.mask[at(lon, lat)]).toBe(0); // Hole.
    expect(result.mask[at(lon+.0025, lat)]).toBe(1);
    expect(result.values[at(lon+.0025, lat)]).toBe(0);
    expect(result.mask[at(lon+.006, lat)]).toBe(0); // Inside H3, outside clipped water/land.
    expect(result.mask[at(otherLon, otherLat)]).toBe(0); // Between disjoint pieces.
    expect(result.mask[at(otherLon-.003, otherLat)]).toBe(2);
    expect(result.mask[at(otherLon+.003, otherLat)]).toBe(2);
    const values = gaussianValues(result), pixels = surfacePixels(result, values, scale, "#a9b3bb");
    expect(Number.isNaN(values[at(otherLon-.003, otherLat)])).toBe(true);
    expect(pixels[at(lon, lat)*4+3]).toBe(0);
    expect([...pixels.slice(at(otherLon-.003, otherLat)*4, at(otherLon-.003, otherLat)*4+4)]).toEqual([169, 179, 187, 255]);
    expect(() => surfaceGrid({ ...request, geometries: [] })).toThrow("matching clipped support");
  });

  it("applies logarithmic colors after interpolating the original fractional weights", () => {
    const scale = createViewshedScale([{ target_h3: "a", lower: 0, upper: 0, average_viewability: 0, input_unknown_fraction: 0 },
      { target_h3: "b", lower: 1, upper: 1, average_viewability: 1, input_unknown_fraction: 0 }], "lower", "ocean", "log", [0, 1]);
    expect(surfaceColor(.1, scale)).toEqual(surfaceColor(Math.log1p(10), scale.logarithmicScale!));
    expect(surfaceColor(.1, scale)).not.toEqual(surfaceColor(.1, { ...scale, logarithmicScale: undefined }));
  });

  it("places contours on the blended scalar and never draws across a missing/outside sample", () => {
    const input = grid([0, 10, 0, 10], [1, 1, 1, 1], 2);
    expect(contourSegments(input, input.values, 5)).toEqual([[1, 0.5, 1, 1.5]]);
    input.mask[0] = 2;
    expect(contourSegments(input, input.values, 5)).toEqual([]);
    input.mask[0] = 0;
    expect(contourSegments(input, input.values, 5)).toEqual([]);
  });
});
