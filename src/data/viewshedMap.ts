import type { FeatureCollection, Point, Polygon, MultiPolygon } from "geojson";
import { viewshedColor } from "./viewshedScale";
import type { ColorScale } from "./colorScale";
import type { ViewMetric, ViewPair, ViewScore, ViewshedData } from "./viewshed";
import type { MapCoordinates } from "./mapCoordinates";
import type { SurfaceSettings } from "./smoothSurface";
import type { MapLayer } from "./map";

export type ViewshedSelection = { role: "source" | "target"; id: string };

export interface ViewshedMapProps {
  data: ViewshedData;
  scores: ViewScore[];
  source: string;
  selection: ViewshedSelection | null;
  coordinates: MapCoordinates | null;
  onCoordinates: (coordinates: MapCoordinates | null) => void;
  onBackground: () => void;
  opacity?: number;
  gridVisible?: boolean;
  smoothing?: SurfaceSettings;
  metric: ViewMetric;
  mode: "source" | "target" | "targetSources";
  allTargets?: boolean;
  colorScale?: ColorScale;
  onSource: (id: string) => void;
  onTarget: (id: string) => void;
}

/** The same raw weights as the cell overlay, restricted to their clipped support. */
export function viewshedSurfaceLayer({ data, scores, mode, metric }: Pick<ViewshedMapProps, "data" | "scores" | "mode" | "metric">): MapLayer {
  const reverse = mode === "targetSources";
  const values = new Map(scores.map(score => [reverse ? (score as ViewPair).source_h3 : score.target_h3, score[metric] ?? null]));
  const cells = (reverse ? data.sources : data.targets).filter(cell => values.has(cell.id));
  return { id: `viewshed-${mode}-${metric}`, name: metric, unit: "fraction", range: [0, 1],
    resolution: data.catalog.model.h3_resolution, sourceLabel: data.catalog.snapshot,
    cells: cells.map(cell => ({ id: cell.id, lon: cell.center[0], lat: cell.center[1], boundary: [], zone: "north" })),
    values, surfaceGeometries: new Map(cells.map(cell => [cell.id, cell.geometry])), missingColor: "#a9b3bb" };
}

export function viewshedOverlays({ data, scores, source, selection, metric, mode, colorScale, allTargets }: Pick<ViewshedMapProps, "data" | "scores" | "source" | "selection" | "metric" | "mode" | "colorScale" | "allTargets">) {
  const values = new Map(scores.map(score => [score.target_h3, score]));
  const reverse = mode === "targetSources";
  const sourceValues = new Map((scores as ViewPair[]).map(score => [score.source_h3, score]));
  const targets: FeatureCollection<Polygon | MultiPolygon> = {
    type: "FeatureCollection",
    features: data.targets.filter(cell => allTargets || reverse || values.has(cell.id)).map(cell => ({
      type: "Feature", id: cell.id, geometry: cell.geometry,
      properties: { id: cell.id, role: "target", selected: selection?.role === "target" && cell.id === selection.id,
        paired: !reverse && values.has(cell.id),
        color: reverse || !values.has(cell.id) ? "#cddfe6" : viewshedColor(values.get(cell.id)?.[metric] ?? null, colorScale) },
    })),
  };
  const sources: FeatureCollection<Polygon | MultiPolygon> = {
    type: "FeatureCollection",
    features: data.sources.map(cell => ({
      type: "Feature", id: cell.id, geometry: cell.geometry,
      properties: { id: cell.id, role: "source", selected: selection?.role === "source" && cell.id === selection.id,
        color: reverse && sourceValues.has(cell.id) ? viewshedColor(sourceValues.get(cell.id)![metric] ?? null, colorScale) : selection?.role === "source" && selection.id === cell.id ? "#efb553" : "#d3a864",
        paired: reverse && sourceValues.has(cell.id) },
    })),
  };
  const observers: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: mode === "source" ? (data.sources.find(cell => cell.id === source)?.observers ?? []).map((position, i) => ({
      type: "Feature", id: i, geometry: { type: "Point", coordinates: position }, properties: {},
    })) : [],
  };
  return { targets, sources, observers };
}
