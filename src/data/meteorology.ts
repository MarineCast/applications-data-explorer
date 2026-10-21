import { parseWeatherFrame, weatherFrameLabel, periodEnd } from "./weatherPeriods";
import { cellToLatLng, getResolution, isValidCell } from "h3-js";
import type { SeascapeCatalog, SeascapeFeature, SeascapeLayer } from "./seascape";

export interface WeatherMetric {
  column: string; name: string; family: string; hourlyColumn: string; definition: string;
  unit: string; range: [number, number]; available: number; rows: number; circular: boolean;
}
export interface MeteorologyCatalog {
  version: number; status: string; snapshot: string; dates: string[]; cells: string[];
  resolution: 5; timezone: "UTC"; metrics: WeatherMetric[];
  dailySeries: Record<string, (number | null)[]>;
  source: {
    attribution: string; sampling: string; effective_resolution: string; run_date_utc: string;
    source_revision: string; hourly_time: string; null_policy: string;
    products: { daily: { sha256: string }; hourly: { sha256: string } };
  };
}
export interface HourlyWeather {
  snapshot: string; date: string; metric: string; cell?: string | null; hourlyColumn: string;
  values: (number | null)[]; counts: number[]; hours: string[];
}
export const weatherDate = (date: string) => new Intl.DateTimeFormat("en", {
  timeZone: "UTC", month: "short", day: "numeric", year: "numeric",
}).format(new Date(`${date}T00:00:00Z`));

export async function loadMeteorologyCatalog(): Promise<MeteorologyCatalog | undefined> {
  const response = await fetch("/local-data/meteorology/catalog.json", { cache: "no-store" });
  if (response.status >= 500) { const detail = await response.json() as {error?: string}; throw new Error(detail.error || "Current Meteorology files could not be read."); }
  if (!response.ok || !response.headers.get("content-type")?.includes("json")) return undefined;
  const catalog = await response.json() as MeteorologyCatalog;
  if (catalog.version !== 1 || catalog.status !== "validated_local_snapshot" || catalog.resolution !== 5 || catalog.timezone !== "UTC"
    || !/^[a-f0-9]{64}$/.test(catalog.snapshot) || !catalog.cells?.length || !catalog.dates?.length || !catalog.metrics?.length
    || new Set(catalog.cells).size !== catalog.cells.length || catalog.cells.some(id => !isValidCell(id) || getResolution(id) !== 5)
    || catalog.dates.some((day, i) => !/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day
      || (i > 0 && Date.parse(day) - Date.parse(catalog.dates[i - 1]) !== 86_400_000))
    || catalog.metrics.some(metric => !metric.unit || !metric.hourlyColumn || !metric.column || metric.range.some(value => !Number.isFinite(value))
      || catalog.dailySeries?.[metric.column]?.length !== catalog.dates.length)) throw new Error("Meteorology cache is not a validated daily UTC product.");
  return catalog;
}

export function withMeteorology(catalog: SeascapeCatalog, weather: MeteorologyCatalog): SeascapeCatalog {
  return { ...catalog, meteorology: weather, datasets: { ...catalog.datasets,
    meteorology: { name: "Meteorology", release: "ERA5 reanalysis", status: "validated local daily/hourly snapshot",
      publishedAt: weather.source.run_date_utc, manifestSha256: weather.snapshot,
      limitations: `ERA5 reanalysis; ${weather.source.effective_resolution}. ${weather.source.sampling}. UTC days; original nulls retained. Independent observational accuracy is not established. ${weather.source.source_revision}. ${weather.source.attribution}.` } },
    features: [...catalog.features, ...weather.metrics.map(metric => ({
      id: `METEOROLOGY__${metric.column}`, column: metric.column, dataset: "meteorology", resolution: 5 as const,
      name: metric.name, family: metric.family, unit: metric.unit, range: metric.range, available: metric.available, rows: metric.rows,
      kind: "numeric" as const, circular: metric.circular, role: "reanalysis_daily_metric", qualifiers: [],
      sourceRelease: "ERA5 / ERA5T snapshot", sourcePath: "meteorology-daily.parquet", sourceSha256: weather.source.products.daily.sha256,
      definition: `${metric.definition} UTC calendar day; complete hourly support required. ${weather.source.effective_resolution}.`,
      modelingEligibility: "research only; observational accuracy not independently established", arrowType: "double",
    }))] };
}

