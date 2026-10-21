import PalettePicker from "./PalettePicker";
import { palettes } from "../data/colorScale";
import type { PaletteId } from "../data/colorScale";
import { viewshedScaleModes } from "../data/viewshedScale";
import type { ViewshedColorScale, ViewshedScaleMode } from "../data/viewshedScale";
import SurfaceDisplayControls from "./SurfaceDisplayControls";
import type { SurfaceSettings } from "../data/smoothSurface";

export default function ViewshedColorControls({ palette, scaleMode, scale, rangeDraft, draftValid, saturatedTargets,
  opacity, gridVisible, smoothing, onSmoothing, onGridVisible, onPalette, onScaleMode, onLimit, onOpacity }: {
  palette: PaletteId; scaleMode: ViewshedScaleMode; scale: ViewshedColorScale; rangeDraft: [string, string];
  draftValid: boolean; saturatedTargets: number; opacity: number; gridVisible: boolean;
  smoothing: SurfaceSettings; onSmoothing: (settings: SurfaceSettings) => void;
  onGridVisible: (visible: boolean) => void;
  onPalette: (palette: PaletteId) => void; onScaleMode: (mode: ViewshedScaleMode) => void;
  onLimit: (index: 0 | 1, value: string) => void; onOpacity: (opacity: number) => void;
}) {
  return <>
    <PalettePicker options={palettes} value={palette} onChange={onPalette} />
    <details className="legend-advanced">
      <summary>Advanced</summary>
      <label className="legend-coloring-method">Coloring method
        <select aria-label="Coloring method" value={scaleMode} onChange={e => onScaleMode(e.target.value as ViewshedScaleMode)}>
          {Object.entries(viewshedScaleModes).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      {scaleMode === "custom" && <div className="viewshed-color-limits">
        <label>Minimum (%)<input aria-label="Color scale minimum (%)" type="number" min="0" max="100" step="0.1" value={rangeDraft[0]} onChange={e => onLimit(0, e.target.value)} /></label>
        <label>Maximum (%)<input aria-label="Color scale maximum (%)" type="number" min="0" max="100" step="0.1" value={rangeDraft[1]} onChange={e => onLimit(1, e.target.value)} /></label>
      </div>}
      {scaleMode === "custom" && !draftValid && <p className="viewshed-mode-note" role="status">Enter 0–100%, with minimum below maximum. The map keeps the last valid range.</p>}
      <p className="viewshed-mode-note">{scaleMode === "auto" ? "Colors follow the minimum and maximum of all current scores." : scaleMode === "log" ? "Log(1 + score in %) emphasizes smaller values and includes zero. Limits follow all current scores." : scaleMode === "quantile" ? "Ten classes across all current scores; equal scores share a color." : "Common limits let you compare sources; values beyond the limits use the end colors."} Scores stay unchanged.</p>
      {saturatedTargets > 0 && <p className="viewshed-mode-note">{saturatedTargets} {saturatedTargets === 1 ? "cell" : "cells"} beyond color limits · original scores retained</p>}
      {scale.count > 0 && scale.edges[0] === scale.edges[10] && <p className="viewshed-mode-note">Constant score · one color</p>}
      {scale.repeatedQuantiles && <p className="viewshed-mode-note">Tied scores share colors; some classes are empty.</p>}
      <SurfaceDisplayControls smoothing={smoothing} onSmoothing={onSmoothing}
        unavailable={!scale.count ? "No available numeric values to blend." : undefined}
        note="Blends nearby weights within the original land or water shapes. Unavailable cells stay unfilled; Insights keep original scores."
        outlines={gridVisible} onOutlines={onGridVisible} opacity={opacity} onOpacity={onOpacity} />
    </details>
  </>;
}
