import type { SourceValue } from "./seascape";

export interface InsightBin { min: number; max: number; count: number }
export interface InsightSummary {
  total: number; count: number; missing: number;
  min: number | null; max: number | null; mean: number | null; median: number | null;
  histogram: InsightBin[]; distribution: InsightBin[];
  categories: { value: Exclude<SourceValue, null>; count: number }[];
}

export function binsFor(values: number[], min: number, max: number, size: number): InsightBin[] {
  if (min === max) return [{ min, max, count: values.length }];
  const bins = Array.from({ length: size }, (_, i) => ({
    min: min * (1 - i / size) + max * (i / size),
    max: min * (1 - (i + 1) / size) + max * ((i + 1) / size), count: 0,
  }));
  const span = max - min;
  const magnitude = Math.max(Math.abs(min), Math.abs(max));
  for (const value of values) {
    const fraction = Number.isFinite(span) ? (value - min) / span
      : (value / magnitude - min / magnitude) / (max / magnitude - min / magnitude);
    bins[Math.min(size - 1, Math.max(0, Math.floor(fraction * size)))].count++;
  }
  return bins;
}

/** Full active native layer; cells count equally. Null/invalid support is separate. */
export function summarizeInsights(input: Iterable<SourceValue>, categorical = false): InsightSummary {
  const raw = Array.from(input);
  const base: InsightSummary = { total: raw.length, count: 0, missing: raw.length,
    min: null, max: null, mean: null, median: null, histogram: [], distribution: [], categories: [] };
  if (categorical) {
    const counts = new Map<Exclude<SourceValue, null>, number>();
    for (const value of raw) {
      if (value === null || (typeof value === "number" && !Number.isFinite(value))) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
      base.count++;
    }
    base.missing = base.total - base.count;
    base.categories = Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
    return base;
  }
  const values = raw.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!values.length) return base;
  const min = values[0], max = values.at(-1)!;
  const magnitude = Math.max(Math.abs(min), Math.abs(max)) || 1;
  let mean = 0;
  values.forEach((value, i) => { mean += (value / magnitude - mean) / (i + 1); });
  const middle = Math.floor(values.length / 2);
  return { ...base, count: values.length, missing: raw.length - values.length,
    min, max, mean: mean * magnitude,
    median: values.length % 2 ? values[middle] : values[middle - 1] / 2 + values[middle] / 2,
    histogram: binsFor(values, min, max, 24), distribution: binsFor(values, min, max, 5) };
}
