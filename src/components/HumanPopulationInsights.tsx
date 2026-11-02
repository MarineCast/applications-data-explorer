import type { SeascapeLayer, SourceValue } from "../data/seascape";
import { populationSupport } from "../data/humanPopulation";

export default function HumanPopulationInsights({ layer, cell }: { layer: SeascapeLayer; cell?: string }) {
  const row = cell ? layer.index.get(cell) : undefined;
  const support = populationSupport(layer.field);
  if (row === undefined || !cell || !support) return <p className="insights-empty">Select a cell to inspect its population estimate.</p>;
  const qualifier = (name: string | undefined): SourceValue => name ? layer.qualifiers[name]?.[row] ?? null : null;
  const field = support.quantityColumn;
  const evidence = layer.field.populationEvidence?.auditFields ?? {};
  const base = support.allocationBase;
  const coverage = qualifier(evidence.coverage_status) ?? qualifier(`${field}__coverage_status`) ?? qualifier(`${base}__coverage_status`) ?? qualifier(`${base}_coverage_status`);
  const value = support.coverageIndicator ? qualifier(field) : layer.values.get(cell);
  const subtotal = qualifier(`${base}__available_source_subtotal`);
  const area = qualifier("cell_area_km2");
  const coverageImputed = coverage === "partial" || coverage === "unavailable" ? true : coverage === "complete" || coverage === "known_zero" ? false : null;
  const imputed = support.collected ? qualifier(evidence.zero_imputed) ?? qualifier(`${field}__zero_imputed`) ?? coverageImputed : false;
  const auditReceipt = layer.field.populationEvidence?.auditReceipt;
  const supportInAudit = layer.field.populationEvidence?.supportInAudit && !layer.field.populationEvidence?.supportAvailable;
  const unverified = qualifier(`${base}__unverified_geographic_support`) ?? qualifier(`${base}_unverified_geographic_support`);
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
      {!supportInAudit && <>
      <div><dt>Source coverage</dt><dd>{text(coverage)}</dd></div>
      <div><dt>Unavailable contributions assumed zero</dt><dd>{imputed === true ? "Yes" : imputed === false ? "No" : "Unknown"}</dd></div>
      <div><dt>Unverified geographic support</dt><dd>{unverified === true ? "Yes" : unverified === false ? "No" : "Unknown"}</dd></div>
      </>}
      {!support.collected && value == null && <div><dt>Available-source subtotal (incomplete)</dt><dd>{available === null ? "Unavailable" : number(available)}</dd></div>}
      <div><dt>H3 index</dt><dd><code>{cell}</code></dd></div>
    </dl>
    <p className="insights-note">{support.collected ? "Area-allocated collected census population. Missing contributions count as zero in this estimate; it is not a complete observed population total." : "This field requires complete source and geographic support. A gray cell means support is incomplete, even when a positive census subtotal is available. Use the collected estimate to display that subtotal with its explicit missing-as-zero assumption."} {support.radius ? "Overlapping neighborhoods must not be summed." : "Population is allocated uniformly over each original census polygon; cell counts can be fractional."}</p>
    {value === 0 && <p className="insights-note">{imputed === true ? "This zero uses the missing-as-zero assumption; it does not establish that no residents are present." : imputed === false ? "This zero has supported source coverage." : supportInAudit ? "Coverage for this zero is retained in the external audit receipt; zero does not establish that no residents are present." : "Coverage for this zero is unknown."}</p>}
    {supportInAudit && <p className="insights-note">Detailed coverage, geographic support and cell area are retained in the external audit receipt.</p>}
    <p className="insights-note">Partial describes strict whole-area source completeness, not the fraction of people missing or the accuracy of the count. Small geographic gaps can make an entire radius partial. This is static context, not measured effort.</p>
    <details className="insights-qualifiers"><summary>Source qualifiers</summary><dl className="insights-cell-details">
      <div><dt>Missing census sources</dt><dd>{qualifier(`${base}__missing_sources`) === null && auditReceipt ? "Retained in the external audit receipt" : qualifier(`${base}__missing_sources`) === "[]" ? "None listed; geographic gaps may still remain" : text(qualifier(`${base}__missing_sources`))}</dd></div>
      {support.collected && <div><dt>Method</dt><dd>{text(qualifier(`${field}__method`) ?? layer.field.populationEvidence?.method ?? null)}</dd></div>}
    </dl></details>
  </>;
}

export function HumanPopulationCoverage({ layer }: { layer: SeascapeLayer }) {
  const support = populationSupport(layer.field);
  if (!support) return null;
  const column = layer.field.populationEvidence?.auditFields?.coverage_status ?? `${support.allocationBase}__coverage_status`;
  const statuses = layer.qualifiers[column];
  if (!statuses) return null;
  const partial = statuses.filter(value => value === "partial").length;
  return <p className="insights-note">{partial.toLocaleString()} of {statuses.length.toLocaleString()} native-cell estimates ({(partial / statuses.length * 100).toFixed(1)}%) have partial source support{support.radius ? ` within ${support.radius} km` : ""}. This is a share of estimates, not a share of people missing or a measure of count accuracy. Even small geographic gaps can make a whole area partial. US 2020 / Canada 2021; research only, model-ineligible.</p>;
}
