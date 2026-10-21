import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import type { Map as LibreMap } from "maplibre-gl";
import { latLngToCell } from "h3-js";
import type { MapLayer } from "../data/map";
import { createColorScale } from "../data/colorScale";
import type { SurfaceResult, SurfaceSettings } from "../data/smoothSurface";
import useSmoothSurface from "./useSmoothSurface";

const workers: FakeWorker[] = [];
class FakeWorker {
  onmessage?: (event: { data: SurfaceResult | { error: string } }) => void;
  onerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { workers.push(this); }
}
beforeEach(() => {
  workers.length = 0;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("ImageData", class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
});
afterEach(() => vi.unstubAllGlobals());
const cells = [48.5, 48.8].map(lat => ({ id: latLngToCell(lat, -123.5, 6), lat, lon: -123.5, boundary: [], zone: "north" as const }));
const layer: MapLayer = { id: "depth", name: "Depth", unit: "m", resolution: 6, range: [0, 10], cells,
  values: new Map([[cells[0].id, 0], [cells[1].id, null]]), sourceLabel: "test" };
const scale = createColorScale(layer.values, "ocean", "equal");
const result = (): SurfaceResult => ({ width: 2, height: 2, pixels: new Uint8ClampedArray(new ArrayBuffer(16)), coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]], elapsedMs: 12 });

it("cancels superseded jobs, ignores late output and releases workers without recomputing on a plain rerender", () => {
  const updateImage = vi.fn();
  const map = { current: { getSource: () => ({ updateImage }) } } as unknown as RefObject<LibreMap | null>;
  const settings: SurfaceSettings = { enabled: true, radius: 0.75, contours: true };
  const view = renderHook(({ settings }) => useSmoothSurface(map, 1, layer, scale, settings), { initialProps: { settings } });
  expect(view.result.current.pending).toBe(true);
  expect(workers[0].postMessage.mock.calls[0][0].values[0]).toBe(0);
  expect(Number.isNaN(workers[0].postMessage.mock.calls[0][0].values[1])).toBe(true);
  view.rerender({ settings: { ...settings, radius: 1.5 } });
  expect(workers[0].terminate).toHaveBeenCalled();
  act(() => workers[0].onmessage?.({ data: result() }));
  expect(updateImage).not.toHaveBeenCalled();
  act(() => workers[1].onmessage?.({ data: result() }));
  expect(updateImage).toHaveBeenCalledOnce();
  expect(view.result.current.active).toBe(true);
  expect(view.result.current.pending).toBe(false);
  view.rerender({ settings: { ...settings, radius: 1.5 } });
  expect(workers).toHaveLength(2);
  view.unmount();
  expect(workers[1].terminate).toHaveBeenCalled();
});

it("keeps the native renderer available if smoothing fails or is disabled", () => {
  const map = { current: { getSource: () => ({ updateImage: vi.fn() }) } } as unknown as RefObject<LibreMap | null>;
  const settings: SurfaceSettings = { enabled: true, radius: 1, contours: true };
  const view = renderHook(({ settings }) => useSmoothSurface(map, 1, layer, scale, settings), { initialProps: { settings } });
  act(() => workers[0].onerror?.());
  expect(view.result.current.active).toBe(false);
  expect(view.result.current.error).toContain("Showing original cells");
  expect(workers[0].terminate).toHaveBeenCalled();
  view.rerender({ settings: { ...settings, enabled: false } });
  expect(view.result.current.active).toBe(false);
  expect(view.result.current.error).toBeUndefined();
});
