import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import ViewshedZoomControls from "./ViewshedZoomControls";
import { viewshedBasemapStyle, viewshedOverlays } from "../data/viewshedMap";
import type { ViewshedMapProps } from "../data/viewshedMap";
import { coordinatePopupPosition } from "../data/mapCoordinates";

maplibregl.setWorkerUrl(workerUrl);

const TARGETS = "viewshed-targets", SOURCES = "viewshed-sources", OBSERVERS = "viewshed-observers";
const TARGET_FILL = "viewshed-target-fill", SOURCE_FILL = "viewshed-source-fill";

export default function ViewshedBasemap({ onUnavailable, ...props }: ViewshedMapProps & { onUnavailable: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(8);
  const overlays = useMemo(() => viewshedOverlays({ data: props.data, scores: props.scores,
    source: props.source, selection: props.selection, metric: props.metric, mode: props.mode, colorScale: props.colorScale }),
  [props.data, props.scores, props.source, props.selection, props.metric, props.mode, props.colorScale]);
  const latest = useRef({ ...props, overlays });
  useEffect(() => { latest.current = { ...props, overlays }; });
  const bounds = props.data.catalog.bounds;
  useEffect(() => {
    if (!container.current) return;
    const [west, south, east, north] = bounds;
    let instance: LibreMap;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: viewshedBasemapStyle,
        center: [(west + east) / 2, (south + north) / 2],
        zoom: 8, minZoom: 3, maxZoom: 18, attributionControl: false,
        scrollZoom: true, dragPan: true, touchZoomRotate: true,
        doubleClickZoom: true, cooperativeGestures: false, dragRotate: false,
      });
    } catch {
      onUnavailable();
      return;
    }
    map.current = instance;
    instance.touchZoomRotate.disableRotation();
    instance.fitBounds([[west, south], [east, north]], { padding: 45, duration: 0 });
    let disposed = false;
    const timer = window.setTimeout(() => { if (!disposed && !instance.isStyleLoaded()) onUnavailable(); }, 15000);
    instance.on("load", () => {
      if (disposed) return;
      window.clearTimeout(timer);
      const current = latest.current.overlays;
      instance.addSource(TARGETS, { type: "geojson", data: current.targets });
      instance.addSource(SOURCES, { type: "geojson", data: current.sources });
      instance.addSource(OBSERVERS, { type: "geojson", data: current.observers });
      // Keep geographic labels above the scientific polygons.
      const labels = instance.getStyle().layers.find(layer => layer.type === "symbol")?.id;
      instance.addLayer({ id: TARGET_FILL, type: "fill", source: TARGETS,
        paint: { "fill-color": ["get", "color"], "fill-opacity": latest.current.opacity ?? .75 } }, labels);
      instance.addLayer({ id: "viewshed-target-outline", type: "line", source: TARGETS,
        paint: { "line-color": ["case", ["get", "selected"], "#123f62", "#ffffff"],
          "line-width": ["case", ["get", "selected"], 3, latest.current.gridVisible === false ? 0 : .65] } }, labels);
      instance.addLayer({ id: SOURCE_FILL, type: "fill", source: SOURCES,
        paint: { "fill-color": ["case", ["get", "selected"], "#efb553", "#d3a864"],
          "fill-opacity": latest.current.mode === "target" ? .22 : .45 } }, labels);
      instance.addLayer({ id: "viewshed-source-outline", type: "line", source: SOURCES,
        paint: { "line-color": ["case", ["get", "selected"], "#693d0c", "#9e7840"],
          "line-width": ["case", ["get", "selected"], 2.5, latest.current.gridVisible === false ? 0 : .7] } }, labels);
      instance.addLayer({ id: "viewshed-observer-points", type: "circle", source: OBSERVERS,
        paint: { "circle-radius": 2.5, "circle-color": "#542f0b", "circle-stroke-color": "white", "circle-stroke-width": .7 } }, labels);
      setZoom(instance.getZoom());
      setReady(true);
    });
    instance.on("error", () => {
      if (!disposed && !instance.isStyleLoaded()) onUnavailable();
    });
    instance.on("click", event => {
      if (event.originalEvent?.button === 2) return;
      if (!instance.getLayer(SOURCE_FILL)) { latest.current.onBackground(); return; }
      const features = instance.queryRenderedFeatures(event.point, { layers: [SOURCE_FILL, TARGET_FILL] });
      const source = features.find(feature => feature.source === SOURCES);
      const target = features.find(feature => feature.source === TARGETS);
      if (source?.properties?.id) latest.current.onSource(String(source.properties.id));
      else if (target?.properties?.id) latest.current.onTarget(String(target.properties.id));
      else latest.current.onBackground();
    });
    const placeCoordinates = (anchor: { lat: number; lon: number } | null) => {
      if (!anchor || !container.current) return;
      const point = instance.project([anchor.lon, anchor.lat]);
      latest.current.onCoordinates({ ...anchor, ...coordinatePopupPosition(point.x, point.y, container.current.clientWidth, container.current.clientHeight) });
    };
    instance.on("contextmenu", event => {
      event.originalEvent.preventDefault();
      placeCoordinates({ lat: event.lngLat.lat, lon: event.lngLat.lng });
    });
    instance.on("move", () => placeCoordinates(latest.current.coordinates));
    instance.on("resize", () => placeCoordinates(latest.current.coordinates));
    instance.on("mousemove", event => {
      if (instance.getLayer(SOURCE_FILL)) instance.getCanvas().style.cursor =
        instance.queryRenderedFeatures(event.point, { layers: [SOURCE_FILL, TARGET_FILL] }).length ? "pointer" : "";
    });
    instance.on("zoomend", () => setZoom(instance.getZoom()));
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, [bounds, onUnavailable]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || !instance.getLayer(TARGET_FILL)) return;
    (instance.getSource(TARGETS) as GeoJSONSource)?.setData(overlays.targets);
    (instance.getSource(SOURCES) as GeoJSONSource)?.setData(overlays.sources);
    (instance.getSource(OBSERVERS) as GeoJSONSource)?.setData(overlays.observers);
    instance.setPaintProperty(SOURCE_FILL, "fill-opacity", props.mode === "target" ? .22 : .45);
    instance.setPaintProperty(TARGET_FILL, "fill-opacity", props.opacity ?? .75);
    instance.setPaintProperty("viewshed-target-outline", "line-width", ["case", ["get", "selected"], 3, props.gridVisible === false ? 0 : .65]);
    instance.setPaintProperty("viewshed-source-outline", "line-width", ["case", ["get", "selected"], 2.5, props.gridVisible === false ? 0 : .7]);
  }, [ready, overlays, props.mode, props.opacity, props.gridVisible]);
  return <div className="viewshed-map viewshed-basemap">
    <div ref={container} className="viewshed-basemap-container" aria-label="Interactive viewshed basemap" />
    {!ready && <p className="viewshed-basemap-status" role="status">Loading basemap…</p>}
    <ViewshedZoomControls container={props.controlsContainer} zoom={zoom} min={3} max={18} onIn={() => map.current?.zoomIn()} onOut={() => map.current?.zoomOut()} />
  </div>;
}
