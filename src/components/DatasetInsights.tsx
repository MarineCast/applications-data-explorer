import WarningNotice from "./WarningNotice";
import {DirectionRose,RankedBars} from "./InsightCharts";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChartNoAxesColumnIncreasing, ChevronLeft, ChevronRight, Info, RotateCcw } from "lucide-react";
import { summarizeInsights } from "../data/insights";
import type { InsightBin } from "../data/insights";
import type { SourceValue } from "../data/seascape";
import CompareInsights, { ComparisonSelected } from "./CompareInsights";
import type { InsightComparison } from "./CompareInsights";
import "./DatasetInsights.css";
import useResizableInsights from "./useResizableInsights";

export interface InsightDataset {
  name: string; unit: string; resolution: number; scope: string; supportLabel?: string;
  visibleValues?: ReadonlyMap<string, SourceValue>;
  values?: ReadonlyMap<string, SourceValue>; categorical?: boolean;
  colors: readonly string[]; categoryColors?: ReadonlyMap<SourceValue, string>;
  formatValue?: (value: number) => string;
  metadata: { label: string; value: string }[];
  note?: string; error?: string;
  circular?: boolean;
  slice?: { axis: string; label: string };
}
export interface InsightCell {
  id: string; value: SourceValue; coordinates?: [number, number];
  details?: { label: string; value: string }[];
  qualifiers?: { label: string; value: string }[];
}
const number = (value: number) => value !== 0 && (Math.abs(value) >= 1e7 || Math.abs(value) < .001)
  ? value.toExponential(3) : value.toLocaleString(undefined, { maximumSignificantDigits: 4 });

function DistributionHistogram({ bins, name, unit, format, color }: {
  bins: InsightBin[]; name: string; unit: string; format: (n: number) => string; color: string;
}) {
  const maximum = Math.max(1, ...bins.map(bin => bin.count));
  const width = 224 / bins.length;
  return <svg className="insights-histogram" viewBox="0 0 310 205" role="img" aria-label={`${name} histogram, counts of non-null native cells`}>
    {[0, .5, 1].map(t => <g key={t}>
      <line x1="70" x2="294" y1={154 - t * 126} y2={154 - t * 126} stroke="#edf1f4" />
      <text x="62" y={158 - t * 126} textAnchor="end">{Math.round(t * maximum).toLocaleString()}</text>
    </g>)}
    {bins.map((bin, i) => <rect key={i} x={70 + i * width} y={154 - bin.count / maximum * 126}
      width={Math.max(1, width - 1.5)} height={bin.count / maximum * 126} fill={color} rx="1">
      <title>{format(bin.min)} – {format(bin.max)}: {bin.count.toLocaleString()} cells</title>
    </rect>)}
    <line x1="70" x2="294" y1="154" y2="154" stroke="#bac8d4" />
    <text x="70" y="173">{format(bins[0].min)}</text>
    <text x="294" y="173" textAnchor="end">{format(bins.at(-1)!.max)}</text>
    <text x="182" y="196" textAnchor="middle">Value{unit ? ` (${unit})` : ""}</text>
    <text x="12" y="91" textAnchor="middle" transform="rotate(-90 12 91)">Cells</text>
  </svg>;
}

