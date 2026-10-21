import type { HumanGeometryView } from "./humanGeometry";
import type { HydrologyPoints } from "./hydrologyOverlay";
import type { OrcaPoints } from "./orcaOverlay";
import { membershipStyles } from "./governancePatterns";
import { cellToBoundary } from "h3-js";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { cells, featureById, valueFor } from "./demo";
import type { Cell, FeatureId, Region, Sighting } from "./demo";
import { colorForScale } from "./colorScale";
import type { ColorScale } from "./colorScale";
import type { ReactNode } from "react";
import type { ViewshedMapProps } from "./viewshedMap";
import type { MapCameraLink } from "./mapCamera";
import type { SurfaceSettings } from "./smoothSurface";
export interface MapLayer {
  /** Explicit per-cell support, independent of numeric zero/missing values. */
  cellAppearance?:ReadonlyMap<string,{color?:string;opacity:number;kind:string}>;
  id: string;
  name: string;
  unit: string;
  range: [number, number];
  resolution: number;
  circular?: boolean;
  cells: Cell[];
  values: ReadonlyMap<string, number | null>;
  sourceLabel: string;
  categories?: string[];
  categoryKeys?: string[];
  categoryMemberships?: ReadonlyMap<string, readonly number[] | null>;
  membershipLegend?: { entries: { key: string; label: string; role: "mixed" | "feature" }[]; support: { key: string; label: string; cells: number }[] };
  /** Optional clipped support for display interpolation, keyed by native cell identity. */
  surfaceGeometries?: ReadonlyMap<string, Polygon | MultiPolygon>;
  missingColor?: string;
}
export type MapBounds = [number, number, number, number];
export function boundaryFor(cell: Cell) {
  return cell.boundary.length ? cell.boundary : cellToBoundary(cell.id);
}
export function visibleLayerCells(layer: MapLayer, bounds?: MapBounds) {
  if (!bounds) return layer.cells;
  const padding = layer.resolution === 8 ? 0.015 : 0.12;
  return layer.cells.filter(
    (c) =>
      c.lon >= bounds[0] - padding &&
      c.lon <= bounds[2] + padding &&
      c.lat >= bounds[1] - padding &&
      c.lat <= bounds[3] + padding,
  );
}
export function colorFromRange(v: number | null, range: [number, number]) {
  if (v === null) return "#d4d8d4";
  const [min, max] = range;
  const t =
    max === min ? 0.5 : Math.min(1, Math.max(0, (v - min) / (max - min)));
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
export interface MapCanvasProps {
  humanGeometry?: HumanGeometryView;
  hydrologyPoints?: HydrologyPoints;
  orcaPoints?: OrcaPoints;
  viewshed?: ViewshedMapProps;
  smoothing?: SurfaceSettings;
  outlines?: boolean;
  onBoundsChange?: (bounds: MapBounds) => void;
  cameraLink?: MapCameraLink;
  overlayHost?: HTMLElement | null;
  showControls?: boolean;
  popup?: ReactNode;
  colorScale?: ColorScale;
  /** Keep the native-data map mounted even while its overlay is loading. */
  nativeData?: boolean;
  layer?: MapLayer;
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
  return colorFromRange(v, featureById(feature).range);
}

export function cellGeoJSON(
  feature: FeatureId,
  month: number,
  region: Region = "all",
  layer?: MapLayer,
  bounds?: MapBounds,
  colorScale?: ColorScale,
): FeatureCollection<Polygon> {
  const memberships = membershipStyles(layer, colorScale);
  return {
    type: "FeatureCollection",
    features: (layer ? visibleLayerCells(layer, bounds) : cells)
      .filter((c) => region === "all" || c.zone === region)
      .map((c) => {
        const coordinates = boundaryFor(c).map(([lat, lon]) => [lon, lat]);
        return {
          type: "Feature",
          id: c.id,
          properties: {
            id: c.id,
            membershipPattern: memberships?.cells.get(c.id) ?? "",
            value: layer
              ? (layer.values.get(c.id) ?? null)
              : valueFor(c, feature, month),
            opacity: layer?.cellAppearance?.get(c.id)?.opacity ?? 1,
            support: layer?.cellAppearance?.get(c.id)?.kind ?? "native",
            color: layer?.cellAppearance?.get(c.id)?.color ?? (layer
              ? colorScale
                ? colorForScale(layer.values.get(c.id) ?? null, colorScale)
                : colorFromRange(layer.values.get(c.id) ?? null, layer.range)
              : colorFor(valueFor(c, feature, month), feature)),
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
