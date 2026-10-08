import { cellToBoundary, gridDisk, latLngToCell } from "h3-js";
export type FeatureId =
  | "temperature"
  | "chlorophyll"
  | "traffic"
  | "viewability";
export type Region = "all" | "north" | "south";
export interface Feature {
  id: FeatureId;
  name: string;
  short: string;
  unit: string;
  domain: string;
  range: [number, number];
  temporal: boolean;
}
export const features: Feature[] = [
  {
    id: "temperature",
    name: "Sea surface temperature",
    short: "Temperature",
    unit: "°C",
    domain: "Oceanography",
    range: [7, 16],
    temporal: true,
  },
  {
    id: "chlorophyll",
    name: "Chlorophyll concentration",
    short: "Chlorophyll",
    unit: "mg/m³",
    domain: "Oceanography",
    range: [0.2, 5.4],
    temporal: true,
  },
  {
    id: "traffic",
    name: "Vessel activity",
    short: "Vessel activity",
    unit: "index",
    domain: "Human activity",
    range: [0, 100],
    temporal: true,
  },
  {
    id: "viewability",
    name: "Physical viewability",
    short: "Viewability",
    unit: "weight",
    domain: "Viewshed",
    range: [0, 1],
    temporal: false,
  },
];
export const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const seasonMonths: Record<string, number[]> = {
  all: Array.from({ length: 12 }, (_, i) => i),
  winter: [11, 0, 1],
  spring: [2, 3, 4],
  summer: [5, 6, 7],
  autumn: [8, 9, 10],
};
const seed = (s: string) =>
  Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export interface Cell {
  id: string;
  lat: number;
  lon: number;
  boundary: number[][];
  zone: "north" | "south";
}
export const cells: Cell[] = gridDisk(latLngToCell(48.45, -123.5, 5), 9)
  .sort()
  .map((id) => {
    const boundary = cellToBoundary(id);
    const lat = boundary.reduce((a, p) => a + p[0], 0) / boundary.length;
    const lon = boundary.reduce((a, p) => a + p[1], 0) / boundary.length;
    return { id, lat, lon, boundary, zone: lat >= 48.5 ? "north" : "south" };
  });
export function valueFor(
  cell: Cell,
  feature: FeatureId,
  month: number,
): number | null {
  const s = seed(cell.id);
  if (feature === "viewability") month = 0;
  if ((s + month * 7) % 29 === 0) return null;
  const wave = (Math.sin(cell.lat * 5 + cell.lon * 3 + month * 0.28) + 1) / 2;
  const noise = (s % 101) / 101;
  switch (feature) {
    case "temperature":
      return 7 + month * 0.22 + wave * 4 + noise * 2;
    case "chlorophyll":
      return 0.2 + wave * 3.3 + noise * 1.8;
    case "traffic":
      return Math.round(noise * 65 + wave * 35);
    case "viewability":
      return Math.round((noise * 0.6 + wave * 0.4) * 100) / 100;
  }
}
export const featureById = (id: FeatureId) =>
  features.find((f) => f.id === id)!;
export const formatValue = (v: number | null, id: FeatureId) =>
  v === null
    ? "Unavailable"
    : `${v.toFixed(id === "traffic" ? 0 : 1)} ${featureById(id).unit}`;
export function filterCells(region: Region) {
  return cells.filter((c) => region === "all" || c.zone === region);
}
export function summarize(list: Cell[], feature: FeatureId, month: number) {
  const values = list
    .map((c) => valueFor(c, feature, month))
    .filter((v): v is number => v !== null);
  return {
    count: list.length,
    available: values.length,
    mean: values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null,
    coverage: list.length ? (values.length / list.length) * 100 : 0,
  };
}
export function pairedValues(
  region: Region,
  season: string,
  x: FeatureId,
  y: FeatureId,
) {
  return filterCells(region).flatMap((c) =>
    seasonMonths[season].flatMap((month) => {
      const a = valueFor(c, x, month),
        b = valueFor(c, y, month);
      return a === null || b === null ? [] : [{ x: a, y: b, id: c.id, month }];
    }),
  );
}
export function correlation(rows: { x: number; y: number }[]): number | null {
  if (rows.length < 2) return null;
  const mx = rows.reduce((s, r) => s + r.x, 0) / rows.length,
    my = rows.reduce((s, r) => s + r.y, 0) / rows.length;
  const numerator = rows.reduce((s, r) => s + (r.x - mx) * (r.y - my), 0);
  const denominator = Math.sqrt(
    rows.reduce((s, r) => s + (r.x - mx) ** 2, 0) *
      rows.reduce((s, r) => s + (r.y - my) ** 2, 0),
  );
  return denominator ? numerator / denominator : null;
}
export function histogram(
  values: number[],
  range: [number, number],
  count = 12,
) {
  const bins = Array.from({ length: count }, () => 0);
  values.forEach(
    (v) =>
      bins[
        Math.min(
          count - 1,
          Math.max(
            0,
            Math.floor(((v - range[0]) / (range[1] - range[0])) * count),
          ),
        )
      ]++,
  );
  return bins;
}
export type Species = "orca" | "humpback" | "harbour-porpoise";
export interface Sighting {
  id: string;
  cell: Cell;
  species: Species;
  encounter: "group" | "single";
  month: number;
}
export const sightings: Sighting[] = Array.from({ length: 96 }, (_, i) => ({
  id: `DEMO-${String(i + 1).padStart(3, "0")}`,
  cell: cells[(i * 37 + 11) % cells.length],
  species: (["orca", "humpback", "harbour-porpoise"] as const)[i % 3],
  encounter: i % 4 === 0 ? "single" : "group",
  month: i % 12,
}));
export interface DemoProduct {
  id: string;
  name: string;
  domain: string;
  format: string;
  release: string;
  coverage: number[];
  flags: { label: string; count: number }[];
  joinLoss: number;
}
export const products: DemoProduct[] = features.map((f, i) => ({
  id: f.id,
  name: f.name,
  domain: f.domain,
  format: "Parquet · H3 r5",
  release: "demo-2026.02",
  coverage: months.map((_, m) => 92 + ((m * 3 + i * 7) % 9)),
  flags: [
    { label: "Unavailable", count: 9 + i * 3 },
    { label: "Partial coverage", count: 5 + i * 2 },
    { label: "Out of range", count: i === 2 ? 3 : 0 },
  ],
  joinLoss: 4 + i * 3,
}));
