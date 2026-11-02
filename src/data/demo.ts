export type FeatureId =
  | "temperature"
  | "chlorophyll"
  | "traffic"
  | "viewability";
interface Feature {
  id: FeatureId;
  name: string;
  short: string;
  unit: string;
  domain: string;
  range: [number, number];
  temporal: boolean;
}
const features: Feature[] = [
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
