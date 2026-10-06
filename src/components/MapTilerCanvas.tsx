import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, Minus, LocateFixed } from "lucide-react";
import { cells } from "../data/demo";
import { cellGeoJSON, mapTilerStyleURL } from "../data/map";
import type { MapCanvasProps } from "../data/map";
const center: [number, number] = [-123.5, 48.45];
export default function MapTilerCanvas({
  apiKey,
  onUnavailable,
  ...props
}: MapCanvasProps & { apiKey: string; onUnavailable: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const select = useRef(props.onSelect);
  useEffect(() => {
    select.current = props.onSelect;
  }, [props.onSelect]);
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
        center,
        zoom: 6.7,
        minZoom: 4,
        maxZoom: 13,
        attributionControl: false,
      });
    } catch {
      onUnavailable();
      return;
    }
    map.current = instance;
    instance.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    let disposed = false;
    const timer = window.setTimeout(() => {
      if (!disposed && !instance.isStyleLoaded()) onUnavailable();
    }, 15000);
    instance.on("load", () => {
      window.clearTimeout(timer);
      instance.addSource("demo-h3", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "id",
      });
      const before = instance
        .getStyle()
        .layers?.find((layer) => layer.type === "symbol")?.id;
      instance.addLayer(
        {
          id: "demo-h3-fill",
          type: "fill",
          source: "demo-h3",
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.8 },
        },
        before,
      );
      instance.addLayer(
        {
          id: "demo-h3-outline",
          type: "line",
          source: "demo-h3",
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              "#ffffff",
              "#ffffff",
            ],
            "line-width": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              3,
              0.7,
            ],
          },
        },
        before,
      );
      setReady(true);
    });
    instance.on("error", (event) => {
      const status = (event.error as Error & { status?: number }).status;
      if (status === 401 || status === 403 || status === 404) onUnavailable();
    });
    instance.on("click", "demo-h3-fill", (event) => {
      const id = event.features?.[0]?.properties?.id;
      const cell = cells.find((c) => c.id === id);
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
      instance.remove();
      map.current = null;
    };
  }, [apiKey, onUnavailable]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    (instance.getSource("demo-h3") as GeoJSONSource).setData(
      cellGeoJSON(props.feature, props.month, props.region),
    );
    instance.setPaintProperty(
      "demo-h3-fill",
      "fill-opacity",
      props.opacity ?? 0.8,
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
    props.feature,
    props.month,
    props.region,
    props.opacity,
    props.showGrid,
    props.selected,
  ]);
  return (
    <div className="map-canvas maptiler-canvas">
      <div
        ref={container}
        className="maplibre-container"
        aria-label="MapTiler Pacific Northwest basemap with synthetic H3 layer"
      />
      {!ready && (
        <span className="basemap-notice" role="status">
          Loading basemap…
        </span>
      )}
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
      <div className="map-tools">
        <button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}>
          <Plus size={17} />
        </button>
        <button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}>
          <Minus size={17} />
        </button>
        <button
          aria-label="Reset map view"
          onClick={() =>
            map.current?.jumpTo({ center, zoom: 6.7, bearing: 0, pitch: 0 })
          }
        >
          <LocateFixed size={17} />
        </button>
      </div>
      <span className="map-source-label">
        MapTiler basemap · Synthetic H3 values
      </span>
    </div>
  );
}
