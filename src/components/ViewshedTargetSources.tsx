import WarningNotice from "./WarningNotice";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { percent, sourceLabel } from "../data/viewshed";
import type { ViewMetric, ViewPair, ViewshedData } from "../data/viewshed";

export default function ViewshedTargetSources({ data, target, rows, metric, metricName, error, onSource, onClose }: {
  data: ViewshedData; target: string; rows?: ViewPair[]; metric: ViewMetric; metricName: string;
  error?: string; onSource: (id: string) => void; onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [target]);
  const ranked = rows ? [...rows].sort((a, b) => (b[metric] ?? -1) - (a[metric] ?? -1) || a.source_h3.localeCompare(b.source_h3)) : [];
  return <section className="viewshed-inspector" aria-label="Land sources for water target">
    <header className="viewshed-panel-heading"><h2 ref={heading} tabIndex={-1}><span>Water target · land sources</span><code>{target}</code></h2>
      <button aria-label="Close cell inspector" onClick={onClose}><X size={18} /></button></header>
    {error ? <WarningNotice inline title="Land-source weights unavailable" message={error} /> : !rows ? <p role="status">Loading land-source weights…</p> : <>
      <p>{rows.length} saved land–water pairs · {data.sources.length - rows.length} land sources outside modeled reach.</p>
      <p>Land colors show {metricName.toLowerCase()} for this water cell. Gray retains unknown or not-applicable weights; faded gold marks land without a saved pair. Saved pairs are ranked by the selected weight.</p>
      <div className="viewshed-source-results">{ranked.map(row => <details key={row.source_h3}>
        <summary><code>{sourceLabel(row.source_h3)}</code><strong>{(metric === "weight_above_ground" || metric === "above_ground_lower") && row.above_ground_status === "not_applicable" ? "Not applicable" : percent(row[metric] ?? null)}</strong></summary>
        <button className="viewshed-inspect-source" onClick={() => onSource(row.source_h3)}>View water from {sourceLabel(row.source_h3)}</button>
        <dl>
          {data.catalog.components && <><dt>Terrain weight</dt><dd>{percent(row.weight_terrain ?? null)}</dd>
            <dt>Above-ground weight</dt><dd>{row.above_ground_status === "not_applicable" ? "Not applicable" : percent(row.weight_above_ground ?? null)}</dd>
            <dt>Above-ground bounds</dt><dd>{row.above_ground_status === "not_applicable" ? "No terrain-clear support" : `${percent(row.above_ground_lower ?? null)}–${percent(row.above_ground_upper ?? null)}`}</dd>
            <dt>Distance weight</dt><dd>{percent(row.weight_distance ?? null)}</dd>
            <dt>Centroid distance</dt><dd>{row.distance_km?.toFixed(2)} km</dd></>}
          <dt>Pilot lower–upper estimate</dt><dd>{percent(row.lower)}–{percent(row.upper)}</dd>
          <dt>Complete score</dt><dd>{percent(row.average_viewability)}</dd>
          <dt>Input uncertainty</dt><dd>{percent(row.input_unknown_fraction)}</dd>
          <dt>Water grid points in reach</dt><dd>{row.target_water_pixel_count.toLocaleString()}</dd>
          <dt>Sampled water points</dt><dd>{row.sampled_target_points.toLocaleString()}</dd>
          <dt>Beyond reach, observer–target comparisons</dt><dd>{percent(row.out_of_range_fraction)}</dd>
          <dt>Observer samples</dt><dd>{row.observer_count}</dd>
        </dl>
      </details>)}</div>
    </>}
    <footer><p>Physical viewability · research pilot · terrain includes distance decay. Conditional above-ground weights remain separate.</p>
      <details className="viewshed-method"><summary>Provenance</summary><p>Browser snapshot<code>{data.catalog.snapshot}</code></p>
        <p>Pair parquet SHA-256<code>{data.catalog.inputs["average_viewability.parquet"]}</code></p>
        {data.catalog.components && <p>Weight diagnostics SHA-256<code>{data.catalog.components.output_sha256}</code></p>}
      </details></footer>
  </section>;
}
