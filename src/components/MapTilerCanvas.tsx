import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification, GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, Minus } from "lucide-react";
import { cells } from "../data/demo";
import { cellGeoJSON, mapTilerStyleURL } from "../data/map";
import type { MapBounds, MapCanvasProps } from "../data/map";
import type { MapCameraPeer } from "../data/mapCamera";
const center: [number, number] = [-123.5, 48.45];
export default function MapTilerCanvas({
  apiKey,
  onUnavailable,
  ...props
}: MapCanvasProps & { apiKey: string; onUnavailable: () => void }) {
  const nativeLayer = Boolean(props.layer);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(0);
  const [viewport, setViewport] = useState<MapBounds>();
  const [popupPoint, setPopupPoint] = useState<{
    x: number;
    y: number;
    id: string;
    revision: number;
  }>();
  const hasPopup = Boolean(props.popup);
  const sourceCells = useRef(props.layer?.cells ?? cells);
  const select = useRef(props.onSelect);
  useEffect(() => {
    select.current = props.onSelect;
    sourceCells.current = props.layer?.cells ?? cells;
  }, [props.onSelect, props.layer]);
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
    let disposed = false;
    const timer = window.setTimeout(() => {
      if (!disposed && !instance.isStyleLoaded()) onUnavailable();
    }, 15000);
    const updateViewport = () => {
      const b = instance.getBounds();
      setViewport([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    // Demo tests/renderers do not need viewport filtering; native cells do.
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
      instance.on("move", () => publish(true));
      instance.on("moveend", () => publish(false));
    } else if (nativeLayer) instance.on("moveend", updateViewport);
    instance.on("load", () => {
      if (nativeLayer) updateViewport();
      window.clearTimeout(timer);
      instance.addSource("demo-h3", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "id",
      });
      // Append overlays after the basemap. Some styles paint water/terrain
      // after their first symbol layer, which would otherwise hide map values.
      instance.addLayer({
        id: "demo-h3-fill",
        type: "fill",
        source: "demo-h3",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.8 },
      });
      instance.addLayer({
        id: "demo-h3-outline",
        type: "line",
        source: "demo-h3",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#123784",
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
      setReady((revision) => revision + 1);
    });
    instance.on("error", (event) => {
      const status = (event.error as Error & { status?: number }).status;
      if (status === 401 || status === 403 || status === 404) onUnavailable();
    });
    instance.on("click", "demo-h3-fill", (event) => {
      const id = event.features?.[0]?.properties?.id;
      const cell = sourceCells.current.find((c) => c.id === id);
      if (cell) select.current?.(cell);
    });
    instance.on("mouseenter", "demo-h3-fill", () => {
      instance.getCanvas().style.cursor = "pointer";
    });
    instance.on("mouseleave", "demo-h3-fill", () => {
      instance.getCanvas().style.cursor = "";
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer.disconnect();
      disconnectCamera?.();
      instance.remove();
      map.current = null;
    };
  }, [apiKey, onUnavailable, nativeLayer, props.cameraLink]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || (props.layer && !viewport)) return;
    const source = instance.getSource("demo-h3") as GeoJSONSource | undefined;
    if (!source) return; // A replacement style/map may still be loading.
    source.setData(
      cellGeoJSON(
        props.feature,
        props.month,
        props.region,
        props.layer,
        viewport,
        props.colorScale,
      ),
    );
    instance.setPaintProperty(
      "demo-h3-fill",
      "fill-opacity",
      props.opacity ?? 0.8,
    );
    // Fine native cells need thinner outlines at overview scales so their
    // source-value colors remain visible. Selected cells retain a clear border.
    const outlineWidth = (width: number): ExpressionSpecification => [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      3,
      width,
    ];
    instance.setPaintProperty(
      "demo-h3-outline",
      "line-width",
      props.layer?.resolution === 8
        ? [
            "interpolate", ["linear"], ["zoom"],
            6, outlineWidth(0),
            8.5, outlineWidth(0.35),
            10, outlineWidth(0.7),
          ]
        : outlineWidth(0.7),
    );
    for (const layer of ["demo-h3-fill", "demo-h3-outline"])
      instance.setLayoutProperty(
        layer,
        "visibility",
        props.showGrid === false ? "none" : "visible",
      );
    instance.removeFeatureState({ source: "demo-h3" });
    if (props.selected)
      instance.setFeatureState(
        { source: "demo-h3", id: props.selected },
        { selected: true },
      );
  }, [
    ready,
    viewport,
    props.layer,
    props.colorScale,
    props.feature,
    props.month,
    props.region,
    props.opacity,
    props.showGrid,
    props.selected,
  ]);
  useEffect(() => {
    const instance = map.current;
    const cell = props.layer?.cells.find((c) => c.id === props.selected);
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
      if (point)
        setPopupPoint({
          x: Math.max(
            8,
            Math.min(
              point.x + 14,
              (container.current?.clientWidth ?? 260) - 230,
            ),
          ),
          y: Math.max(
            10,
            Math.min(
              point.y - 30,
              (container.current?.clientHeight ?? 700) - 240,
            ),
          ),
          id: cell.id,
          revision: ready,
        });
    };
    const frame = window.requestAnimationFrame(updatePosition);
    instance.on("move", updatePosition);
    instance.on("resize", updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      instance.off?.("move", updatePosition);
      instance.off?.("resize", updatePosition);
    };
  }, [ready, props.layer, props.selected, hasPopup]);
  const overlays = (<>
      {props.popup &&
        popupPoint?.id === props.selected &&
        popupPoint?.revision === ready && (
          <div
            className="atlas-map-popup"
            style={{ left: popupPoint.x, top: popupPoint.y }}
          >
            {props.popup}
          </div>
        )}
      {!props.layer && (
        <label className="map-cell-picker">
          Inspect H3 cell
          <select
            aria-label="Inspect H3 cell"
            value={props.selected ?? ""}
            onChange={(e) => {
              const cell = cells.find((c) => c.id === e.target.value);
              if (cell) props.onSelect?.(cell);
            }}
          >
            <option value="">Select a cell</option>
            {cells
              .filter(
                (c) =>
                  props.region === undefined ||
                  props.region === "all" ||
                  c.zone === props.region,
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id}
                </option>
              ))}
          </select>
        </label>
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
        aria-label={
          props.layer
            ? `MapTiler basemap with native H3 R${props.layer.resolution} layer · ${props.layer.sourceLabel}`
            : "MapTiler Pacific Northwest basemap with synthetic H3 layer"
        }
      />
      {!ready && (
        <span className="basemap-notice" role="status">
          Loading basemap…
        </span>
      )}
      {props.overlayHost ? createPortal(overlays, props.overlayHost) : overlays}
      {!props.layer && (
        <span className="map-source-label">
          MapTiler basemap · Synthetic H3 values
        </span>
      )}
    </div>
  );
}
