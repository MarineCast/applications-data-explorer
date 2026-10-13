import { useMemo } from "react";
import type { InsightDataset } from "./DatasetInsights";
import { binsFor, summarizeInsights } from "../data/insights";
import { correlateLayers, numericValues, summarizeBox } from "../data/compareInsights";
import type { BoxSummary, TemporalComparison } from "../data/compareInsights";

export interface InsightComparison {
  left: InsightDataset; right: InsightDataset; temporal?: TemporalComparison;
  cell?: { id: string; coordinates: [number, number]; leftQualifiers: { label: string; value: string }[]; rightQualifiers: { label: string; value: string }[] };
}
const colors = ["#287bc1", "#bf673b"];
const number = (value: number) => value !== 0 && (Math.abs(value) >= 1e6 || Math.abs(value) < .001)
  ? value.toExponential(2) : value.toLocaleString(undefined, { maximumSignificantDigits: 4 });
const format = (value: number, dataset: InsightDataset) => dataset.formatValue?.(value) ?? `${number(value)}${dataset.unit ? ` ${dataset.unit}` : ""}`;
const position = (value: number, min: number, max: number) => min === max ? .5 : Number.isFinite(max - min)
  ? (value - min) / (max - min) : (value / Math.max(Math.abs(min), Math.abs(max)) - min / Math.max(Math.abs(min), Math.abs(max))) / (max / Math.max(Math.abs(min), Math.abs(max)) - min / Math.max(Math.abs(min), Math.abs(max)));
const boxTitle = (box: BoxSummary, dataset: InsightDataset) => `Min ${format(box.min, dataset)}; Q1 ${format(box.q1, dataset)}; median ${format(box.median, dataset)}; Q3 ${format(box.q3, dataset)}; max ${format(box.max, dataset)}; ${box.count.toLocaleString()} available, ${box.missing.toLocaleString()} unavailable cells`;

function PairedHistograms({ datasets, values, boxes }: { datasets: InsightDataset[]; values: number[][]; boxes: (BoxSummary | undefined)[] }) {
  const common = datasets[0].unit === datasets[1].unit;
  const defined = boxes.filter((box): box is BoxSummary => Boolean(box));
  const min = Math.min(...defined.map(box => box.min)), max = Math.max(...defined.map(box => box.max));
  const bins = values.map((v, i) => boxes[i] ? binsFor(v, common ? min : boxes[i]!.min, common ? max : boxes[i]!.max, 24) : []);
  const frequencies = bins.map((row, side) => row.map(bin => bin.count / Math.max(1, values[side].length) * 100));
  const peak = Math.max(1, ...frequencies.flat());
  return <svg viewBox="0 0 310 270" className="compare-chart" role="img" aria-label="Paired histograms">
    {bins.map((row, side) => {
      const baseline = 112 + side * 130;
      return <g key={side}>
        <text x="62" y={baseline - 88} fill={colors[side]}>{side ? "Right" : "Left"} ({datasets[side].unit})</text>
        {[0, 1].map(t => <g key={t}><line x1="62" x2="294" y1={baseline - t * 70} y2={baseline - t * 70} stroke="#e4ebef" />
          <text x="55" y={baseline - t * 70 + 4} textAnchor="end">{(peak * t).toFixed(1)}%</text></g>)}
        {row.map((bin, i) => <rect key={i} x={62 + i * 232 / row.length} y={baseline - frequencies[side][i] / peak * 70}
          width={Math.max(1, 232 / row.length - 1)} height={frequencies[side][i] / peak * 70} fill={colors[side]} opacity=".8">
          <title>{format(bin.min, datasets[side])} – {format(bin.max, datasets[side])}: {bin.count.toLocaleString()} cells ({frequencies[side][i].toFixed(1)}%)</title>
        </rect>)}
        {row.length ? <><text x="62" y={baseline + 18}>{number(row[0].min)}</text><text x="294" y={baseline + 18} textAnchor="end">{number(row.at(-1)!.max)}</text></> : <text x="180" y={baseline - 32} textAnchor="middle">No available values</text>}
      </g>;
    })}
    <text x="12" y="142" transform="rotate(-90 12 142)" textAnchor="middle">Share of cells</text>
  </svg>;
}

