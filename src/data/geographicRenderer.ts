export const loadGeographicRenderer = () => import("../components/MapTilerCanvas");

/** Warm the code and CSS without mounting a map or delaying Home's first render. */
export function preloadGeographicMap() {
  if (import.meta.env.VITE_MAPTILER_KEY?.trim()) void loadGeographicRenderer().catch(() => {});
}
