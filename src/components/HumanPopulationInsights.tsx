import type { SeascapeLayer, SourceValue } from "../data/seascape";
import { populationSupport } from "../data/humanPopulation";

export default function HumanPopulationInsights({ layer, cell }: { layer: SeascapeLayer; cell?: string }) {
  const row = cell ? layer.index.get(cell) : undefined;
  const support = populationSupport(layer.field);
  if (row === undefined || !cell || !support) return <p className="insights-empty">Select a cell to inspect its population estimate.</p>;
  const qualifier = (name: string): SourceValue => layer.qualifiers[name]?.[row] ?? null;
  const field = support.quantityColumn;
  const base = support.allocationBase;
  const coverage = qualifier(`${field}__coverage_status`) ?? qualifier(`${base}__coverage_status`);
  const value = support.coverageIndicator ? qualifier(field) : layer.values.get(cell);
  const subtotal = qualifier(`${base}__available_source_subtotal`);
  const area = qualifier("cell_area_km2");
  const imputed = support.collected ? qualifier(`${field}__zero_imputed`) : false;
  const unverified = qualifier(`${base}__unverified_geographic_support`);
  const text = (value: SourceValue) => value === null ? "Unknown" : String(value);
  const units = support.density ? "persons/km²" : "persons";
  const number = (v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${units}`;
  const available = typeof subtotal === "number" ? support.density && typeof area === "number" && area > 0 ? subtotal / area : subtotal : null;
  return <>
    {support.coverageIndicator && <p className="insights-note">This map shows strict source completeness, not population amount or percentage. Partial means some geographic support or census counts remain unknown; even a small census/water boundary gap can make the whole area partial. The collected estimate below remains available.</p>}
    <dl className="insights-cell-details">
      <div><dt>{"Population estimate"}</dt><dd>{typeof value !== "number" ? "Unavailable" : number(value)}</dd></div>
      <div><dt>{support.radius ? "Radius" : "Spatial support"}</dt><dd>{support.radius ? `${support.radius} km from the H3 cell center` : "Full native H3 cell"}</dd></div>
      {support.density && <div><dt>Density denominator</dt><dd>{typeof area === "number" ? `${area.toLocaleString(undefined, { maximumFractionDigits: 4 })} km² · full cell area` : "Full cell area"}</dd></div>}
      <div><dt>Census vintages</dt><dd>{layer.field.sourceRelease}</dd></div>
      <div><dt>Source coverage</dt><dd>{text(coverage)}</dd></div>
      <div><dt>Unavailable contributions assumed zero</dt><dd>{imputed === true ? "Yes" : imputed === false ? "No" : "Unknown"}</dd></div>
      <div><dt>Unverified geographic support</dt><dd>{unverified === true ? "Yes" : unverified === false ? "No" : "Unknown"}</dd></div>
      {!support.collected && value == null && <div><dt>Available-source subtotal (incomplete)</dt><dd>{available === null ? "Unavailable" : number(available)}</dd></div>}
      <div><dt>H3 index</dt><dd><code>{cell}</code></dd></div>
    </dl>
    <p className="insights-note">{support.collected ? "Area-allocated collected census population. Missing contributions count as zero in this estimate; it is not a complete observed population total." : "This field requires complete source and geographic support. A gray cell means support is incomplete, even when a positive census subtotal is available. Use the collected estimate to display that subtotal with its explicit missing-as-zero assumption."} {support.radius ? "Overlapping neighborhoods must not be summed." : "Population is allocated uniformly over each original census polygon; cell counts can be fractional."}</p>
    {value === 0 && <p className="insights-note">{imputed === true ? "This zero uses the missing-as-zero assumption; it does not establish that no residents are present." : imputed === false ? "This zero has supported source coverage." : "Coverage for this zero is unknown."}</p>}
    <details className="insights-qualifiers"><summary>Source qualifiers</summary><dl className="insights-cell-details">
      <div><dt>Missing census sources</dt><dd>{text(qualifier(`${base}__missing_sources`))}</dd></div>
      {support.collected && <div><dt>Method</dt><dd>{text(qualifier(`${field}__method`))}</dd></div>}
    </dl></details>
  </>;
}
