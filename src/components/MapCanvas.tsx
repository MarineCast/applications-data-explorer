import { lazy, Suspense, useCallback, useState } from "react";
import WarningNotice from "./WarningNotice";
import { loadGeographicRenderer } from "../data/geographicRenderer";
import type { MapCanvasProps } from "../data/map";

const MapTilerCanvas = lazy(loadGeographicRenderer);

export default function MapCanvas(props: MapCanvasProps) {
  const [failed, setFailed] = useState(false);
  const onUnavailable = useCallback(() => setFailed(true), []);
  const apiKey = import.meta.env.VITE_MAPTILER_KEY?.trim();
  if (apiKey && !failed) return <Suspense fallback={
    <div className="map-canvas map-wait-state" role="status">Loading map…</div>
  }>
    <MapTilerCanvas {...props} apiKey={apiKey} onUnavailable={onUnavailable} />
  </Suspense>;
  return <div className="map-canvas map-wait-state">
    <WarningNotice title={failed ? "Basemap unavailable" : "Basemap key not configured"}
      message={failed ? "Retry to load the geographic map." : "Configure the MapTiler key described in the app README to load the geographic map."}
      onRetry={failed ? () => setFailed(false) : undefined} retryLabel="Retry basemap" />
  </div>;
}
