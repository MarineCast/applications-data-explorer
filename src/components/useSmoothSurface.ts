import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import type { ImageSource, Map as LibreMap } from "maplibre-gl";
import type { MapLayer } from "../data/map";
import type { ColorScale } from "../data/colorScale";
import type { SurfaceRequest, SurfaceResult, SurfaceSettings } from "../data/smoothSurface";

export default function useSmoothSurface(map: RefObject<LibreMap | null>, ready: number,
  layer?: MapLayer, scale?: ColorScale, settings?: SurfaceSettings) {
  const enabled = settings?.enabled ?? false;
  const radius = settings?.radius ?? 0.75;
  const contours = settings?.contours ?? true;
  const request = useMemo<SurfaceRequest | undefined>(() => {
    if (!enabled || !layer || layer.categories || !scale?.count) return undefined;
    return {
      ids: layer.cells.map(cell => cell.id),
      values: Float64Array.from(layer.cells, cell => layer.values.get(cell.id) ?? NaN),
      geometries: layer.surfaceGeometries ? layer.cells.map(cell => layer.surfaceGeometries!.get(cell.id)!) : undefined,
      missingColor: layer.missingColor,
      scale, radius, contours,
    };
  }, [layer, scale, enabled, radius, contours]);
  const [state, setState] = useState<{ request?: SurfaceRequest; ready?: number; error?: string; elapsedMs?: number }>({});
  useEffect(() => {
    if (!request || !ready || !map.current?.getSource("smooth-surface")) return;
    let disposed = false, worker: Worker | undefined;
    const fail = () => {
      worker?.terminate();
      if (!disposed) setState({ request, ready, error: "Smooth view unavailable. Showing original cells; toggle Smooth surface to retry." });
    };
    try {
      worker = new Worker(new URL("../data/smoothSurface.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<SurfaceResult | { error: string }>) => {
        if (disposed) return;
        if ("error" in event.data) { fail(); return; }
        const source = map.current?.getSource("smooth-surface") as ImageSource | undefined;
        if (!source) return;
        const { width, height, pixels, coordinates, elapsedMs } = event.data;
        try {
          source.updateImage({ image: new ImageData(pixels, width, height), coordinates });
          setState({ request, ready, elapsedMs });
          worker?.terminate();
        } catch { fail(); }
      };
      worker.onerror = fail;
      // Keep the input buffer intact so a map-style reload can request it again.
      worker.postMessage(request);
    } catch { queueMicrotask(fail); }
    return () => { disposed = true; worker?.terminate(); };
  }, [map, ready, request]);
  const current = request && state.request === request && state.ready === ready;
  return {
    active: Boolean(current && !state.error),
    pending: Boolean(request && !current),
    error: current ? state.error : undefined,
    elapsedMs: current ? state.elapsedMs : undefined,
  };
}
