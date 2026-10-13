import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  colorFor,
  colorFromRange,
  boundaryFor,
  visibleLayerCells,
} from "../data/map";
import { createPortal } from "react-dom";
import type { MapCamera, MapCameraPeer } from "../data/mapCamera";
import type { MapCanvasProps } from "../data/map";
import { colorForScale } from "../data/colorScale";
const MapTilerCanvas = lazy(() => import("./MapTilerCanvas"));
import { Plus, Minus } from "lucide-react";
import { cells, featureById, valueFor } from "../data/demo";
function project(lat: number, lon: number): [number, number] {
  return [((lon + 126.15) / 4.9) * 1400, ((50.35 - lat) / 4.3) * 1000];
}
function points(coords: number[][]) {
  return coords.map(([lat, lon]) => project(lat, lon).join(",")).join(" ");
}
const land: number[][][] = [
  [
    [50.5, -126.3],
    [50.5, -124.75],
    [50.05, -124.75],
    [49.7, -124.15],
    [49.15, -123.85],
    [48.72, -123.28],
    [48.47, -123.31],
    [48.32, -123.66],
    [48.43, -124.22],
    [48.86, -124.74],
    [49.25, -125.18],
    [49.58, -125.55],
    [50, -126.05],
  ],
  [
    [50.5, -124.2],
    [50.5, -121],
    [46, -121],
    [46, -124.15],
    [46.8, -124.09],
    [47.4, -124.35],
    [48.16, -124.64],
    [48.14, -123.63],
    [47.98, -122.84],
    [47.69, -122.57],
    [47.35, -122.7],
    [47.22, -122.36],
    [47.69, -122.27],
    [48.01, -122.27],
    [48.38, -122.62],
    [48.57, -122.39],
    [48.84, -122.76],
    [49.06, -123.12],
    [49.27, -123.23],
    [49.43, -123.51],
    [49.8, -123.99],
  ],
  [
    [48.69, -123.21],
    [48.54, -123.16],
    [48.45, -122.99],
    [48.55, -122.89],
    [48.7, -122.93],
  ],
  [
    [48.63, -122.86],
    [48.52, -122.8],
    [48.48, -122.66],
    [48.65, -122.68],
  ],
];
function localView(camera?: MapCamera) {
  if (!camera) return { zoom: 1, offset: { x: 0, y: 0 } };
  const [x, y] = project(camera.center[1], camera.center[0]);
  return { zoom: 2 ** (camera.zoom - 6.7), offset: { x: 700 - x, y: 500 - y } };
}
function LocalMapCanvas({
  cameraLink,
  overlayHost,
  showControls = true,
  layer,
  colorScale,
  popup,
  feature,
  month,
  region = "all",
  selected,
  onSelect,
  showGrid = true,
  opacity = 0.8,
  markers = [],
}: MapCanvasProps) {
  const [zoom, setZoom] = useState(() => localView(cameraLink?.getCamera()).zoom);
  const [offset, setOffset] = useState(() => localView(cameraLink?.getCamera()).offset);
  const cameraPeer = useRef<MapCameraPeer | null>(null);
  useEffect(() => {
    if (!cameraLink) return;
    const peer: MapCameraPeer = {
      setCamera(camera) {
        const next = localView(camera);
        setZoom(next.zoom);
        setOffset(next.offset);
      },
      finishMove() {},
    };
    cameraPeer.current = peer;
    const disconnect = cameraLink.connect(peer);
    return () => { disconnect(); cameraPeer.current = null; };
  }, [cameraLink]);
  const moveView = (nextZoom: number, nextOffset: { x: number; y: number }, moving = false) => {
    setZoom(nextZoom);
    setOffset(nextOffset);
    if (cameraLink && cameraPeer.current) cameraLink.publish(cameraPeer.current, {
      center: [-126.15 + ((700 - nextOffset.x) / 1400) * 4.9, 50.35 - ((500 - nextOffset.y) / 1000) * 4.3],
      zoom: 6.7 + Math.log2(nextZoom), bearing: 0, pitch: 0,
    }, moving);
  };
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const displayBounds: [number, number, number, number] = [
    -126.15 + ((700 - 700 / zoom - offset.x) / 1400) * 4.9,
    50.35 - ((500 + 500 / zoom - offset.y) / 1000) * 4.3,
    -126.15 + ((700 + 700 / zoom - offset.x) / 1400) * 4.9,
    50.35 - ((500 - 500 / zoom - offset.y) / 1000) * 4.3,
  ];
  const displayCells = layer
    ? visibleLayerCells(layer, displayBounds)
    : cells;
  const overlays = (<>
      {popup && <div className="atlas-map-popup local-popup">{popup}</div>}
      {showControls && <div className="map-tools">
        <button
          aria-label="Zoom in"
          onClick={() => moveView(Math.min(3, zoom + 0.25), offset)}
        >
          <Plus size={17} />
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => moveView(Math.max(0.75, zoom - 0.25), offset)}
        >
          <Minus size={17} />
        </button>
      </div>}
  </>);
  return (
    <div className="map-canvas">
      <svg
        aria-label={
          layer
            ? `Illustrative coastline with native H3 R${layer.resolution} values · ${layer.sourceLabel}`
            : "Illustrative Pacific Northwest map with synthetic H3 values"
        }
        viewBox="0 0 1400 1000"
        preserveAspectRatio="xMidYMid slice"
        onPointerDown={(e) => {
          if (!(e.target as Element).closest(".hex-cell")) {
            setDrag({ x: e.clientX, y: e.clientY });
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (drag) {
            moveView(zoom, {
              x: offset.x + (e.clientX - drag.x) / zoom,
              y: offset.y + (e.clientY - drag.y) / zoom,
            }, true);
            setDrag({ x: e.clientX, y: e.clientY });
          }
        }}
        onPointerUp={() => { setDrag(null); if (drag) moveView(zoom, offset); }}
      >
        <defs>
          <pattern
            id="water-grid"
            width="90"
            height="90"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 90 0 L 0 0 0 90"
              fill="none"
              stroke="#7bacae"
              strokeWidth="0.55"
              opacity=".16"
            />
          </pattern>
          <pattern
            id="terrain"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M-10 60 Q20 5 60 15 M-10 75 Q20 20 60 30"
              fill="none"
              stroke="#a5b8a4"
              strokeWidth=".7"
              opacity=".35"
            />
          </pattern>
        </defs>
        <rect width="1400" height="1000" fill="#e5eff0" />
        <rect width="1400" height="1000" fill="url(#water-grid)" />
        <g
          transform={`translate(700 500) scale(${zoom}) translate(-700 -500) translate(${offset.x} ${offset.y})`}
        >
          {land.map((p, i) => (
            <g key={i}>
              <polygon
                points={points(p)}
                fill="#e7ebdf"
                stroke="#aebfaf"
                strokeWidth="1.3"
              />
              <polygon points={points(p)} fill="url(#terrain)" />
            </g>
          ))}
          <path
            d="M830 314 L1060 314"
            stroke="#b5c1b9"
            strokeDasharray="7 6"
            fill="none"
          />
          {showGrid &&
            displayCells
              .filter((c) => region === "all" || c.zone === region)
              .map((c) => (
                <polygon
                  key={c.id}
                  points={points(boundaryFor(c))}
                  fill={
                    layer
                      ? colorScale
                        ? colorForScale(
                            layer.values.get(c.id) ?? null,
                            colorScale,
                          )
                        : colorFromRange(
                            layer.values.get(c.id) ?? null,
                            layer.range,
                          )
                      : colorFor(valueFor(c, feature, month), feature)
                  }
                  fillOpacity={opacity}
                  stroke={selected === c.id ? "#183f44" : "#ffffff"}
                  strokeWidth={selected === c.id ? 3 : 0.8}
                  className="hex-cell"
                  tabIndex={onSelect ? 0 : undefined}
                  role={onSelect ? "button" : undefined}
                  aria-label={onSelect ? `Inspect cell ${c.id}` : undefined}
                  onClick={() => onSelect?.(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(c);
                    }
                  }}
                >
                  <title>
                    {c.id} ·{" "}
                    {layer?.categories
                      ? (layer.values.get(c.id) == null ? "Unavailable" : layer.categories[layer.values.get(c.id)!])
                      : (layer
                      ? layer.values.get(c.id)
                      : valueFor(c, feature, month)
                    )?.toPrecision(6) ?? "Unavailable"}{" "}
                    {layer?.unit ?? featureById(feature).unit}
                  </title>
                </polygon>
              ))}
          {markers.map((s) => {
            const [x, y] = project(s.cell.lat, s.cell.lon);
            return (
              <circle
                key={s.id}
                cx={x}
                cy={y}
                r="4.5"
                fill="#c7784f"
                stroke="white"
                strokeWidth="1.5"
              >
                <title>
                  {s.id} · synthetic {s.species}
                </title>
              </circle>
            );
          })}
          <g className="map-labels">
            <text
              x="220"
              y="485"
              transform="rotate(-37 220 485)"
              className="land-label"
            >
              VANCOUVER ISLAND
            </text>
            <text x="420" y="720" className="water-label">
              STRAIT OF JUAN DE FUCA
            </text>
            <text x="880" y="170" className="land-label">
              BRITISH COLUMBIA
            </text>
            <text x="1030" y="650" className="land-label">
              WASHINGTON
            </text>
            <text x="580" y="300" className="water-label">
              SALISH SEA
            </text>
            {[
              [49.28, -123.12, "Vancouver"],
              [48.43, -123.37, "Victoria"],
              [48.75, -122.48, "Bellingham"],
              [47.6, -122.33, "Seattle"],
            ].map(([lat, lon, name]) => {
              const [x, y] = project(Number(lat), Number(lon));
              return (
                <g key={name}>
                  <circle cx={x} cy={y} r="3" fill="#5b6c64" />
                  <text x={x + 9} y={y + 4}>
                    {name}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      {overlayHost ? createPortal(overlays, overlayHost) : overlays}
      {!layer && (
        <span className="map-attribution">
          Illustrative coastline · H3 r5 · Synthetic values
        </span>
      )}
    </div>
  );
}

export default function MapCanvas(props: MapCanvasProps) {
  const [failed, setFailed] = useState(false);
  const onUnavailable = useCallback(() => setFailed(true), []);
  const apiKey = import.meta.env.VITE_MAPTILER_KEY?.trim();
  const online = props.basemap === "maptiler" && Boolean(apiKey) && !failed;
  if (online)
    return (
      <Suspense fallback={
        <div className="map-canvas map-wait-state" role="status">
          Loading map…
        </div>
      }>
        <MapTilerCanvas
          {...props}
          apiKey={apiKey!}
          onUnavailable={onUnavailable}
        />
      </Suspense>
    );
  if (props.basemap === "maptiler" && props.layer)
    return (
      <div className="map-canvas map-wait-state" role="alert">
        <div>
          <p>{failed ? "Basemap unavailable." : "Basemap key not configured."}</p>
          <p>
            {failed
              ? "Retry to load the geographic map."
              : "Configure the MapTiler key described in the app README to load the geographic map."}
          </p>
          {failed && <button className="button" onClick={() => setFailed(false)}>Retry basemap</button>}
        </div>
      </div>
    );
  return (
    <div className="map-provider">
      <LocalMapCanvas {...props} />
      {props.basemap === "maptiler" && (
        <span className="basemap-notice" role="status">
          {failed
            ? "Basemap unavailable · local fallback"
            : "Local basemap · MapTiler key not configured"}
        </span>
      )}
    </div>
  );
}
