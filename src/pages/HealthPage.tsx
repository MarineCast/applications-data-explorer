import { useState } from "react";
import { Check, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import PageLegend from "../components/PageLegend";
import { Stat, Empty } from "../components/Controls";
import { products, months } from "../data/demo";
export default function HealthPage() {
  const [product, setProduct] = useState("temperature"),
    [release, setRelease] = useState("demo-2026.02"),
    [compare, setCompare] = useState(false),
    [simulate, setSimulate] = useState("ready");
  const p = products.find((x) => x.id === product)!;
  const current = release === "demo-2026.02";
  const coverage = p.coverage.map((v) => v - (current ? 0 : 4));
  const average = coverage.reduce((a, b) => a + b, 0) / 12;
  const flags = p.flags.map((f) => ({
    ...f,
    count: f.count + (current ? 0 : 2),
  }));
  return (
    <main className="workspace">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PRODUCT INTEGRITY</span>
          <h1>Health</h1>
          <p>Coverage, quality, and release context.</p>
        </div>
        <span className="tag">Fixture metadata</span>
      </div>
      <section className="panel filter-bar health-filters">
        <label className="field">
          Product
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            {products.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Release
          <select value={release} onChange={(e) => setRelease(e.target.value)}>
            <option>demo-2026.02</option>
            <option>demo-2026.01</option>
          </select>
        </label>
        <label className="field">
          Demo state
          <select
            value={simulate}
            onChange={(e) => setSimulate(e.target.value)}
          >
            <option value="ready">Ready</option>
            <option value="empty">Empty catalog</option>
            <option value="error">Read error</option>
          </select>
        </label>
        <button
          className="button"
          onClick={() => setCompare(!compare)}
          aria-pressed={compare}
        >
          <RefreshCw size={15} />
          {compare ? "Hide release comparison" : "Compare releases"}
        </button>
      </section>
      {simulate === "empty" ? (
        <Empty
          title="No products available"
          detail="This empty state is simulated. No data root is connected."
        />
      ) : simulate === "error" ? (
        <section className="panel error-state" role="alert">
          <AlertCircle size={24} />
          <h2>Demo product could not be read</h2>
          <p>This error is simulated; no file or API request was made.</p>
          <button className="button" onClick={() => setSimulate("ready")}>
            Retry demo
          </button>
        </section>
      ) : (
        <>
          <div className="stat-row">
            <Stat
              label="Mean coverage"
              value={`${average.toFixed(1)}%`}
              detail="Synthetic metadata, not a data validation result"
            />
            <Stat
              label="Flagged demo rows"
              value={flags.reduce((a, f) => a + f.count, 0)}
            />
            <Stat
              label="Join loss"
              value={`${p.joinLoss + (current ? 0 : 3)}%`}
              detail="Illustrative unmatched H3 keys"
            />
          </div>
          <div className="analysis-grid">
            <section className="panel chart-panel">
              <div className="panel-title">
                <h2>Coverage calendar</h2>
                <span className="tag">2026 · monthly</span>
              </div>
              <div className="coverage-calendar">
                {months.map((m, i) => (
                  <div
                    key={m}
                    style={{
                      background: `rgba(92,153,125,${(coverage[i] - 80) / 25})`,
                    }}
                  >
                    <span>{m}</span>
                    <strong>{coverage[i]}%</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel chart-panel">
              <h2>Quality flags</h2>
              <div className="quality-list">
                {flags.map((f) => (
                  <div key={f.label}>
                    <span>
                      {f.count > 0 ? (
                        <AlertCircle size={16} />
                      ) : (
                        <Check size={16} />
                      )}{" "}
                      {f.label}
                    </span>
                    <strong>{f.count}</strong>
                    <div className="quality-track">
                      <i style={{ width: `${Math.min(100, f.count * 4)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel chart-panel">
              <h2>Missingness & join support</h2>
              <div className="support-bars">
                {[
                  { name: "Observed support", value: average },
                  { name: "Unavailable support", value: 100 - average },
                  {
                    name: "Unmatched join keys",
                    value: p.joinLoss + (current ? 0 : 3),
                  },
                ].map((s) => (
                  <div key={s.name}>
                    <span>
                      {s.name}
                      <strong>{s.value.toFixed(1)}%</strong>
                    </span>
                    <div>
                      <i style={{ width: `${s.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="chart-note">
                Fixture coverage summaries have no authority over production
                products.
              </p>
            </section>
            <section className="panel chart-panel">
              <h2>Provenance</h2>
              <dl className="provenance">
                <div>
                  <dt>Product</dt>
                  <dd>demo.{p.id}</dd>
                </div>
                <div>
                  <dt>Producer</dt>
                  <dd>Local deterministic fixtures</dd>
                </div>
                <div>
                  <dt>Release</dt>
                  <dd>{release}</dd>
                </div>
                <div>
                  <dt>Format / grain</dt>
                  <dd>{p.format} · cell × month</dd>
                </div>
                <div>
                  <dt>Data source</dt>
                  <dd>None connected</dd>
                </div>
                <div>
                  <dt>Validation</dt>
                  <dd>Synthetic / unvalidated</dd>
                </div>
              </dl>
              <p className="chart-note">
                Physical viewability is a static demo feature. Its calendar here
                illustrates UI states only.
              </p>
            </section>
          </div>
          {compare && (
            <section className="panel release-compare">
              <h2>Release comparison</h2>
              <div>
                <span>demo-2026.01</span>
                <ArrowRight size={18} />
                <span>demo-2026.02</span>
                <strong className="tag">+4.0 pp coverage</strong>
              </div>
              <p>
                Illustrative change: fewer unavailable cells; join loss reduced
                by 3 percentage points. No production release has been
                evaluated.
              </p>
            </section>
          )}
        </>
      )}
      <PageLegend name="Health" entries={[
        { color: "#5c997d", label: "Available spatial support" },
      ]} note="Darker calendar cells indicate more available spatial support. Missing ≠ observed zero. Coverage and quality summaries are synthetic fixture metadata." />
    </main>
  );
}
