import type { FeatureCollection, Point, Polygon, MultiPolygon } from "geojson";
import { viewshedColor } from "./viewshedScale";
import type { ColorScale } from "./colorScale";
import type { ViewMetric, ViewScore, ViewshedData } from "./viewshed";
import type { MapCoordinates } from "./mapCoordinates";

export type ViewshedSelection = { role: "source" | "target"; id: string };

export interface ViewshedMapProps {
  data: ViewshedData;
  scores: ViewScore[];
  source: string;
  selection: ViewshedSelection | null;
  coordinates: MapCoordinates | null;
  onCoordinates: (coordinates: MapCoordinates | null) => void;
  onBackground: () => void;
  controlsContainer?: HTMLElement | null;
  opacity?: number;
  gridVisible?: boolean;
  metric: ViewMetric;
  mode: "source" | "target";
  colorScale?: ColorScale;
  onSource: (id: string) => void;
  onTarget: (id: string) => void;
}

export const viewshedBasemapStyle =
  import.meta.env.VITE_BASEMAP_STYLE_URL?.trim() ||
  "https://tiles.openfreemap.org/styles/bright";

export function viewshedOverlays({ data, scores, source, selection, metric, mode, colorScale }: Pick<ViewshedMapProps, "data" | "scores" | "source" | "selection" | "metric" | "mode" | "colorScale">) {
  const values = new Map(scores.map(score => [score.target_h3, score]));
  const targets: FeatureCollection<Polygon | MultiPolygon> = {
    type: "FeatureCollection",
    features: data.targets.filter(cell => values.has(cell.id)).map(cell => ({
      type: "Feature", id: cell.id, geometry: cell.geometry,
      properties: { id: cell.id, role: "target", selected: selection?.role === "target" && cell.id === selection.id,
        color: viewshedColor(values.get(cell.id)![metric] ?? null, colorScale) },
    })),
  };
  const sources: FeatureCollection<Polygon | MultiPolygon> = {
    type: "FeatureCollection",
    features: data.sources.map(cell => ({
      type: "Feature", id: cell.id, geometry: cell.geometry,
      properties: { id: cell.id, role: "source", selected: selection?.role === "source" && cell.id === selection.id },
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
