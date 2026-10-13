import { cellToBoundary, cellToLatLng } from "h3-js";
import type { ViewCell, ViewPair, ViewshedData } from "../data/viewshed";

export const sourceA = "8728d180cffffff", sourceB = "8728d1874ffffff", targetB = "8728d1810ffffff";
function cell(id: string): ViewCell {
  const coordinates = cellToBoundary(id).map(([lat, lon]) => [lon, lat]);
  const [lat, lon] = cellToLatLng(id);
  return { id, center: [lon, lat], geometry: { type: "Polygon", coordinates: [[...coordinates, coordinates[0]]] } };
}
export function pair(source = sourceA, target = sourceA, lower = .4, upper = .6): ViewPair {
  return { source_type: "land", source_h3: source, target_h3: target, lower, upper,
    average_viewability: lower === upper ? lower : null, input_unknown_fraction: upper - lower,
    out_of_range_fraction: .1, target_water_pixel_count: 2000, sampled_target_points: 600,
    observer_count: 15, max_distance_m: 24140.16, sampling: "stride2", census_checked: false };
}
export function viewshedFixture(): ViewshedData {
  const a = cell(sourceA), b = cell(sourceB);
  return {
    catalog: { version: 1, snapshot: "a".repeat(64), contract: "bounded_regional_classified_viewability_pilot_v1",
      qualification: "research_pilot_not_empirically_calibrated", source_count: 2, target_count: 2, pair_count: 2,
      default_source: sourceA, bounds: [-123.8, 47.8, -122.4, 48.7],
      aggregation: "equal_source_cell_mean_with_out_of_reach_zero_v1", inputs: { "average_viewability.parquet": "b".repeat(64) },
      limitations: ["Research fixture"], model: { crs: "EPSG:32610", h3_resolution: 7, max_distance_m: 24140.16,
        target_water_lattice_m: 30, obstacle_pixel_m: 10, terrain_pixel_m: 30, model: {} }, input_products: {},
      sampling_max_checked_error: .01, census_checked_sources: 1,
      common: { url: "/test", sha256: "" }, sources: { [sourceA]: { url: "/a", sha256: "" }, [sourceB]: { url: "/b", sha256: "" } }, source_pair_counts: { [sourceA]: 1, [sourceB]: 1 } },
    sources: [a, b].map(c => ({ ...c, land_fraction: .5, observers: Array.from({ length: 15 }, () => c.center) })),
    targets: [a, cell(targetB)], land: a.geometry,
    averages: [
      { target_h3: sourceA, lower: .2, upper: .3, average_viewability: null, input_unknown_fraction: .1,
        source_count: 2, modeled_source_count: 1, outside_reach_source_count: 1 },
      { target_h3: targetB, lower: .4, upper: .4, average_viewability: .4, input_unknown_fraction: 0,
        source_count: 2, modeled_source_count: 1, outside_reach_source_count: 1 },
    ],
  };
}

export function weightedViewshedFixture(): ViewshedData {
  const data = viewshedFixture();
  data.catalog.version = 2;
  data.catalog.inputs["weights.parquet"] = "c".repeat(64);
  data.catalog.components = { contract: "retained_regional_weight_diagnostics_v1", parent_sha256: "b".repeat(64), output_sha256: "c".repeat(64), pair_count: 2,
    distance: { selected_model: "logistic", logistic_d50_km: 9, logistic_slope_km: 2.7, normalize_at_zero: true, hard_cutoff_km: 30 }, definitions: {} };
  Object.assign(data.averages[0], { weight_terrain: .1, weight_distance: .3, weight_above_ground: .8,
    above_ground_lower: .8, above_ground_upper: .8, above_ground_status: "known", above_ground_source_count: 1,
    above_ground_unknown_source_count: 0, above_ground_not_applicable_source_count: 1 });
  Object.assign(data.averages[1], { weight_terrain: 0, weight_distance: .1, weight_above_ground: null,
    above_ground_lower: null, above_ground_upper: null, above_ground_status: "not_applicable", above_ground_source_count: 0,
    above_ground_unknown_source_count: 0, above_ground_not_applicable_source_count: 2 });
  return data;
}
