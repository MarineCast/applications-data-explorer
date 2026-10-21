import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import { viewshedOverlays } from "./viewshedMap";
import type { ViewshedMapProps } from "./viewshedMap";

export const viewshedSourceId = "viewshed-sources";
export const viewshedTargetId = "viewshed-targets";
export const viewshedHitLayers = ["viewshed-source-fill", "viewshed-target-fill"];
const layers = ["viewshed-target-fill", "viewshed-target-outline", "viewshed-source-fill", "viewshed-source-outline", "viewshed-observer-points"];
const empty = { type: "FeatureCollection" as const, features: [] };

/** Install scientific overlay resources on the Features map; never create or move a map. */
export function installViewshedOverlay(map: LibreMap) {
  for (const id of [viewshedTargetId, viewshedSourceId, "viewshed-observers"])
    map.addSource(id, { type: "geojson", data: empty });
  map.addLayer({ id: layers[0], type: "fill", source: viewshedTargetId, layout: { visibility: "none" },
    paint: { "fill-color": ["get", "color"], "fill-opacity": .75 } });
  map.addLayer({ id: layers[1], type: "line", source: viewshedTargetId, layout: { visibility: "none" },
    paint: { "line-color": ["case", ["get", "selected"], "#D68D63", "#ffffff"],
      "line-width": ["case", ["get", "selected"], 3, .65] } });
  map.addLayer({ id: layers[2], type: "fill", source: viewshedSourceId, layout: { visibility: "none" },
    paint: { "fill-color": ["get", "color"], "fill-opacity": .45 } });
  map.addLayer({ id: layers[3], type: "line", source: viewshedSourceId, layout: { visibility: "none" },
    paint: { "line-color": ["case", ["get", "selected"], "#D68D63", "#9e7840"],
      "line-width": ["case", ["get", "selected"], 2.5, .7] } });
  map.addLayer({ id: layers[4], type: "circle", source: "viewshed-observers", layout: { visibility: "none" },
    paint: { "circle-radius": 2.5, "circle-color": "#542f0b", "circle-stroke-color": "white", "circle-stroke-width": .7 } });
}

export function updateViewshedOverlay(map: LibreMap, view?: ViewshedMapProps, smooth = false) {
  // A replacement map/style can exist before its load event installs these resources.
  if (![viewshedTargetId, viewshedSourceId, "viewshed-observers"].every(id => map.getSource(id))) return;
  for (const layer of layers) map.setLayoutProperty(layer, "visibility", view ? "visible" : "none");
  if (!view) return;
  const overlay = viewshedOverlays(view);
  for (const [id, data] of [[viewshedTargetId, overlay.targets], [viewshedSourceId, overlay.sources], ["viewshed-observers", overlay.observers]] as const)
    (map.getSource(id) as GeoJSONSource).setData(data);
  map.setPaintProperty(layers[0], "fill-opacity", smooth && view.mode !== "targetSources"
    ? ["case", ["get", "paired"], 0, view.opacity ?? .75] : view.opacity ?? .75);
  map.setPaintProperty(layers[2], "fill-opacity", view.mode === "targetSources"
    ? ["case", ["get", "paired"], smooth ? 0 : view.opacity ?? .75, .14] : view.mode === "target" ? .22 : .45);
  map.setPaintProperty(layers[1], "line-width", ["case", ["get", "selected"], 3, smooth || view.gridVisible === false ? 0 : .65]);
  map.setPaintProperty(layers[3], "line-width", ["case", ["get", "selected"], 2.5, smooth || view.gridVisible === false ? 0 : .7]);
}
