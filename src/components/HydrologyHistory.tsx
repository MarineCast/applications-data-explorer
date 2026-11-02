import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { hydrologyChartPath, hydrologyDateLabel, hydrologyMetricUnit } from "../data/hydrology";
import type { HydrologyData, HydrologyMetricId } from "../data/hydrology";
import type { HydrologyAppearance } from "../data/hydrologyOverlay";
import { hydrologyRiverColor } from "../data/hydrologyOverlay";
import "./Hydrology.css";

export default function HydrologyHistory({ data, metric, day, onDate, appearance }: {
  data: HydrologyData; metric: HydrologyMetricId; day: string; onDate: (date: string) => void; appearance?: HydrologyAppearance;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [span, setSpan] = useState("year");
  const [hover, setHover] = useState<number>();
  const [width, setWidth] = useState(660);
  const [anchor] = useState(() => data.dates.indexOf(day));
  const plot = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const element = plot.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(Math.max(260, element.clientWidth)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [collapsed]);
  const selected = data.dates.indexOf(day), end = Math.max(anchor, selected, 0);
  const first = span === "all" ? 0 : Math.max(0, Math.min(selected, end - (span === "quarter" ? 89 : 364)));
  const last = span === "all" ? data.dates.length - 1 : end;
  const definition = data.metrics.find(m => m.id === metric)!;
  const unit = hydrologyMetricUnit(definition);
  const history = useMemo(() => {
    const series = data.rivers.map(river => ({ river, values: river.series[metric].values.slice(first, last + 1) }));
    let min = 0, max = 0, count = 0;
    for (const s of series) for (const value of s.values) if (value !== null) { min = Math.min(min, value); max = Math.max(max, value); count++; }
    if (metric === "causal_discharge_pulse") { min = 0; max = 1; }
    if (min === max) max = min + 1;
    return { series, range: [min, max] as const, count };
  }, [data, metric, first, last]);
  const paths = useMemo(() => history.series.map(({ river, values }) => ({
    river, path: hydrologyChartPath(values, width - 68, 64, history.range, 82, definition.plot === "step"),
    isolated: values.flatMap((v, i) => v !== null && (i === 0 || values[i - 1] === null) && (i === values.length - 1 || values[i + 1] === null) ? [{ index: i, value: v }] : []),
  })), [history, width, definition.plot]);
  const [low, high] = history.range, length = last - first + 1;
  const x = (index: number) => 48 + (index - first) / Math.max(1, length - 1) * (width - 68);
  const y = (value: number) => 82 - (value - low) / (high - low) * 64;
  const pointIndex = (clientX: number) => {
    const rect = plot.current!.getBoundingClientRect();
    return Math.max(first, Math.min(last, first + Math.round(((clientX - rect.left) / rect.width * width - 48) / (width - 68) * Math.max(1, length - 1))));
  };
  return <section className={`hydrology-history panel ${collapsed ? "is-collapsed" : ""}`} aria-label="River history">
    <header>
      <button type="button" className="hydrology-history-toggle" aria-expanded={!collapsed} aria-controls={id} aria-label={collapsed ? "Expand river history" : "Collapse river history"} onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}<span>River history <strong>{definition.name}</strong></span>
      </button>
      <output aria-label="Selected date">{hydrologyDateLabel(day)}</output>
    </header>
    {!collapsed && <div id={id}>
      <div className="hydrology-history-toolbar"><span>{unit} · provider dates</span><select aria-label="River history window" value={span} onChange={e => { setSpan(e.target.value); setHover(undefined); }}><option value="quarter">90 days</option><option value="year">1 year</option><option value="all">All history</option></select></div>
      <div className="hydrology-history-plot" ref={plot}>
        <svg viewBox={`0 0 ${width} 120`} role="img" tabIndex={0} aria-label={`${definition.name}, one line per river. Click a date or use Left and Right arrow keys to inspect a provider day. Missing days remain gaps.`}
          onPointerMove={e => setHover(pointIndex(e.clientX))} onPointerLeave={() => setHover(undefined)} onClick={e => { setHover(undefined); onDate(data.dates[pointIndex(e.clientX)]); }}
          onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? first : e.key === "End" ? last : Math.max(first, Math.min(last, selected + (e.key === "ArrowLeft" ? -1 : 1))); onDate(data.dates[next]); } }}>
          {(metric === "causal_discharge_pulse" ? [0,1] : [0,.5,1]).map(t => <g key={t}><line x1={48} x2={width - 20} y1={18 + t * 64} y2={18 + t * 64} className="hydrology-history-grid"/><text x={42} y={22 + t * 64} textAnchor="end">{(high - t * (high - low)).toLocaleString(undefined, { maximumSignificantDigits: 3 })}</text></g>)}
          {paths.map(({ river, path, isolated }) => <g key={river.id}>
            <path data-testid={`river-history-${river.id}`} d={path} fill="none" stroke={hydrologyRiverColor(river.id, appearance)} strokeWidth={1.6} strokeLinejoin="round"><title>{river.name}</title></path>
            {isolated.map(point => <circle key={point.index} cx={x(first + point.index)} cy={y(point.value)} r={2} fill={hydrologyRiverColor(river.id, appearance)}/>)}
          </g>)}
          <line x1={x(hover ?? selected)} x2={x(hover ?? selected)} y1={12} y2={84} className="hydrology-history-cursor"/>
          {history.series.map(({ river }) => { const value = river.series[metric].values[hover ?? selected]; return value == null ? null : <circle key={river.id} cx={x(hover ?? selected)} cy={y(value)} r={3.5} fill={hydrologyRiverColor(river.id, appearance)} stroke="var(--hydrology-surface,#fffefb)" strokeWidth={1.5}/>; })}
          <text x={48} y={107}>{data.dates[first]}</text><text x={width - 20} y={107} textAnchor="end">{data.dates[last]}</text>
        </svg>
        {hover !== undefined && <div className="hydrology-history-tooltip" style={{ left: `${Math.max(0, Math.min(60, x(hover) / width * 100))}%` }}><strong>{hydrologyDateLabel(data.dates[hover])}</strong>{history.series.map(({ river }) => <span key={river.id}><i style={{ background: hydrologyRiverColor(river.id, appearance) }}/>{river.name}<b>{river.series[metric].values[hover]?.toLocaleString(undefined, { maximumSignificantDigits: 4 }) ?? "Unavailable"}</b></span>)}</div>}
      </div>
      <p>{definition.causal && <>Output provider date {day} · as-of {data.causal?.asOfDates[selected]} · lag 1 day; no interpolation · model-ineligible.<br/></>}{history.count ? "Click a date to inspect · gaps are unavailable data" : "No supported values in this window"}</p>
      {(metric==="high_flow_duration"&&data.rivers.some(r=>r.highFlowDefinition)||metric==="low_flow_duration"&&data.rivers.some(r=>r.lowFlowDefinition)||metric==="days_since_flow_pulse"&&data.rivers.some(r=>r.flowPulseDefinition))&&<p>Each river’s historical {metric==="low_flow_duration"?"10th percentile":metric==="high_flow_duration"?"90th percentile; consecutive days strictly above it":"90th-percentile upward crossing"} · interior flow gaps interpolated for this calculation only · retrospective.</p>}
    </div>}
  </section>;
}
