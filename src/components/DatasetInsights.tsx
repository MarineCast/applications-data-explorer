import { useEffect, useEffectEvent, useId, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { ChartNoAxesColumnIncreasing, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { summarizeInsights } from "../data/insights";
import type { InsightBin } from "../data/insights";
import type { SourceValue } from "../data/seascape";
import CompareInsights from "./CompareInsights";
import type { InsightComparison } from "./CompareInsights";
import "./DatasetInsights.css";

export interface InsightDataset {
  name: string; unit: string; resolution: number; scope: string;
  values?: ReadonlyMap<string, SourceValue>; categorical?: boolean;
  colors: readonly string[]; categoryColors?: ReadonlyMap<SourceValue, string>;
  formatValue?: (value: number) => string;
  metadata: { label: string; value: string }[];
  note?: string; error?: string;
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

export default function DatasetInsights({ open, onOpenChange, dataset, cell, selectedContent, comparison }: {
  open: boolean; onOpenChange: (open: boolean) => void; dataset: InsightDataset;
  cell?: InsightCell; selectedContent?: ReactNode;
  comparison?: InsightComparison;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const comparing = Boolean(comparison);
  const summary = useMemo(() => summarizeInsights(comparing ? [] : dataset.values?.values() ?? [], dataset.categorical), [dataset.values, dataset.categorical, comparing]);
  const dismiss = useEffectEvent(() => { onOpenChange(false); trigger.current?.focus(); });
  useEffect(() => {
    if (!open) return;
    heading.current?.focus();
    const escape = (event: KeyboardEvent) => {
      // Let the topmost local popup close first when a selector/legend is open.
      if (event.key === "Escape" && !document.querySelector('.colorbar-settings, .layer-panel, .viewshed-layers-panel, .tool-drawer-actions, .viewshed-controls, .atlas-dialog')) dismiss();
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
  return <div className="dataset-insights">
    <button ref={trigger} className="panel insights-tab" aria-label="Insights" aria-expanded={open} aria-controls={id} tabIndex={open ? -1 : 0}
      onClick={() => onOpenChange(!open)}>
      <ChartNoAxesColumnIncreasing size={18} /><span>Insights</span><ChevronLeft size={14} />
    </button>
    {open && <aside id={id} className="insights-panel panel" aria-label="Dataset insights">
      <header className="insights-header">
        <ChartNoAxesColumnIncreasing size={21} />
        <h2 ref={heading} tabIndex={-1}>{comparison ? "Comparison Insights" : "Dataset Insights"}</h2>
        <button aria-label="Close insights" onClick={() => { onOpenChange(false); trigger.current?.focus(); }}><ChevronRight size={21} /></button>
      </header>
      <div className="insights-body">
        {comparison ? <CompareInsights comparison={comparison} /> : <>
        <div className="insights-dataset-heading"><div><h3>{dataset.name}</h3><p>{dataset.categorical ? "Source categories" : `Original values${dataset.unit ? ` (${dataset.unit})` : ""}`}</p></div>
          <span className="insights-resolution">H3 R{dataset.resolution}</span>
        </div>
        <p className="insights-scope">{dataset.scope}</p>
        {dataset.error ? <p role="alert">{dataset.error}</p> : !dataset.values ? <p role="status">Loading active layer…</p> : <>
          {!dataset.categorical && summary.count > 0 && <DistributionHistogram bins={summary.histogram} name={dataset.name} unit={dataset.unit}
            format={dataset.formatValue ?? number} color={dataset.colors[6] ?? "#247dcc"} />}
          {!dataset.categorical && summary.count > 0 && <dl className="insights-stats">
            {([['Min', summary.min], ['Max', summary.max], ['Mean', summary.mean], ['Median', summary.median]] as const).map(([label, value]) =>
              <div key={label}><dt>{label}</dt><dd>{value == null ? "Unavailable" : format(value)}</dd></div>)}
          </dl>}
          <div className="insights-coverage"><span>Available <strong>{summary.count.toLocaleString()}</strong></span><span>Unavailable <strong>{summary.missing.toLocaleString()}</strong></span></div>
          {dataset.note && <p className="insights-note">{dataset.note}</p>}
          <section className="insights-section" aria-label="Value distribution">
            <h3>{dataset.categorical ? "Category distribution" : "Distribution"}<Info size={13} aria-hidden="true" /></h3>
            <p className="insights-note">{dataset.categorical ? "Source labels" : "Equal-width value ranges"} · share of non-null cells</p>
            {!summary.count ? <p className="insights-empty">No non-null values in this active layer. Unavailable values are not zeros.</p> : <>
              <div className="insights-distribution-bar" aria-hidden="true">{rows.filter(row => row.count).map((row, i) => <span key={i} style={{ background: row.color, flex: row.count }} />)}</div>
              <dl className="insights-distribution-rows">{rows.map((row, i) => <div key={i}><dt><i style={{ background: row.color }} />{row.label}</dt>
                <dd>{(row.count / summary.count * 100).toFixed(1)}%</dd><dd>{row.count.toLocaleString()}</dd></div>)}</dl>
            </>}
          </section>
        </>}
        <section className="insights-section insights-selected" aria-label="Insights selected cell">
          <h3>Selected Cell <Info size={13} aria-hidden="true" /></h3>
          {selectedContent ?? (cell ? <><dl className="insights-cell-details">
            <div><dt>Value</dt><dd>{cell.value === null ? "Unavailable" : typeof cell.value === "number" && !dataset.categorical ? format(cell.value) : String(cell.value)}</dd></div>
            <div><dt>H3 index</dt><dd><code>{cell.id}</code></dd></div>
            {cell.coordinates && <div><dt>Latitude / longitude</dt><dd>{cell.coordinates.map(n => n.toFixed(6)).join(", ")}</dd></div>}
            {cell.details?.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
          </dl>
          {cell.qualifiers?.length ? <details className="insights-qualifiers"><summary>Source &amp; quality</summary>
            <dl className="insights-cell-details">{cell.qualifiers.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
          </details> : null}
          </> : <p className="insights-empty">Select a cell on the map to inspect its source value.</p>)}
        </section>
        <section className="insights-section insights-provenance" aria-label="Insights data source"><h3>Data source</h3>
          <dl className="insights-cell-details">{dataset.metadata.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
        </section>
        </>}
      </div>
    </aside>}
  </div>;
}
