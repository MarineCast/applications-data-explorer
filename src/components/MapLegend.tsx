import { useId } from "react";
import LegendDropdown from "./LegendDropdown";
import { missingColor, palettes, scaleModes } from "../data/colorScale";
import type { ColorScale, PaletteId, ScaleMode } from "../data/colorScale";
import type { MapLayer } from "../data/map";

const number = (value: number) =>
  value !== 0 && (Math.abs(value) < .001 || Math.abs(value) >= 1e7) ? value.toExponential(3)
    : value.toLocaleString(undefined, { maximumSignificantDigits: 4 });

export default function MapLegend({
  layer,
  scale,
  side,
  opacity,
  onPalette,
  onScaleMode,
  onOpacity,
  open: controlledOpen,
  onOpenChange,
}: {
  layer: MapLayer;
  scale: ColorScale;
  side?: string;
  opacity: number;
  onPalette: (id: PaletteId) => void;
  onScaleMode: (mode: ScaleMode) => void;
  onOpacity: (opacity: number) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const settingsId = useId();
  const label = side ? `${side} map legend` : "Map legend";
  const buttonLabel = side ? `${side} map color options` : "Color options";
  const popupLabel = side ? `${side} map color options` : "Map color options";
  const categorical = Boolean(scale.categories);
  const constant = !categorical && scale.count > 0 && scale.edges[0] === scale.edges[10];
  const continuous = !categorical && scale.count > 0 && !constant && scale.mode === "minmax";
  return (
    <LegendDropdown label={label} buttonLabel={buttonLabel} popupLabel={popupLabel}
      className={side ? "comparison-colorbar" : ""}
      open={controlledOpen} onOpenChange={onOpenChange}
      title={`${layer.name} (${layer.unit}) · ${palettes[scale.palette].name} · ${categorical ? "Categories" : scaleModes[scale.mode]}`}
      preview={<>
        {side && <span className="comparison-legend-name"><span>{side} · {layer.name}</span><em>{layer.unit}</em></span>}
        <div
          className={`map-legend-colors ${continuous ? "continuous" : ""}`}
          role="img"
          aria-label={
            categorical && scale.count
              ? `${scale.categories!.length} source categories`
              : scale.count
              ? `${continuous ? "Continuous scale with ten color stops" : "Ten color classes"}, ${number(scale.edges[0])} to ${number(scale.edges[10])} ${layer.unit}`
              : "No non-null values"
          }
          style={
            continuous
              ? {
                  background: `linear-gradient(to right, ${scale.colors.join(",")})`,
                }
              : undefined
          }
        >
          {(scale.count
            ? constant
              ? Array<string>(10).fill(scale.colors[5])
              : scale.colors
            : [missingColor]
          ).map((color, i) => (
            <span
              key={i}
              style={{ background: color }}
              title={
                categorical && scale.count
                  ? scale.categories![i]
                  : scale.count
                  ? scale.mode === "minmax"
                    ? `${number(scale.edges[0] + ((scale.edges[10] - scale.edges[0]) * i) / 9)} ${layer.unit}`
                    : `${number(scale.edges[i])} – ${number(scale.edges[i + 1])} ${layer.unit}`
                  : "Unavailable"
              }
            />
          ))}
        </div>
        <div className="map-legend-ticks">
          {categorical && scale.count ? (
            <span>{scale.categories!.length} categories · click for key</span>
          ) : scale.count ? (
            <>
              <span>{number(scale.edges[0])}</span>
              <span>{number(scale.edges[5])}</span>
              <span>
                {number(scale.edges[10])}{!side && ` ${layer.unit}`}
              </span>
            </>
          ) : (
            <span>Unavailable</span>
          )}
        </div>
      </>}>
          <div
            className="legend-palettes"
            role="radiogroup"
            aria-label="Color palette"
          >
            {Object.entries(palettes).map(([id, item]) => (
              <label className="legend-palette-row" key={id}>
                <input
                  type="radio"
                  name={`${settingsId}-palette`}
                  aria-label={item.name}
                  value={id}
                  checked={scale.palette === id}
                  onChange={() => onPalette(id as PaletteId)}
                />
                <span className="legend-palette-name">{item.name}</span>
                <span className="legend-palette-swatch" aria-hidden="true">
                  {item.colors.map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
              </label>
            ))}
          </div>
          {categorical ? (
            <div className="legend-category-key" aria-label="Category key">
              {scale.categories!.map((name, i) => (
                <div key={name}><i style={{ background: scale.colors[i] }} />{name}</div>
              ))}
              {!scale.count && <p>No non-null values in this slice.</p>}
            </div>
          ) : <div className="legend-scale-section">
            <label className="legend-coloring-method">Coloring method
              <select
                aria-label="Coloring method"
                value={scale.mode}
                onChange={(e) => onScaleMode(e.target.value as ScaleMode)}
              >
              {Object.entries(scaleModes).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
              </select>
            </label>
            <p className="legend-scale-note">
              {scale.mode === "equal"
                ? "Ten equal-width value bins."
                : scale.mode === "quantile"
                  ? "Ten quantiles across the full native area."
                  : "Continuous color from minimum to maximum."}
            </p>
            {scale.repeatedQuantiles && (
              <p className="legend-scale-note">
                Tied values share colors; some classes may be empty.
              </p>
            )}
            {scale.count > 0 && scale.edges[0] === scale.edges[10] && (
              <p className="legend-scale-note">Constant value · one color</p>
            )}
          </div>}
          <label className="legend-opacity">
            <span>
              Opacity <strong>{Math.round(opacity * 100)}%</strong>
            </span>
            <input
              aria-label="Layer opacity"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => onOpacity(Number(e.target.value))}
            />
          </label>
          <div className="legend-missing">
            <i style={{ background: missingColor }} /> Unavailable values · full
            area
          </div>
    </LegendDropdown>
  );
}