function PairedBoxes({ datasets, boxes }: { datasets: InsightDataset[]; boxes: (BoxSummary | undefined)[] }) {
  const defined = boxes.filter((box): box is BoxSummary => Boolean(box));
  const common = datasets[0].unit === datasets[1].unit;
  const min = Math.min(...defined.map(box => box.min)), max = Math.max(...defined.map(box => box.max));
  return <svg viewBox="0 0 310 165" className="compare-chart" role="img" aria-label="Paired box plots">
    {boxes.map((box, side) => {
      const y = 45 + side * 78;
      const x = (value: number) => 62 + position(value, common ? min : box!.min, common ? max : box!.max) * 232;
      return <g key={side}>
        <text x="62" y={y - 20} fill={colors[side]}>{side ? "Right" : "Left"} ({datasets[side].unit})</text>
        {box ? <g><title>{boxTitle(box, datasets[side])}</title>
          <line x1={x(box.min)} x2={x(box.max)} y1={y} y2={y} stroke={colors[side]} />
          {[box.min, box.max].map((value, i) => <line key={i} x1={x(value)} x2={x(value)} y1={y - 6} y2={y + 6} stroke={colors[side]} />)}
          <rect x={x(box.q1)} y={y - 10} width={Math.max(1, x(box.q3) - x(box.q1))} height="20" fill={colors[side]} fillOpacity=".2" stroke={colors[side]} />
          <line x1={x(box.median)} x2={x(box.median)} y1={y - 10} y2={y + 10} stroke={colors[side]} strokeWidth="2" />
          <text x="62" y={y + 28}>{number(common ? min : box.min)}</text><text x="294" y={y + 28} textAnchor="end">{number(common ? max : box.max)}</text>
        </g> : <text x="180" y={y + 4} textAnchor="middle">No available values</text>}
      </g>;
    })}
  </svg>;
}

function ScatterPlot({ pairs, left, right, selected }: { pairs: ReturnType<typeof correlateLayers>["pairs"]; left: InsightDataset; right: InsightDataset; selected?: string }) {
  const [xBox, yBox] = useMemo(() => [summarizeBox(pairs.map(p => p.x))!, summarizeBox(pairs.map(p => p.y))!], [pairs]);
  const x = (v: number) => 70 + position(v, xBox.min, xBox.max) * 224;
  const y = (v: number) => 184 - position(v, yBox.min, yBox.max) * 148;
  const step = Math.max(1, Math.ceil(pairs.length / 1200));
  const visible = pairs.filter((pair, i) => i % step === 0 || pair.id === selected);
  return <><svg viewBox="0 0 310 235" className="compare-chart" role="img" aria-label={`Correlation scatter plot, ${pairs.length.toLocaleString()} paired H3 cells`}>
    {[0, .5, 1].map(t => <g key={t}><line x1="70" x2="294" y1={184 - t * 148} y2={184 - t * 148} stroke="#e4ebef" />
      <text x="62" y={188 - t * 148} textAnchor="end">{number(yBox.min * (1 - t) + yBox.max * t)}</text>
    </g>)}
    {visible.map(pair => <circle key={pair.id} cx={x(pair.x)} cy={y(pair.y)} r={pair.id === selected ? 4 : 1.6}
      fill={pair.id === selected ? colors[1] : colors[0]} fillOpacity={pair.id === selected ? 1 : .32}>
      <title>{pair.id}: Left {format(pair.x, left)}, Right {format(pair.y, right)}</title></circle>)}
    <line x1="70" x2="294" y1="184" y2="184" stroke="#bac8d4" />
    <text x="70" y="202">{number(xBox.min)}</text><text x="294" y="202" textAnchor="end">{number(xBox.max)}</text>
    <text x="178" y="225" textAnchor="middle">Left ({left.unit})</text>
    <text x="12" y="112" transform="rotate(-90 12 112)" textAnchor="middle">Right ({right.unit})</text>
  </svg>{visible.length < pairs.length && <p className="insights-note">Showing {visible.length.toLocaleString()} of {pairs.length.toLocaleString()} paired cells; correlations use every pair.</p>}</>;
}

