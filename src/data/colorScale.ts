export const palettes = {
  ocean: {
    name: "Ocean blue",
    colors: [
      "#f0f7ff",
      "#dbeeff",
      "#bfdeff",
      "#99caff",
      "#70b3f4",
      "#4599e6",
      "#247dcc",
      "#1261ab",
      "#0b4685",
      "#082e60",
    ],
  },
  viridis: {
    name: "Viridis",
    colors: [
      "#440154",
      "#482878",
      "#3e4989",
      "#31688e",
      "#26828e",
      "#1f9e89",
      "#35b779",
      "#6ece58",
      "#b5de2b",
      "#fde725",
    ],
  },
  warm: {
    name: "Warm glow",
    colors: [
      "#000004",
      "#1b0c41",
      "#4a0c6b",
      "#781c6d",
      "#a52c60",
      "#cf4446",
      "#ed6925",
      "#fb9b06",
      "#f7d13d",
      "#fcffa4",
    ],
  },
  balance: {
    name: "Blue to red",
    colors: [
      "#053061",
      "#2166ac",
      "#4393c3",
      "#92c5de",
      "#d1e5f0",
      "#fddbc7",
      "#f4a582",
      "#d6604d",
      "#b2182b",
      "#67001f",
    ],
  },
} as const;
export type PaletteId = keyof typeof palettes;
export type ScaleMode = "equal" | "quantile" | "minmax";
export const scaleModes: Record<ScaleMode, string> = {
  equal: "Equal bins",
  quantile: "Quantiles",
  minmax: "Min/max",
};
export const missingColor = "#d4d8d4";
export interface ColorScale {
  palette: PaletteId;
  mode: ScaleMode;
  colors: readonly string[];
  edges: number[];
  count: number;
  repeatedQuantiles: boolean;
  categories?: string[];
}
export function createCategoryScale(values: ReadonlyMap<string, number | null>, labels: string[], palette: PaletteId): ColorScale {
  const colors = labels.map((_, i) => {
    if (labels.length <= 10) return palettes[palette].colors[Math.round(i * 9 / Math.max(1, labels.length - 1))];
    // Distinct display colors, never numeric ordering or interpolation of categories.
    const hue = (i * 137.508) % 360;
    return `hsl(${hue}, 62%, 46%)`;
  });
  return { palette, mode: "equal", colors, categories: labels,
    edges: Array.from({ length: 11 }, (_, i) => i * Math.max(0, labels.length - 1) / 10),
    count: Array.from(values.values()).filter((v) => v !== null).length, repeatedQuantiles: false };
}
// Full-release, non-null cells, unweighted. Linear interpolation between order statistics.
export function createColorScale(
  values: ReadonlyMap<string, number | null>,
  palette: PaletteId,
  mode: ScaleMode,
): ColorScale {
  const sorted = Array.from(values.values())
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  const min = sorted[0] ?? 0,
    max = sorted.at(-1) ?? 0;
  const edges = Array.from({ length: 11 }, (_, i) => {
    if (mode !== "quantile") return min + ((max - min) * i) / 10;
    const position = ((sorted.length - 1) * i) / 10;
    const lower = Math.max(0, Math.floor(position)),
      upper = Math.max(0, Math.ceil(position));
    return (
      (sorted[lower] ?? 0) +
      ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (position - lower)
    );
  });
  return {
    palette,
    mode,
    colors: palettes[palette].colors,
    edges,
    count: sorted.length,
    repeatedQuantiles:
      mode === "quantile" && new Set(edges).size < edges.length,
  };
}
export function colorForScale(value: number | null, scale: ColorScale) {
  if (value === null || !Number.isFinite(value) || !scale.count)
    return missingColor;
  if (scale.categories) return scale.colors[value] ?? missingColor;
  const min = scale.edges[0],
    max = scale.edges[10];
  if (min === max) return scale.colors[5];
  if (scale.mode === "quantile") {
    // Equal values always share a color; ties can leave classes empty.
    const index = scale.edges.slice(1, 10).findIndex((edge) => value <= edge);
    return scale.colors[index < 0 ? 9 : index];
  }
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (scale.mode === "equal")
    return scale.colors[Math.min(9, Math.floor(t * 10))];
  const position = t * 9,
    lower = Math.floor(position),
    upper = Math.min(9, lower + 1);
  const channels = [1, 3, 5].map((offset) => {
    const a = parseInt(scale.colors[lower].slice(offset, offset + 2), 16);
    const b = parseInt(scale.colors[upper].slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * (position - lower))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}
