import { cellToBoundary, cellToLatLng } from "h3-js";
import { missingColor } from "./colorScale";
import type { ColorScale } from "./colorScale";
import type { Polygon, MultiPolygon } from "geojson";

export interface SurfaceScale extends ColorScale { logarithmicScale?: ColorScale }

export interface SurfaceSettings {
  enabled: boolean;
  radius: number;
  contours: boolean;
}
export interface SurfaceRequest {
  ids: string[];
  values: Float64Array;
  scale: SurfaceScale;
  geometries?: (Polygon | MultiPolygon)[];
  missingColor?: string;
  radius: number;
  contours: boolean;
  maxSize?: number;
}
export interface SurfaceGrid {
  width: number;
  height: number;
  // 0: outside support; 1: available source cell; 2: unavailable source cell.
  mask: Uint8Array;
  values: Float64Array;
  sigma: number;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
}
export interface SurfaceResult {
  width: number;
  height: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
  coordinates: SurfaceGrid["coordinates"];
  elapsedMs: number;
}

// Web Mercator makes one raster pixel the same projected distance in both axes.
const project = (lat: number, lon: number): [number, number] => [
  lon / 360 + 0.5,
  (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2,
];
const unproject = (x: number, y: number): [number, number] => [
  (x - 0.5) * 360, Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI,
];

/** Rasterize exact native polygons once over the complete layer, never a viewport sample. */
export function surfaceGrid(request: SurfaceRequest): SurfaceGrid {
  if (!request.ids.length || request.ids.length !== request.values.length)
    throw new Error("Smooth surface requires matching native cell keys and values.");
  if (request.geometries && (request.geometries.length !== request.ids.length || request.geometries.some(geometry => !geometry)))
    throw new Error("Smooth surface requires matching clipped support.");
  if (request.scale.categories || !Number.isFinite(request.radius) || request.radius <= 0)
    throw new Error("Smooth surface requires numeric values and a positive blend radius.");
  const centres = request.ids.map(id => project(...cellToLatLng(id)));
  const firstBoundary = cellToBoundary(request.ids[0]).map(([lat, lon]) => project(lat, lon));
  const cellWidth = Math.max(...firstBoundary.map(p => p[0])) - Math.min(...firstBoundary.map(p => p[0]));
  let west = Infinity, north = Infinity, east = -Infinity, south = -Infinity;
  for (const [x, y] of centres) {
    west = Math.min(west, x); east = Math.max(east, x);
    north = Math.min(north, y); south = Math.max(south, y);
  }
  // Padding comfortably contains boundary vertices at every latitude in this regional layer.
  west -= cellWidth; east += cellWidth; north -= cellWidth; south += cellWidth;
  const size = Math.max(64, Math.min(1536, request.maxSize ?? 1280));
  const step = Math.max(east - west, south - north) / size;
  const width = Math.max(2, Math.ceil((east - west) / step));
  const height = Math.max(2, Math.ceil((south - north) / step));
  east = west + width * step; south = north + height * step;
  const mask = new Uint8Array(width * height);
  const values = new Float64Array(width * height);
  for (let cell = 0; cell < request.ids.length; cell++) {
    const geometry = request.geometries?.[cell];
    const polygons = geometry ? geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
      : [[cellToBoundary(request.ids[cell]).map(([lat, lon]) => [lon, lat])]];
    // Scan every ring together: even/odd filling retains holes and disjoint pieces.
    const rings = polygons.flat().map(ring => ring.map(([lon, lat]) => {
      const [x, y] = project(lat, lon);
      return [(x - west) / step, (y - north) / step];
    }));
    const ys = rings.flatMap(ring => ring.map(p => p[1]));
    const minY = Math.max(0, Math.ceil(Math.min(...ys) - 0.5));
    const maxY = Math.min(height - 1, Math.floor(Math.max(...ys) - 0.5));
    const available = Number.isFinite(request.values[cell]);
    for (let row = minY; row <= maxY; row++) {
      const y = row + 0.5, intersections: number[] = [];
      for (const ring of rings) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
          intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      intersections.sort((a, b) => a - b);
      for (let pair = 0; pair + 1 < intersections.length; pair += 2) {
        const minX = Math.max(0, Math.ceil(intersections[pair] - 0.5));
        const maxX = Math.min(width - 1, Math.floor(intersections[pair + 1] - 0.5));
        for (let col = minX; col <= maxX; col++) {
          const index = row * width + col;
          mask[index] = available ? 1 : 2;
          values[index] = available ? request.values[cell] : 0;
        }
      }
    }
  }
  return { width, height, mask, values,
    sigma: Math.max(0.5, cellWidth / step * Math.max(0.25, Math.min(3, request.radius))),
    coordinates: [unproject(west, north), unproject(east, north), unproject(east, south), unproject(west, south)] };
}

/** Normalized Gaussian convolution of measurements, excluding nulls from both sums. */
export function gaussianValues(grid: SurfaceGrid): Float64Array {
  const { width, height, values, mask, sigma } = grid;
  const radius = Math.min(128, Math.ceil(sigma * 3));
  const kernel = Float64Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-0.5 * ((i - radius) / sigma) ** 2));
  const horizontalValues = new Float64Array(values.length), horizontalWeights = new Float64Array(values.length);
  const blurred = new Float64Array(values.length).fill(NaN);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    for (let offset = -radius; offset <= radius; offset++) {
      const col = x + offset;
      if (col < 0 || col >= width) continue;
      const other = y * width + col;
      if (mask[other] !== 1) continue;
      const weight = kernel[offset + radius];
      horizontalValues[index] += values[other] * weight;
      horizontalWeights[index] += weight;
    }
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (mask[index] !== 1) continue;
    let sum = 0, weights = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      const row = y + offset;
      if (row < 0 || row >= height) continue;
      const weight = kernel[offset + radius], other = row * width + x;
      sum += horizontalValues[other] * weight;
      weights += horizontalWeights[other] * weight;
    }
    if (weights > 0) blurred[index] = sum / weights;
  }
  return blurred;
}

