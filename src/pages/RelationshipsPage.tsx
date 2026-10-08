import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  FeatureSelect,
  RegionSelect,
  SeasonSelect,
  Stat,
} from "../components/Controls";
import { Scatter, Histogram } from "../components/Charts";
import { correlation, pairedValues, features } from "../data/demo";
import type { FeatureId, Region } from "../data/demo";
export default function RelationshipsPage() {
  const [x, setX] = useState<FeatureId>("temperature"),
    [y, setY] = useState<FeatureId>("chlorophyll"),
    [region, setRegion] = useState<Region>("all"),
    [season, setSeason] = useState("all");
  const rows = pairedValues(region, season, x, y);
  const r = correlation(rows);
  return (
    <main className="workspace">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FEATURE ANALYSIS</span>
          <h1>Relationships</h1>
          <p>Compare patterns across the demo feature space.</p>
        </div>
        <span className="tag">Synthetic observations</span>
      </div>
      <section className="panel filter-bar">
        <FeatureSelect label="X feature" value={x} onChange={setX} />
        <FeatureSelect label="Y feature" value={y} onChange={setY} />
        <RegionSelect value={region} onChange={setRegion} />
        <SeasonSelect value={season} onChange={setSeason} />
      </section>
      <div className="stat-row">
        <Stat
          label="Pearson correlation"
          value={r?.toFixed(2) ?? "Not defined"}
          detail="Unweighted demo cell-month pairs"
        />
        <Stat
          label="Paired observations"
          value={rows.length.toLocaleString()}
          detail="Unavailable values excluded"
        />
        <Stat
          label="Redundancy signal"
          value={
            r !== null && Math.abs(r) > 0.8
              ? "High"
              : r !== null && Math.abs(r) > 0.5
                ? "Moderate"
                : "Low"
          }
          detail="Illustrative threshold only"
        />
      </div>
      <div className="analysis-grid">
        <section className="panel chart-panel">
          <div className="panel-title">
            <h2>Feature comparison</h2>
            <span className="tag">Cell × month</span>
          </div>
          <Scatter rows={rows} x={x} y={y} />
          <p className="chart-note">
            Display capped at 650 points; statistics use all filtered pairs.
          </p>
        </section>
        <section className="panel chart-panel">
          <h2>Correlation matrix</h2>
          <div className="matrix">
            <div />
            {features.map((f) => (
              <span key={f.id} className="matrix-head">
                {f.short}
              </span>
            ))}
            {features.map((a) => (
              <div className="matrix-row" key={a.id}>
                <span className="matrix-head">{a.short}</span>
                {features.map((b) => {
                  const value = correlation(
                    pairedValues(region, season, a.id, b.id),
                  );
                  return (
                    <button
                      key={b.id}
                      aria-label={`Compare ${a.short} with ${b.short}`}
                      style={{
                        background: `rgba(79,139,120,${0.08 + Math.abs(value ?? 0) * 0.58})`,
                      }}
                      onClick={() => {
                        setX(a.id);
                        setY(b.id);
                      }}
                    >
                      {value?.toFixed(2) ?? "—"}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="chart-note">
            Select a pair to inspect its distribution and scatter.
          </p>
        </section>
        <section className="panel chart-panel">
          <h2>X distribution</h2>
          <Histogram values={rows.map((r) => r.x)} feature={x} />
        </section>
        <section className="panel chart-panel">
          <h2>Y distribution</h2>
          <Histogram
            values={rows.map((r) => r.y)}
            feature={y}
            color="#6e9eab"
          />
        </section>
      </div>
      <div className="future-note">
        <ArrowUpRight size={16} />
        <span>
          Next: temporal lags, spatial scale sensitivity, and documented
          aggregation rules.
        </span>
      </div>
      <p className="method-note">
        Demo correlations are descriptive fixture calculations. They provide no
        evidence of ecological relationships or causation.
      </p>
    </main>
  );
}
