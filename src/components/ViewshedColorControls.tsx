import { palettes } from "../data/colorScale";
import type { PaletteId } from "../data/colorScale";
import { viewshedScaleModes } from "../data/viewshedScale";
import type { ViewshedColorScale, ViewshedScaleMode } from "../data/viewshedScale";

export default function ViewshedColorControls({ palette, scaleMode, scale, rangeDraft, draftValid, saturatedTargets,
  opacity, onPalette, onScaleMode, onLimit, onOpacity }: {
  palette: PaletteId; scaleMode: ViewshedScaleMode; scale: ViewshedColorScale; rangeDraft: [string, string];
  draftValid: boolean; saturatedTargets: number; opacity: number;
  onPalette: (palette: PaletteId) => void; onScaleMode: (mode: ViewshedScaleMode) => void;
  onLimit: (index: 0 | 1, value: string) => void; onOpacity: (opacity: number) => void;
}) {
  return <>
    <div className="legend-palettes" role="radiogroup" aria-label="Viewshed color palette">
      {Object.entries(palettes).map(([id, item]) => <label className="legend-palette-row" key={id}>
        <input type="radio" name="viewshed-palette" aria-label={item.name} value={id} checked={palette === id} onChange={() => onPalette(id as PaletteId)} />
        <span className="legend-palette-name">{item.name}</span>
        <span className="legend-palette-swatch" aria-hidden="true">{item.colors.map(color => <i key={color} style={{ background: color }} />)}</span>
      </label>)}
    </div>
    <label className="viewshed-field">Coloring method
      <select aria-label="Viewshed color scale" value={scaleMode} onChange={e => onScaleMode(e.target.value as ViewshedScaleMode)}>
        {Object.entries(viewshedScaleModes).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
    {scaleMode === "custom" && <div className="viewshed-color-limits">
      <label>Minimum (%)<input aria-label="Color scale minimum (%)" type="number" min="0" max="100" step="0.1" value={rangeDraft[0]} onChange={e => onLimit(0, e.target.value)} /></label>
      <label>Maximum (%)<input aria-label="Color scale maximum (%)" type="number" min="0" max="100" step="0.1" value={rangeDraft[1]} onChange={e => onLimit(1, e.target.value)} /></label>
    </div>}
    {scaleMode === "custom" && !draftValid && <p className="viewshed-mode-note" role="status">Enter 0–100%, with minimum below maximum. The map keeps the last valid range.</p>}
    <p className="viewshed-mode-note">{scaleMode === "auto" ? "Colors follow the minimum and maximum of all current target scores." : scaleMode === "log" ? "Log(1 + score in %) emphasizes smaller values and includes zero. Limits follow all current target scores." : scaleMode === "quantile" ? "Ten classes across all current target scores; equal scores share a color." : "Common limits let you compare sources; values beyond the limits use the end colors."} Scores stay unchanged.</p>
    {saturatedTargets > 0 && <p className="viewshed-mode-note">{saturatedTargets} targets beyond color limits · original scores retained</p>}
    {scale.count > 0 && scale.edges[0] === scale.edges[10] && <p className="viewshed-mode-note">Constant score · one color</p>}
    {scale.repeatedQuantiles && <p className="viewshed-mode-note">Tied scores share colors; some classes are empty.</p>}
    <label className="viewshed-field">Target layer opacity · {Math.round(opacity * 100)}%
      <input aria-label="Target layer opacity" type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={e => onOpacity(Number(e.target.value))} />
    </label>
  </>;
}
