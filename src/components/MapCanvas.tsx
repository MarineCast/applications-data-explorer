import WarningNotice from "./WarningNotice";
import {humanVisibleFeatures,humanRecordName,humanRecordColor} from "../data/humanGeometry";
import type {Geometry} from "geojson";
import { hydrologyPointGeoJSON } from "../data/hydrologyOverlay";
import { useAppTheme } from '../theme/appTheme';
import { basemapPalette } from '../data/basemapTheme';
import { orcaCategoryColors } from "../data/orca";
import { membershipStyles } from "../data/governancePatterns";
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  colorFor,
  colorFromRange,
  boundaryFor,
  visibleLayerCells,
} from "../data/map";
import { createPortal } from "react-dom";
import type { MapCamera, MapCameraPeer } from "../data/mapCamera";
import type { MapCanvasProps } from "../data/map";
import { viewshedOverlays } from "../data/viewshedMap";
import { sourceLabel } from "../data/viewshed";
import type { MultiPolygon, Polygon } from "geojson";
import { colorForScale } from "../data/colorScale";
import { loadGeographicRenderer } from "../data/geographicRenderer";
const MapTilerCanvas = lazy(loadGeographicRenderer);
import { Plus, Minus } from "lucide-react";
import { cells, featureById, valueFor } from "../data/demo";
function project(lat: number, lon: number): [number, number] {
  return [((lon + 126.15) / 4.9) * 1400, ((50.35 - lat) / 4.3) * 1000];
}
function geometryPath(geometry: Polygon | MultiPolygon) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap(polygon => polygon.map(ring => ring.map(([lon, lat], index) =>
    `${index ? "L" : "M"}${project(lat, lon).join(",")}`).join(" ") + "Z")).join(" ");
}
function humanPath(geometry:Geometry):string {
  const line=(coords:number[][])=>coords.map(([lon,lat],i)=>`${i?"L":"M"}${project(lat,lon).join(",")}`).join(" ");
  switch(geometry.type){
    case "LineString":return line(geometry.coordinates);
    case "MultiLineString":return geometry.coordinates.map(line).join(" ");
    case "Polygon":return geometry.coordinates.map(c=>line(c)+"Z").join(" ");
    case "MultiPolygon":return geometry.coordinates.flatMap(p=>p.map(c=>line(c)+"Z")).join(" ");
    case "GeometryCollection":return geometry.geometries.map(humanPath).join(" ");
    default:return "";
  }
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
  humanGeometry,
  hydrologyPoints,
  orcaPoints,
  viewshed,
  cameraLink,
  overlayHost,
  showControls = true,
  nativeData = false,
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
  const [theme] = useAppTheme();
  const basemap = basemapPalette(theme);
  const patternPrefix = useId().replaceAll(":", "");
  const memberships = membershipStyles(layer, colorScale);
  const viewShapes = viewshed ? viewshedOverlays(viewshed) : undefined;
  const moved = useRef(false);
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
    : nativeData ? [] : cells;
  const overlays = (<>
      {(humanGeometry?.popup ?? popup) && <div className="atlas-map-popup local-popup">{humanGeometry?.popup ?? popup}</div>}
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
          humanGeometry ? "Illustrative coastline with original Human source geometry" : layer
            ? `Illustrative coastline with native H3 R${layer.resolution} values · ${layer.sourceLabel}`
            : nativeData ? "Illustrative coastline awaiting native layer values"
              : "Illustrative Pacific Northwest map with synthetic H3 values"
        }
        viewBox="0 0 1400 1000"
        preserveAspectRatio="xMidYMid slice"
        onClick={event => {
          if (!moved.current && !(event.target as Element).closest(".hex-cell,[data-human-record],[data-orca-point],[data-viewshed-role]")) { viewshed?.onBackground(); humanGeometry?.onBackground(); }
        }}
        onPointerDown={(e) => {
          moved.current = false;
          if (!(e.target as Element).closest(".hex-cell,[data-human-record],[data-orca-point],[data-viewshed-role]")) {
            setDrag({ x: e.clientX, y: e.clientY });
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (drag) {
            if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 2) moved.current = true;
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
          {memberships?.patterns.map(pattern => <pattern key={pattern.id} id={`${patternPrefix}-${pattern.id}`} patternUnits="userSpaceOnUse" width="16" height="16" patternTransform="rotate(45)">
            {pattern.colors.map((color,i) => <rect key={i} x={i*16/pattern.colors.length} y="0" width={16/pattern.colors.length+.05} height="16" fill={color} />)}
          </pattern>)}
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
              stroke={basemap.forest}
              strokeWidth=".7"
              opacity=".35"
            />
          </pattern>
        </defs>
        <rect width="1400" height="1000" fill={basemap.ocean} />
        <rect width="1400" height="1000" fill="url(#water-grid)" />
        <g
          transform={`translate(700 500) scale(${zoom}) translate(-700 -500) translate(${offset.x} ${offset.y})`}
        >
          {land.map((p, i) => (
            <g key={i}>
              <polygon
                points={points(p)}
                fill={basemap.land}
                stroke={basemap.coast}
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
                    layer?.cellAppearance?.get(c.id)?.color ?? (memberships?.cells.has(c.id) ? `url(#${patternPrefix}-${memberships.cells.get(c.id)})` : layer
                      ? colorScale
                        ? colorForScale(
                            layer.values.get(c.id) ?? null,
                            colorScale,
                          )
                        : colorFromRange(
                            layer.values.get(c.id) ?? null,
                            layer.range,
                          )
                      : colorFor(valueFor(c, feature, month), feature))
                  }
                  fillOpacity={opacity * (layer?.cellAppearance?.get(c.id)?.opacity ?? 1)}
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
          {viewShapes && viewshed && <g className="viewshed-overlay">
            {viewShapes.targets.features.map(target => <path key={`target:${target.id}`} data-viewshed-role="target"
              d={geometryPath(target.geometry)} fill={target.properties!.color} fillOpacity={viewshed.opacity ?? .75}
              fillRule="evenodd" stroke={target.properties!.selected ? "#123f62" : "white"}
              strokeWidth={target.properties!.selected ? 3 : viewshed.gridVisible === false ? 0 : .65}
              role="button" tabIndex={0} aria-label={`Inspect water target ${target.id}`}
              onClick={() => viewshed.onTarget(String(target.id))}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); viewshed.onTarget(String(target.id)); } }} />)}
            {viewShapes.sources.features.map(source => <path key={`source:${source.id}`} data-viewshed-role="source"
              d={geometryPath(source.geometry)} fill={source.properties!.color}
              fillOpacity={viewshed.mode === "targetSources" ? source.properties!.paired ? viewshed.opacity ?? .75 : .14 : viewshed.mode === "target" ? .22 : .45}
              fillRule="evenodd" stroke="#9e7840" strokeWidth={source.properties!.selected ? 2.5 : viewshed.gridVisible === false ? 0 : .7}
              role="button" tabIndex={0} aria-label={`Select land source ${sourceLabel(String(source.id))}`}
              onClick={() => viewshed.onSource(String(source.id))}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); viewshed.onSource(String(source.id)); } }} />)}
            {viewShapes.observers.features.map(observer => {
              const [x, y] = project(observer.geometry.coordinates[1], observer.geometry.coordinates[0]);
              return <circle key={observer.id} cx={x} cy={y} r={2.5 / zoom} fill="#542f0b" pointerEvents="none" />;
            })}
          </g>}
          {humanGeometry && [...humanVisibleFeatures(humanGeometry).footprints,...humanVisibleFeatures(humanGeometry).records].map(f=>{
            const [x,y]=project(f.properties.label_point[1],f.properties.label_point[0]);
            const common={"data-human-record":true,role:"button",tabIndex:0,"aria-label":`Inspect ${humanRecordName(f)}`,
              onClick:()=>humanGeometry.onSelect(f.properties.record_id),onKeyDown:(event:React.KeyboardEvent<SVGElement>)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();humanGeometry.onSelect(f.properties.record_id);}}};
            return f.geometry.type==="Point"?<circle key={f.id} {...common} cx={x} cy={y} r={(humanGeometry.selected===f.properties.record_id?7:5)/zoom} fill={humanRecordColor(f)} fillOpacity={humanGeometry.opacity} stroke="white" strokeWidth={1.5/zoom}><title>{humanRecordName(f)}</title></circle>
              :<path key={f.id} {...common} d={humanPath(f.geometry)} fill={f.properties.role==="source_footprint"?humanRecordColor(f):"none"} fillOpacity={humanGeometry.opacity*.2} stroke={humanRecordColor(f)} strokeOpacity={humanGeometry.opacity} strokeWidth={2/zoom}><title>{humanRecordName(f)}</title></path>;
          })}
          {hydrologyPoints && hydrologyPointGeoJSON(hydrologyPoints).features.map(node => {
            const [x, y] = project(node.geometry.coordinates[1], node.geometry.coordinates[0]);
            const p = node.properties!;
            return <circle key={node.id} data-hydrology-node cx={x} cy={y} r={(p.radius + (p.selected ? 2 : 0)) / zoom}
              fill={p.missing ? "none" : p.color} fillOpacity={hydrologyPoints.appearance?.opacity ?? .88} stroke={p.color} strokeWidth={(p.selected ? 4 : 2.5) / zoom}
              role="button" tabIndex={0} aria-label={`Inspect ${p.name} river`}
              onClick={() => hydrologyPoints.onSelect(p.river)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); hydrologyPoints.onSelect(p.river); } }}>
              <title>{p.name} · {p.missing ? "Unavailable" : p.value} · approximate mouth reference</title></circle>;
          })}
          {orcaPoints?.records.filter(r => r.latitude !== null && r.longitude !== null).slice(0, 1000).map(record => {
            const [x,y] = project(record.latitude!, record.longitude!);
            return <circle data-orca-point key={record.event_id} cx={x} cy={y} r={5} fill={orcaCategoryColors[record.category]} stroke="white" strokeWidth={1.5} tabIndex={0} role="button" aria-label={`Inspect sighting ${record.event_id}`} onClick={() => orcaPoints.onSelect(record.event_id)} onKeyDown={event => { if(event.key === "Enter" || event.key === " ") { event.preventDefault(); orcaPoints.onSelect(record.event_id); } }}><title>{record.source} · {record.category}</title></circle>;
          })}
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
      {!layer && !nativeData && (
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
  if (props.basemap === "maptiler" && (props.nativeData || props.layer))
    return (
      <div className="map-canvas map-wait-state">
        <WarningNotice title={failed ? "Basemap unavailable" : "Basemap key not configured"}
          message={failed ? "Retry to load the geographic map." : "Configure the MapTiler key described in the app README to load the geographic map."}
          onRetry={failed ? () => setFailed(false) : undefined} retryLabel="Retry basemap" />
      </div>
    );
  return (
    <div className="map-provider">
      <LocalMapCanvas {...props} />
      {props.basemap === "maptiler" && (
        <WarningNotice title={failed ? "Basemap unavailable" : "Basemap key not configured"}
          role="status" message={failed ? "Local basemap fallback is active." : "Local basemap · MapTiler key not configured"}
          onRetry={failed ? () => setFailed(false) : undefined} retryLabel="Retry basemap" />
      )}
    </div>
  );
}
