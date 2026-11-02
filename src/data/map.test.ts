import { describe, it, expect } from "vitest";
import { cellGeoJSON, mapTilerStyleURL } from "./map";
import { latLngToCell } from "h3-js";
import type { MapLayer } from "./map";
describe("basemap adapter", () => {
  it("keeps H3 coordinate order and closes every GeoJSON polygon", () => {
    const cells = [48.45, 48.8].map(lat => ({id: latLngToCell(lat, -123.5, 6),lat,lon:-123.5,boundary:[],zone:"north" as const}));
    const layer: MapLayer = {id:"depth",name:"Depth",unit:"m",range:[0,10],resolution:6,cells,values:new Map([[cells[0].id,0],[cells[1].id,null]]),sourceLabel:"native fixture"};
    const collection = cellGeoJSON(layer);
    expect(collection.features.map(f => f.properties?.value)).toEqual([0,null]);
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
