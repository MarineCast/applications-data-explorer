import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, CircleHelp, Eye, Layers3, MapPin, SlidersHorizontal, X } from "lucide-react";
import ViewshedMap from "../components/ViewshedMap";
import ViewshedCellInspector from "../components/ViewshedCellInspector";
import DatasetInsights from "../components/DatasetInsights";
import MapToolDrawer from "../components/MapToolDrawer";
import ViewshedLegend from "../components/ViewshedLegend";
import ViewshedColorControls from "../components/ViewshedColorControls";
import CoordinatePopup from "../components/CoordinatePopup";
import type { ViewshedSelection } from "../data/viewshedMap";
import type { MapCoordinates } from "../data/mapCoordinates";
import { loadSource, loadViewshed, percent, sourceLabel } from "../data/viewshed";
import type { ViewMetric, ViewPair, ViewScore, ViewshedData } from "../data/viewshed";
import type { PaletteId } from "../data/colorScale";
import { scalePercent } from "../data/viewshedScale";
import { createViewshedScale } from "../data/viewshedScale";
import type { ViewshedScaleMode } from "../data/viewshedScale";
import "./ViewshedPage.css";

const metrics: { id: ViewMetric; name: string; detail: string }[] = [
  { id: "above_ground_lower", name: "Above-ground weight (lower)", detail: "Lower bound of roof and vegetation transmission on terrain-clear sightlines, weighted by distance. Unresolved inputs take their blocked bound; inspect upper bounds to distinguish uncertainty from confirmed blockage. Gray means no terrain-clear support. Target view averages applicable source pairs only." },
  { id: "weight_terrain", name: "Terrain weight", detail: "Bare-earth line of sight with the developed distance decay integrated at every observer–water comparison. Target view averages all source cells, including outside-reach zeros." },
  { id: "weight_distance", name: "Distance weight", detail: "The developed normalized logistic curve at H3-centroid distance: d50 parameter 9 km, slope 2.7 km, cutoff 30 km. A diagnostic; distance is already included in terrain. Target view averages modeled-pair weights across all sources, with outside-reach zeros." },
  { id: "weight_above_ground", name: "Above-ground weight (complete)", detail: "Complete conditional transmission weight. Gray means no terrain-clear support or unresolved inputs. Target view averages applicable source pairs only; any unknown contributor retains a null mean." },
  { id: "lower", name: "Lower estimate", detail: "Unresolved inputs take their obstructed bound." },
  { id: "upper", name: "Upper estimate", detail: "Unresolved inputs take their clear bound." },
  { id: "average_viewability", name: "Complete score", detail: "Gray means unresolved inputs; no complete score is available." },
  { id: "input_unknown_fraction", name: "Input uncertainty", detail: "The gap between the upper and lower estimates." },
];

type Panel = { kind: "settings" | "legend" | "tools" | "layers" | "help" } | { kind: "cell"; selection: ViewshedSelection } | { kind: "coordinates"; coordinates: MapCoordinates } | null;

