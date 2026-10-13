import { getResolution, isValidCell } from "h3-js";
import type { Polygon, MultiPolygon } from "geojson";

export type ViewMetric = "lower" | "upper" | "average_viewability" | "input_unknown_fraction" | "weight_terrain" | "weight_above_ground" | "weight_distance" | "above_ground_lower";
export interface ViewWeights {
  weight_terrain?: number;
  weight_distance?: number;
  weight_above_ground?: number | null;
  above_ground_lower?: number | null;
  above_ground_upper?: number | null;
  above_ground_status?: "known" | "unknown" | "not_applicable";
}
export interface ViewScore extends ViewWeights {
  target_h3: string;
  lower: number;
  upper: number;
  average_viewability: number | null;
  input_unknown_fraction: number;
}
export interface ViewPair extends ViewScore {
  distance_km?: number;
  source_type: "land";
  source_h3: string;
  out_of_range_fraction: number;
  target_water_pixel_count: number;
  sampled_target_points: number;
  observer_count: number;
  max_distance_m: number;
  sampling: string;
  census_checked: boolean;
}
export interface TargetAverage extends ViewScore {
  above_ground_source_count?: number;
  above_ground_unknown_source_count?: number;
  above_ground_not_applicable_source_count?: number;
  source_count: number;
  modeled_source_count: number;
  outside_reach_source_count: number;
}
export interface ViewCell {
  id: string;
  center: [number, number];
  geometry: Polygon | MultiPolygon;
}
export interface ViewSource extends ViewCell {
  land_fraction: number;
  observers: [number, number][];
}
interface Asset { url: string; sha256: string }
export interface ViewshedCatalog {
  version: number;
  snapshot: string;
  contract: string;
  qualification: string;
  source_count: number;
  target_count: number;
  pair_count: number;
  default_source: string;
  bounds: [number, number, number, number];
  aggregation: string;
  inputs: Record<string, string>;
  limitations: string[];
  model: {
    crs: string;
    h3_resolution: number;
    max_distance_m: number;
    target_water_lattice_m: number;
    obstacle_pixel_m: number;
    terrain_pixel_m: number;
    model: Record<string, string | number>;
  };
  input_products: Record<string, { sha256: string; filename: string }>;
  sampling_max_checked_error: number;
  census_checked_sources: number;
  common: Asset;
  sources: Record<string, Asset>;
  source_pair_counts: Record<string, number>;
  components?: {
    contract: string;
    parent_sha256: string;
    output_sha256: string;
    pair_count: number;
    distance: { selected_model: string; logistic_d50_km: number; logistic_slope_km: number; normalize_at_zero: boolean; hard_cutoff_km: number };
    definitions: Record<string, string>;
  };
}
export interface ViewshedData {
  catalog: ViewshedCatalog;
  sources: ViewSource[];
  targets: ViewCell[];
  land: Polygon | MultiPolygon;
  averages: TargetAverage[];
}
const pending = new Map<string, Promise<unknown>>();
async function checkedAsset(asset: Asset, snapshot: string): Promise<unknown> {
  if (!asset || !asset.url.startsWith(`/local-data/viewshed/${snapshot}/`) || !/^[a-f0-9]{64}$/.test(asset.sha256))
    throw new Error("Invalid viewshed asset reference.");
  const key = `${asset.url}:${asset.sha256}`;
  let request = pending.get(key);
  if (!request) {
    request = (async () => {
      const response = await fetch(asset.url);
      if (!response.ok) throw new Error(`Cannot read viewshed data (${response.status}).`);
      const bytes = await response.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
      if (hash !== asset.sha256) throw new Error("Viewshed checksum mismatch. Prepare the local cache again.");
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    })();
    pending.set(key, request);
    request.catch(() => pending.delete(key));
  }
  return request;
}
function h3(id: string) {
  return isValidCell(id) && getResolution(id) === 7;
}
function fraction(n: number) { return Number.isFinite(n) && n >= 0 && n <= 1; }
function positiveInteger(n: number) { return Number.isInteger(n) && n > 0; }
function geometryValid(geometry: Polygon | MultiPolygon) {
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.length > 0 && polygons.every((rings) => rings.length > 0 && rings.every((ring) =>
    ring.length >= 4 && ring.every((p) => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)));
}
function validateCells(cells: ViewCell[], count: number) {
  if (!Array.isArray(cells) || cells.length !== count || new Set(cells.map(c => c.id)).size !== count || cells.some(c =>
    !h3(c.id) || !geometryValid(c.geometry) || c.center.length !== 2 || c.center.some(n => !Number.isFinite(n))))
    throw new Error("Invalid viewshed cell geometry or identity.");
}
export function validateScores(scores: ViewScore[]) {
  if (!Array.isArray(scores) || new Set(scores.map(s => s.target_h3)).size !== scores.length || scores.some(s =>
    !h3(s.target_h3) || !fraction(s.lower) || !fraction(s.upper) || s.lower > s.upper || !fraction(s.input_unknown_fraction) ||
    Math.abs(s.upper - s.lower - s.input_unknown_fraction) > 1e-12 ||
    (s.input_unknown_fraction > 0 ? s.average_viewability !== null : s.average_viewability !== s.lower)))
    throw new Error("Invalid viewshed scores, bounds or missingness.");
}
export function validateWeights(scores: ViewScore[]) {
  for (const s of scores) {
    if (!fraction(s.weight_terrain!) || !fraction(s.weight_distance!)) throw new Error("Invalid terrain/distance weights.");
    const [lo, hi, value] = [s.above_ground_lower, s.above_ground_upper, s.weight_above_ground];
    if (s.above_ground_status === "not_applicable") {
      if (s.weight_terrain !== 0 || lo !== null || hi !== null || value !== null) throw new Error("Invalid not-applicable above-ground support.");
    } else if (!fraction(lo!) || !fraction(hi!) || lo! > hi! || s.weight_terrain! <= 0 ||
      (s.above_ground_status === "known" ? lo !== hi || value !== lo : s.above_ground_status !== "unknown" || value !== null || lo! >= hi!))
      throw new Error("Invalid above-ground weights or missingness.");
  }
}
export async function loadViewshed(): Promise<ViewshedData> {
  const response = await fetch("/local-data/viewshed/catalog.json", { cache: "no-store" });
  if (!response.ok) throw new Error("The local viewshed cache is missing. Run scripts/prepare_viewshed.py with the completed pilot folder.");
  const catalog = await response.json() as ViewshedCatalog;
  if (![1, 2].includes(catalog.version) || !/^[a-f0-9]{64}$/.test(catalog.snapshot) ||
    catalog.contract !== "bounded_regional_classified_viewability_pilot_v1" ||
    catalog.qualification !== "research_pilot_not_empirically_calibrated" ||
    catalog.aggregation !== "equal_source_cell_mean_with_out_of_reach_zero_v1" ||
    !positiveInteger(catalog.source_count) || !positiveInteger(catalog.target_count) || !positiveInteger(catalog.pair_count) ||
    catalog.model?.h3_resolution !== 7 || catalog.model?.max_distance_m !== 24140.16 ||
    !Array.isArray(catalog.bounds) || catalog.bounds.length !== 4 || catalog.bounds.some(n => !Number.isFinite(n)) ||
    catalog.bounds[0] >= catalog.bounds[2] || catalog.bounds[1] >= catalog.bounds[3])
    throw new Error("Unsupported or incomplete viewshed pilot cache.");
  if (catalog.version === 2 && (!catalog.components || catalog.components.contract !== "retained_regional_weight_diagnostics_v1" ||
    catalog.components.parent_sha256 !== catalog.inputs["average_viewability.parquet"] ||
    catalog.components.output_sha256 !== catalog.inputs["weights.parquet"] || catalog.components.pair_count !== catalog.pair_count ||
    catalog.components.distance?.selected_model !== "logistic" || catalog.components.distance.logistic_d50_km !== 9 ||
    catalog.components.distance.logistic_slope_km !== 2.7 || !catalog.components.distance.normalize_at_zero || catalog.components.distance.hard_cutoff_km !== 30))
    throw new Error("Unsupported weight diagnostics or distance profile.");
  const common = await checkedAsset(catalog.common, catalog.snapshot) as Omit<ViewshedData, "catalog">;
  validateCells(common.sources, catalog.source_count);
  validateCells(common.targets, catalog.target_count);
  if (!geometryValid(common.land) || common.sources.some(s => !Number.isFinite(s.land_fraction) || s.land_fraction < 0 || s.land_fraction > 1 + 1e-12 ||
    !Array.isArray(s.observers) || s.observers.length !== 15 || s.observers.some(p => p.length !== 2 || p.some(n => !Number.isFinite(n)))) ||
    !common.sources.some(s => s.id === catalog.default_source) ||
    Object.keys(catalog.sources).length !== catalog.source_count || common.sources.some(s => !catalog.sources[s.id]) ||
    !catalog.source_pair_counts || Object.keys(catalog.source_pair_counts).length !== catalog.source_count ||
    common.sources.some(s => !positiveInteger(catalog.source_pair_counts[s.id])) ||
    Object.values(catalog.source_pair_counts).reduce((a, b) => a + b, 0) !== catalog.pair_count)
    throw new Error("Incomplete viewshed source support.");
  validateScores(common.averages);
  if (catalog.version === 2) {
    validateWeights(common.averages);
    if (common.averages.some(a => !Number.isInteger(a.above_ground_source_count) || a.above_ground_source_count! < 0 ||
      a.above_ground_source_count! > a.modeled_source_count || !Number.isInteger(a.above_ground_unknown_source_count) ||
      a.above_ground_unknown_source_count! < 0 || a.above_ground_unknown_source_count! > a.above_ground_source_count! ||
      a.above_ground_source_count! + a.above_ground_not_applicable_source_count! !== catalog.source_count ||
      (a.above_ground_status === "not_applicable") !== (a.above_ground_source_count === 0) ||
      (a.above_ground_status === "unknown") !== (a.above_ground_unknown_source_count! > 0)))
      throw new Error("Invalid above-ground target denominator.");
  }
  const ids = new Set(common.targets.map(c => c.id));
  if (common.averages.length !== catalog.target_count || common.averages.reduce((n, a) => n + a.modeled_source_count, 0) !== catalog.pair_count || common.averages.some(a =>
    !ids.has(a.target_h3) || a.source_count !== catalog.source_count || !positiveInteger(a.modeled_source_count) ||
    !Number.isInteger(a.outside_reach_source_count) || a.outside_reach_source_count < 0 ||
    a.modeled_source_count + a.outside_reach_source_count !== catalog.source_count))
    throw new Error("Invalid target average denominator.");
  return { ...common, catalog };
}
export async function loadSource(data: ViewshedData, source: string): Promise<ViewPair[]> {
  if (!data.catalog.sources[source]) throw new Error("Source is outside this pilot.");
  const body = await checkedAsset(data.catalog.sources[source], data.catalog.snapshot) as { source_h3: string; pairs: ViewPair[] };
  if (body.source_h3 !== source || body.pairs?.length !== data.catalog.source_pair_counts[source]) throw new Error("Wrong or incomplete viewshed source partition.");
  validateScores(body.pairs);
  if (data.catalog.version === 2) {
    validateWeights(body.pairs);
    if (body.pairs.some(p => !Number.isFinite(p.distance_km) || p.distance_km! < 0)) throw new Error("Invalid centroid distance.");
  }
  const targets = new Set(data.targets.map(t => t.id));
  if (body.pairs.some(p => p.source_type !== "land" || p.source_h3 !== source || !targets.has(p.target_h3) ||
    !fraction(p.out_of_range_fraction) || !positiveInteger(p.target_water_pixel_count) || !positiveInteger(p.sampled_target_points) ||
    p.sampled_target_points > p.target_water_pixel_count || p.observer_count !== 15 || p.max_distance_m !== 24140.16))
    throw new Error("Invalid viewshed source pair support.");
  return body.pairs;
}
export function percent(value: number | null) {
  return value === null ? "Unknown" : `${(value * 100).toFixed(1)}%`;
}
export function sourceLabel(id: string) {
  return id === "8728d180cffffff" ? "Dungeness" : id === "8728d1874ffffff" ? "Sequim coast" : id;
}
export function scoreColor(value: number | null) {
  if (value === null) return "#a9b3bb";
  // Fixed 0–100% domain, identical between sources and the target mean.
  const t = Math.max(0, Math.min(1, value));
  const start = [235, 242, 239], end = [0, 101, 121];
  return `rgb(${start.map((v, i) => Math.round(v + (end[i] - v) * t)).join(",")})`;
}