async function weatherQuery<T>(catalog: MeteorologyCatalog, operation: "daily" | "hourly", date: string, metric: string, signal?: AbortSignal, cell?: string): Promise<T> {
  const frame = parseWeatherFrame(date);
  const parameters = new URLSearchParams({ operation, snapshot: catalog.snapshot, date: frame.date, metric, ...(frame.period === "day" ? {} : {period: frame.period}), ...(cell ? { cell } : {}) });
  const response = await fetch(`/api/meteorology?${parameters}`, { signal });
  if (!response.headers.get("content-type")?.includes("json")) throw new Error("The local meteorology reader is unavailable. Start the app with its data adapter.");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Cannot read the requested meteorology day.");
  if (payload.snapshot !== catalog.snapshot || payload.date !== frame.date || payload.metric !== metric || (payload.period ?? "day") !== frame.period) throw new Error("Meteorology day/snapshot mismatch. Reload local data.");
  return payload as T;
}

type DailyValues = { ids: string[]; values: (number | null)[] };
const dailyCache = new Map<string, DailyValues>();
const pendingFrames = new Map<string, Promise<DailyValues>>();
export async function loadMeteorologyLayer(catalog: SeascapeCatalog, field: SeascapeFeature, selectedDate?: string, signal?: AbortSignal): Promise<SeascapeLayer> {
  const weather = catalog.meteorology;
  if (!weather) throw new Error("No validated meteorology data.");
  const day = selectedDate ?? weather.dates.at(-1)!;
  const metric = field.column!;
  if (!weather.dates.includes(parseWeatherFrame(day).date) || !weather.metrics.some(item => item.column === metric)) throw new Error("Unavailable meteorology date or metric.");
  const key = `${weather.snapshot}:${day}:${metric}`;
  let data = dailyCache.get(key);
  signal?.throwIfAborted();
  if (!data) {
    let pending = pendingFrames.get(key);
    if (!pending) {
      pending = weatherQuery<DailyValues>(weather, "daily", day, metric).then(result => {
        if (result.ids?.length !== weather.cells.length || result.ids.some((id, i) => id !== weather.cells[i])
          || result.values?.length !== result.ids.length || result.values.some(value => value !== null && (typeof value !== "number" || !Number.isFinite(value))))
          throw new Error("Invalid meteorology native support or measurements.");
        dailyCache.set(key, result);
        if (dailyCache.size > 16) dailyCache.delete(dailyCache.keys().next().value!);
        return result;
      }).finally(() => pendingFrames.delete(key));
      pendingFrames.set(key, pending);
    }
    data = await pending;
  }
  signal?.throwIfAborted();
  const { period } = parseWeatherFrame(day);
  const periodName = period === "week" ? "Weekly" : "Monthly";
  const range: [number, number] = period !== "day" && metric === "PRECIPITATION_MM" ? [0, field.range[1] * (period === "week" ? 7 : 31)] : field.range;
  const name = period === "day" ? field.name : `${periodName} ${field.name.replace(/^Daily /i, "").toLowerCase()}`;
  const frame = parseWeatherFrame(day);
  const operation = metric === "PRECIPITATION_MM" ? "sum" : field.circular ? "direction of mean U/V wind vector" : metric.endsWith("_MIN") ? "minimum" : metric.endsWith("_MAX") ? "maximum" : "mean";
  const qualifiers: SeascapeLayer["qualifiers"] = period === "day" ? {} : {
    "Temporal aggregation": data.ids.map(() => `${operation}; all daily inputs required`),
    "UTC period start": data.ids.map(() => frame.date),
    "UTC period end (inclusive)": data.ids.map(() => periodEnd(frame.date, period)),
  };
  const cells = data.ids.map(id => { const [lat, lon] = cellToLatLng(id); return { id, lat, lon, boundary: [], zone: "north" as const }; });
  const values = new Map(data.ids.map((id, i) => [id, data!.values[i]]));
  return { id: field.id, name, unit: field.unit, range, resolution: 5, circular: field.circular,
    cells, values, rawValues: values, field, catalog, qualifiers, index: new Map(data.ids.map((id, i) => [id, i])),
    sourceLabel: `ERA5 reanalysis · ${period === "day" ? "daily" : periodName.toLowerCase()} UTC · native H3 R5 · ~31 km source`, slice: { axis: "UTC date", value: day, label: weatherFrameLabel(day) } };
}

export async function loadHourlyWeather(catalog: MeteorologyCatalog, day: string, metric: string, signal?: AbortSignal, cell?: string) {
  const data = await weatherQuery<HourlyWeather>(catalog, "hourly", day, metric, signal, cell);
  if ((data.cell ?? undefined) !== cell || data.values?.length !== 24 || data.counts?.length !== 24 || data.hours?.length !== 24
    || data.hours.some((hour, index) => hour !== `${day}T${String(index).padStart(2, "0")}:00:00Z`)
    || data.values.some(value => value !== null && (typeof value !== "number" || !Number.isFinite(value)))) throw new Error("Invalid hourly meteorology support.");
  return data;
}
