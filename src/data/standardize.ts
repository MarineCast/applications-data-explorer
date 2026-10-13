import type { MapLayer } from "./map";

export interface StandardizedLayer {
  layer: MapLayer;
  count: number;
  mean: number | null;
  std: number | null;
  unavailable: "empty" | "constant" | null;
}

// Unweighted full native layer; population variance (ddof = 0).
// Center and scale before Welford accumulation to retain small differences
// around large offsets and avoid overflowing the variance sum.
export function standardizeLayer(source: MapLayer): StandardizedLayer {
  const valid = Array.from(source.values.values()).filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  let origin = valid[0] ?? 0;
  if (valid.some((value) => !Number.isFinite(value - origin))) origin = 0;
  let magnitude = 0;
  for (const value of valid)
    magnitude = Math.max(magnitude, Math.abs(value - origin));
  let normalizedMean = 0,
    m2 = 0,
    count = 0;
  if (magnitude > 0) {
    for (const value of valid) {
      const normalized = (value - origin) / magnitude;
      const delta = normalized - normalizedMean;
      normalizedMean += delta / ++count;
      m2 += delta * (normalized - normalizedMean);
    }
  }
  const normalizedStd =
    valid.length && magnitude > 0
      ? Math.sqrt(Math.max(0, m2 / valid.length))
      : 0;
  const mean = valid.length ? origin + normalizedMean * magnitude : null;
  const std = valid.length ? normalizedStd * magnitude : null;
  const unavailable = !valid.length
    ? "empty"
    : normalizedStd === 0
      ? "constant"
      : null;
  let min = Infinity,
    max = -Infinity;
  const values = new Map<string, number | null>();
  for (const [id, value] of source.values) {
    const z =
      unavailable || value === null || !Number.isFinite(value)
        ? null
        : ((value - origin) / magnitude - normalizedMean) / normalizedStd;
    values.set(id, z);
    if (z !== null) {
      min = Math.min(min, z);
      max = Math.max(max, z);
    }
  }
  return {
    layer: {
      ...source,
      values,
      name: `${source.name} · standardized`,
      unit: "z",
      range: min === Infinity ? [0, 0] : [min, max],
    },
    count: valid.length,
    mean,
    std,
    unavailable,
  };
}
