import WarningNotice from "./WarningNotice";
import useDataRevision from "../hooks/useDataRevision";
import type { MapAppearance } from "../hooks/useComparisonAppearance";
import { createPortal } from "react-dom";
import DataDomainDock from "./DataDomainDock";
import ViewshedTargetSources from "./ViewshedTargetSources";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Download, GitCompareArrows, Eye, Layers3, MapPin, X } from "lucide-react";
import ViewshedCellInspector from "./ViewshedCellInspector";
import DatasetInsights from "./DatasetInsights";
import ViewshedLegend from "./ViewshedLegend";
import ViewshedColorControls from "./ViewshedColorControls";
import CoordinatePopup from "./CoordinatePopup";
import SourcePicker from "./SourcePicker";
import type { SurfaceSettings } from "../data/smoothSurface";
import type { ViewshedMapProps, ViewshedSelection } from "../data/viewshedMap";
import type { MapCoordinates } from "../data/mapCoordinates";
import { loadSource, loadTargetSources, loadViewshed, percent, sourceLabel } from "../data/viewshed";
import type { ViewMetric, ViewPair, ViewScore, ViewshedData } from "../data/viewshed";
import type { PaletteId } from "../data/colorScale";
import { scalePercent } from "../data/viewshedScale";
import { createViewshedScale } from "../data/viewshedScale";
import type { ViewshedScaleMode } from "../data/viewshedScale";
import "./ViewshedLayer.css";

const metrics: { id: ViewMetric; name: string; detail: string }[] = [
  { id: "above_ground_lower", name: "Above-ground weight (lower)", detail: "Lower bound of roof and vegetation transmission on terrain-clear sightlines, weighted by distance. Unresolved inputs take their blocked bound; inspect upper bounds to distinguish uncertainty from confirmed blockage. Gray means no terrain-clear support. All-source overview averages applicable source pairs only." },
  { id: "weight_terrain", name: "Terrain weight", detail: "Bare-earth line of sight with the developed distance decay integrated at every observer–water comparison. All-source overview averages all source cells, including outside-reach zeros." },
  { id: "weight_distance", name: "Distance weight", detail: "The developed normalized logistic curve at H3-centroid distance: d50 parameter 9 km, slope 2.7 km, cutoff 30 km. A diagnostic; distance is already included in terrain. All-source overview averages modeled-pair weights across all sources, with outside-reach zeros." },
  { id: "weight_above_ground", name: "Above-ground weight (complete)", detail: "Complete conditional transmission weight. Gray means no terrain-clear support or unresolved inputs. All-source overview averages applicable source pairs only; any unknown contributor retains a null mean." },
  { id: "lower", name: "Lower estimate", detail: "Unresolved inputs take their obstructed bound." },
  { id: "upper", name: "Upper estimate", detail: "Unresolved inputs take their clear bound." },
  { id: "average_viewability", name: "Complete score", detail: "Gray means unresolved inputs; no complete score is available." },
  { id: "input_unknown_fraction", name: "Input uncertainty", detail: "The gap between the upper and lower estimates." },
];

type Panel = { kind: "legend" | "help" } | { kind: "cell"; selection: ViewshedSelection } | { kind: "coordinates"; coordinates: MapCoordinates } | null;

