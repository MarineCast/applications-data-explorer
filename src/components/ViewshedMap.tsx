import { lazy, Suspense, useCallback, useState } from "react";
import type { ViewshedMapProps } from "../data/viewshedMap";
import ViewshedLocalMap from "./ViewshedLocalMap";

const ViewshedBasemap = lazy(() => import("./ViewshedBasemap"));

export default function ViewshedMap(props: ViewshedMapProps) {
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fallback = useCallback(() => setUnavailable(true), []);
  if (unavailable) return <div className="viewshed-map-fallback">
    <ViewshedLocalMap {...props} />
    <div className="viewshed-basemap-status" role="status">
      Basemap unavailable. Showing the local pilot coastline.
      <button onClick={() => { setUnavailable(false); setAttempt(a => a + 1); }}>Retry basemap</button>
    </div>
  </div>;
  return <Suspense fallback={<p className="viewshed-basemap-status" role="status">Loading basemap…</p>}>
    <ViewshedBasemap key={attempt} {...props} onUnavailable={fallback} />
  </Suspense>;
}
