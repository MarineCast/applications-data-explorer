import WarningNotice from "./WarningNotice";
import {installHumanGeometry,updateHumanGeometry,pickHumanGeometry,humanHitLayers} from "../data/humanGeometryOverlay";
import { installHydrologyOverlay, updateHydrologyOverlay, pickHydrologyPoint, hydrologyPointLayer } from "../data/hydrologyOverlay";
import { useAppTheme } from '../theme/appTheme';
import { applyBasemapTheme } from '../data/basemapTheme';
import { installOrcaOverlay, updateOrcaOverlay, pickOrcaPoint } from "../data/orcaOverlay";
import { membershipStyles, stripeImage } from "../data/governancePatterns";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { ExpressionSpecification, GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, Minus } from "lucide-react";
import { getResolution, latLngToCell } from "h3-js";
import { cellGeoJSON, mapTilerStyleURL } from "../data/map";
import type { MapBounds, MapCanvasProps } from "../data/map";
import type { MapCameraPeer } from "../data/mapCamera";
import { installViewshedOverlay, updateViewshedOverlay, viewshedHitLayers, viewshedSourceId, viewshedTargetId } from "../data/viewshedOverlay";
import CoordinatePopup from "./CoordinatePopup";
import type { MapCoordinates } from "../data/mapCoordinates";
import { coordinatePopupPosition } from "../data/mapCoordinates";
import { scaleLabelSize } from "../data/basemapLabels";
import useSmoothSurface from "./useSmoothSurface";
import { viewshedSurfaceLayer } from "../data/viewshedMap";
// Vite hashes the emitted worker; MapLibre's relative default URL is not preserved.
maplibregl.setWorkerUrl(workerUrl);

