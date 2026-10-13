import { colorForScale, createColorScale } from "./colorScale";
import type { ColorScale, PaletteId } from "./colorScale";
import { scoreColor } from "./viewshed";
import type { ViewMetric, ViewScore } from "./viewshed";

export type ViewshedScaleMode = "auto" | "fixed" | "log" | "custom" | "quantile";
export const viewshedScaleModes: Record<ViewshedScaleMode, string> = {
  auto: "Value range (min–max)",
  fixed: "Full range (0–100%)",
  log: "Log (value range)",
  custom: "Custom range",
  quantile: "Quantiles",
};

export interface ViewshedColorScale extends ColorScale {
  // Reusable transformed interpolation scale; public edges remain raw fractions.
  logarithmicScale?: ColorScale;
}

// Color limits are a display transform only. The original scores are never
// clipped, normalized or written back. Statistics use every active target,
// independently of the map viewport, and omit unknown complete scores.
export function createViewshedScale(
  scores: ViewScore[], metric: ViewMetric, palette: PaletteId,
  mode: ViewshedScaleMode, custom: [number, number],
): ViewshedColorScale {
  const values = new Map(scores.map(score => [score.target_h3, score[metric] ?? null]));
  const scale = createColorScale(values, palette, mode === "quantile" ? "quantile" : "minmax");
  if (mode === "log") {
    const min = Math.log1p(scale.edges[0] * 100);
    const max = Math.log1p(scale.edges[10] * 100);
    const edges = Array.from({ length: 11 }, (_, i) => min + (max - min) * i / 10);
    const rawEdges = edges.map(value => Math.expm1(value) / 100);
    // Preserve exact source endpoints, including constant/all-unknown layers.
    rawEdges[0] = scale.edges[0];
    rawEdges[10] = scale.edges[10];
    return { ...scale, edges: rawEdges, logarithmicScale: { ...scale, edges } };
  }
  if (mode === "fixed" || mode === "custom") {
    const [lower, upper] = mode === "fixed" ? [0, 1] : custom;
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower < 0 || upper > 1 || lower >= upper)
      throw new Error("Color limits must satisfy 0 ≤ minimum < maximum ≤ 100%.");
    return { ...scale, edges: Array.from({ length: 11 }, (_, i) => lower + (upper - lower) * i / 10) };
  }
  return scale;
}

export function viewshedColor(value: number | null, scale?: ViewshedColorScale) {
  if (value === null || !Number.isFinite(value)) return "#a9b3bb";
  if (scale?.logarithmicScale) return colorForScale(Math.log1p(Math.max(0, value) * 100), scale.logarithmicScale);
  return scale ? colorForScale(value, scale) : scoreColor(value);
}

export function scalePercent(value: number) {
  return `${(value * 100).toLocaleString(undefined, { maximumSignificantDigits: 3 })}%`;
}
