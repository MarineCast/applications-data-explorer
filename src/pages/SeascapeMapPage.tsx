import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers3,
  Check,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import MapCanvas from "../components/MapCanvas";
import MapSwipeCompare from "../components/MapSwipeCompare";
import { createMapCameraLink } from "../data/mapCamera";
import MapLegend from "../components/MapLegend";
import DatasetInsights from "../components/DatasetInsights";
import type { InsightDataset } from "../components/DatasetInsights";
import { useComparisonTimeline } from "../components/useComparisonTimeline";
import MapToolDrawer from "../components/MapToolDrawer";
import AtlasDialog from "../components/AtlasDialog";
import { createColorScale, createCategoryScale, palettes } from "../data/colorScale";
import { standardizeLayer } from "../data/standardize";
import type { PaletteId, ScaleMode } from "../data/colorScale";
import type { Cell } from "../data/demo";
import {
  loadSeascapeCatalog,
  loadSeascapeLayer,
  sourceValue,
} from "../data/seascape";
import type {
  NativeResolution,
  SeascapeCatalog,
  SeascapeFeature,
  SeascapeLayer,
} from "../data/seascape";
function useLayer(
  catalog: SeascapeCatalog | undefined,
  field: SeascapeFeature | undefined,
  slice?: string,
) {
  const [state, setState] = useState<{
    layer?: SeascapeLayer;
    error?: string;
    field?: SeascapeFeature;
    slice?: string;
  }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (catalog && field)
      loadSeascapeLayer(catalog, field, slice)
        .then((layer) => {
          if (active) setState({ layer, field, slice });
        })
        .catch((error) => {
          if (active) setState({ error: String(error.message), field, slice });
        });
    return () => {
      active = false;
    };
  }, [catalog, field, slice, attempt]);
  return {
    layer: state.layer?.field === field && state.slice === slice ? state.layer : undefined,
    error: state.field === field && state.slice === slice ? state.error : undefined,
    retry: () => {
      setState({});
      setAttempt((a) => a + 1);
    },
  };
}
function metric(value: number | null | undefined, unit: string, precision = 7) {
  return value == null
    ? "Unavailable"
    : `${value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1e7) ? value.toExponential(3) : value.toLocaleString(undefined, { maximumSignificantDigits: precision })} ${unit}`;
}
function VariableSelect({
  label,
  catalog,
  resolution,
  dataset,
  value,
  onChange,
}: {
  label: string;
  catalog: SeascapeCatalog;
  resolution: NativeResolution;
  dataset: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const fields = catalog.features.filter((f) => f.resolution === resolution && (f.dataset ?? "seascape") === dataset);
  const families = Array.from(new Set(fields.map((f) => f.family)));
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {families.map((family) => (
          <optgroup
            key={family}
            label={family === "PREFERRED" ? "Preferred source aliases" : family}
          >
            {fields
              .filter((f) => f.family === family)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id === "BATHYMETRY"
                    ? "Bathymetry · mean depth (m)"
                    : f.name}
                  {!f.available ? " · unavailable" : ""}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
export default function SeascapeMapPage() {
  const [catalog, setCatalog] = useState<SeascapeCatalog>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [resolution, setResolution] = useState<NativeResolution>(6);
  const [dataset, setDataset] = useState("seascape");
  const [otherDataset, setOtherDataset] = useState("seascape");
  const [slice, setSlice] = useState<string>();
  const [otherSlice, setOtherSlice] = useState<string>();
  const [id, setId] = useState("BATHYMETRY");
  const [otherId, setOtherId] = useState("BATHYMETRY_LOCAL_ANOMALY");
  const [selected, setSelected] = useState<{ cell: Cell; right: boolean }>();
  const [opacity, setOpacity] = useState(0.8);
  const [palette, setPalette] = useState<PaletteId>("ocean");
  const [scaleMode, setScaleMode] = useState<ScaleMode>("equal");
  const [compare, setCompare] = useState(false);
  const [cameraLink] = useState(createMapCameraLink);
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [standardize, setStandardize] = useState(false);
  const [layers, setLayers] = useState(() => window.innerWidth > 900);
  const layersButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!layers) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setLayers(false);
      layersButton.current?.focus();
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [layers]);
  const [dialog, setDialog] = useState<"export" | "help" | "source">();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsSide, setInsightsSide] = useState<"left" | "right">("left");
  const [legendSide, setLegendSide] = useState<"left" | "right">();
  const setLegendOpen = useCallback((side: "left" | "right" | undefined) => {
    setLegendSide(side);
    if (side) {
      setToolsOpen(false);
      setLayers(false);
      setSelected(undefined);
      setDialog(undefined);
    }
  }, []);
  const setLeftLegendOpen = useCallback((open: boolean) => setLegendOpen(open ? "left" : undefined), [setLegendOpen]);
  const setRightLegendOpen = useCallback((open: boolean) => setLegendOpen(open ? "right" : undefined), [setLegendOpen]);
  const toggleLayers = () => {
    setToolsOpen(false);
    setLegendSide(undefined);
    setLayers(!layers);
  };
  const [copied, setCopied] = useState<string>();
  useEffect(() => {
    let active = true;
    loadSeascapeCatalog()
      .then((c) => {
        if (active) {
          setCatalog(c);
          setError(undefined);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const field = catalog?.features.find(
    (f) => f.id === id && f.resolution === resolution,
  );
  const otherField = compare
    ? catalog?.features.find(
        (f) => f.id === otherId && f.resolution === resolution,
      )
    : undefined;
  const left = useLayer(catalog, field, slice);
  const right = useLayer(catalog, otherField, otherSlice);
  const leftStandardized = useMemo(
    () => (left.layer && !left.layer.categories ? standardizeLayer(left.layer) : undefined),
    [left.layer],
  );
  const rightStandardized = useMemo(
    () => (right.layer && !right.layer.categories ? standardizeLayer(right.layer) : undefined),
    [right.layer],
  );
  const leftDisplay = standardize && !left.layer?.categories ? leftStandardized?.layer : left.layer;
  const rightDisplay = standardize && !right.layer?.categories ? rightStandardized?.layer : right.layer;
  const leftScale = useMemo(
    () =>
      leftDisplay
        ? leftDisplay.categories ? createCategoryScale(leftDisplay.values, leftDisplay.categories, palette) : createColorScale(leftDisplay.values, palette, scaleMode)
        : undefined,
    [leftDisplay, palette, scaleMode],
  );
  const rightScale = useMemo(
    () =>
      rightDisplay
        ? rightDisplay.categories ? createCategoryScale(rightDisplay.values, rightDisplay.categories, palette) : createColorScale(rightDisplay.values, palette, scaleMode)
        : undefined,
    [rightDisplay, palette, scaleMode],
  );
  const currentDisplay =
    selected?.right && compare ? rightDisplay : leftDisplay;
  const currentStandardized =
    selected?.right && compare ? rightStandardized : leftStandardized;
  const current = selected?.right && compare ? right.layer : left.layer;
  const visible = useMemo(() => current?.cells ?? [], [current]);
  const originalValue = (layer: SeascapeLayer | undefined, cell: string) => layer?.rawValues?.get(cell) ?? layer?.values.get(cell) ?? null;
  const currentDataset = catalog?.datasets?.[current?.field.dataset ?? "seascape"];
  const depth = current?.id === "BATHYMETRY";
  const insightsRight = compare && insightsSide === "right";
  const insightLayer = insightsRight ? right.layer : left.layer;
  const insightRow = selected && insightLayer ? insightLayer.index.get(selected.cell.id) : undefined;
  const timeline = useComparisonTimeline(catalog, field, otherField, compare && insightsOpen);
  const describeLayer = (rightSide: boolean): InsightDataset => {
    const layer = rightSide ? right.layer : left.layer;
    const feature = rightSide ? otherField : field;
    const info = catalog?.datasets?.[feature?.dataset ?? "seascape"];
    const published = info ? info.publishedAt : catalog?.publishedAt;
    const standardized = rightSide ? rightStandardized : leftStandardized;
    return {
      name: feature?.name ?? "Active data layer", unit: feature?.unit ?? "", resolution,
      slice: layer?.slice,
      scope: "Full native area · non-null cells · unweighted",
      values: layer?.rawValues ?? layer?.values, categorical: Boolean(layer?.categories ?? feature?.kind === "categorical"),
      colors: palettes[palette].colors, error: rightSide ? right.error : left.error,
      categoryColors: feature?.categories ? new Map(feature.categories.map((value, i) => [value, (rightSide ? rightScale : leftScale)?.colors[i] ?? palettes[palette].colors[0]])) : undefined,
      note: standardize && !layer?.categories ? standardized?.unavailable
        ? "Standardization is unavailable. Insights retains original values."
        : "Map: z-scores. Insights: original source values." : undefined,
      metadata: [
        { label: "Product", value: info?.name ?? "Seascape" },
        { label: "Release", value: info?.release ?? catalog?.release ?? "Unavailable" },
        ...(feature?.sourceRelease ? [{ label: "Source release", value: feature.sourceRelease }] : []),
        ...(layer?.slice ? [{ label: layer.slice.axis, value: layer.slice.label }] : []),
        ...(published ? [{ label: "Published", value: published }] : []),
        { label: "Source", value: feature?.sourcePath ?? "Unavailable" },
        { label: "Coverage", value: info?.limitations ?? catalog?.sourceCompleteness ?? "Source coverage retained" },
      ],
    };
  };
  const selectedQualifiers = (layer?: SeascapeLayer) => Object.entries(layer?.qualifiers ?? {}).map(([label, values]) => {
    const index = selected ? layer?.index.get(selected.cell.id) : undefined;
    return { label, value: sourceValue(index == null ? null : values[index]) };
  });
  const toggleCompare = () => {
    setToolsOpen(false);
    setLegendSide(undefined);
    setCompare(!compare);
    setSelected(undefined);
  };
  const cellPopup =
    selected && current ? (
      <section aria-label="Map cell preview">
        <header>
          <strong>H3 R{resolution} cell</strong>
          <button
            aria-label="Dismiss cell preview"
            onClick={() => setSelected(undefined)}
          >
            <X size={14} />
          </button>
        </header>
        <dl>
          <div>
            <dt>ID</dt>
            <dd>
              <code>{selected.cell.id}</code>
            </dd>
          </div>
          <div>
            <dt>{depth ? "Mean depth" : "Value"}</dt>
            <dd>
              {current.categories ? sourceValue(originalValue(current, selected.cell.id)) : metric(current.values.get(selected.cell.id), current.unit, 4)}
            </dd>
          </div>
          {standardize && !current?.categories && (
            <div>
              <dt>Standardized value</dt>
              <dd>
                {metric(currentDisplay?.values.get(selected.cell.id), "z", 4)}
              </dd>
            </div>
          )}
          <div>
            <dt>Data status</dt>
            <dd
              className={
                current.values.get(selected.cell.id) == null ? "" : "available"
              }
            >
              {current.values.get(selected.cell.id) == null
                ? "Unavailable"
                : "Available"}
            </dd>
          </div>
        </dl>
        <button
          className="atlas-popup-source"
          onClick={() => {
            setDialog("source");
          }}
        >
          Source & quality <ChevronRight size={13} />
        </button>
      </section>
    ) : undefined;
  const exportLayer = () => {
    if (!current) return;
    const payload = {
      release: currentDataset?.release ?? catalog?.release,
      manifest_sha256: currentDataset?.manifestSha256 ?? catalog?.manifestSha256,
      dataset: current.field.dataset ?? "seascape",
      slice: current.slice,
      source_release: current.field.sourceRelease,
      source_path: current.field.sourcePath,
      source_sha256: current.field.sourceSha256,
      column: current.field.column ?? current.id,
      display_standardization: standardize && !current.categories
        ? {
            formula: "(value - mean) / std",
            scope: "full native layer, non-null cells, unweighted",
            ddof: 0,
            count: currentStandardized?.count,
            mean: currentStandardized?.mean,
            std: currentStandardized?.std,
            unavailable: currentStandardized?.unavailable,
          }
        : undefined,
      unit: current.unit,
      h3_resolution: resolution,
      scope:
        currentDataset?.limitations ?? "Full native area; published partial source coverage; not an ecological qualification",
      modeling_eligibility: current.field.modelingEligibility,
      cells: current.cells.map((c) => ({
        h3_index: c.id,
        value: originalValue(current, c.id),
      })),
      qualifiers: current.qualifiers,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${current.field.dataset ?? "seascape"}-${current.id}-R${resolution}${current.slice ? `-${current.slice.value}` : ""}.json`;
    link.click();
    const revoke = URL.revokeObjectURL.bind(URL);
    window.setTimeout(() => revoke(url), 1000);
    setDialog(undefined);
  };
  const row =
    selected && current ? current.index.get(selected.cell.id) : undefined;
  const changeField = (value: string) => {
    setId(value);
    setSelected(undefined);
  };
  const changeResolution = (res: NativeResolution) => {
    setResolution(res);
    setSelected(undefined);
    const pick = (domain: string, chosen: string) => {
      const candidates = catalog?.features.filter((f) => f.resolution === res && (f.dataset ?? "seascape") === domain) ?? [];
      return candidates.find((f) => f.id === chosen) ?? candidates.find((f) => f.id === "BATHYMETRY") ?? candidates.find((f) => f.kind !== "categorical") ?? candidates[0];
    };
    const chosen = pick(dataset, id);
    const other = pick(otherDataset, otherId);
    setDataset(chosen?.dataset ?? "seascape");
    setId(chosen?.id ?? "BATHYMETRY");
    setOtherDataset(other?.dataset ?? "seascape");
    setOtherId(other?.id ?? "BATHYMETRY");
    setSlice(undefined);
    setOtherSlice(undefined);
  };
  const productSelect = (rightSide: boolean) => catalog?.datasets && (
    <label className="field">{rightSide ? "Right data product" : "Data product"}
      <select value={rightSide ? otherDataset : dataset} onChange={(e) => {
        const domain = e.target.value;
        const candidates = catalog.features.filter((f) => (f.dataset ?? "seascape") === domain && f.resolution === resolution);
        const first = candidates.find((f) => f.id === "BATHYMETRY") ?? candidates.find((f) => f.kind !== "categorical") ?? candidates[0];
        if (rightSide) { setOtherDataset(domain); setOtherId(first.id); setOtherSlice(undefined); }
        else { setDataset(domain); setId(first.id); setSlice(undefined); }
        setSelected(undefined);
      }}>
        {Object.entries(catalog.datasets).map(([key, info]) => <option key={key} value={key} disabled={!catalog.features.some((f) => f.dataset === key && f.resolution === resolution)}>{info.name}{!catalog.features.some((f) => f.dataset === key && f.resolution === resolution) ? " · unavailable at this resolution" : ""}</option>)}
      </select>
    </label>
  );
  const sliceSelect = (feature: SeascapeFeature | undefined, value: string | undefined, change: (v: string) => void, rightSide = false) => {
    const product = feature?.productId ? catalog?.products?.[feature.productId] : undefined;
    return product && "slices" in product ? <label className="field">{rightSide ? `Right ${product.axis.toLowerCase()}` : product.axis}
      <select value={value ?? product.defaultSlice} onChange={(e) => { change(e.target.value); setSelected(undefined); }}>
        {Object.entries(product.slices).map(([key, slice]) => <option key={key} value={key}>{slice.label ?? key}</option>)}
      </select>
    </label> : null;
  };
  const step = (direction: number) => {
    const i = visible.findIndex((c) => c.id === selected?.cell.id);
    if (visible.length)
      setSelected({
        cell: visible[(i + direction + visible.length) % visible.length],
        right: selected?.right ?? false,
      });
  };
  if (!catalog)
    return (
      <main className="seascape-loading" aria-label="Features explorer">
        <h1 className="sr-only">Features</h1>
        {error ? (
          <div role="alert">
            <h2>Feature data unavailable</h2>
            <p>{error}</p>
            <button
              className="button"
              onClick={() => {
                setError(undefined);
                setAttempt((a) => a + 1);
              }}
            >
              Retry local data
            </button>
          </div>
        ) : (
          <p role="status">Loading local Data catalog…</p>
        )}
      </main>
    );
  const leftMap = left.layer ? (
    <MapCanvas
      key={`left-${resolution}`}
      basemap="maptiler"
      cameraLink={cameraLink}
      overlayHost={overlayHost}
      feature="temperature"
      month={0}
      layer={leftDisplay!}
      colorScale={leftScale}
      popup={!insightsOpen && !selected?.right ? cellPopup : undefined}
      region="all"
      showGrid
      opacity={opacity}
      selected={selected?.cell.id}
      onSelect={(cell) => {
        setToolsOpen(false);
        setLegendSide(undefined);
        setSelected({ cell, right: false });
        setInsightsSide("left");
      }}
    />
  ) : (
    <div
      className="map-load-state"
      role={left.error ? "alert" : "status"}
    >
      {left.error ?? "Loading native source values…"}
      {left.error && <button onClick={left.retry}>Retry layer</button>}
    </div>
  );
  const rightMap = right.layer ? (
    <MapCanvas
      key={`right-${resolution}`}
      basemap="maptiler"
      cameraLink={cameraLink}
      overlayHost={overlayHost}
      showControls={false}
      feature="temperature"
      month={0}
      layer={rightDisplay!}
      colorScale={rightScale}
      popup={!insightsOpen && selected?.right ? cellPopup : undefined}
      region="all"
      showGrid
      opacity={opacity}
      selected={selected?.cell.id}
      onSelect={(cell) => {
        setToolsOpen(false);
        setLegendSide(undefined);
        setSelected({ cell, right: true });
        setInsightsSide("right");
      }}
    />
  ) : (
    <div
      className="map-load-state"
      role={right.error ? "alert" : "status"}
    >
      {right.error ?? "Loading comparison…"}
      {right.error && (
        <button onClick={right.retry}>Retry comparison</button>
      )}
    </div>
  );
  return (
    <main
      aria-label="Features explorer"
      className={`map-page reference-map seascape-map atlas-map colorbar-map drawer-map ${compare ? "comparing swipe-comparing" : ""} ${insightsOpen ? "insights-open" : ""}`}
    >
      <h1 className="sr-only">Features</h1>
      <DatasetInsights open={insightsOpen} onOpenChange={open => {
        setInsightsOpen(open);
        if (open) { setToolsOpen(false); setLegendSide(undefined); setLayers(false); setDialog(undefined); }
      }} dataset={describeLayer(insightsRight)} cell={selected && insightLayer && selected.right === insightsRight ? {
        id: selected.cell.id, value: originalValue(insightLayer, selected.cell.id), coordinates: [selected.cell.lat, selected.cell.lon],
        details: [
          ...(standardize && !insightLayer.categories ? [{ label: "Map z-score", value: metric((insightsRight ? rightDisplay : leftDisplay)?.values.get(selected.cell.id), "z", 4) }] : []),
        ],
        qualifiers: Object.entries(insightLayer.qualifiers).map(([label, values]) => ({ label, value: sourceValue(insightRow == null ? null : values[insightRow]) })),
      } : undefined} comparison={compare ? {
        left: describeLayer(false), right: describeLayer(true), temporal: timeline,
        cell: selected ? { id: selected.cell.id, coordinates: [selected.cell.lat, selected.cell.lon],
          leftQualifiers: selectedQualifiers(left.layer), rightQualifiers: selectedQualifiers(right.layer) } : undefined,
      } : undefined} />
      <div className="maps">
        {compare ? <MapSwipeCompare left={leftMap} right={rightMap} onDragStart={() => {
          setToolsOpen(false);
          setLegendSide(undefined);
          setLayers(false);
          setSelected(undefined);
        }} /> : leftMap}
      </div>
      <div className="map-overlay-host" ref={setOverlayHost} />
      <div className={`map-legends ${compare ? "two-legends" : ""}`}>
        <div className="map-legend-tools">
          {left.layer && leftScale && (
            <MapLegend
              layer={leftDisplay!}
              scale={leftScale}
              side={compare ? "Left" : undefined}
              opacity={opacity}
              onPalette={setPalette}
              onScaleMode={setScaleMode}
              onOpacity={setOpacity}
              open={legendSide === "left"}
              onOpenChange={setLeftLegendOpen}
            />
          )}
          <MapToolDrawer
            open={toolsOpen}
            onOpenChange={(open) => {
              setToolsOpen(open);
              if (open) {
                setLegendSide(undefined);
                setLayers(false);
                setDialog(undefined);
              }
            }}
            compare={compare}
            canExport={Boolean(current)}
            onCompare={toggleCompare}
            onExport={() => { setLegendSide(undefined); setDialog("export"); }}
            onHelp={() => { setLegendSide(undefined); setDialog("help"); }}
          />
        </div>
        {compare && right.layer && rightScale && (
          <div className="comparison-legend">
            <MapLegend
              layer={rightDisplay!}
              scale={rightScale}
              side="Right"
              opacity={opacity}
              onPalette={setPalette}
              onScaleMode={setScaleMode}
              onOpacity={setOpacity}
              open={legendSide === "right"}
              onOpenChange={setRightLegendOpen}
            />
          </div>
        )}
      </div>
      {compare && (
        <div className="comparison-captions">
          <span>
            Left · {field?.name} · Native R{resolution}
          </span>
          <span>
            Right · {otherField?.name} · Native R{resolution}
          </span>
        </div>
      )}
      <button
        ref={layersButton}
        className="panel open-layers"
        aria-label="Map layers"
        aria-expanded={layers}
        onClick={toggleLayers}
      >
        <Layers3 size={19} /> Layers{" "}
        <span className="atlas-layer-count">{compare ? 2 : 1}</span>{" "}
        {layers ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {layers && (
        <section className="panel layer-panel" aria-label="Map layers">
          <div className="panel-title">
            <h2>Data layers</h2>
            <button
              aria-label="Close map layers"
              onClick={() => setLayers(false)}
            >
              <X size={19} />
            </button>
          </div>
          <div className="layer-body">
            {productSelect(false)}
            <VariableSelect
              label="Dataset / feature"
              catalog={catalog}
              resolution={resolution}
              dataset={dataset}
              value={id}
              onChange={changeField}
            />
            {sliceSelect(field, slice, setSlice)}
            <label className="field">
              Native H3 resolution
              <select
                aria-label="Native H3 resolution"
                value={resolution}
                onChange={(e) =>
                  changeResolution(Number(e.target.value) as NativeResolution)
                }
              >
                <option value="6">
                  R6 ·{" "}
                  {catalog.resolutions?.["6"]?.rows.toLocaleString() ??
                    "native"}{" "}
                  cells
                </option>
                <option value="8">
                  R8 ·{" "}
                  {catalog.resolutions?.["8"]?.rows.toLocaleString() ??
                    "native"}{" "}
                  cells
                </option>
              </select>
            </label>
            {compare && (
              <>
              {productSelect(true)}
              <VariableSelect
                label="Right map feature"
                catalog={catalog}
                resolution={resolution}
                dataset={otherDataset}
                value={otherId}
                onChange={(value) => {
                  setOtherId(value);
                  setSelected(undefined);
                }}
              />
              {sliceSelect(otherField, otherSlice, setOtherSlice, true)}
              </>
            )}
            <p className="atlas-standardize-note">{catalog.datasets?.[dataset]?.limitations}</p>
            {catalog.unavailableProducts?.map((p) => <p className="atlas-standardize-note" key={p.name}>{p.name}: {p.reason}</p>)}
            <label className="atlas-standardize">
              <span>
                Standardize<small>(value − mean) / std</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label="Standardize"
                checked={standardize}
                onChange={(e) => setStandardize(e.target.checked)}
              />
            </label>
            <p className="atlas-standardize-note">
              Full area · non-null cells · population std. Categories keep their original labels and cannot be standardized.
            </p>
            {standardize &&
              (
                [
                  ["Left map", leftStandardized],
                  ["Right map", compare ? rightStandardized : undefined],
                ] as const
              ).map(([side, result]) =>
                result?.unavailable ? (
                  <p
                    key={side}
                    className="atlas-standardize-note"
                    role="status"
                  >
                    {compare ? `${side}: ` : ""}
                    {result.unavailable === "empty"
                      ? "Standardization unavailable: no non-null values."
                      : "Standardization unavailable: zero standard deviation."}
                  </p>
                ) : null,
              )}
          </div>
        </section>
      )}
      {dialog && (
        <AtlasDialog
          title={
            dialog === "export"
              ? "Export local layer"
              : dialog === "source"
                ? "Source & quality"
                : "Explore the data atlas"
          }
          onClose={() => setDialog(undefined)}
        >
          {dialog === "source" ? (
            <div className="atlas-source-inspector">
              <div className="atlas-cell-detail">
                {selected && current ? (
                  <>
                    <h3>Selected native H3 R{resolution} cell</h3>
                    <dl>
                      <div>
                        <dt>ID</dt>
                        <dd>
                          <code>{selected.cell.id}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Exact stored value</dt>
                        <dd>
                          {sourceValue(originalValue(current, selected.cell.id))}{" "}
                          {current.unit}
                        </dd>
                      </div>
                      {standardize && !current?.categories && (
                        <div>
                          <dt>Standardized value</dt>
                          <dd>
                            {sourceValue(
                              currentDisplay?.values.get(selected.cell.id),
                            )}{" "}
                            z
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt>Cell center</dt>
                        <dd>
                          {selected.cell.lat.toFixed(5)}°,{" "}
                          {selected.cell.lon.toFixed(5)}°
                        </dd>
                      </div>
                      <div>
                        <dt>Data status</dt>
                        <dd>
                          {current.values.get(selected.cell.id) == null
                            ? "Unavailable"
                            : "Available"}
                        </dd>
                      </div>
                    </dl>
                    <div className="atlas-cell-actions">
                      <button
                        className="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              selected.cell.id,
                            );
                            setCopied(selected.cell.id);
                          } catch {
                            setCopied(undefined);
                          }
                        }}
                      >
                        {copied === selected.cell.id ? (
                          <Check size={15} />
                        ) : (
                          <Copy size={15} />
                        )}{" "}
                        {copied === selected.cell.id ? "Copied" : "Copy ID"}
                      </button>
                      <button className="button" onClick={() => step(-1)}>
                        <ChevronLeft size={16} /> Previous cell
                      </button>
                      <button className="button" onClick={() => step(1)}>
                        Next cell <ChevronRight size={16} />
                      </button>
                    </div>
                    <p className="source-note">
                      Full native H3 cell geometry. See Source & quality for
                      original row qualifiers and provenance.
                    </p>
                  </>
                ) : (
                  <p className="detail-note">
                    Click a map cell to inspect its exact source value.
                  </p>
                )}
              </div>
              <div className="environment-context source-quality">
                <p>
                  <strong>Column</strong> <code>{current?.id}</code>
                </p>
                {selected && (
                  <p>
                    <strong>Exact stored value</strong>{" "}
                    {sourceValue(originalValue(current, selected.cell.id))}{" "}
                    {current?.unit}
                  </p>
                )}
                {standardize && !current?.categories && (
                  <p>
                    <strong>Display standardization</strong>(value − mean) / std
                    · population std · full native area, non-null cells,
                    unweighted. Mean: {sourceValue(currentStandardized?.mean)}{" "}
                    {current?.unit}; std:{" "}
                    {sourceValue(currentStandardized?.std)} {current?.unit}.
                  </p>
                )}
                <p>
                  <strong>Source release</strong> {current?.field.sourceRelease}
                </p>
                <p>
                  <strong>Source artifact</strong> {current?.field.sourcePath}
                </p>
                <p>
                  <strong>Source SHA-256</strong>{" "}
                  <code>{current?.field.sourceSha256}</code>
                </p>
                <p>
                  <strong>Data updated</strong> {currentDataset?.publishedAt ?? catalog.publishedAt}
                </p>
                <p>
                  <strong>Source status</strong> {currentDataset?.status ?? catalog.receiptStatus} · {currentDataset ? currentDataset.publishedAt ?? "source observation dates retained below" : catalog.publishedAt}
                </p>
                <p>
                  <strong>Definition</strong> {current?.field.definition}{" "}
                  {current?.unit === "source units" &&
                    "This field's unit is not encoded by the adapter; consult its source definition."}
                </p>
                <p>
                  <strong>Modeling eligibility</strong>{" "}
                  {current?.field.modelingEligibility}
                </p>
                <p>
                  <strong>Scope</strong>{" "}
                  {currentDataset?.limitations}
                  {current?.slice && <span> {current.slice.axis}: {current.slice.label}. </span>}
                  {current?.field.dataset === "governance" ? <span> Original dataset shapes and attributes are retained under Governance/OriginalData.</span> : <a
                    href={`/local-data/seascape/${catalog.manifestSha256}/consumption-guide.txt`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source consumption guide
                  </a>}{" "}
                  · Source observation dates may be unknown. Static history does
                  not establish current presence.
                </p>
                {row !== undefined ? (
                  Object.entries(current?.qualifiers ?? {}).map(
                    ([name, column]) => (
                      <p key={name}>
                        <strong>{name}</strong> {sourceValue(column[row])}
                      </p>
                    ),
                  )
                ) : (
                  <p>
                    Select a cell to see its original status, coverage, and
                    observation-date fields.
                  </p>
                )}
              </div>
            </div>
          ) : dialog === "export" ? (
            <>
              <p>
                Download the full native {current?.name} layer as JSON,
                including exact values, nulls, H3 IDs, units, source bindings
                and row qualifiers. The file is created locally. Display
                standardization does not replace the original exported values.
              </p>
              <button
                className="button"
                onClick={exportLayer}
                disabled={!current}
              >
                <Download size={16} /> Download layer JSON
              </button>
            </>
          ) : (
            <>
              <p>
                Explore the local seascape, governance, annual kelp and directional coastal products across their native areas.
                Choose a data product, variable and native resolution in Layers. Annual kelp and coastal rays also require a survey year or bearing; adjust its
                palette, scale, and opacity by clicking the colorbar.
                Standardize in Layers displays dimensionless z-scores using the
                full-area mean and population standard deviation; original
                source values stay available in the inspector and export.
              </p>
              <p>
                Click a cell for its source value. Compare links both layers to the same geographic view. Drag the
                divider to reveal each layer; pan and zoom move them together.
                Each variable keeps its own legend and native resolution. R8
                cells load at the current zoom.
              </p>
              <p>
                Basemap credits: <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">© MapTiler</a>{" "}
                · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>.
              </p>
              <p>
                Values may be missing and source inventories are partial.
                Historic records and mapped intersections do not establish
                current habitat presence or absence. The other explorer pages
                still use synthetic demo data.
              </p>
            </>
          )}
        </AtlasDialog>
      )}
    </main>
  );
}