const center: [number, number] = [-123.5, 48.45];
export default function MapTilerCanvas({
  apiKey,
  onUnavailable,
  ...props
}: MapCanvasProps & { apiKey: string; onUnavailable: () => void }) {
  const [theme] = useAppTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const baseLayers = useRef<ReturnType<LibreMap['getStyle']>['layers']>([]);
  const keyboardHint = useId();
  const [coordinates, setCoordinates] = useState<MapCoordinates | null>(null);
  const coordinatesRef = useRef<MapCoordinates | null>(null);
  const showCoordinates = (value: MapCoordinates | null) => { coordinatesRef.current = value; setCoordinates(value); };
  const [keyboardStatus, setKeyboardStatus] = useState("");
  const human = useRef(props.humanGeometry);
  useEffect(() => { human.current = props.humanGeometry; });
  const hydro = useRef(props.hydrologyPoints);
  useEffect(() => { hydro.current = props.hydrologyPoints; });
  const orca = useRef(props.orcaPoints);
  const hadOrca = useRef(false);
  useEffect(() => { orca.current = props.orcaPoints; });
  const view = useRef(props.viewshed);
  useEffect(() => { view.current = props.viewshed; });
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const membershipImages = useRef(new Set<string>());
  const popupElement = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(0);
  useEffect(() => {
    if (map.current && ready) applyBasemapTheme(map.current, baseLayers.current ?? [], theme);
  }, [theme, ready]);
  const { data: viewData, scores: viewScores, mode: viewMode, metric: viewMetric } = props.viewshed ?? {};
  const viewshedSurface = useMemo(() => viewData && viewScores && viewMode && viewMetric
    ? viewshedSurfaceLayer({ data: viewData, scores: viewScores, mode: viewMode, metric: viewMetric }) : undefined,
  [viewData, viewScores, viewMode, viewMetric]);
  const surface = useSmoothSurface(map, ready, props.viewshed ? viewshedSurface : props.layer,
    props.viewshed ? props.viewshed.colorScale : props.colorScale, props.viewshed ? props.viewshed.smoothing : props.smoothing);
  const [viewport, setViewport] = useState<MapBounds>();
  const [popupPoint, setPopupPoint] = useState<{
    x: number;
    y: number;
    id: string;
    revision: number;
  }>();
  const popupBody = props.humanGeometry?.popup ?? props.popup;
  const popupId = props.humanGeometry?.selected ?? props.selected;
  const hasPopup = Boolean(popupBody);
  const sourceCells = useRef(props.layer?.cells ?? []);
  const select = useRef(props.onSelect);
  const boundsChange = useRef(props.onBoundsChange);
  useEffect(() => {
    select.current = props.onSelect;
    boundsChange.current = props.onBoundsChange;
    sourceCells.current = props.layer?.cells ?? [];
  }, [props.onSelect, props.layer, props.onBoundsChange]);
  useEffect(() => {
    if (!container.current) return;
    let instance: LibreMap;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: mapTilerStyleURL(
          apiKey,
          import.meta.env.VITE_MAPTILER_MAP_ID || "outdoor-v4",
        )!,
        ...(props.cameraLink?.getCamera() ?? { center, zoom: 6.7 }),
        minZoom: 4,
        maxZoom: 13,
        attributionControl: false,
      });
    } catch {
      onUnavailable();
      return;
    }
    map.current = instance;
    const images = membershipImages.current;
    let disposed = false;
    const timer = window.setTimeout(() => {
      if (!disposed && !instance.isStyleLoaded()) onUnavailable();
    }, 15000);
    const updateViewport = () => {
      const b = instance.getBounds();
      setViewport([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      boundsChange.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    let disconnectCamera: (() => void) | undefined;
    if (props.cameraLink) {
      const link = props.cameraLink;
      let following = false;
      const peer: MapCameraPeer = {
        setCamera(camera) {
          following = true;
          try { instance.jumpTo(camera); } finally { following = false; }
        },
        finishMove: updateViewport,
      };
      const publish = (moving: boolean) => {
        if (following) return;
        const c = instance.getCenter();
        link.publish(peer, { center: [c.lng, c.lat], zoom: instance.getZoom(),
          bearing: instance.getBearing(), pitch: instance.getPitch() }, moving);
      };
      disconnectCamera = link.connect(peer);
      instance.on("move", () => { publish(true); placeCoordinates(); });
      instance.on("moveend", () => { publish(false); placeCoordinates(); });
    } else instance.on("moveend", () => { updateViewport(); placeCoordinates(); });
    instance.on("load", () => {
      updateViewport();
      window.clearTimeout(timer);
      instance.addSource("native-h3", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "id",
      });
      // MarineCast coastal palette; scientific overlay colors remain independent.
      const basemapLayers = instance.getStyle().layers ?? [];
      baseLayers.current = basemapLayers;
      for (const layer of basemapLayers) {
        if (layer.type === "background") instance.setPaintProperty(layer.id, "background-color", "#E9EBE4");
        if (layer.type === "hillshade") instance.setPaintProperty(layer.id, "hillshade-exaggeration", 0.06);
        // Some provider styles bake relief into raster layers rather than hillshade layers.
        if (layer.type === "raster" && /hill|shade|terrain|relief/i.test(`${layer.id} ${layer.source}`)) {
          const opacity = layer.paint?.["raster-opacity"];
          instance.setPaintProperty(layer.id, "raster-opacity", typeof opacity === "number" ? opacity * 0.5 : 0.15);
          instance.setPaintProperty(layer.id, "raster-saturation", -0.7);
          instance.setPaintProperty(layer.id, "raster-contrast", -0.3);
        }
        if (layer.type === "fill") {
          if (/water|ocean/i.test(layer.id)) {
            instance.setPaintProperty(layer.id, "fill-color", "#DCE9EA");
            instance.setPaintProperty(layer.id, "fill-outline-color", "#829C98");
          } else if (/glacier|snow|ice/i.test(layer.id)) {
            instance.setPaintProperty(layer.id, "fill-color", "#E3E6DD");
            instance.setPaintProperty(layer.id, "fill-opacity", 1);
          } else if (/forest|wood/i.test(layer.id)) {
            instance.setPaintProperty(layer.id, "fill-color", "#D8DED2");
            instance.setPaintProperty(layer.id, "fill-opacity", 1);
          } else if (/landcover|landuse|park|grass|scrub/i.test(layer.id)) {
            instance.setPaintProperty(layer.id, "fill-color", ["match", ["get", "class"],
              ["wood", "forest"], "#D8DED2", "#E9EBE4"]);
            instance.setPaintProperty(layer.id, "fill-opacity", 1);
          }
        }
        if (layer.type === "line" && /road|transportation|bridge|tunnel|path|track|trail/i.test(layer.id)) {
          // Keep regional maps quiet; local streets reappear as the user zooms in.
          const majorRoad: ExpressionSpecification = ["match", ["get", "class"], ["motorway", "trunk", "primary"], 0.3, 0];
          instance.setPaintProperty(layer.id, "line-opacity", ["interpolate", ["linear"], ["zoom"],
            8, majorRoad, 10, ["match", ["get", "class"], ["motorway", "trunk", "primary"], 0.4, 0.12], 13, 0.55]);
        }
        if (layer.type === "line" && /contour/i.test(layer.id)) {
          instance.setPaintProperty(layer.id, "line-opacity", ["interpolate", ["linear"], ["zoom"], 9, 0, 12, 0.18]);
        }
        if (layer.type === "line" && /coast|water.*(line|outline)|shore/i.test(layer.id)) {
          instance.setPaintProperty(layer.id, "line-color", "#829C98");
          instance.setPaintProperty(layer.id, "line-width", 0.65);
        }
        if (layer.type === "symbol") {
          instance.setLayoutProperty(layer.id, "text-size", scaleLabelSize(layer.layout?.["text-size"]));
          instance.setPaintProperty(layer.id, "text-color", "#456273");
          instance.setPaintProperty(layer.id, "text-halo-color", "#E9EBE4");
          instance.setPaintProperty(layer.id, "text-halo-width", 0.65);
          instance.setPaintProperty(layer.id, "text-halo-blur", 0.25);
          if (/place|settlement|city|town|village|hamlet/i.test(`${layer.id} ${layer["source-layer"]}`)) {
            const regionalVisibility: ExpressionSpecification = ["match", ["get", "class"],
              ["town", "village", "hamlet", "suburb", "neighbourhood", "quarter"], 0,
              /town|village|hamlet|suburb|neighb/i.test(layer.id) ? 0 : 1];
            instance.setPaintProperty(layer.id, "text-opacity", ["interpolate", ["linear"], ["zoom"],
              7.5, regionalVisibility, 9, 1]);
            instance.setPaintProperty(layer.id, "icon-opacity", ["interpolate", ["linear"], ["zoom"],
              7.5, regionalVisibility, 9, 1]);
          }
          if (/poi|village|hamlet|peak|road.*label/i.test(layer.id))
            instance.setLayoutProperty(layer.id, "visibility", "none");
        }
      }
      applyBasemapTheme(instance, basemapLayers, themeRef.current);
      // Paint data above all terrain/water, then restore labels above the data.
      instance.addLayer({
        id: "native-h3-fill",
        type: "fill",
        source: "native-h3",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.8 },
      });
      instance.addSource("smooth-surface", { type: "image", coordinates: [[-126, 51], [-121, 51], [-121, 46], [-126, 46]] });
      instance.addLayer({
        id: "smooth-surface",
        type: "raster",
        source: "smooth-surface",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.8, "raster-fade-duration": 0, "raster-resampling": "linear" },
      });
      instance.addLayer({
        id: "native-h3-memberships", type: "fill", source: "native-h3",
        filter: ["!=", ["get", "membershipPattern"], ""],
        paint: { "fill-pattern": ["get", "membershipPattern"], "fill-opacity": 0.8 },
      });
      instance.addLayer({
        id: "native-h3-outline",
        type: "line",
        source: "native-h3",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#D68D63",
            "#ffffff",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            3,
            0.7,
          ],
        },
      });
      installViewshedOverlay(instance);
      installOrcaOverlay(instance);
      installHydrologyOverlay(instance);
      installHumanGeometry(instance);
      for (const layer of basemapLayers) if (layer.type === "symbol") instance.moveLayer(layer.id);
      instance.getCanvas().setAttribute?.("aria-describedby", keyboardHint);
      setReady((revision) => revision + 1);
    });
    instance.on("error", (event) => {
      const status = (event.error as Error & { status?: number }).status;
      if (status === 401 || status === 403 || status === 404) onUnavailable();
    });
    const pickCell = (id?: string) => {
      const cell = sourceCells.current.find((c) => c.id === id);
      if (cell) select.current?.(cell);
    };
    {
      // Geographic H3 picking works for both the native fill and the smooth image,
      // independently of transparent fill hit testing or raster resolution.
      instance.on("click", event => {
        if (human.current) { void pickHumanGeometry(instance, human.current, event.point); return; }
        if (hydro.current) { pickHydrologyPoint(instance, hydro.current, event.point); return; }
        if (orca.current) { void pickOrcaPoint(instance, orca.current, event.point); return; }
        if (view.current) {
          if (event.originalEvent?.button === 2) return;
          const features = instance.queryRenderedFeatures(event.point, { layers: viewshedHitLayers });
          const source = features.find(feature => feature.source === viewshedSourceId);
          const target = features.find(feature => feature.source === viewshedTargetId);
          if (source?.properties?.id) view.current.onSource(String(source.properties.id));
          else if (target?.properties?.id) view.current.onTarget(String(target.properties.id));
          else view.current.onBackground();
          return;
        }
        const first = sourceCells.current[0];
        if (first) {
          const id = latLngToCell(event.lngLat.lat, event.lngLat.lng, getResolution(first.id));
          pickCell(id);
        }
      });
    }
    instance.on("mouseenter", "native-h3-fill", () => {
      instance.getCanvas().style.cursor = "pointer";
    });
    instance.on("mouseleave", "native-h3-fill", () => {
      instance.getCanvas().style.cursor = "";
    });
    const placeCoordinates = () => {
      const coordinates = view.current?.coordinates ?? coordinatesRef.current;
      if (!coordinates || !container.current) return;
      const point = instance.project([coordinates.lon, coordinates.lat]);
      const next = { ...coordinates, ...coordinatePopupPosition(point.x, point.y, container.current.clientWidth, container.current.clientHeight) };
      if (view.current) view.current.onCoordinates(next);
      else showCoordinates(next);
    };
    instance.on("contextmenu", event => {
      if (!container.current) return;
      event.originalEvent.preventDefault();
      const point = instance.project([event.lngLat.lng, event.lngLat.lat]);
      const next = { lat: event.lngLat.lat, lon: event.lngLat.lng,
        ...coordinatePopupPosition(point.x, point.y, container.current.clientWidth, container.current.clientHeight) };
      if (view.current) view.current.onCoordinates(next);
      else showCoordinates(next);
    });
    instance.on("resize", placeCoordinates);
    instance.on("mousemove", event => {
      if (human.current) instance.getCanvas().style.cursor = instance.queryRenderedFeatures(event.point, { layers: humanHitLayers }).length ? "pointer" : "";
      else if (hydro.current) instance.getCanvas().style.cursor = instance.queryRenderedFeatures(event.point, { layers: [hydrologyPointLayer] }).length ? "pointer" : "";
      else if (view.current) instance.getCanvas().style.cursor = instance.queryRenderedFeatures(event.point, { layers: viewshedHitLayers }).length ? "pointer" : "";
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer.disconnect();
      disconnectCamera?.();
      instance.remove();
      images.clear();
      map.current = null;
    };
  }, [apiKey, onUnavailable, props.cameraLink, keyboardHint]);
  useEffect(() => {
    if (ready && map.current) updateHumanGeometry(map.current, props.humanGeometry);
  }, [ready, props.humanGeometry]);
  useEffect(() => {
    if (ready && map.current && (props.orcaPoints || hadOrca.current)) {
      updateOrcaOverlay(map.current, props.orcaPoints);
      hadOrca.current = Boolean(props.orcaPoints);
    }
  }, [ready, props.orcaPoints]);
  useEffect(() => {
    if (ready && map.current) updateHydrologyOverlay(map.current, props.hydrologyPoints);
  }, [ready, props.hydrologyPoints]);
  useEffect(() => {
    if (ready && map.current) updateViewshedOverlay(map.current, props.viewshed, surface.active);
  }, [ready, props.viewshed, surface.active]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || (props.layer && !viewport)) return;
    const source = instance.getSource("native-h3") as GeoJSONSource | undefined;
    if (!source) return; // A replacement style/map may still be loading.
    const patterns = membershipStyles(props.layer, props.colorScale);
    const currentImages = new Set(patterns?.patterns.map(pattern => pattern.id) ?? []);
    for (const pattern of patterns?.patterns ?? []) if (!membershipImages.current.has(pattern.id)) {
      instance.addImage(pattern.id, stripeImage(pattern.colors), { pixelRatio: 2 });
      membershipImages.current.add(pattern.id);
    }
    source.setData(
      props.hydrologyPoints || !props.layer
        ? { type: "FeatureCollection", features: [] }
        : cellGeoJSON(
            props.layer,
            viewport,
            props.colorScale,
          ),
    );
    for (const id of membershipImages.current) if (!currentImages.has(id)) { instance.removeImage(id); membershipImages.current.delete(id); }
  }, [ready, viewport, props.layer, props.colorScale, props.hydrologyPoints]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance?.getSource("native-h3")) return;
    instance.setPaintProperty("native-h3-fill", "fill-opacity", surface.active ? 0 : props.layer?.cellAppearance ? ["*",props.opacity ?? 0.8,["coalesce",["get","opacity"],1]] : props.opacity ?? 0.8);
    instance.setPaintProperty("native-h3-memberships", "fill-opacity", props.opacity ?? 0.8);
    instance.setPaintProperty("smooth-surface", "raster-opacity", props.viewshed?.opacity ?? props.opacity ?? 0.8);
    instance.setLayoutProperty("smooth-surface", "visibility", surface.active && (props.viewshed || props.showGrid !== false) ? "visible" : "none");
    // Fine native cells need thinner outlines at overview scales so their
    // source-value colors remain visible. Selected cells retain a clear border.
    const outlineWidth = (width: number): ExpressionSpecification => [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      3,
      props.outlines === false || surface.active ? 0 : width,
    ];
    instance.setPaintProperty(
      "native-h3-outline",
      "line-width",
      props.layer?.resolution === 8
        ? [
            "interpolate", ["linear"], ["zoom"],
            6, outlineWidth(0),
            8.5, outlineWidth(0.35),
            10, outlineWidth(0.7),
          ]
        : ["interpolate", ["linear"], ["zoom"], 5, outlineWidth(0.06), 9, outlineWidth(0.35), 12, outlineWidth(0.75)],
    );
    instance.setPaintProperty("native-h3-outline", "line-color", ["case", ["boolean", ["feature-state", "selected"], false], "#D68D63", "#315f7c"]);
    instance.setPaintProperty("native-h3-outline", "line-opacity", ["case", ["boolean", ["feature-state", "selected"], false], 1, 0.22]);
    for (const layer of ["native-h3-fill", "native-h3-memberships", "native-h3-outline"])
      instance.setLayoutProperty(
        layer,
        "visibility",
        props.showGrid === false ? "none" : "visible",
      );
  }, [ready, props.layer?.resolution, props.layer?.cellAppearance, props.opacity, props.showGrid, props.outlines, props.viewshed, surface.active]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance?.getSource("native-h3")) return;
    instance.removeFeatureState({ source: "native-h3" });
    if (props.selected) instance.setFeatureState({ source: "native-h3", id: props.selected }, { selected: true });
  }, [ready, props.selected]);
  useEffect(() => {
    const instance = map.current;
    const record = props.humanGeometry?.data.records.find(f => f.properties.record_id === props.humanGeometry?.selected);
    const cell = record ? {id:record.properties.record_id,lon:record.properties.label_point[0],lat:record.properties.label_point[1]} : props.layer?.cells.find((c) => c.id === props.selected);
    if (!instance || !ready || !hasPopup || !cell) return;
    const bounds = instance.getBounds();
    if (
      cell.lon < bounds.getWest() ||
      cell.lon > bounds.getEast() ||
      cell.lat < bounds.getSouth() ||
      cell.lat > bounds.getNorth()
    ) {
      instance.jumpTo({
        center: [cell.lon, cell.lat],
        zoom: instance.getZoom(),
      });
    }
    const updatePosition = () => {
      const point = instance.project?.([cell.lon, cell.lat]);
      const topInset = popupElement.current ? parseFloat(getComputedStyle(popupElement.current).getPropertyValue("--map-popup-top-inset")) || 10 : 10;
      if (point)
        setPopupPoint({
          x: Math.max(
            8,
            Math.min(
              point.x + 14,
              (container.current?.clientWidth || 260) - (popupElement.current?.offsetWidth || 218) - 8,
            ),
          ),
          y: Math.max(
            topInset,
            Math.min(
              point.y - 30,
              (container.current?.clientHeight || 700) - (popupElement.current?.offsetHeight || 230) - 8,
            ),
          ),
          id: cell.id,
          revision: ready,
        });
    };
    const frame = window.requestAnimationFrame(updatePosition);
    instance.on("move", updatePosition);
    instance.on("resize", updatePosition);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updatePosition);
    if (popupElement.current) observer?.observe(popupElement.current);
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      instance.off?.("move", updatePosition);
      instance.off?.("resize", updatePosition);
    };
  }, [ready, props.layer, props.selected, props.humanGeometry, hasPopup, popupPoint?.id]);
  const overlays = (<>
      {popupBody &&
        popupPoint?.id === popupId &&
        popupPoint?.revision === ready && (
          <div
            className="atlas-map-popup" ref={popupElement}
            style={{ left: popupPoint.x, top: popupPoint.y, ...{"--cell-popup-left": `${popupPoint.x}px`, "--cell-popup-top": `${popupPoint.y}px`} }}
          >
            {popupBody}
          </div>
        )}

      {props.showControls !== false && <div className="map-tools">
        <button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}>
          <Plus size={17} />
        </button>
        <button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}>
          <Minus size={17} />
        </button>
      </div>}
  </>);
  return (
    <div className="map-canvas maptiler-canvas">
      <div
        ref={container}
        className="maplibre-container"
        onPointerDown={event => { if (event.button === 0) showCoordinates(null); }}
        onKeyDown={event => {
          if (!map.current || event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.key === "Escape" && human.current) { human.current.onBackground(); return; }
          if (event.key === "Escape" && view.current) { view.current.onBackground(); return; }
          if (event.key !== "Enter") return;
          event.preventDefault();
          const instance = map.current;
          const point = instance.getCenter();
          if (human.current) { void pickHumanGeometry(instance, human.current, instance.project(point)); setKeyboardStatus("Inspecting Human source records at map center."); }
          else if (hydro.current) { pickHydrologyPoint(instance, hydro.current, instance.project(point)); setKeyboardStatus("Inspecting river at map center. River legend buttons also open each gauge."); }
          else if (orca.current) { void pickOrcaPoint(instance, orca.current, instance.project(point)); setKeyboardStatus("Inspecting reports at the map center; zoom in to separate clusters."); }
          else if (view.current) {
            const hits = instance.queryRenderedFeatures(instance.project(point), { layers: viewshedHitLayers });
            const source = hits.find(hit => hit.source === viewshedSourceId);
            const target = hits.find(hit => hit.source === viewshedTargetId);
            if (source?.properties?.id) { view.current.onSource(String(source.properties.id)); setKeyboardStatus("Land cell selected"); }
            else if (target?.properties?.id) { view.current.onTarget(String(target.properties.id)); setKeyboardStatus("Water cell selected"); }
            else { view.current.onBackground(); setKeyboardStatus("No prepared cell at map center. Overview restored."); }
          } else {
            const first = sourceCells.current[0];
            const cell = first && sourceCells.current.find(cell => cell.id === latLngToCell(point.lat, point.lng, getResolution(first.id)));
            if (cell) { select.current?.(cell); setKeyboardStatus(`Selected cell ${cell.id}`); }
            else setKeyboardStatus("No prepared cell at map center. Pan to the mapped area and try again.");
          }
        }}
        aria-label={
          props.humanGeometry ? "Human source locations and classifications · original points, lines and source areas · partial inventory" : props.hydrologyPoints ? "River mouth references and distinct orange measured temperature stations · native source locations" : props.orcaPoints ? "Reported Orca sighting points · clustered source records" : props.viewshed ? "MapTiler basemap with Viewshed weights" : props.layer
            ? `MapTiler basemap with native H3 R${props.layer.resolution} layer · ${props.layer.sourceLabel}`
            : "MapTiler basemap awaiting native layer values"
        }
      />
      {coordinates && !props.viewshed && <CoordinatePopup key={`${coordinates.lat}:${coordinates.lon}`} coordinates={coordinates} onClose={() => { showCoordinates(null); map.current?.getCanvas().focus(); }} />}
      <>
        <span id={keyboardHint} className="sr-only">Use arrow keys to pan the map. Press Enter to inspect the cell at the center. In Viewshed, press Enter again or Escape to return to the overview.</span>
        <span className="map-keyboard-target" aria-hidden="true" />
        <span className="map-keyboard-hint" aria-hidden="true">Arrow keys to pan · Enter to inspect center</span>
        <span className="sr-only" role="status">{keyboardStatus}</span>
      </>
      {surface.error && <WarningNotice title="Smoothing unavailable" message={surface.error} />}
      {surface.pending && !surface.error && <span className="map-smoothing-status" role="status">Blending data…</span>}
      {surface.active && <span className="sr-only" role="status">Smooth surface ready in {Math.round(surface.elapsedMs ?? 0)} ms</span>}
      {!ready && (
        <span className="basemap-notice" role="status">
          Loading basemap…
        </span>
      )}
      {props.overlayHost ? createPortal(overlays, props.overlayHost) : overlays}

    </div>
  );
}
