import { surfaceGrid, gaussianValues, surfacePixels, contourSegments } from "./smoothSurface";
import type { SurfaceRequest, SurfaceResult } from "./smoothSurface";

self.onmessage = (event: MessageEvent<SurfaceRequest>) => {
  const start = performance.now();
  try {
    const request = event.data, grid = surfaceGrid(request), values = gaussianValues(grid);
    for (let i = 0; i < values.length; i++) if (grid.mask[i] === 1 && !Number.isFinite(values[i]))
      throw new Error("Numeric blend is not finite; retain the original cells.");
    let pixels = surfacePixels(grid, values, request.scale, request.missingColor);
    if (request.contours) {
      const unadorned = pixels;
      const canvas = new OffscreenCanvas(grid.width, grid.height), context = canvas.getContext("2d");
      if (!context) throw new Error("Contour renderer unavailable.");
      context.putImageData(new ImageData(pixels, grid.width, grid.height), 0, 0);
      context.strokeStyle = "rgba(18,61,87,0.24)";
      context.lineWidth = 0.9;
      const levels = [...new Set(request.scale.edges.slice(1, -1).filter(Number.isFinite))];
      for (const level of levels) {
        context.beginPath();
        for (const [x1, y1, x2, y2] of contourSegments(grid, values, level)) {
          context.moveTo(x1, y1); context.lineTo(x2, y2);
        }
        context.stroke();
      }
      pixels = context.getImageData(0, 0, grid.width, grid.height).data;
      // Canvas antialiasing cannot extend a contour into a missing cell or outside support.
      for (let i = 0; i < grid.mask.length; i++) if (grid.mask[i] !== 1)
        pixels.set(unadorned.subarray(i * 4, i * 4 + 4), i * 4);
    }
    const result: SurfaceResult = { width: grid.width, height: grid.height, pixels, coordinates: grid.coordinates, elapsedMs: performance.now() - start };
    self.postMessage(result, { transfer: [pixels.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Smooth surface unavailable." });
  }
};
