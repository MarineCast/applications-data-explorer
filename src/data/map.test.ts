import { describe, it, expect } from "vitest";
import { cellGeoJSON, mapTilerStyleURL } from "./map";
import { filterCells } from "./demo";
describe("basemap adapter", () => {
  it("keeps H3 coordinate order and closes every GeoJSON polygon", () => {
    const collection = cellGeoJSON("temperature", 6, "north");
    expect(collection.features.length).toBe(filterCells("north").length);
    for (const feature of collection.features) {
      const ring = feature.geometry.coordinates[0];
      expect(ring[0]).toEqual(ring.at(-1));
      expect(ring[0][0]).toBeLessThan(-120);
      expect(ring[0][1]).toBeGreaterThan(45);
      expect(feature.properties?.color).toMatch(/^#[a-f0-9]{6}$/);
    }
  });
  it("makes no basemap URL without a key and encodes configured values", () => {
    expect(mapTilerStyleURL("  ")).toBeNull();
    expect(mapTilerStyleURL("test/key", "custom map")).toBe(
      "https://api.maptiler.com/maps/custom%20map/style.json?key=test%2Fkey",
    );
    expect(mapTilerStyleURL("test")).toContain("/outdoor-v4/");
  });
});
