import { palettes } from "./colorScale";
import type { PaletteId } from "./colorScale";
import type { FeatureCollection, Point } from "geojson";
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import type { HydrologyData, HydrologyMetricId } from "./hydrology";

// River identity colors are shared by map nodes, histories, and the legend.
const riverColors: Record<string, string> = {
  fraser: "#3686B8", cowichan: "#C87A45", skagit: "#8B72C4",
  snohomish: "#C65D83", nooksack: "#339886", columbia: "#B09A36",
  puyallup: "#5476A8", elwha: "#A86A97", skokomish: "#7E8F43", queets: "#B66A4A",
};
export interface HydrologyAppearance {
  palette: "river" | "custom" | PaletteId;
  colors: Readonly<Record<string, string>>;
  radius: number;
  opacity: number;
}
export const defaultHydrologyAppearance: HydrologyAppearance = { palette: "river", colors: {}, radius: 8, opacity: .88 };
export function hydrologyPaletteColors(data: HydrologyData, palette: "river" | PaletteId) {
  const ids = data.rivers.map(r => r.id).sort();
  return Object.fromEntries(ids.map((id, index) => [id, palette === "river" ? hydrologyRiverColor(id)
    : palettes[palette].colors[Math.round(index * 9 / Math.max(1, ids.length - 1))]]));
}
export function hydrologyRiverColor(id: string, appearance?: HydrologyAppearance) {
  if (appearance?.colors[id]) return appearance.colors[id];
  const palette = ["#3686B8", "#C87A45", "#8B72C4", "#C65D83", "#339886", "#B09A36"];
  return riverColors[id.toLowerCase()] ?? palette[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % palette.length];
}
export interface HydrologyPoints {
  data: HydrologyData; metric: HydrologyMetricId; day: string;
  stationDay?:string; selectedStation?:string; onSelectStation?:(station:string)=>void;
  appearance?: HydrologyAppearance; selected?: string; onSelect: (river: string) => void;
}
export const hydrologyPointSource = "hydrology-river-nodes";
export const hydrologyPointLayer = "hydrology-river-bubbles";
export function hydrologyPointGeoJSON(view?: HydrologyPoints): FeatureCollection<Point> {
  const index = view?.data.dates.indexOf(view.day) ?? -1;
  const nodes = view?.data.rivers.flatMap(river => river.mouths.map(mouth => ({ river, mouth }))) ?? [];
  return { type: "FeatureCollection", features: [...nodes.map(({ river, mouth }, i) => {
    const remaining = nodes.slice(i + 1).filter(n => n.mouth.latitude === mouth.latitude && n.mouth.longitude === mouth.longitude).length;
    return { type: "Feature" as const, id: `${river.id}:${mouth.mouth_id}`, geometry: { type: "Point" as const, coordinates: [mouth.longitude, mouth.latitude] },
      properties: { river: river.id, name: river.name, cell: mouth.cell, color: hydrologyRiverColor(river.id, view?.appearance),
        missing: index < 0 || river.series[view!.metric].values[index] == null,
        value: index < 0 ? null : river.series[view!.metric].values[index],
        selected: view?.selected === river.id, radius: (view?.appearance?.radius ?? 8) + remaining * 4 } };
  }), ...(view?.onSelectStation && view.data.stationTemperature ? Object.values(view.data.stationTemperature.stations).map(station=>{
    const row=view.data.stationTemperature!.rows.find(r=>r.station_id===station.station_id&&r.statistic==="daily_mean"&&r.date===(view.stationDay??view.day));
    return {type:"Feature" as const,id:station.station_id,geometry:{type:"Point" as const,coordinates:[station.longitude,station.latitude]},properties:{station:station.station_id,river:station.river_id,name:station.provider_station_name,color:"#bf6127",missing:!row,value:row?.value??null,selected:view.selectedStation===station.station_id,radius:7}};
  }):[])] };
}
export function installHydrologyOverlay(map: LibreMap) {
  map.addSource(hydrologyPointSource, { type: "geojson", data: hydrologyPointGeoJSON() });
  map.addLayer({ id: hydrologyPointLayer, type: "circle", source: hydrologyPointSource, layout: { visibility: "none" }, paint: {
    "circle-radius": ["+", ["get", "radius"], ["case", ["get", "selected"], 2, 0]],
    "circle-color": ["get", "color"], "circle-opacity": ["case", ["get", "missing"], 0, 0.88],
    "circle-stroke-color": ["get", "color"], "circle-stroke-width": ["case", ["get", "selected"], 4, 2.5],
    "circle-stroke-opacity": 1,
  } });
}
export function updateHydrologyOverlay(map: LibreMap, view?: HydrologyPoints) {
  const source = map.getSource(hydrologyPointSource) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData(hydrologyPointGeoJSON(view));
  map.setPaintProperty(hydrologyPointLayer, "circle-opacity", ["case", ["get", "missing"], 0, view?.appearance?.opacity ?? .88]);
  map.setLayoutProperty(hydrologyPointLayer, "visibility", view ? "visible" : "none");
}
export function pickHydrologyPoint(map: LibreMap, view: HydrologyPoints, point: { x: number; y: number }) {
  const hits = map.queryRenderedFeatures([point.x, point.y], { layers: [hydrologyPointLayer] });
  const hit = hits.find(f => f.properties?.river !== view.selected) ?? hits[0];
  if (typeof hit?.properties?.station === "string") {view.onSelectStation?.(hit.properties.station);return;}
  if (typeof hit?.properties?.river === "string") view.onSelect(hit.properties.river);
}