const rgb = (color: string) => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));

/** Color the blended scalar, rather than blurring pre-classified RGB colors. */
export function surfaceColor(value: number, scale: SurfaceScale, channels = scale.colors.map(rgb)): number[] {
  if (!Number.isFinite(value)) return rgb(missingColor);
  if (scale.logarithmicScale) return surfaceColor(Math.log1p(Math.max(0, value) * 100), scale.logarithmicScale, channels);
  if (scale.edges[0] === scale.edges.at(-1)) return channels[Math.floor(channels.length / 2)];
  let position = 0;
  if (scale.mode === "depth") {
    const stops = scale.edges.slice(0, -1);
    const upper = stops.findIndex(edge => edge > value);
    position = upper < 0 ? scale.colors.length - 1 : upper === 0 ? 0 :
      upper - 1 + (value - stops[upper - 1]) / (stops[upper] - stops[upper - 1]);
  } else if (scale.mode === "quantile") {
    const upper = scale.edges.findIndex(edge => edge >= value);
    const i = Math.max(1, upper < 0 ? scale.edges.length - 1 : upper);
    const interval = scale.edges[i] - scale.edges[i - 1];
    position = (i - 1 + (interval ? (value - scale.edges[i - 1]) / interval : 0)) / (scale.edges.length - 1) * (scale.colors.length - 1);
  } else {
    const min = scale.edges[0], max = scale.edges.at(-1)!;
    position = max === min ? (scale.colors.length - 1) / 2 : (value - min) / (max - min) * (scale.colors.length - 1);
  }
  position = Math.max(0, Math.min(scale.colors.length - 1, position));
  const lower = Math.floor(position), fraction = position - lower;
  const a = channels[lower], b = channels[Math.min(lower + 1, scale.colors.length - 1)];
  return a.map((channel, i) => Math.round(channel + (b[i] - channel) * fraction));
}

/** Marching-squares segments: all four samples must have available source support. */
export function contourSegments(grid: SurfaceGrid, values: Float64Array, level: number) {
  const segments: number[][] = [];
  for (let y = 0; y < grid.height - 1; y++) for (let x = 0; x < grid.width - 1; x++) {
    const indices = [y * grid.width + x, y * grid.width + x + 1, (y + 1) * grid.width + x + 1, (y + 1) * grid.width + x];
    if (indices.some(i => grid.mask[i] !== 1 || !Number.isFinite(values[i]))) continue;
    const points = [[x + 0.5, y + 0.5], [x + 1.5, y + 0.5], [x + 1.5, y + 1.5], [x + 0.5, y + 1.5]];
    const crossings: number[][] = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, a = values[indices[i]], b = values[indices[j]];
      if ((a < level) === (b < level)) continue;
      const t = (level - a) / (b - a);
      crossings.push([points[i][0] + t * (points[j][0] - points[i][0]), points[i][1] + t * (points[j][1] - points[i][1])]);
    }
    // Resolve saddle cells consistently using the centre value.
    if (crossings.length === 4 && (values[indices[0]] < level) === (indices.reduce((sum, i) => sum + values[i], 0) / 4 < level))
      crossings.push(crossings.shift()!);
    for (let i = 0; i + 1 < crossings.length; i += 2)
      segments.push([...crossings[i], ...crossings[i + 1]]);
  }
  return segments;
}

export function surfacePixels(grid: SurfaceGrid, values: Float64Array, scale: SurfaceScale, unavailableColor = missingColor) {
  const pixels = new Uint8ClampedArray(new ArrayBuffer(grid.width * grid.height * 4));
  const missing = rgb(unavailableColor), channels = scale.colors.map(rgb);
  for (let i = 0; i < values.length; i++) {
    if (!grid.mask[i]) continue;
    pixels.set(grid.mask[i] === 2 ? missing : surfaceColor(values[i], scale, channels), i * 4);
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}