export default function DatasetInsights({ open, onOpenChange, dataset, cell, selectedContent, overviewContent, overviewNote, temporalContent, comparison, focusSelection = false, persistentTrigger = false, onSourceDetails, selectionToken, selectionName="cell", temporalLabel="Time history" }: {
  open: boolean; onOpenChange: (open: boolean) => void; dataset: InsightDataset;
  cell?: InsightCell; selectedContent?: ReactNode; overviewContent?:ReactNode;
  overviewNote?: ReactNode;
  temporalContent?: ReactNode;
  temporalLabel?: string;
  selectionToken?: object;
  selectionName?: "cell"|"record";
  focusSelection?: boolean;
  persistentTrigger?: boolean;
  onSourceDetails?: () => void;
  comparison?: InsightComparison;
}) {
  const { root: resizeRoot, panel: resizePanel, style: resizeStyle, handles, width, height, minWidth, minHeight, limits, reset } = useResizableInsights(open);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const comparing = Boolean(comparison);
  const DistributionSection = focusSelection ? "details" : "section";
  const SourceSection = focusSelection ? "details" : "section";
  const [scope, setScope] = useState("full");
  const [viewChoice, setViewChoice] = useState<{ token?: object | string; dataset?: string; tab: string }>({ tab: "overview" });
  const selectedId = cell?.id;
  const token = selectionToken ?? selectedId;
  const datasetKey = `${dataset.name}|${dataset.resolution}|${dataset.slice?.label ?? ""}`;
  const requestedView = focusSelection && selectedId && token !== viewChoice.token ? "cell" :
    focusSelection && !selectedId && datasetKey !== viewChoice.dataset ? "overview" : viewChoice.tab;
  const view = requestedView === "history" && !temporalContent ? "overview" : requestedView;
  const setView = (tab: string) => setViewChoice({ token, dataset: datasetKey, tab });
  const values = scope === "visible" && dataset.visibleValues ? dataset.visibleValues : dataset.values;
  const summary = useMemo(() => summarizeInsights(!open || comparing ? [] : values?.values() ?? [], dataset.categorical), [values, dataset.categorical, comparing, open]);
  const dismiss = useEffectEvent(() => { onOpenChange(false); trigger.current?.focus(); });
  useEffect(() => {
    if (!open) return;
    heading.current?.focus();
    const escape = (event: KeyboardEvent) => {
      // Let the topmost local popup close first when a selector/legend is open.
      if (event.key === "Escape" && !document.querySelector('.colorbar-settings, .layer-panel, .viewshed-controls, .atlas-dialog')) dismiss();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  const format = dataset.formatValue ?? ((value: number) => `${number(value)}${dataset.unit ? ` ${dataset.unit}` : ""}`);
  const color = (i: number, total: number) => dataset.colors[Math.round(i * (dataset.colors.length - 1) / Math.max(1, total - 1))] ?? "#247dcc";
  const rows = dataset.categorical ? summary.categories.map((category, i) => ({
    label: String(category.value), count: category.count, color: dataset.categoryColors?.get(category.value) ?? color(i, summary.categories.length),
  })) : summary.distribution.map((bin, i) => ({
    label: bin.min === bin.max ? format(bin.min) : `${format(bin.min)} – ${format(bin.max)}`,
    count: bin.count, color: color(i, summary.distribution.length),
  }));
  const viewTabs = focusSelection && <div className="insights-view-tabs" role="tablist" aria-label="Insight view" onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "overview" : event.key === "End" ? "cell" : view === "overview" ? "cell" : "overview";
          setView(next);
          event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next === "overview" ? 0 : 1]?.focus();
        }}>
          <button role="tab" tabIndex={view === "overview" ? 0 : -1} aria-selected={view === "overview"} aria-controls={`${id}-overview`} onClick={() => setView("overview")}>Overview</button>
          <button role="tab" tabIndex={view === "cell" ? 0 : -1} aria-selected={view === "cell"} aria-controls={`${id}-cell`} onClick={() => setView("cell")}>Selected {selectionName}</button>
        </div>;
  return <div ref={resizeRoot} className={`dataset-insights${persistentTrigger ? " dataset-insights--persistent" : ""}`}>
    <button ref={trigger} className="panel insights-tab" aria-label="Insights" aria-expanded={open} aria-controls={id} tabIndex={open && !persistentTrigger ? -1 : 0}
      onClick={() => onOpenChange(!open)}>
      <ChartNoAxesColumnIncreasing size={18} /><span>Insights</span><ChevronLeft size={14} />
    </button>
    {open && <aside ref={resizePanel} id={id} style={resizeStyle} className="insights-panel panel insights-resizable" aria-label="Dataset insights">
      <div className="insights-resize-edge insights-resize-width" role="separator" tabIndex={0} aria-label="Resize Insights width" aria-orientation="vertical" aria-controls={id} aria-valuemin={Math.round(minWidth)} aria-valuemax={Math.round(limits.width)} aria-valuenow={Math.round(width)} title="Drag left/right to resize · arrow keys adjust width" {...handles('width')} />
      <div className="insights-resize-edge insights-resize-height" role="separator" tabIndex={0} aria-label="Resize Insights height" aria-orientation="horizontal" aria-controls={id} aria-valuemin={Math.round(minHeight)} aria-valuemax={Math.round(limits.height)} aria-valuenow={Math.round(height)} title="Drag up/down to resize · arrow keys adjust height" {...handles('height')} />
      <div className="insights-resize-corner" aria-hidden="true" title="Drag to resize Insights" {...handles('both')} />
      <header className="insights-header">
        <ChartNoAxesColumnIncreasing size={21} />
        <h2 ref={heading} tabIndex={-1}>{comparison ? "Compare" : "Insights"}</h2>
        <button aria-label="Reset Insights size" title="Reset panel size" onClick={reset}><RotateCcw size={16} /></button>
        <button aria-label="Close insights" onClick={() => { onOpenChange(false); trigger.current?.focus(); }}><ChevronRight size={21} /></button>
      </header>
      <div className="insights-body" role="region" aria-label="Insights content" tabIndex={0}>
        {comparison ? <>{viewTabs}<div id={`${id}-overview`} role="tabpanel" aria-label="Overview" hidden={view !== "overview"}><CompareInsights comparison={comparison} showSelection={false} />{temporalContent}</div>
          <section id={`${id}-cell`} role="tabpanel" aria-label={`Insights selected ${selectionName}`} hidden={view !== "cell"}>
            {selectedContent ?? <ComparisonSelected comparison={comparison} embedded/>}
            {(comparison.cell || cell) && onSourceDetails && <button className="insights-source-button" onClick={onSourceDetails}>Source &amp; quality</button>}
          </section></> : <>
        <div className="insights-dataset-heading"><div><h3>{dataset.name}</h3><p>{[dataset.categorical ? "Categories" : dataset.unit, dataset.slice?.label].filter(Boolean).join(" · ")}</p></div>
          <span className="insights-resolution">{dataset.supportLabel ?? `H3 R${dataset.resolution}`}</span>
        </div>
        {viewTabs}
        <div id={`${id}-overview`} role={focusSelection ? "tabpanel" : undefined} aria-label="Overview" hidden={focusSelection && view !== "overview"}>
        {overviewNote}
        {overviewContent ?? <>
        {dataset.visibleValues && <label className="insights-choice">Summary scope<select aria-label="Summary scope" value={scope} onChange={e => setScope(e.target.value)}><option value="full">Full dataset</option><option value="visible">Visible map</option></select></label>}
        <p className="insights-scope">{scope === "visible" && dataset.visibleValues ? "Cell centres within visible bounds · unweighted" : "Full dataset · cells count equally"}</p>
        {dataset.error ? <WarningNotice inline title="Layer unavailable" message={dataset.error} /> : !dataset.values ? <p role="status">Loading active layer…</p> : <>
          <div className="insights-coverage"><span>Available <strong>{summary.count.toLocaleString()}</strong></span><span>Unavailable <strong>{summary.missing.toLocaleString()}</strong></span></div>
          <div className="insights-summary-grid">
          {!dataset.categorical && !dataset.circular && summary.count > 0 && <dl className="insights-stats">
            {([['Min', summary.min], ['Max', summary.max], ...(!dataset.circular ? [['Mean', summary.mean], ['Median', summary.median]] as const : [])] as const).map(([label, value]) =>
              <div key={label}><dt>{label}</dt><dd>{value == null ? "Unavailable" : (focusSelection ? dataset.formatValue ?? number : format)(value)}</dd></div>)}
          </dl>}
          {!dataset.categorical && !dataset.circular && summary.count > 0 && <DistributionHistogram bins={summary.histogram} name={dataset.name} unit={dataset.unit}
            format={dataset.formatValue ?? number} color={dataset.colors[6] ?? "#247dcc"} />}
          </div>
          {dataset.circular && summary.count > 0 && <DirectionRose values={values?.values()??[]} color={dataset.colors[6]??"#287f9d"}/>}
          {dataset.categorical && <RankedBars title="Category distribution" caption={`${summary.count.toLocaleString()} available cells · full counts, not area shares`} rows={rows.map(row=>({key:row.label,label:row.label,value:row.count,color:row.color}))}/>}
          {dataset.note && <details className="insights-qualifiers"><summary>Methods &amp; limitations</summary><p className="insights-note">{dataset.note}</p></details>}
          {!summary.count && <p className="insights-empty" role="status">No non-null values in this summary. Unavailable values are not zeros.</p>}
          {!dataset.categorical && !dataset.circular && <DistributionSection className="insights-section insights-bin-details" aria-label="Value distribution">
            {focusSelection ? <summary>{dataset.categorical ? "Category distribution" : "Distribution details"}</summary> : <h3>{dataset.categorical ? "Category distribution" : "Distribution"}<Info size={13} aria-hidden="true" /></h3>}
            <p className="insights-note">{dataset.categorical ? "Source labels" : focusSelection ? "Five equal-width summary ranges; independent of map classes" : "Equal-width value ranges"} · share of non-null cells</p>
            {!summary.count ? <p className="insights-empty">No non-null values in this active layer. Unavailable values are not zeros.</p> : <>
              <div className="insights-distribution-bar" aria-hidden="true">{rows.filter(row => row.count).map((row, i) => <span key={i} style={{ background: row.color, flex: row.count }} />)}</div>
              <dl className="insights-distribution-rows">{rows.map((row, i) => <div key={i}><dt><i style={{ background: row.color }} />{row.label}</dt>
                <dd>{(row.count / summary.count * 100).toFixed(1)}%</dd><dd>{row.count.toLocaleString()}</dd></div>)}</dl>
            </>}
          </DistributionSection>}
        </>}
        </>}
        </div>
        <section id={`${id}-cell`} role={focusSelection ? "tabpanel" : undefined} hidden={focusSelection && view !== "cell"} className="insights-section insights-selected" aria-label={`Insights selected ${selectionName}`}>
          {!focusSelection&&<h3>Selected {selectionName === "record" ? "Record" : "Cell"}</h3>}
          {selectedContent ?? (cell ? <><dl className="insights-cell-details">
            <div className="insight-primary-value"><dt>Value</dt><dd>{cell.value === null ? "Unavailable" : typeof cell.value === "number" && !dataset.categorical ? dataset.formatValue?.(cell.value) ?? `${String(cell.value)}${dataset.unit ? ` ${dataset.unit}` : ""}` : String(cell.value)}</dd></div>
            <div><dt>H3 index</dt><dd><code>{cell.id}</code></dd></div>
            {cell.coordinates && <div><dt>Latitude / longitude</dt><dd>{cell.coordinates.map(n => n.toFixed(6)).join(", ")}</dd></div>}
            {cell.details?.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
          </dl>
          {cell.qualifiers?.length ? <details className="insights-qualifiers"><summary>Source qualifiers</summary>
            <dl className="insights-cell-details">{cell.qualifiers.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
          </details> : null}
          {onSourceDetails && <button className="insights-source-button" onClick={onSourceDetails}>Source &amp; quality</button>}
          </> : <p className="insights-empty">Select a cell on the map to inspect its source value.</p>)}
        </section>
        {temporalContent && <details className="insights-history" open><summary>{temporalLabel}</summary>{temporalContent}</details>}
        <SourceSection className="insights-section insights-provenance" aria-label="Insights data source">{focusSelection ? <summary>Data source</summary> : <h3>Data source</h3>}
          <p className="insights-note">{dataset.scope}</p><dl className="insights-cell-details">{dataset.metadata.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
        </SourceSection>
        </>}
      </div>
    </aside>}
  </div>;
}
