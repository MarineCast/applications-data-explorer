import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { percent, sourceLabel } from "../data/viewshed";
import type { ViewMetric, ViewPair, ViewScore, ViewshedData, TargetAverage } from "../data/viewshed";
import type { ViewshedSelection } from "../data/viewshedMap";

export default function ViewshedCellInspector({ selection, data, score, metric, metricName, mode, source, onClose }: {
  selection: ViewshedSelection; data: ViewshedData; score?: ViewScore; metric: ViewMetric;
  metricName: string; mode: "source" | "target"; source: string; onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [selection.id, selection.role]);
  const land = selection.role === "source" ? data.sources.find(s => s.id === selection.id) : undefined;
  return <section className="viewshed-inspector" aria-label={land ? "Source cell details" : "Target viewability"}>
    <header className="viewshed-panel-heading">
      <h2 ref={heading} tabIndex={-1}><span>{land ? "Land source" : "Water target"}</span><code>{selection.id}</code></h2>
      <button className="viewshed-dismiss" aria-label="Close cell inspector" onClick={onClose}><X size={18} /></button>
    </header>
    {land ? <>
      <p className="viewshed-kicker">{sourceLabel(land.id)}</p>
      <div className="viewshed-primary-value">{land.observers.length}<span>Outdoor observer samples</span></div>
      <dl><dt>Land fraction</dt><dd>{percent(land.land_fraction)}</dd>
        <dt>Modeled water targets</dt><dd>{data.catalog.source_pair_counts[land.id]?.toLocaleString() ?? "Unavailable"}</dd>
        <dt>Observer reach</dt><dd>15 miles</dd>
        <dt>H3 resolution</dt><dd>{data.catalog.model.h3_resolution}</dd>
      </dl>
      <p>This cell supplies observers. Colored water cells show its {metricName.toLowerCase()}; select one for its score and bounds.</p>
    </> : score ? <>
      <p className="viewshed-kicker">{mode === "source" ? sourceLabel(source) : metric.startsWith("weight_") || metric === "above_ground_lower" ? "Average target weight" : "Average target viewability"}</p>
      <div className="viewshed-primary-value">{(metric === "weight_above_ground" || metric === "above_ground_lower") && score.above_ground_status === "not_applicable" ? "Not applicable" : percent(score[metric] ?? null)}<span>{metricName}</span></div>
      {data.catalog.components && <>
        <dl><dt>Terrain weight (includes distance)</dt><dd>{percent(score.weight_terrain ?? null)}</dd>
          <dt>Above-ground weight</dt><dd>{score.above_ground_status === "not_applicable" ? "Not applicable" : percent(score.weight_above_ground ?? null)}</dd>
          <dt>Above-ground bounds</dt><dd>{score.above_ground_status === "not_applicable" ? "No terrain-clear support" : `${percent(score.above_ground_lower ?? null)}–${percent(score.above_ground_upper ?? null)}`}</dd>
          <dt>Distance weight (centroid)</dt><dd>{percent(score.weight_distance ?? null)}</dd>
          {mode === "source" ? <><dt>Centroid distance</dt><dd>{(score as ViewPair).distance_km?.toFixed(2)} km</dd></> : <>
            <dt>Above-ground source denominator</dt><dd>{(score as TargetAverage).above_ground_source_count}</dd>
            <dt>Sources with unknown above-ground inputs</dt><dd>{(score as TargetAverage).above_ground_unknown_source_count}</dd>
            <dt>Sources without terrain-clear support / outside reach</dt><dd>{(score as TargetAverage).above_ground_not_applicable_source_count}</dd>
          </>}
        </dl>
        <p>Terrain includes observer-to-water distance decay. Above-ground is conditional transmission through roofs and vegetation on terrain-clear sightlines. The centroid distance weight is a separate diagnostic; do not multiply it into terrain again. Target means of these components cannot be multiplied to reconstruct mean viewability.</p>
      </>}
      <dl><dt>{data.catalog.components ? "Original pilot lower–upper estimate" : "Lower–upper estimate"}</dt><dd>{percent(score.lower)}–{percent(score.upper)}</dd>
        <dt>Complete score</dt><dd>{percent(score.average_viewability)}</dd>
        <dt>Input uncertainty</dt><dd>{percent(score.input_unknown_fraction)}</dd>
        {mode === "source" ? <>
          <dt>Water grid points in reach</dt><dd>{(score as ViewPair).target_water_pixel_count.toLocaleString()}</dd>
          <dt>Sampled water points</dt><dd>{(score as ViewPair).sampled_target_points.toLocaleString()}</dd>
          <dt>Beyond reach, observer–target comparisons</dt><dd>{percent((score as ViewPair).out_of_range_fraction)}</dd>
          <dt>Observer samples</dt><dd>{(score as ViewPair).observer_count}</dd>
        </> : <>
          <dt>All-source denominator</dt><dd>{(score as TargetAverage).source_count}</dd>
          <dt>Sources with water in reach</dt><dd>{(score as TargetAverage).modeled_source_count}</dd>
          <dt>Sources outside reach</dt><dd>{(score as TargetAverage).outside_reach_source_count}</dd>
        </>}
      </dl>
      {score.input_unknown_fraction > 0 && <p>Unknown canopy or roof inputs leave a range of possible scores. Unknown is distinct from zero.</p>}
      <p>{mode === "source" ? "Scores describe the water portion within observer reach." : metric === "weight_above_ground" || metric === "above_ground_lower" ? "Each terrain-clear source pair contributes equally to the above-ground mean. Its applicable-source denominator is shown above; unknown contributors retain uncertainty." : "Each source contributes equally; sources outside reach contribute zero. In-reach water portions differ by source."}</p>
    </> : <p role="status">No target score available in this view.</p>}
    <footer><p>Local research pilot · physical viewability, separate from access or detection. Not empirically calibrated.</p>
      <details className="viewshed-method"><summary>Provenance</summary>
        <p>Pair parquet SHA-256<code>{data.catalog.inputs["average_viewability.parquet"]}</code></p>
        <p>Browser snapshot<code>{data.catalog.snapshot}</code></p>
        {data.catalog.components && <p>Weight diagnostics SHA-256<code>{data.catalog.components.output_sha256}</code></p>}
      </details>
    </footer>
  </section>;
}