function TemporalBoxes({ temporal, datasets }: { temporal: TemporalComparison; datasets: InsightDataset[] }) {
  const rows = temporal.rows;
  const boxes = rows.flatMap(row => [row.left, row.right]).filter((box): box is BoxSummary => Boolean(box));
  if (!boxes.length) return <p className="insights-empty">No non-null numeric values in the recorded time slices.</p>;
  const common = datasets[0].unit === datasets[1].unit;
  const width = Math.max(240, rows.length * 24 + 30);
  const start = rows[0].time, end = rows.at(-1)!.time;
  const x = (time: number) => 8 + position(time, start, end) * (width - 38);
  const graphs = (common ? ["both"] : ["left", "right"]).map(side => {
    const included = rows.flatMap(row => side === "both" ? [row.left, row.right] : [side === "left" ? row.left : row.right]).filter((box): box is BoxSummary => Boolean(box));
    return { side, min: Math.min(...included.map(box => box.min)), max: Math.max(...included.map(box => box.max)),
      unit: datasets[side === "right" ? 1 : 0].unit, available: included.length > 0 };
  });
  return <><div className="compare-time-key"><span style={{ color: colors[0] }}>● Left</span><span style={{ color: colors[1] }}>● Right</span></div>
    <div className="compare-time-frame">
      <div className="compare-time-axes" aria-hidden="true">{graphs.map(graph => <svg key={graph.side} width="70" height="240" viewBox="0 0 70 240">
        <text x="4" y="14">{graph.side === "both" ? "Left + Right" : graph.side === "left" ? "Left" : "Right"}</text>
        <text x="4" y="26">({graph.unit})</text>
        {graph.available && [0, .5, 1].map(t => <text key={t} x="62" y={184 - t * 145} textAnchor="end">{number(graph.min * (1 - t) + graph.max * t)}</text>)}
      </svg>)}</div>
      <div className="compare-time-scroll" tabIndex={0} role="region" aria-label="Recorded time box plots">{graphs.map(graph => {
        const { side, min, max } = graph;
        const y = (value: number) => 180 - position(value, min, max) * 145;
        return <svg key={side} width={width} height="240" viewBox={`0 0 ${width} 240`} className="compare-chart compare-time-chart" role="img"
          aria-label={`Time series of ${side === "both" ? "paired" : side} box plots (${graph.unit})`}>
          {graph.available ? <>
            {[0, .5, 1].map(t => <line key={t} x1="8" x2={width - 30} y1={180 - t * 145} y2={180 - t * 145} stroke="#e4ebef" />)}
            {rows.map((row, i) => <g key={row.key}>
              {[row.left, row.right].map((box, role) => {
                if (side !== "both" && (side === "left" ? role !== 0 : role !== 1)) return null;
                const cx = x(row.time) + (side === "both" ? role ? 5 : -5 : 0);
                return box ? <g key={role}><title>{row.label} · {role ? "Right" : "Left"}: {boxTitle(box, datasets[role])}</title>
                  <line x1={cx} x2={cx} y1={y(box.min)} y2={y(box.max)} stroke={colors[role]} />
                  {[box.min, box.max].map((v, j) => <line key={j} x1={cx - 3} x2={cx + 3} y1={y(v)} y2={y(v)} stroke={colors[role]} />)}
                  <rect x={cx - 3} y={y(box.q3)} width="6" height={Math.max(1, y(box.q1) - y(box.q3))} fill={colors[role]} fillOpacity=".3" stroke={colors[role]} />
                  <line x1={cx - 3} x2={cx + 3} y1={y(box.median)} y2={y(box.median)} stroke={colors[role]} strokeWidth="2" />
                </g> : <text key={role} x={cx} y="184" textAnchor="middle" fill={colors[role]}><title>{row.label} · {role ? "Right" : "Left"}: unavailable</title>×</text>;
              })}
              {(i % Math.max(1, Math.ceil(rows.length / 7)) === 0 || i === rows.length - 1) && <text x={x(row.time)} y="202" textAnchor={i === 0 ? "start" : "middle"}>{row.key.slice(0, 10)}</text>}
            </g>)}
            <text x={width / 2} y="229" textAnchor="middle">Recorded time</text>
          </> : <text x="8" y="120">No available values</text>}
        </svg>;
      })}</div>
    </div>
  </>;
}