function PilotPage({ data, onContextChange }: { data: ViewshedData; onContextChange?: (context: string) => void }) {
  const availableMetrics = metrics.filter(m => data.catalog.version === 2 || (!m.id.startsWith("weight_") && m.id !== "above_ground_lower"));
  const [panel, setPanel] = useState<Panel>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const panelKind = panel?.kind;
  const settingsOpen = panelKind === "settings";
  const helpOpen = panelKind === "help";
  const layersOpen = panelKind === "layers";
  const selection = panel?.kind === "cell" ? panel.selection : null;
  const target = selection?.role === "target" ? selection.id : "";
  const settingsPanel = useRef<HTMLElement>(null);
  const legendRoot = useRef<HTMLElement>(null);
  const legendButton = useRef<HTMLButtonElement>(null);
  const [zoomContainer, setZoomContainer] = useState<HTMLDivElement | null>(null);
  const [gridVisible, setGridVisible] = useState(true);
  const [opacity, setOpacity] = useState(.75);
  const toolsButton = useRef<HTMLButtonElement>(null);
  const layersRoot = useRef<HTMLDivElement>(null);
  const layersButton = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<"source" | "target">("target");
  const [source, setSource] = useState(data.catalog.default_source);
  const [metric, setMetric] = useState<ViewMetric>("lower");
  const [palette, setPalette] = useState<PaletteId>("balance");
  const [scaleMode, setScaleMode] = useState<ViewshedScaleMode>("auto");
  const [customRange, setCustomRange] = useState<[number, number]>([0, 1]);
  const [rangeDraft, setRangeDraft] = useState<[string, string]>(["0", "100"]);
  const [retry, setRetry] = useState(0);
  const [partition, setPartition] = useState<{ source: string; retry: number; rows?: ViewPair[]; error?: string }>();
  useEffect(() => {
    let cancelled = false;
    loadSource(data, source).then(rows => {
      if (!cancelled) setPartition({ source, retry, rows });
    }).catch((e: unknown) => {
      if (!cancelled) setPartition({ source, retry, error: e instanceof Error ? e.message : "Cannot read source scores." });
    });
    return () => { cancelled = true; };
  }, [data, source, retry]);
  const current = partition?.source === source && partition?.retry === retry ? partition : undefined;
  const scores: ViewScore[] = useMemo(() => mode === "target" ? data.averages : current?.rows ?? [], [mode, data.averages, current?.rows]);
  const insightValues = useMemo(() => new Map(scores.map(score => [score.target_h3, score[metric] ?? null])), [scores, metric]);
  const colorScale = useMemo(() => createViewshedScale(scores, metric, palette, scaleMode, customRange), [scores, metric, palette, scaleMode, customRange]);
  const draftValid = rangeDraft.every(value => value.trim() !== "" && Number.isFinite(Number(value))) &&
    Number(rangeDraft[0]) >= 0 && Number(rangeDraft[1]) <= 100 && Number(rangeDraft[0]) < Number(rangeDraft[1]);
  const updateLimit = (index: 0 | 1, value: string) => {
    const next: [string, string] = [...rangeDraft];
    next[index] = value;
    setRangeDraft(next);
    if (next.every(v => v.trim() !== "" && Number.isFinite(Number(v))) && Number(next[0]) >= 0 &&
      Number(next[1]) <= 100 && Number(next[0]) < Number(next[1])) setCustomRange([Number(next[0]) / 100, Number(next[1]) / 100]);
  };
  const manualScale = scaleMode === "custom" || scaleMode === "fixed";
  const saturatedTargets = manualScale ? scores.filter(score => score[metric] != null &&
    (score[metric]! < colorScale.edges[0] - 1e-12 || score[metric]! > colorScale.edges[10] + 1e-12)).length : 0;
  const activeTargets = useMemo(() => new Set(scores.map(s => s.target_h3)), [scores]);
  const inspected = scores.find(s => s.target_h3 === target);
  const displayMetric = metrics.find(m => m.id === metric)!;
  const context = `${mode === "source" ? `Source: ${sourceLabel(source)}` : metric.startsWith("weight_") || metric === "above_ground_lower" ? "Average target weight" : "Average target viewability"} / ${displayMetric.name}`;
  useEffect(() => { onContextChange?.(context); }, [context, onContextChange]);
  const closePanel = () => { setPanel(null); (panelKind === "legend" ? legendButton : panelKind === "layers" ? layersButton : toolsButton).current?.focus(); };
  const colorControls = { palette, scaleMode, scale: colorScale, rangeDraft, draftValid, saturatedTargets, opacity,
    onPalette: setPalette, onScaleMode: setScaleMode, onLimit: updateLimit, onOpacity: setOpacity };
  useEffect(() => {
    if (!panelKind || panelKind === "legend" || panelKind === "tools") return;
    if (panelKind === "settings" || panelKind === "help") settingsPanel.current?.querySelector<HTMLButtonElement>("header button")?.focus();
    if (panelKind === "layers") layersRoot.current?.querySelector<HTMLSelectElement>("select")?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPanel(null); (panelKind === "layers" ? layersButton : toolsButton).current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if ((panelKind === "settings" || panelKind === "help") &&
        !settingsPanel.current?.contains(event.target) && !toolsButton.current?.contains(event.target)) setPanel(null);
      if (panelKind === "layers" && !layersRoot.current?.contains(event.target)) setPanel(null);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [panelKind]);
  const selectSource = (id: string) => { setSource(id); setMode("source"); };
  const selectCell = (role: "source" | "target", id: string) => {
    if (role === "source") selectSource(id);
    setPanel({ kind: "cell", selection: { role, id } });
  };
  const changeMode = (next: "source" | "target") => { setMode(next); };
  return <main className={`viewshed-page ${insightsOpen ? "insights-open" : ""}`} aria-label="Viewshed explorer">
    <h1 className="sr-only">Viewshed</h1>
    <DatasetInsights open={insightsOpen} onOpenChange={open => { setInsightsOpen(open); if (open && panelKind !== "cell") setPanel(null); }}
      dataset={{ name: displayMetric.name, unit: "%", resolution: data.catalog.model.h3_resolution,
        scope: `${mode === "source" ? `Source: ${sourceLabel(source)}` : "All-source target view"} · active water targets · unweighted`,
        values: mode === "source" && (!current || current.error) ? undefined : insightValues,
        error: mode === "source" ? current?.error : undefined, colors: colorScale.colors, formatValue: scalePercent,
        note: "Statistics use original scores. Color limits, logarithmic coloring and opacity do not change them. Unavailable support is separate from zero.",
        metadata: [{ label: "Snapshot", value: data.catalog.snapshot }, { label: "Qualification", value: data.catalog.qualification },
          { label: "Support", value: displayMetric.detail }, { label: "Source cells", value: data.catalog.source_count.toLocaleString() }],
      }} selectedContent={selection ? <ViewshedCellInspector selection={selection} data={data} score={inspected} metric={metric}
        metricName={displayMetric.name} mode={mode} source={source} onClose={closePanel} /> : undefined} />
    <aside className="viewshed-map-controls" aria-label="Map controls">
      <div className="viewshed-bottom-dock map-legend-tools">
      <ViewshedLegend scores={scores} metric={metric} metricName={displayMetric.name} scale={colorScale} scaleMode={scaleMode}
        open={panelKind === "legend"} rootRef={legendRoot} buttonRef={legendButton}
        onToggle={() => setPanel(panelKind === "legend" ? null : { kind: "legend" })}>
        <ViewshedColorControls {...colorControls} />
      </ViewshedLegend>
      <MapToolDrawer open={panelKind === "tools"} triggerRef={toolsButton}
        onOpenChange={open => setPanel(open ? { kind: "tools" } : null)}
        actions={[
          { label: "Settings", icon: SlidersHorizontal, onClick: () => setPanel({ kind: "settings" }) },
          { label: "Map help", text: "Help", icon: CircleHelp, onClick: () => setPanel({ kind: "help" }) },
        ]} />
      </div>
      <div className="viewshed-layers" ref={layersRoot}>
        <button className="panel viewshed-layers-trigger" ref={layersButton} aria-label="Map layers"
          aria-expanded={layersOpen} aria-controls="viewshed-layers" onClick={() => setPanel(layersOpen ? null : { kind: "layers" })}>
          <Layers3 size={19} /> Layers <span className="atlas-layer-count">1</span>
          {layersOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {layersOpen && <section className="panel viewshed-layers-panel" id="viewshed-layers" aria-label="Map layers">
          <header className="legend-popup-heading"><strong>Data layers</strong>
            <button aria-label="Close map layers" onClick={closePanel}><X size={19} /></button>
          </header>
          <label className="viewshed-field">Map layer
            <select aria-label="Map layer" title={displayMetric.detail} value={metric} onChange={e => setMetric(e.target.value as ViewMetric)}>
              {availableMetrics.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}
            </select>
          </label>
          <p className="viewshed-mode-note">{displayMetric.detail}</p>
          <p className="viewshed-mode-note">{mode === "source" ? `Source: ${sourceLabel(source)}` : "All-source target view"} · Local research pilot</p>
        </section>}
      </div>
      <div ref={setZoomContainer} className="viewshed-zoom-host" />
    </aside>
    {(settingsOpen || helpOpen) && <aside ref={settingsPanel} id={helpOpen ? "viewshed-help" : "viewshed-settings"} className="viewshed-controls" aria-label={helpOpen ? "Viewshed help" : "Viewshed settings"}>
      <header className="viewshed-panel-heading"><h2>{helpOpen ? "Viewshed help" : "Settings"}</h2><button aria-label={helpOpen ? "Close map help" : "Close settings"} onClick={closePanel}><X size={18} /></button></header>
      {settingsOpen && <>
      <h3>View and score</h3>
      <div className="viewshed-modes" role="group" aria-label="Viewshed display mode">
        <button aria-pressed={mode === "source"} onClick={() => changeMode("source")}><MapPin size={15} /> Source view</button>
        <button aria-pressed={mode === "target"} onClick={() => changeMode("target")}><Eye size={15} /> Target view</button>
      </div>
      <p className="viewshed-mode-note">{mode === "source" ? "Click any gold land cell. Colored water cells show its target scores." : metric === "weight_above_ground" || metric === "above_ground_lower" ? "Above-ground weights average terrain-clear source pairs equally. Inspect a water cell for its applicable-source denominator." : `Target scores average all ${data.catalog.source_count} source cells equally. Sources outside reach contribute zero.`}</p>
      <label className="viewshed-field">Score display
        <select aria-label="Score display" value={metric} onChange={e => setMetric(e.target.value as ViewMetric)}>{availableMetrics.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select>
      </label>
      <p className="viewshed-mode-note">{displayMetric.detail}</p>
      {mode === "source" && <>
      <label className="viewshed-field">Land source cell
        <select aria-label="Land source cell" value={source} onChange={e => selectSource(e.target.value)}>
          {data.sources.map(s => <option key={s.id} value={s.id}>{sourceLabel(s.id)}{sourceLabel(s.id) !== s.id ? ` · ${s.id}` : ""}</option>)}
        </select>
      </label>
      <div className="viewshed-shortcuts">
        {data.sources.filter(s => sourceLabel(s.id) !== s.id).map(s => <button key={s.id} onClick={() => selectSource(s.id)}>{sourceLabel(s.id)}</button>)}
      </div>
      <button className="viewshed-inspect-source" onClick={() => selectCell("source", source)}>Inspect source cell</button>
      </>}
      <fieldset className="viewshed-color-settings"><legend>Overlay display</legend>
        <label className="viewshed-checkbox"><input type="checkbox" checked={gridVisible} onChange={e => setGridVisible(e.target.checked)} /> H3 grid outlines</label>
      </fieldset>
      <label className="viewshed-field">Inspect water target
        <select aria-label="Inspect water target" value={inspected ? target : ""} disabled={!scores.length} onChange={e => { if (e.target.value) selectCell("target", e.target.value); }}>
          <option value="">Click a water cell or choose here</option>
          {data.targets.filter(t => activeTargets.has(t.id)).map(t => <option value={t.id} key={t.id}>{t.id}</option>)}
        </select>
      </label>
      <p className="viewshed-inspect-hint">Click a colored water cell to inspect its score and uncertainty.</p>
      </>}
      {helpOpen && <>
      <details open className="viewshed-method"><summary>How to read this map</summary>
        {data.catalog.components && <p>The weight layers are additional diagnostics on the saved pilot samples. Terrain includes distance decay; Above-ground is conditional roof/vegetation transmission. Distance is a separate centroid diagnostic and must not be multiplied into terrain again. The original Lower/Upper/Complete scores remain the pilot’s unweighted transmission estimates.</p>}
        <p>0% means no modeled viewability; 100% means fully viewable in this scenario. A lower estimate of 0% with a positive upper estimate is uncertain, rather than confirmed obstruction.</p>
        <p>Sources use 15 outdoor land observers per H3 R7 cell. Water targets use a 30 m lattice, with a weighted sampling approximation. Obstacles use a 10 m grid; terrain is 30 m.</p>
        <p>Eye height is 1.7 m above local ground and water-target height is 1 m. The terrain model applies Earth curvature and the configured refraction correction, so a clear path still has a water-surface horizon.</p>
        <p>Scores describe the portion of each water cell within at least one observer’s 15-mile reach. Individual comparisons beyond that distance contribute zero. Shading covers the cell’s water shape, including edge portions that may fall outside reach.</p>
        <p>Target view averages per-source scores with all {data.catalog.source_count} sources in the denominator. Each source’s in-reach water portion can differ; this is a mean of source-cell scores, rather than a whole-water-area mean.</p>
        <p>Terrain and roofs block rays; WorldCover and canopy height estimate vegetation transmission. Buildings are treated as a complete inventory: no building footprint means no building. Missing heights on land retain uncertainty.</p>
      </details>
      <details className="viewshed-method"><summary>Basemap credits</summary>
        <p>Default basemap: <a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> · Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>.</p>
      </details>
      <details className="viewshed-method"><summary>Source &amp; qualification</summary>
        <p>Completed regional research pilot: Port Angeles, Victoria and Port Townsend. {data.catalog.pair_count.toLocaleString()} source–target pairs. Physical viewability is separate from public access, observation effort or detection.</p>
        <p>Exploratory transmission model; no empirical calibration or production promotion. {data.catalog.census_checked_sources} source census checks; maximum checked sampling difference {percent(data.catalog.sampling_max_checked_error)}.</p>
        <ul>{data.catalog.limitations.map(item => <li key={item}>{item}</li>)}</ul>
        <dl>{Object.entries(data.catalog.input_products).map(([name, input]) => <div key={name}><dt>{name}</dt><dd>{input.filename}<code>{input.sha256}</code></dd></div>)}</dl>
        <p>Pair parquet SHA-256<code>{data.catalog.inputs["average_viewability.parquet"]}</code></p>
        <p>Browser snapshot<code>{data.catalog.snapshot}</code></p>
        {data.catalog.components && <p>Weight diagnostics SHA-256<code>{data.catalog.components.output_sha256}</code></p>}
      </details>
      </>}
    </aside>}
    <div className="viewshed-map-area">
      <ViewshedMap data={data} scores={scores} source={source} selection={selection} metric={metric} mode={mode} colorScale={colorScale}
        gridVisible={gridVisible} opacity={opacity} controlsContainer={zoomContainer}
        coordinates={panel?.kind === "coordinates" ? panel.coordinates : null}
        onCoordinates={coordinates => setPanel(current => coordinates ? { kind: "coordinates", coordinates } : current?.kind === "coordinates" ? null : current)}
        onBackground={() => setPanel(null)} onSource={id => selectCell("source", id)} onTarget={id => selectCell("target", id)} />
      {selection && !insightsOpen && <ViewshedCellInspector selection={selection} data={data} score={inspected} metric={metric} metricName={displayMetric.name} mode={mode} source={source} onClose={closePanel} />}
      {panel?.kind === "coordinates" && <CoordinatePopup key={`${panel.coordinates.lat}:${panel.coordinates.lon}`} coordinates={panel.coordinates} onClose={closePanel} />}
      {mode === "source" && !current && <p role="status" className="viewshed-floating-status">Loading source scores…</p>}
      {mode === "source" && current?.error && <div role="alert" className="viewshed-error viewshed-floating-status"><p>{current.error}</p><button onClick={() => setRetry(r => r + 1)}>Retry source scores</button></div>}

    </div>
  </main>;
}

export default function ViewshedPage({ onContextChange }: { onContextChange?: (context: string) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; data?: ViewshedData; error?: string }>();
  useEffect(() => {
    let cancelled = false;
    loadViewshed().then(data => { if (!cancelled) setResult({ attempt, data }); }).catch((e: unknown) => {
      if (!cancelled) setResult({ attempt, error: e instanceof Error ? e.message : "Cannot load viewshed data." });
    });
    return () => { cancelled = true; };
  }, [attempt]);
  const current = result?.attempt === attempt ? result : undefined;
  if (current?.data) return <PilotPage data={current.data} onContextChange={onContextChange} />;
  return <main className="viewshed-load" aria-label="Viewshed explorer"><Eye size={32} /><h1>Viewshed</h1>
    {current?.error ? <div role="alert"><p>{current.error}</p><button onClick={() => setAttempt(a => a + 1)}>Retry viewshed data</button></div> : <p role="status">Loading the local viewshed pilot…</p>}
  </main>;
}
