import { cellToBoundary, gridDisk, latLngToCell } from "h3-js";
import type { Cell } from "../data/map";
import type { FeatureId } from "../data/demo";

// Deterministic H3/value fixtures for renderer and adapter tests only.
const seed = (s: string) =>
  Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
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
