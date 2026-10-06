import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Layers3,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Hexagon,
  Thermometer,
  Droplets,
  Ship,
  Eye,
  Play,
  Pause,
  Copy,
  Check,
} from "lucide-react";
import MapCanvas from "../components/MapCanvas";
import { FeatureSelect, RegionSelect, Stat } from "../components/Controls";
import {
  featureById,
  months,
  filterCells,
  summarize,
  valueFor,
  formatValue,
  features,
} from "../data/demo";
import type { Cell, FeatureId, Region } from "../data/demo";
const icons = {
  temperature: Thermometer,
  chlorophyll: Droplets,
  traffic: Ship,
  viewability: Eye,
};
type Side = "left" | "right";
type DetailTab = "series" | "nearby" | "context";
export default function MapPage() {
  const [feature, setFeature] = useState<FeatureId>("temperature");
  const [month, setMonth] = useState(6);
  const [region, setRegion] = useState<Region>("all");
  const [selection, setSelection] = useState<{ cell: Cell; side: Side }>();
  const [grid, setGrid] = useState(true);
  const [opacity, setOpacity] = useState(0.8);
  const [compare, setCompare] = useState(false);
  const [other, setOther] = useState<FeatureId>("chlorophyll");
  const [otherMonth, setOtherMonth] = useState(0);
  const [layers, setLayers] = useState(() => window.innerWidth >= 700);
  const [detailTab, setDetailTab] = useState<DetailTab>("series");
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const selected = selection?.cell;
  const rightSelected = compare && selection?.side === "right";
  const detailFeature = rightSelected ? other : feature;
  const detailMonth = rightSelected ? otherMonth : month;
  const f = featureById(feature),
    df = featureById(detailFeature);
  const visibleCells = filterCells(region);
  const summary = summarize(visibleCells, detailFeature, detailMonth);
  const series = months.map((_, i) =>
    selected
      ? valueFor(selected, detailFeature, i)
      : summarize(visibleCells, detailFeature, i).mean,
  );
  const nearby = selected
    ? [...visibleCells]
        .filter((c) => c.id !== selected.id)
        .sort(
          (a, b) =>
            (a.lat - selected.lat) ** 2 +
            (a.lon - selected.lon) ** 2 -
            ((b.lat - selected.lat) ** 2 + (b.lon - selected.lon) ** 2),
        )
        .slice(0, 3)
    : [];
  const changeDetailMonth = (v: number) =>
    rightSelected ? setOtherMonth(v) : setMonth(v);
  useEffect(() => {
    if (!playing || !df.temporal) return;
    const timer = window.setInterval(() => {
      if (rightSelected) setOtherMonth((v) => (v + 1) % 12);
      else setMonth((v) => (v + 1) % 12);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [playing, df.temporal, rightSelected]);
  const selectCell = (cell: Cell, side: Side) => {
    setSelection({ cell, side });
    setCopied(false);
  };
  const toggleComparison = () => {
    setPlaying(false);
    setCompare(!compare);
    setSelection(undefined);
  };
  const stepCell = (step: number) => {
    const index = visibleCells.findIndex((c) => c.id === selected?.id);
    selectCell(
      visibleCells[(index + step + visibleCells.length) % visibleCells.length],
      rightSelected ? "right" : "left",
    );
  };
  return (
    <main className={`map-page reference-map ${compare ? "comparing" : ""}`}>
      <div className="maps">
        <MapCanvas
          basemap="maptiler"
          feature={feature}
          month={month}
          region={region}
          selected={selected?.id}
          onSelect={(c) => selectCell(c, "left")}
          showGrid={grid}
          opacity={opacity}
        />
        {compare && (
          <MapCanvas
            basemap="maptiler"
            feature={other}
            month={otherMonth}
            region={region}
            selected={selected?.id}
            onSelect={(c) => selectCell(c, "right")}
            showGrid={grid}
            opacity={opacity}
          />
        )}
      </div>
      {compare && (
        <div className="comparison-captions">
          <span>
            Left · {f.short} · {f.temporal ? months[month] + " 2026" : "Static"}
          </span>
          <span>
            Right · {featureById(other).short} ·{" "}
            {featureById(other).temporal
              ? months[otherMonth] + " 2026"
              : "Static"}
          </span>
        </div>
      )}
      {!layers && (
        <button className="panel open-layers" onClick={() => setLayers(true)}>
          <Layers3 size={19} /> Map layers
        </button>
      )}
      {layers && (
        <section className="panel layer-panel" aria-label="Map layers">
          <div className="panel-title">
            <h2>Map layers</h2>
            <button
              aria-label="Close map layers"
              onClick={() => setLayers(false)}
            >
              <X size={19} />
            </button>
          </div>
          <div className="layer-body">
            <FeatureSelect
              label="Dataset / feature"
              value={feature}
              onChange={setFeature}
            />
            <div className="metric-options" aria-label="Map metrics">
              {features.map((x) => {
                const Icon = icons[x.id];
                return (
                  <button
                    key={x.id}
                    aria-pressed={feature === x.id}
                    onClick={() => setFeature(x.id)}
                  >
                    <Icon size={20} />
                    {x.name}
                  </button>
                );
              })}
            </div>
            <strong className="legend-title">{f.short}</strong>
            <div className="legend-swatches">
              {[
                "#d4eaff",
                "#abd7ff",
                "#75bbfa",
                "#3896ef",
                "#116cd6",
                "#074797",
              ].map((color) => (
                <span key={color} style={{ background: color }} />
              ))}
            </div>
            <div className="legend-labels">
              <span>
                {f.range[0]} {f.unit}
              </span>
              <span>
                {f.range[1]} {f.unit}
              </span>
            </div>
            <div className="missing-key">
              <i /> Unavailable · synthetic values
            </div>
            <label className="check grid-toggle">
              <Hexagon size={23} />
              <span>H3 grid · resolution 5</span>
              <input
                type="checkbox"
                checked={grid}
                onChange={(e) => setGrid(e.target.checked)}
              />
            </label>
            <details className="more-layers">
              <summary>
                More layers <ChevronDown size={16} />
              </summary>
              <RegionSelect
                value={region}
                onChange={(v) => {
                  setRegion(v);
                  setSelection(undefined);
                }}
              />
              <label className="opacity">
                Opacity <span>{Math.round(opacity * 100)}%</span>
                <input
                  aria-label="Layer opacity"
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                />
              </label>
            </details>
            <button
              className={`button compare-button ${compare ? "active" : ""}`}
              onClick={toggleComparison}
            >
              <ArrowLeftRight size={16} />
              {compare ? "Close comparison" : "Compare layers"}
            </button>
            {compare && (
              <div className="compare-fields">
                <FeatureSelect
                  label="Right map feature"
                  value={other}
                  onChange={setOther}
                />
                {featureById(other).temporal && (
                  <label className="field">
                    Right map date
                    <select
                      value={otherMonth}
                      onChange={(e) => setOtherMonth(Number(e.target.value))}
                    >
                      {months.map((m, i) => (
                        <option value={i} key={m}>
                          {m} 2026
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </div>
        </section>
      )}
      <section className="panel explorer-sheet" aria-label="Map details">
        <div className="sheet-handle" />
        <div className="sheet-content">
          <section
            className="cell-overview"
            aria-label={selected ? "Selected cell" : "Regional summary"}
          >
            <div className="cell-title">
              <Hexagon size={39} fill="#086cff" strokeWidth={1.4} />
              <div>
                <h2>{selected ? `H3 Cell ${selected.id}` : "Salish Sea"}</h2>
                <p>
                  {selected
                    ? `${selected.zone === "north" ? "Northern" : "Southern"} waters · H3 resolution 5`
                    : "Pacific Northwest · select a cell to explore"}
                </p>
              </div>
              {selected && (
                <button
                  aria-label="Copy cell ID"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selected.id);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              )}
              {selected && (
                <button
                  aria-label="Close cell inspector"
                  onClick={() => setSelection(undefined)}
                >
                  <X size={17} />
                </button>
              )}
            </div>
            <div className="selection-context">
              {compare ? `${rightSelected ? "Right" : "Left"} map · ` : ""}
              {df.name} ·{" "}
              {df.temporal ? `${months[detailMonth]} 2026` : "Static demo"}
            </div>
            <div className="cell-metrics">
              {selected ? (
                features.map((x) => {
                  const Icon = icons[x.id];
                  return (
                    <div key={x.id}>
                      <Icon size={22} />
                      <span>
                        {x.short}
                        <strong>
                          {formatValue(
                            valueFor(selected, x.id, detailMonth),
                            x.id,
                          )}
                        </strong>
                      </span>
                    </div>
                  );
                })
              ) : (
                <>
                  <Stat
                    label="Mean"
                    value={formatValue(summary.mean, detailFeature)}
                  />
                  <Stat
                    label="Coverage"
                    value={`${summary.coverage.toFixed(1)}%`}
                  />
                  <Stat label="Demo cells" value={summary.count} />
                </>
              )}
            </div>
            <div className="sheet-actions">
              {selected ? (
                <>
                  <button className="button" onClick={() => stepCell(-1)}>
                    <ChevronLeft size={17} />
                    Previous cell
                  </button>
                  <button className="button" onClick={() => stepCell(1)}>
                    Next cell
                    <ChevronRight size={17} />
                  </button>
                  <span className="quality-note">Synthetic / unvalidated</span>
                </>
              ) : (
                <span className="quality-note">
                  {summary.available} available cells · Synthetic / unvalidated
                </span>
              )}
            </div>
          </section>
          <section className="detail-content" aria-label="Cell context">
            <div
              className="detail-tabs"
              role="tablist"
              aria-label="Cell detail views"
            >
              {(
                [
                  ["series", "Time series"],
                  ["nearby", "Nearby cells"],
                  ["context", "Environmental context"],
                ] as const
              ).map(([id, name]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={detailTab === id}
                  onClick={() => setDetailTab(id)}
                >
                  {name}
                </button>
              ))}
            </div>
            {detailTab === "series" ? (
              <div className="series-view">
                <div className="series-heading">
                  <strong>{df.short}</strong>
                  <span>
                    {selected ? "Selected cell" : "Regional mean"} · {df.unit}
                  </span>
                </div>
                {df.temporal ? (
                  <div className="spark-chart">
                    <svg
                      viewBox="0 0 600 105"
                      preserveAspectRatio="none"
                      role="img"
                      aria-label={`${df.name} synthetic monthly time series`}
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <line
                          key={i}
                          x1="0"
                          x2="600"
                          y1={i * 30 + 8}
                          y2={i * 30 + 8}
                          stroke="#e4eafa"
                        />
                      ))}
                      {series.map((v, i) => {
                        const next = series[i + 1];
                        const y = (n: number) =>
                          90 -
                          ((n - df.range[0]) / (df.range[1] - df.range[0])) *
                            75;
                        return v !== null &&
                          next !== undefined &&
                          next !== null ? (
                          <line
                            key={i}
                            x1={i * 54.5}
                            y1={y(v)}
                            x2={(i + 1) * 54.5}
                            y2={y(next)}
                            stroke="#137bff"
                            strokeWidth="2"
                          />
                        ) : null;
                      })}
                      <line
                        x1={detailMonth * 54.5}
                        x2={detailMonth * 54.5}
                        y1="0"
                        y2="103"
                        stroke="#137bff"
                        strokeDasharray="3 3"
                      />
                      {series[detailMonth] !== null && (
                        <circle
                          cx={detailMonth * 54.5}
                          cy={
                            90 -
                            ((series[detailMonth]! - df.range[0]) /
                              (df.range[1] - df.range[0])) *
                              75
                          }
                          r="5"
                          fill="#137bff"
                          stroke="white"
                          strokeWidth="2"
                        />
                      )}
                    </svg>
                    <div className="chart-months">
                      {months.map((m, i) => (
                        <button
                          key={m}
                          aria-label={`Chart ${m} 2026`}
                          aria-pressed={detailMonth === i}
                          onClick={() => changeDetailMonth(i)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="detail-note">This layer is time invariant.</p>
                )}
              </div>
            ) : detailTab === "nearby" ? (
              <div className="nearby-list">
                {selected ? (
                  nearby.map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        selectCell(c, rightSelected ? "right" : "left")
                      }
                    >
                      <Hexagon size={17} />
                      <code>{c.id}</code>
                      <strong>
                        {formatValue(
                          valueFor(c, detailFeature, detailMonth),
                          detailFeature,
                        )}
                      </strong>
                    </button>
                  ))
                ) : (
                  <p className="detail-note">
                    Select a cell to inspect nearby demo cells.
                  </p>
                )}
              </div>
            ) : (
              <div className="environment-context">
                <p>
                  <strong>Spatial support</strong> H3 resolution 5
                  {selected
                    ? ` · ${selected.lat.toFixed(3)}°, ${selected.lon.toFixed(3)}°`
                    : " · Salish Sea"}
                </p>
                <p>
                  <strong>Source</strong> Deterministic demo fixtures
                </p>
                <p>
                  <strong>Quality</strong> Synthetic / unvalidated. Missing
                  values stay unavailable.
                </p>
              </div>
            )}
          </section>
        </div>
        {df.temporal ? (
          <section className="sheet-timeline" aria-label="Map timeline">
            <button
              className="play-button"
              aria-label={playing ? "Pause timeline" : "Play timeline"}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? (
                <Pause size={19} />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
            </button>
            <button
              aria-label="Previous month"
              onClick={() => changeDetailMonth((detailMonth + 11) % 12)}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="timeline-track">
              <div>
                <strong>
                  {compare ? `${rightSelected ? "Right" : "Left"} map · ` : ""}
                  {months[detailMonth]} 2026
                </strong>
                <span>Monthly synthetic demo · Jan — Dec 2026</span>
              </div>
              <input
                type="range"
                aria-label="Map month"
                min="0"
                max="11"
                step="1"
                value={detailMonth}
                onChange={(e) => changeDetailMonth(Number(e.target.value))}
              />
              <div className="month-ticks">
                {months.map((m, i) => (
                  <button
                    className={i === detailMonth ? "chosen" : ""}
                    key={m}
                    aria-label={`Show ${m} 2026`}
                    aria-pressed={i === detailMonth}
                    onClick={() => changeDetailMonth(i)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <button
              aria-label="Next month"
              onClick={() => changeDetailMonth((detailMonth + 1) % 12)}
            >
              <ChevronRight size={18} />
            </button>
            <span className="monthly-chip">Monthly</span>
          </section>
        ) : (
          <div className="sheet-static">Static feature · no temporal axis</div>
        )}
      </section>
    </main>
  );
}