export default function CompareInsights({ comparison }: { comparison: InsightComparison }) {
  const { left, right, temporal, cell } = comparison;
  const datasets = [left, right];
  const values = useMemo(() => [numericValues(left.values?.values() ?? []), numericValues(right.values?.values() ?? [])], [left.values, right.values]);
  const boxes = useMemo(() => values.map(summarizeBox), [values]);
  const correlation = useMemo(() => correlateLayers(left.values ?? new Map(), right.values ?? new Map()), [left.values, right.values]);
  const summaries = useMemo(() => [summarizeInsights(left.values?.values() ?? [], left.categorical), summarizeInsights(right.values?.values() ?? [], right.categorical)], [left.values, left.categorical, right.values, right.categorical]);
  const numeric = !left.categorical && !right.categorical;
  const ready = Boolean(left.values && right.values && !left.error && !right.error);
  return <section aria-label="Comparison insights" className="compare-insights">
    <h3>Compare layers <span className="insights-resolution">H3 R{left.resolution}</span></h3>
    <div className="compare-series-key">{datasets.map((dataset, side) => <div key={side}><i style={{ background: colors[side] }} /><span><strong>{side ? "Right" : "Left"}</strong> · {dataset.name}<small>{dataset.unit}{dataset.slice ? ` · ${dataset.slice.axis}: ${dataset.slice.label}` : ""}{dataset.note ? ` · ${dataset.note}` : ""}</small></span></div>)}</div>
    <p className="insights-scope">Original values · full active native layers · cells count equally</p>
    {!ready ? <p role={left.error || right.error ? "alert" : "status"}>{left.error || right.error || "Loading comparison layers…"}</p> : <>
      <div className="compare-support">{datasets.map((dataset, side) => {
        const summary = summaries[side];
        return <div key={side} aria-label={`${side ? "Right" : "Left"} layer summary`}><strong>{side ? "Right" : "Left"}</strong><span>Available {summary.count.toLocaleString()}</span><span>Unavailable {summary.missing.toLocaleString()}</span>
          {numeric && summary.count > 0 && <span>Mean {format(summary.mean!, dataset)} · Median {format(summary.median!, dataset)}</span>}
          {dataset.categorical && <dl>{summary.categories.map((category, i) => <div key={i}><dt>{String(category.value)}</dt><dd>{category.count.toLocaleString()}</dd></div>)}</dl>}
        </div>;
      })}</div>
      {numeric ? <>
        <section className="insights-section"><h3>Paired histograms</h3><p className="insights-note">Share of available cells in each layer · shared frequency axis. {left.unit === right.unit ? "Shared value axis." : "Separate value axes in original units."}</p><PairedHistograms datasets={datasets} values={values} boxes={boxes} /></section>
        <section className="insights-section"><h3>Paired box plots</h3><p className="insights-note">Box: Q1–Q3 · line: median · whiskers: min–max. {left.unit === right.unit ? "Shared value axis." : "Each row uses its own units and value axis."}</p><PairedBoxes datasets={datasets} boxes={boxes} /></section>
        <section className="insights-section" aria-label="Correlation"><h3>Correlation scatter plot</h3>
          <p className="insights-note">Matched native H3 cells · current selected slices · both values non-null</p>
          <dl className="compare-correlation"><div><dt>Pearson r</dt><dd>{correlation.pearson === null ? "Unavailable" : correlation.pearson.toFixed(3)}</dd></div><div><dt>Spearman ρ</dt><dd>{correlation.spearman === null ? "Unavailable" : correlation.spearman.toFixed(3)}</dd></div><div><dt>Paired cells</dt><dd>{correlation.pairs.length.toLocaleString()}</dd></div><div><dt>Excluded cells</dt><dd>{correlation.excluded.toLocaleString()}</dd></div></dl>
          {correlation.pairs.length ? <ScatterPlot pairs={correlation.pairs} left={left} right={right} selected={cell?.id} /> : <p className="insights-empty">No cells have both numeric values.</p>}
          {correlation.pearson === null && <p className="insights-note">Correlation requires at least two paired cells and variation in both layers.</p>}
          <p className="insights-note">Spatial association across cells; no causal or independent-sample inference.</p>
        </section>
      </> : <p className="insights-empty">Histograms, box plots and numeric correlations require two numeric layers. Source category counts are retained above.</p>}
    </>}
    {temporal && numeric && <section className="insights-section"><h3>Box plots over time</h3><p className="insights-note">Recorded slices only · full non-null support per layer and time · missing dates remain gaps. × means unavailable. Scroll horizontally for the full timeline.</p>
      {temporal.loading ? <p role="status">Loading recorded time slices… {temporal.rows.length} / {temporal.total}</p> : temporal.error ? <p role="alert">{temporal.error}</p> : <TemporalBoxes temporal={temporal} datasets={datasets} />}
      {temporal.rows.some(row => row.error) && <details className="insights-qualifiers"><summary>Unavailable time slices</summary>{temporal.rows.filter(row => row.error).map(row => <p key={row.key}>{row.label}: {row.error}</p>)}</details>}
    </section>}
    <section className="insights-section" aria-label="Insights selected cell"><h3>Selected Cell</h3>{cell ? <>
      <dl className="insights-cell-details"><div><dt>H3 index</dt><dd><code>{cell.id}</code></dd></div><div><dt>Latitude / longitude</dt><dd>{cell.coordinates.map(n => n.toFixed(6)).join(", ")}</dd></div>
        {datasets.map((dataset, side) => { const value = dataset.values?.get(cell.id); return <div key={side}><dt>{side ? "Right" : "Left"} value</dt><dd>{value == null ? "Unavailable" : typeof value === "number" && !dataset.categorical ? format(value, dataset) : String(value)}</dd></div>; })}
      </dl>{[cell.leftQualifiers, cell.rightQualifiers].map((items, side) => items.length > 0 && <details key={side} className="insights-qualifiers"><summary>{side ? "Right" : "Left"} source &amp; quality</summary><dl className="insights-cell-details">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></details>)}
    </> : <p className="insights-empty">Select a cell to inspect both original values at the same location.</p>}</section>
    <section className="insights-section" aria-label="Insights data source"><h3>Data sources</h3>{datasets.map((dataset, side) => <details className="insights-qualifiers" key={side}><summary>{side ? "Right" : "Left"} · {dataset.name}</summary><dl className="insights-cell-details">{dataset.metadata.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></details>)}</section>
  </section>;
}
