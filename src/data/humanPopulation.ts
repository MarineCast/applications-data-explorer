import type { SeascapeFeature, SeascapeLayer } from "./seascape";

export function populationSupport(field?: Pick<SeascapeFeature, "dataset" | "column">) {
  if (field?.dataset !== "human" || !field.column) return undefined;
  const column = field.column.replace(/__coverage_status$/, "");
  const collected = column.endsWith("_collected");
  const base = column.replace(/_collected$/, "");
  const radius = /^population_within_(25|50|100)km$/.exec(base)?.[1];
  if (!collected) return undefined;
  if (!radius && base !== "population_count" && base !== "population_density_per_km2") return undefined;
  return { base, collected, coverageIndicator: field.column.endsWith("__coverage_status"), quantityColumn: column, radius: radius ? Number(radius) : undefined,
    density: base === "population_density_per_km2",
    allocationBase: base === "population_density_per_km2" ? "population_count" : base };
}

// Public population quantities use collected allocations, with a consistent zero baseline.
// Source coverage and imputation flags remain independent of classification.
export function populationScaleValues(layer: SeascapeLayer) {
  const support = populationSupport(layer.field);
  if (!support || support.coverageIndicator) return undefined;
  const subtotal = layer.qualifiers[`${support.allocationBase}__available_source_subtotal`];
  if (!subtotal) return undefined;
  const areas = layer.qualifiers.cell_area_km2;
  const values = new Map<string, number | null>([["scale-zero", 0]]);
  layer.index.forEach((row, cell) => {
    const value = subtotal[row];
    const area = areas?.[row];
    const count = value === null ? 0 : typeof value === "number" && Number.isFinite(value) ? value : null;
    values.set(cell, support.density ? count !== null && typeof area === "number" && area > 0 ? count / area : null : count);
  });
  return values;
}

export function samePopulationQuantity(a?: SeascapeFeature, b?: SeascapeFeature) {
  const left = populationSupport(a), right = populationSupport(b);
  return Boolean(left && right && left.base === right.base);
}

export function populationLegendContext(field?: SeascapeFeature, standardized = false) {
  const support = populationSupport(field);
  if (!support) return "";
  if (support.coverageIndicator) return " · strict whole-area completeness · partial is not zero population · US 2020 / Canada 2021";
  return ` · ${support.collected ? "missing contributions assumed zero" : "incomplete support is gray"}${standardized ? "" : " · common population scale"}`;
}
