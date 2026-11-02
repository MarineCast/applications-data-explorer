import WarningNotice from "./WarningNotice";
import PalettePicker from "./PalettePicker";
import AppearanceScope from "./AppearanceScope";
import CategoryLegendItems from "./CategoryLegendItems";
import LegendDropdown from "./LegendDropdown";
import SurfaceDisplayControls from "./SurfaceDisplayControls";
import { missingColor, palettes, scaleModes } from "../data/colorScale";
import type { ColorScale, PaletteId, ScaleMode } from "../data/colorScale";
import type { SurfaceSettings } from "../data/smoothSurface";
import type { MapLayer } from "../data/map";
import { regionalAssignmentColumn } from "../data/regionalBoundaries";
import { waterAssignmentFamily } from "../data/waterAssignments";
import { criticalHabitatCoverageNote, criticalHabitatUnknownLabel, isCriticalHabitatFeature } from "../data/criticalHabitat";
import "./CriticalHabitatLegend.css";

const number = (value: number) =>
  value !== 0 && (Math.abs(value) < .001 || Math.abs(value) >= 1e7) ? value.toExponential(3)
    : value.toLocaleString(undefined, { maximumSignificantDigits: 4 });

export default function MapLegend({
  layer,
  hiddenCategories = [],
  onHiddenCategoriesChange,
  scale,
  side,
  opacity,
  onPalette,
  onScaleMode,
  onOpacity,
  standardization,
  depthBands = false,
  outlines,
  onOutlines,
  smoothing,
  onSmoothing,
  context,
  missingLabel="Unavailable",
  categoricalCounts = false,
  appearanceScope,
  open: controlledOpen,
  onOpenChange,
}: {
  layer: MapLayer;
  hiddenCategories?: readonly string[];
  onHiddenCategoriesChange?: (keys:string[]) => void;
  scale: ColorScale;
  side?: string;
  opacity: number;
  onPalette: (id: PaletteId) => void;
  onScaleMode: (mode: ScaleMode) => void;
  onOpacity: (opacity: number) => void;
  standardization?: {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    unavailable?: "empty" | "constant" | null;
  };
  depthBands?: boolean;
  outlines?: boolean;
  onOutlines?: (value: boolean) => void;
  smoothing?: SurfaceSettings;
  onSmoothing?: (settings: SurfaceSettings) => void;
  context?: string;
  missingLabel?: string;
  categoricalCounts?: boolean;
  appearanceScope?: { linked: boolean; onChange: (linked: boolean) => void };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const label = side ? `${side} map legend` : "Map legend";
  const buttonLabel = side ? `${side} map color options` : "Color options";
  const popupLabel = side ? `${side} map color options` : "Map color options";
  const categorical = Boolean(scale.categories);
  const depth = scale.mode === "depth";
  const membership = Boolean(layer.membershipLegend);
  const habitat = isCriticalHabitatFeature(layer.id);
  const mappedPresence = /(?:^|__)ANTHROPOGENIC__(?:AQUACULTURE|ARTIFICIAL_REEF|DISPOSAL_SITE|DREDGED_CHANNEL)_MAPPED_POSITIVE_EVIDENCE$/.test(layer.id) || /(?:^|__)has_mapped_artificial_reef$/.test(layer.id);
  const unknownLabel = habitat ? criticalHabitatUnknownLabel : missingLabel;
  const categoryEntries = (scale.categories ?? []).map((label,i) => ({label,i})).filter(({i}) => layer.categoryKeys?.[i] !== "multiple-memberships");
  const column = layer.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
  if (column === regionalAssignmentColumn || waterAssignmentFamily(column)) {
    categoryEntries.sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base", numeric: true }) || a.i - b.i);
  }
  const cellCount = (count: number) => `${count.toLocaleString()} ${count === 1 ? "cell" : "cells"}`;
  const counts = new Map<number, number>();
  let unknown = 0;
  if (categoricalCounts || habitat || mappedPresence) {
    if (layer.categoryMemberships) for (const row of layer.categoryMemberships.values()) {
      if (row === null) unknown++;
      else for (const index of row) counts.set(index, (counts.get(index) ?? 0) + 1);
    }
    else for (const value of layer.values.values()) {
      if (value === null) unknown++;
      else counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  const last = scale.edges.at(-1)!;
  const unit = !layer.unit || layer.unit === "source units" ? "Units unavailable" : layer.unit;
  const constant = !depth && !categorical && scale.count > 0 && scale.edges[0] === last;
  const smooth = Boolean(smoothing?.enabled && !categorical && !layer.circular && scale.count);
  const continuous = !categorical && scale.count > 0 && !constant && (scale.mode === "minmax" || smooth);
  if(categorical) return <LegendDropdown label={label} buttonLabel={buttonLabel} popupLabel={popupLabel} className={`categorical-legend ${side?"comparison-colorbar":""}`} heading="Appearance" open={controlledOpen} onOpenChange={onOpenChange}
    preview={<span className="legend-metric-name">{side&&`${side} · `}{layer.name}</span>}
    items={<><CategoryLegendItems emptyLabel={mappedPresence ? "No mapped positive evidence" : undefined} identity={`${layer.id}:${layer.resolution}`} items={categoryEntries.map(({label,i})=>{const key=layer.categoryKeys?.[i]??label;return {key,label:(categoricalCounts || mappedPresence)?`${mappedPresence ? (label === "true" || label === "1" ? "True" : label === "false" || label === "0" ? "False" : label) : label} · ${cellCount(counts.get(i)??0)}`:label,color:scale.colors[i],selected:!hiddenCategories.includes(key)};})} onSelectionChange={keys=>onHiddenCategoriesChange?.(categoryEntries.map(({label,i})=>layer.categoryKeys?.[i]??label).filter(key=>!keys.includes(key)))}/>{!mappedPresence && (categoricalCounts || habitat) && <span className="legend-coverage-key"><i style={{background:habitat?"repeating-linear-gradient(135deg,#d4d8d4 0 4px,#93a0a9 4px 8px)":layer.missingColor??missingColor}}/>{unknownLabel} · {cellCount(unknown)}</span>}{habitat&&<p className="critical-habitat-coverage-note">{criticalHabitatCoverageNote}</p>}</> }>
    <AppearanceScope scope={appearanceScope} side={side}/>
    {!membership&&<PalettePicker options={palettes} value={scale.palette} onChange={onPalette}/>}
    <SurfaceDisplayControls outlines={outlines} onOutlines={onOutlines} opacity={opacity} onOpacity={onOpacity}/>
  </LegendDropdown>;
  return (
    <LegendDropdown label={label} buttonLabel={buttonLabel} popupLabel={popupLabel}
      className={`metric-legend ${smooth ? "surface-legend" : ""} ${side ? "comparison-colorbar" : ""}`} heading="Appearance"
      open={controlledOpen} onOpenChange={onOpenChange}
      title={`${layer.name} (${unit}) · ${palettes[scale.palette].name} · ${scaleModes[scale.mode]}`}
      preview={<>
        <span className="legend-metric-name">{side && `${side} · `}{layer.name}</span>
        <span className="legend-metric-context">{context ?? `${unit} · H3 R${layer.resolution}`}</span>
        <div
          className={`map-legend-colors ${continuous ? "continuous" : ""}`}
          role="img"
          aria-label={
            scale.count
              ? depth ? "Depth bands: 0, 50, 100, 200, 500 and 1,000 metres; positive down" : `${continuous ? "Continuous scale with ten color stops" : "Ten color classes"}, ${number(scale.edges[0])} to ${number(last)} ${unit}`
              : "No non-null values"
          }
          style={
            continuous
              ? {
                  background: depth && smooth
                    ? `linear-gradient(to right, ${scale.colors.map((color, i) => `${color} ${i / scale.colors.length * 100}%`).join(",")}, ${scale.colors.at(-1)} 100%)`
                    : `linear-gradient(to right, ${scale.colors.join(",")})`,
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
                scale.count
                  ? scale.mode === "minmax"
                    ? `${number(scale.edges[0] + ((last - scale.edges[0]) * i) / 9)} ${unit}`
                    : `${number(scale.edges[i])}${Number.isFinite(scale.edges[i + 1]) ? ` – ${number(scale.edges[i + 1])}` : "+"} ${unit}`
                  : "Unavailable"
              }
            />
          ))}
        </div>
        <div className={`map-legend-ticks ${depth ? "depth-ticks" : ""}`}>
          {depth && scale.count ? (
            <>{scale.edges.slice(0, -1).map((tick, i) => <span key={tick}>{number(tick)}{i === 5 ? "+" : ""}</span>)}</>
          ) : scale.count ? (
            <>
              <span>{number(scale.edges[0])}</span>

              <span>
                {number(last)}
              </span>
            </>
          ) : (
            <span>Unavailable</span>
          )}
        </div>
        {constant && <span className="legend-value-state">Constant value · {number(last)} {unit}</span>}
        {!scale.count && <span className="legend-value-state">No available values in this slice</span>}
        {smooth && <span className="legend-surface-mode">Smooth surface · visual interpolation</span>}
        <span className="legend-coverage-key"><i style={{ background: missingColor }} />{unknownLabel}</span>
        {habitat&&<p className="critical-habitat-coverage-note">{criticalHabitatCoverageNote}</p>}
      </>}>
          <AppearanceScope scope={appearanceScope} side={side} />
          <PalettePicker options={palettes} value={scale.palette} onChange={onPalette} />
          <details className="legend-advanced">
            <summary>Advanced</summary>
            <div className="legend-scale-section">
              <label className="legend-coloring-method">Coloring method
                <select
                  aria-label="Coloring method"
                  value={scale.mode}
                  onChange={(e) => onScaleMode(e.target.value as ScaleMode)}
                >
                {Object.entries(scaleModes).filter(([id]) => id !== "depth" || depthBands).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
                </select>
              </label>
              {scale.repeatedQuantiles && (
                <p className="legend-scale-note">
                  Tied values share colors; some classes may be empty.
                </p>
              )}
              {scale.count > 0 && scale.edges[0] === last && (
                <p className="legend-scale-note">Constant value · one color</p>
              )}
            </div>
            <SurfaceDisplayControls smoothing={smoothing} onSmoothing={onSmoothing}
              unavailable={layer.circular ? "Directions keep their native cells; scalar smoothing is not applied." : !scale.count ? "No available numeric values to blend." : undefined}
              outlines={outlines} onOutlines={onOutlines} opacity={opacity} onOpacity={onOpacity} />
            {standardization && <section className="legend-standardization" aria-label="Standardized display">
              <label className="atlas-standardize">
                <span>Display z-scores<small>(value − mean) / std</small></span>
                <input type="checkbox" role="switch" aria-label="Display z-scores"
                  checked={!layer.circular && standardization.enabled} disabled={layer.circular}
                  onChange={event => standardization.onChange(event.target.checked)} />
              </label>
              <p className="atlas-standardize-note">
                {layer.circular ? "Directions are circular and are not standardized."
                  : `Full area · non-null cells · population std.${appearanceScope?.linked ? " Applies to both maps." : ""}`}
              </p>
              {standardization.enabled && standardization.unavailable &&
                <WarningNotice inline title="Standardization unavailable" role="status" message={standardization.unavailable === "empty"
                    ? "Standardization unavailable: no non-null values."
                    : "Standardization unavailable: zero standard deviation."} />}
            </section>}
          </details>
    </LegendDropdown>
  );
}