type SharedDisplay = Pick<MapAppearance, "palette"|"opacity"|"outlines"|"smoothing">;
export interface ViewshedIntegration {
  display?: { value: SharedDisplay; onChange: (value: Partial<SharedDisplay>) => void };
  available: string[]; names: Record<string, string>; onSelect: (domain: string) => void;
  headerHost?: HTMLElement | null;
  onMapChange: (view: ViewshedMapProps | undefined) => void;
}
function PilotLayer({ data, onContextChange, integration }: { data: ViewshedData; onContextChange?: (context: string) => void; integration: ViewshedIntegration }) {
  const onMapChange = integration.onMapChange;
  const availableMetrics = metrics.filter(m => data.catalog.version === 2 || (!m.id.startsWith("weight_") && m.id !== "above_ground_lower"));
  const [panel, setPanel] = useState<Panel>(null);
  const [actionNotice, setActionNotice] = useState("");
  const [dockOpen, setDockOpen] = useState(true);
  const [layerSettingsOpen, setLayerSettingsOpen] = useState(true);
  const domainButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!layerSettingsOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setLayerSettingsOpen(false); domainButton.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !layersRoot.current?.contains(event.target)) setLayerSettingsOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [layerSettingsOpen]);
  const [waterTarget, setWaterTarget] = useState("");
  const [insightsOpen, setInsightsOpen] = useState(false);
  const panelKind = panel?.kind;
  const helpOpen = panelKind === "help";
  const selection = panel?.kind === "cell" ? panel.selection : null;
  const target = selection?.role === "target" ? selection.id : "";
  const settingsPanel = useRef<HTMLElement>(null);
  const legendRoot = useRef<HTMLElement>(null);
  const legendButton = useRef<HTMLButtonElement>(null);
  const [localGridVisible, setGridVisibleLocal] = useState(false);
  const [localOpacity, setOpacityLocal] = useState(.75);
  const [localSmoothing, setSmoothingLocal] = useState<SurfaceSettings>({ enabled: false, radius: .75, contours: true });
  const [family, setFamily] = useState("source");
  const toolsButton = useRef<HTMLButtonElement>(null);
  const layersRoot = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"source" | "target" | "targetSources">("target");
  const [source, setSource] = useState(data.catalog.default_source);
  const [metric, setMetric] = useState<ViewMetric>(data.catalog.version === 2 ? "weight_terrain" : "lower");
  const [localPalette, setPaletteLocal] = useState<PaletteId>("balance");
  const palette = integration.display?.value.palette ?? localPalette;
  const opacity = integration.display?.value.opacity ?? localOpacity;
  const gridVisible = integration.display?.value.outlines ?? localGridVisible;
  const smoothing = integration.display?.value.smoothing ?? localSmoothing;
  const setPalette = (value: PaletteId) => integration.display ? integration.display.onChange({palette:value}) : setPaletteLocal(value);
  const setOpacity = (value: number) => integration.display ? integration.display.onChange({opacity:value}) : setOpacityLocal(value);
  const setGridVisible = (value: boolean) => integration.display ? integration.display.onChange({outlines:value}) : setGridVisibleLocal(value);
  const setSmoothing = (value: SurfaceSettings) => integration.display ? integration.display.onChange({smoothing:value}) : setSmoothingLocal(value);
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
  const [reverse, setReverse] = useState<{ target: string; retry: number; rows?: ViewPair[]; error?: string }>();
  useEffect(() => {
    if (mode !== "targetSources" || !waterTarget) return;
    let cancelled = false;
    loadTargetSources(data, waterTarget).then(rows => {
      if (!cancelled) setReverse({ target: waterTarget, retry, rows });
    }).catch((error: unknown) => {
      if (!cancelled) setReverse({ target: waterTarget, retry, error: error instanceof Error ? error.message : "Cannot read land-source weights." });
    });
    return () => { cancelled = true; };
  }, [data, mode, waterTarget, retry]);
  const reverseCurrent = reverse?.target === waterTarget && reverse?.retry === retry ? reverse : undefined;
  const current = partition?.source === source && partition?.retry === retry ? partition : undefined;
  const scores: ViewScore[] = useMemo(() => mode === "targetSources" ? reverseCurrent?.rows ?? [] : mode === "target" ? data.averages : current?.rows ?? [], [mode, data.averages, current?.rows, reverseCurrent?.rows]);
  const insightValues = useMemo(() => new Map(scores.map(score => [mode === "targetSources" ? (score as ViewPair).source_h3 : score.target_h3, score[metric] ?? null])), [scores, metric, mode]);
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
  const inspected = scores.find(s => s.target_h3 === target);
  const displayMetric = metrics.find(m => m.id === metric)!;
  const context = `${mode === "targetSources" ? `Land sources for water: ${waterTarget}` : mode === "source" ? `Source: ${sourceLabel(source)}` : metric.startsWith("weight_") || metric === "above_ground_lower" ? "Average target weight" : "Average target viewability"} / ${displayMetric.name}`;
  useEffect(() => { onContextChange?.(context); }, [context, onContextChange]);
  const closePanel = () => { setPanel(null); (panelKind === "legend" ? legendButton : toolsButton).current?.focus(); };
  const colorControls = { palette, scaleMode, scale: colorScale, rangeDraft, draftValid, saturatedTargets, opacity, gridVisible, onGridVisible: setGridVisible,
    smoothing, onSmoothing: setSmoothing,
    onPalette: setPalette, onScaleMode: setScaleMode, onLimit: updateLimit, onOpacity: setOpacity };
  useEffect(() => {
    if (!panelKind || panelKind === "legend") return;
    if (panelKind === "help") settingsPanel.current?.querySelector<HTMLButtonElement>("header button")?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPanel(null); toolsButton.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (panelKind === "help" && event.target instanceof Node &&
        !settingsPanel.current?.contains(event.target) && !toolsButton.current?.contains(event.target)) setPanel(null);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [panelKind]);
  const selectSource = useCallback((id: string) => { setSource(id); setMode("source"); }, [setSource, setMode]);
  const resetView = useCallback(() => {
    setMode("target");
    setWaterTarget("");
    setPanel(null);
    setLayerSettingsOpen(false);
  }, [setMode, setWaterTarget, setPanel, setLayerSettingsOpen]);
  const selectCell = useCallback((role: "source" | "target", id: string, toggle = false) => {
    if (toggle && ((role === "source" && mode === "source" && source === id) ||
      (role === "target" && mode === "targetSources" && waterTarget === id))) {
      resetView();
      return;
    }
    if (role === "source") { setFamily("source"); selectSource(id); }
    else { setFamily("targetSources"); setWaterTarget(id); setMode("targetSources"); }
    setLayerSettingsOpen(false);
    setPanel({ kind: "cell", selection: { role, id } });
  }, [mode, source, waterTarget, resetView, selectSource, setLayerSettingsOpen, setPanel]);
  const onMapSource = useCallback((id: string) => selectCell("source", id, true), [selectCell]);
  const onMapTarget = useCallback((id: string) => selectCell("target", id, true), [selectCell]);
  const onMapCoordinates = useCallback((coordinates: MapCoordinates | null) => setPanel(current => coordinates ? { kind: "coordinates", coordinates } : current?.kind === "coordinates" ? null : current), [setPanel]);
  const mapSelection = useMemo(() => selection ?? (mode === "targetSources" && waterTarget ? { role: "target" as const, id: waterTarget } : null), [selection, mode, waterTarget]);
  const mapCoordinates = panel?.kind === "coordinates" ? panel.coordinates : null;
  const mapView = useMemo<ViewshedMapProps>(() => ({ data, scores, source, selection: mapSelection, metric, mode,
    allTargets: true, colorScale, gridVisible, opacity, smoothing,
    coordinates: mapCoordinates, onCoordinates: onMapCoordinates, onBackground: resetView, onSource: onMapSource, onTarget: onMapTarget,
  }), [data, scores, source, mapSelection, metric, mode, colorScale, gridVisible, opacity, smoothing,
    mapCoordinates, onMapCoordinates, resetView, onMapSource, onMapTarget]);
  useEffect(() => { onMapChange(mapView); }, [onMapChange, mapView]);
  useEffect(() => () => onMapChange(undefined), [onMapChange]);
  const changeFamily = (next: string) => {
    setFamily(next);
    setMode("target");
    setWaterTarget("");
    setPanel(null);
  };
  const settingsContent = <>
      <SourcePicker label="Family" value={family} showInformation={false} onChange={changeFamily}
        iconFor={id => id === "source" ? MapPin : Eye}
        items={[{ id: "source", name: "Land → water", group: "Family", summary: "", details: [] },
          { id: "targetSources", name: "Water → land", group: "Family", summary: "", details: [] }]} />
      <SourcePicker label="Score display" value={metric} showInformation={false} onChange={value => setMetric(value as ViewMetric)}
        items={availableMetrics.map(m => ({ ...m, group: "Score display", summary: "", details: [] }))} />
  </>;
  const selectedInspector = mode === "targetSources" && waterTarget ? <ViewshedTargetSources data={data} target={waterTarget}
    rows={reverseCurrent?.rows} error={reverseCurrent?.error} metric={metric} metricName={displayMetric.name}
    onSource={id => selectCell("source", id)} onClose={closePanel} /> : selection ? <ViewshedCellInspector
      selection={selection} data={data} score={inspected} metric={metric} metricName={displayMetric.name}
      mode={mode === "source" ? "source" : "target"} source={source} onClose={closePanel} /> : undefined;
  const mapHeader = <div className="data-map-topbar"><div className="active-layer-breadcrumb" aria-label="Active layer">
    <span>Viewshed</span><span aria-hidden="true">/</span><strong>{displayMetric.name}</strong></div>
    <nav className="data-map-actions" aria-label="Map actions">
      <button aria-label="Compare" aria-disabled="true" title="Comparison unavailable: Viewshed uses land–water pairs. Switch to a native grid product to compare variables." onClick={() => setActionNotice("Viewshed uses land–water pairs. Comparison is available for native grid variables; switch products to compare those layers.")}><GitCompareArrows size={17} /><span>Compare</span></button>
      <button aria-label="Export" aria-disabled="true" title="Viewshed pair export is unavailable. Source files and provenance are listed in Insights." onClick={() => setActionNotice("Viewshed pair export is not available in the explorer. Source files and provenance are listed in Insights.")}><Download size={17} /><span>Export</span></button>
      <button ref={toolsButton} aria-label="Map help" onClick={() => setPanel({ kind: "help" })}><CircleHelp size={18} /></button></nav></div>;
  return <section className={`viewshed-page hosted-viewshed integrated-viewshed ${insightsOpen ? "insights-open" : ""}`} aria-label="Viewshed layer">
    {integration.headerHost ? createPortal(mapHeader, integration.headerHost) : mapHeader}
    {actionNotice && <WarningNotice title="Action unavailable" role="status" message={actionNotice} onDismiss={() => setActionNotice("")} dismissLabel="Dismiss action message" />}
    <DatasetInsights focusSelection selectionToken={selection ?? undefined} cell={selection ? {id:selection.id,value:null} : undefined} persistentTrigger open={insightsOpen} onOpenChange={open => { setInsightsOpen(open); if (open && panelKind !== "cell") setPanel(null); }}
      dataset={{ name: displayMetric.name, unit: "%", resolution: data.catalog.model.h3_resolution,
        scope: `${mode === "targetSources" ? `Water target: ${waterTarget} · land sources` : mode === "source" ? `Source: ${sourceLabel(source)}` : "All-source target view"} · ${mode === "targetSources" ? "saved land source pairs" : "active water targets"} · unweighted`,
        values: mode === "targetSources" && (!reverseCurrent || reverseCurrent.error) || mode === "source" && (!current || current.error) ? undefined : insightValues,
        error: mode === "targetSources" ? reverseCurrent?.error : mode === "source" ? current?.error : undefined, colors: colorScale.colors, formatValue: scalePercent,
        note: "Statistics use original scores. Color limits, logarithmic coloring and opacity do not change them. Unavailable support is separate from zero.",
        metadata: [{ label: "Snapshot", value: data.catalog.snapshot }, { label: "Qualification", value: data.catalog.qualification },
          { label: "Support", value: displayMetric.detail }, { label: "Source cells", value: data.catalog.source_count.toLocaleString() }],
      }} selectedContent={selection ? selectedInspector : undefined} />
    <aside className="viewshed-map-controls" aria-label="Map controls">
      <div className="viewshed-bottom-dock map-legend-tools">
      <ViewshedLegend scores={scores} metric={metric} metricName={displayMetric.name} scale={colorScale} scaleMode={scaleMode}
        supportNote={mode === "targetSources" ? "Land weights · gold: no saved pair" : mode === "source" ? "Water weights · pale blue: no saved pair" : "All-source water mean"}
        smoothing={smoothing.enabled} open={panelKind === "legend"} rootRef={legendRoot} buttonRef={legendButton}
        onToggle={() => { setLayerSettingsOpen(false); setPanel(panelKind === "legend" ? null : { kind: "legend" }); }}>
        <ViewshedColorControls {...colorControls} />
      </ViewshedLegend>
      </div>
    </aside>
    <div className="domain-layer-controls" ref={layersRoot}>
      {dockOpen ? <DataDomainDock active="viewshed" open={layerSettingsOpen} activeButton={domainButton}
        available={[...integration.available, "viewshed"]} names={integration.names}
        onSelect={domain => domain === "viewshed" ? setLayerSettingsOpen(value => !value) : integration.onSelect(domain)}
        onCollapse={() => { setDockOpen(false); setLayerSettingsOpen(false); }}>
        {layerSettingsOpen && <section className="panel layer-panel domain-layer-panel" id="domain-layer-panel" aria-label="Map layers">
          <header className="panel-title"><h2>Viewshed</h2><button aria-label="Close map layers" onClick={() => { setLayerSettingsOpen(false); domainButton.current?.focus(); }}><X size={19} /></button></header>
          <div className="layer-body">{settingsContent}</div>
        </section>}
      </DataDomainDock> : <button className="panel collapsed-product-dock" aria-label="Map layers" onClick={() => setDockOpen(true)}><Layers3 size={21} /></button>}
    </div>
    {helpOpen && <aside ref={settingsPanel} id="viewshed-help" className="viewshed-controls" aria-label="Viewshed help">
      <header className="viewshed-panel-heading"><h2>Viewshed help</h2><button aria-label="Close map help" onClick={closePanel}><X size={18} /></button></header>
      <details open className="viewshed-method"><summary>How to read this map</summary>
        {data.catalog.components && <p>The weight layers are additional diagnostics on the saved pilot samples. Terrain includes distance decay; Above-ground is conditional roof/vegetation transmission. Distance is a separate centroid diagnostic and must not be multiplied into terrain again. The original Lower/Upper/Complete scores remain the pilot’s unweighted transmission estimates.</p>}
        <p>0% means no modeled viewability; 100% means fully viewable in this scenario. A lower estimate of 0% with a positive upper estimate is uncertain, rather than confirmed obstruction.</p>
        <p>Sources use 15 outdoor land observers per H3 R7 cell. Water targets use a 30 m lattice, with a weighted sampling approximation. Obstacles use a 10 m grid; terrain is 30 m.</p>
        <p>Eye height is 1.7 m above local ground and water-target height is 1 m. The terrain model applies Earth curvature and the configured refraction correction, so a clear path still has a water-surface horizon.</p>
        <p>Scores describe the portion of each water cell within at least one observer’s 15-mile reach. Individual comparisons beyond that distance contribute zero. Shading covers the cell’s water shape, including edge portions that may fall outside reach.</p>
        <p>All-source overview averages per-source scores with all {data.catalog.source_count} sources in the denominator. Each source’s in-reach water portion can differ; this is a mean of source-cell scores, rather than a whole-water-area mean.</p>
        <p>Terrain and roofs block rays; WorldCover and canopy height estimate vegetation transmission. Buildings are treated as a complete inventory: no building footprint means no building. Missing heights on land retain uncertainty.</p>
      </details>
      <details className="viewshed-method"><summary>Basemap credits</summary>
        <p><a href="https://www.maptiler.com/copyright/">© MapTiler</a> · Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>.</p>
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
    </aside>}
    <div className="viewshed-map-area">
      {selection && !insightsOpen && !layerSettingsOpen && selectedInspector}
      {panel?.kind === "coordinates" && <CoordinatePopup key={`${panel.coordinates.lat}:${panel.coordinates.lon}`} coordinates={panel.coordinates} onClose={closePanel} />}
      {mode === "targetSources" && !reverseCurrent && <p role="status" className="viewshed-floating-status">Loading land-source weights…</p>}
      {mode === "targetSources" && reverseCurrent?.error && <WarningNotice title="Land-source weights unavailable" message={reverseCurrent.error} onRetry={() => setRetry(r => r + 1)} retryLabel="Retry land-source weights" />}
      {mode === "source" && !current && <p role="status" className="viewshed-floating-status">Loading source scores…</p>}
      {mode === "source" && current?.error && <WarningNotice title="Source scores unavailable" message={current.error} onRetry={() => setRetry(r => r + 1)} retryLabel="Retry source scores" />}

    </div>
  </section>;
}

export default function ViewshedLayer({ onContextChange, integration }: { onContextChange?: (context: string) => void; integration: ViewshedIntegration }) {
  const revision = useDataRevision(["viewshed"]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; data?: ViewshedData; error?: string }>();
  useEffect(() => {
    let cancelled = false;
    loadViewshed().then(data => { if (!cancelled) setResult({ attempt, data }); }).catch((e: unknown) => {
      if (!cancelled) setResult({ attempt, error: e instanceof Error ? e.message : "Cannot load viewshed data." });
    });
    return () => { cancelled = true; };
  }, [attempt, revision]);
  const current = result?.attempt === attempt ? result : undefined;
  if (current?.data) return <PilotLayer data={current.data} onContextChange={onContextChange} integration={integration} />;
  return <aside className="viewshed-load hosted-viewshed-load" aria-label="Viewshed data"><Eye size={32} /><h1>Viewshed</h1><button onClick={() => integration.onSelect("seascape")}>Return to Seascape layers</button>
    {current?.error ? <WarningNotice title="Viewshed data unavailable" message={current.error} onRetry={() => setAttempt(a => a + 1)} retryLabel="Retry viewshed data" /> : <p role="status">Loading the local viewshed pilot…</p>}
  </aside>;
}
