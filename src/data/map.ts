import type { FeatureCollection, Polygon } from "geojson";
import { cells, featureById, valueFor } from "./demo";
import type { Cell, FeatureId, Region, Sighting } from "./demo";
export interface MapCanvasProps {
  feature: FeatureId;
  month: number;
  region?: Region;
  selected?: string;
  onSelect?: (cell: Cell) => void;
  showGrid?: boolean;
  opacity?: number;
  markers?: Sighting[];
  basemap?: "local" | "maptiler";
}
export function colorFor(v: number | null, feature: FeatureId) {
  if (v === null) return "#d4d8d4";
  const [min, max] = featureById(feature).range;
  const t = Math.min(1, Math.max(0, (v - min) / (max - min)));
  const palette = [
    "#d4eaff",
    "#abd7ff",
    "#75bbfa",
    "#3896ef",
    "#116cd6",
    "#074797",
  ];
  return palette[Math.min(5, Math.floor(t * 6))];
}
export function cellGeoJSON(
  feature: FeatureId,
  month: number,
  region: Region = "all",
): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: cells
      .filter((c) => region === "all" || c.zone === region)
      .map((c) => {
        const coordinates = c.boundary.map(([lat, lon]) => [lon, lat]);
        return {
          type: "Feature",
          id: c.id,
          properties: {
            id: c.id,
            color: colorFor(valueFor(c, feature, month), feature),
          },
          geometry: {
            type: "Polygon",
            coordinates: [[...coordinates, coordinates[0]]],
          },
        };
      }),
  };
}
export function mapTilerStyleURL(key: string, mapId = "outdoor-v4") {
  if (!key.trim()) return null;
  return `https://api.maptiler.com/maps/${encodeURIComponent(mapId)}/style.json?key=${encodeURIComponent(key.trim())}`;
}
