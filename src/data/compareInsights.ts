import type { SourceValue, SlicedProduct, NativeProduct } from "./seascape";

export interface BoxSummary { count: number; missing: number; min: number; q1: number; median: number; q3: number; max: number }
export interface ValuePair { id: string; x: number; y: number }
export interface TemporalBox { key: string; label: string; time: number; left?: BoxSummary; right?: BoxSummary; error?: string }
export interface TemporalComparison { rows: TemporalBox[]; loading: boolean; total?: number; error?: string }
export const numericValues = (values: Iterable<SourceValue>) => Array.from(values).filter((v): v is number => typeof v === "number" && Number.isFinite(v));

/** Linear empirical quantiles; whiskers retain the observed minimum and maximum. */
export function summarizeBox(input: Iterable<SourceValue>): BoxSummary | undefined {
  const raw = Array.from(input), values = numericValues(raw).sort((a, b) => a - b);
  if (!values.length) return undefined;
  const quantile = (p: number) => {
    const at = (values.length - 1) * p, low = Math.floor(at), fraction = at - low;
    return values[low] * (1 - fraction) + values[Math.ceil(at)] * fraction;
  };
  return { count: values.length, missing: raw.length - values.length, min: values[0], q1: quantile(.25),
    median: quantile(.5), q3: quantile(.75), max: values.at(-1)! };
}

function pearson(x: number[], y: number[]): number | null {
  if (x.length < 2 || x.every(v => v === x[0]) || y.every(v => v === y[0])) return null;
  const magnitudeX = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const magnitudeY = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const nx = x.map(v => v / magnitudeX), ny = y.map(v => v / magnitudeY);
  const mx = nx.reduce((sum, v) => sum + v / nx.length, 0), my = ny.reduce((sum, v) => sum + v / ny.length, 0);
  let xx = 0, yy = 0, xy = 0;
  nx.forEach((v, i) => { const dx = v - mx, dy = ny[i] - my; xx += dx * dx; yy += dy * dy; xy += dx * dy; });
  return xx === 0 || yy === 0 ? null : Math.max(-1, Math.min(1, xy / Math.sqrt(xx) / Math.sqrt(yy)));
}
function ranks(values: number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = Array<number>(values.length);
  for (let i = 0; i < order.length;) {
    let end = i + 1;
    while (end < order.length && order[end].value === order[i].value) end++;
    for (let j = i; j < end; j++) result[order[j].index] = (i + end - 1) / 2 + 1;
    i = end;
  }
  return result;
}
/** Exact native H3 join; missing/unsupported cells are never zero-filled. */
export function correlateLayers(left: ReadonlyMap<string, SourceValue>, right: ReadonlyMap<string, SourceValue>) {
  const pairs: ValuePair[] = [];
  for (const [id, x] of left) {
    const y = right.get(id);
    if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) pairs.push({ id, x, y });
  }
  const x = pairs.map(pair => pair.x), y = pairs.map(pair => pair.y);
  return { pairs, pearson: pearson(x, y), spearman: pearson(ranks(x), ranks(y)),
    excluded: new Set([...left.keys(), ...right.keys()]).size - pairs.length };
}

/** Only declared, parseable calendar axes qualify; a bearing is never a time axis. */
export function calendarSlices(product?: NativeProduct | SlicedProduct) {
  if (!product || !("slices" in product)) return undefined;
  const axis = product.axis.toLowerCase();
  const grain = /^(survey )?year$/.test(axis) ? "year" : /^(survey )?month$/.test(axis) ? "month"
    : /^(survey )?(date|day)$/.test(axis) ? "day" : /^(date ?time|timestamp|time)$/.test(axis) ? "time" : undefined;
  if (!grain) return undefined;
  const entries = Object.entries(product.slices).map(([key, slice]) => {
    const valid = grain === "year" ? /^\d{4}$/.test(key) : grain === "month" ? /^\d{4}-\d{2}$/.test(key)
      : grain === "day" ? /^\d{4}-\d{2}-\d{2}$/.test(key) : /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(key);
    const time = valid ? Date.parse(grain === "year" ? `${key}-01-01T00:00:00Z` : grain === "month" ? `${key}-01T00:00:00Z` : grain === "day" ? `${key}T00:00:00Z` : key) : NaN;
    const canonical = Number.isFinite(time) && (grain === "time" || new Date(time).toISOString().startsWith(key));
    return { key, label: slice.label ?? key, time: canonical ? time : NaN };
  });
  return entries.every(entry => Number.isFinite(entry.time)) ? { grain, entries: entries.sort((a, b) => a.time - b.time) } : undefined;
}
