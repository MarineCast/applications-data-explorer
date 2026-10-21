import type { SurfaceSettings } from "../data/smoothSurface";

/** Shared appearance controls for native cells and display-only scalar smoothing. */
export default function SurfaceDisplayControls({ smoothing, onSmoothing, unavailable, note, outlines, onOutlines, opacity, onOpacity }: {
  smoothing?: SurfaceSettings; onSmoothing?: (settings: SurfaceSettings) => void;
  unavailable?: string; note?: string;
  outlines?: boolean; onOutlines?: (visible: boolean) => void;
  opacity: number; onOpacity: (opacity: number) => void;
}) {
  const smooth = Boolean(smoothing?.enabled && !unavailable);
  return <>
    {smoothing && onSmoothing && <section className="legend-smoothing" aria-label="Surface display">
      <label className="atlas-standardize">
        <span>Smooth surface<small>Gaussian blend of data values</small></span>
        <input type="checkbox" role="switch" aria-label="Smooth surface" checked={smooth} disabled={Boolean(unavailable)}
          onChange={event => onSmoothing({ ...smoothing, enabled: event.target.checked })} />
      </label>
      <p className="legend-scale-note">{unavailable ?? note ?? "Blends nearby values in the browser. Missing cells stay unfilled; Insights and exports keep original measurements."}</p>
      {smooth && <>
        <label className="legend-opacity"><span>Smoothing <strong>{smoothing.radius}× cell width</strong></span>
          <input type="range" aria-label="Smoothing radius" min="0.25" max="3" step="0.25" value={smoothing.radius}
            onChange={event => onSmoothing({ ...smoothing, radius: Number(event.target.value) })} />
        </label>
        <label className="legend-outline"><input type="checkbox" aria-label="Contour lines" checked={smoothing.contours}
          onChange={event => onSmoothing({ ...smoothing, contours: event.target.checked })} />Contour lines</label>
      </>}
    </section>}
    {onOutlines && <label className="legend-outline"><input type="checkbox" aria-label="Cell outlines" checked={smooth ? false : outlines} disabled={smooth}
      onChange={event => onOutlines(event.target.checked)} /> Cell outlines{smooth && <small>Selection stays outlined</small>}</label>}
    <label className="legend-opacity"><span>Opacity <strong>{Math.round(opacity * 100)}%</strong></span>
      <input aria-label="Layer opacity" type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={event => onOpacity(Number(event.target.value))} />
    </label>
  </>;
}
