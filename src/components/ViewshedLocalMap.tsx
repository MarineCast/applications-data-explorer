import { useMemo, useRef, useState } from "react";
import ViewshedZoomControls from "./ViewshedZoomControls";
import type { MultiPolygon, Polygon } from "geojson";
import { sourceLabel } from "../data/viewshed";
import { viewshedColor } from "../data/viewshedScale";
import type { ViewshedMapProps } from "../data/viewshedMap";
import { coordinatePopupPosition } from "../data/mapCoordinates";

export default function ViewshedLocalMap({ data, scores, source, selection, metric, mode, colorScale, onSource, onTarget, onBackground, onCoordinates, controlsContainer, opacity = .75, gridVisible = true }: ViewshedMapProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const mapGroup = useRef<SVGGElement>(null);
  const geometry = useMemo(() => {
    const mercator = ([lon, lat]: number[]) => [lon, Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI];
    const [west, south, east, north] = data.catalog.bounds;
    const min = mercator([west, south]), max = mercator([east, north]);
    const scale = Math.min(1120 / (max[0] - min[0]), 770 / (max[1] - min[1]));
    const project = (p: number[]) => {
      const [x, y] = mercator(p);
      return [600 + (x - (min[0] + max[0]) / 2) * scale, 425 - (y - (min[1] + max[1]) / 2) * scale];
    };
    const path = (g: Polygon | MultiPolygon) => {
      const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      return polygons.flatMap(p => p.map(ring => ring.map((p, i) => `${i ? "L" : "M"}${project(p).map(n => n.toFixed(2)).join(",")}`).join(" ") + "Z")).join(" ");
    };
    const unproject = (x: number, y: number) => {
      const lon = (x - 600) / scale + (min[0] + max[0]) / 2;
      const mercatorY = (425 - y) / scale + (min[1] + max[1]) / 2;
      const lat = (2 * Math.atan(Math.exp(mercatorY * Math.PI / 180)) - Math.PI / 2) * 180 / Math.PI;
      return { lat, lon };
    };
    return { project, unproject, land: path(data.land), sources: new Map(data.sources.map(s => [s.id, path(s.geometry)])), targets: new Map(data.targets.map(t => [t.id, path(t.geometry)])) };
  }, [data]);
  const values = useMemo(() => new Map(scores.map(s => [s.target_h3, s])), [scores]);
  const changeZoom = (next: number) => {
    onCoordinates(null);
    setZoom(Math.max(1, Math.min(8, next)));
    if (next <= 1) setOffset({ x: 0, y: 0 });
  };
  const selectedSource = data.sources.find(s => s.id === source);
  return <div className="viewshed-map">
    <svg viewBox="0 0 1200 850" preserveAspectRatio="xMidYMid slice" aria-label="Viewshed map with land source cells and water target cells" onPointerDown={e => {
      if (e.button !== 0) return;
      onCoordinates(null);
      moved.current = false;
      if (!(e.target as Element).closest("[data-cell]")) {
        setDrag({ x: e.clientX, y: e.clientY });
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }} onPointerMove={e => {
      if (drag && (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 2 || moved.current)) {
        moved.current = true;
        const rect = e.currentTarget.getBoundingClientRect();
        const factor = Math.min(1200 / rect.width, 850 / rect.height) / zoom;
        setOffset(o => ({ x: o.x + (e.clientX - drag.x) * factor, y: o.y + (e.clientY - drag.y) * factor }));
        setDrag({ x: e.clientX, y: e.clientY });
      }
    }} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)} onClick={event => {
      if (!moved.current && !(event.target as Element).closest("[data-cell]")) onBackground();
    }} onContextMenu={event => {
      event.preventDefault();
      const matrix = mapGroup.current?.getScreenCTM();
      if (!matrix) return;
      const point = event.currentTarget.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(matrix.inverse());
      const rect = event.currentTarget.getBoundingClientRect();
      onCoordinates({ ...geometry.unproject(local.x, local.y), ...coordinatePopupPosition(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height) });
    }}>
      <rect width="1200" height="850" fill="#e5eff2" />
      <g ref={mapGroup} transform={`translate(600 425) scale(${zoom}) translate(-600 -425) translate(${offset.x} ${offset.y})`}>
        <path d={geometry.land} fill="#e6eadf" stroke="#b5c3b5" strokeWidth="1" fillRule="evenodd" vectorEffect="non-scaling-stroke" />
        {data.targets.filter(t => values.has(t.id)).map(t => {
          const score = values.get(t.id)!;
          return <path key={`target:${t.id}`} data-cell="target" d={geometry.targets.get(t.id)} fill={viewshedColor(score[metric] ?? null, colorScale)}
            fillOpacity={opacity} fillRule="evenodd" stroke={selection?.role === "target" && selection.id === t.id ? "#123f62" : "#ffffff"} strokeWidth={selection?.role === "target" && selection.id === t.id ? 3 : gridVisible ? .65 : 0}
            vectorEffect="non-scaling-stroke" role="button" tabIndex={-1} aria-label={`Inspect water target ${t.id}`}
            onClick={() => onTarget(t.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTarget(t.id); } }}>
          </path>;
        })}
        {data.sources.map(s => <path key={`source:${s.id}`} data-cell="source" d={geometry.sources.get(s.id)} fill={selection?.role === "source" && selection.id === s.id ? "#efb553" : "#d3a864"}
          fillOpacity={mode === "target" ? .22 : selection?.role === "source" && selection.id === s.id ? .95 : .4} fillRule="evenodd"
          stroke={selection?.role === "source" && selection.id === s.id ? "#693d0c" : "#9e7840"} strokeWidth={selection?.role === "source" && selection.id === s.id ? 2.5 : gridVisible ? .7 : 0}
          vectorEffect="non-scaling-stroke" role="button" tabIndex={-1} aria-label={`Select land source ${sourceLabel(s.id)}`}
          onClick={() => onSource(s.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSource(s.id); } }} />)}
        {mode === "source" && selectedSource?.observers.map((p, i) => {
          const [x, y] = geometry.project(p);
          return <circle key={i} cx={x} cy={y} r={2.5 / zoom} fill="#542f0b" stroke="white" strokeWidth=".7" vectorEffect="non-scaling-stroke" role="img" aria-label={`Outdoor observer ${i + 1} of 15`} />;
        })}
        {[["Port Angeles", -123.43, 48.118], ["Victoria", -123.365, 48.429], ["Port Townsend", -122.762, 48.117], ["Sequim", -123.101, 48.079]].map(([name, lon, lat]) => {
          const [x, y] = geometry.project([Number(lon), Number(lat)]);
          return <g key={name} className="viewshed-town" pointerEvents="none"><circle cx={x} cy={y} r={2.5 / zoom} />
            <text x={x + 7 / zoom} y={y - 6 / zoom} fontSize={13 / zoom}>{name}</text></g>;
        })}
      </g>
    </svg>
    <ViewshedZoomControls container={controlsContainer} zoom={zoom} min={1} max={8} onIn={() => changeZoom(zoom * 1.5)} onOut={() => changeZoom(zoom / 1.5)} />
    <span className="viewshed-map-caption">Local coastline · H3 R7 · drag to pan</span>
  </div>;
}
