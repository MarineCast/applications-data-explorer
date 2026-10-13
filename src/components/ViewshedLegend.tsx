import type { ReactNode, RefObject } from "react";
import LegendDropdown from "./LegendDropdown";
import type { ColorScale } from "../data/colorScale";
import { scalePercent } from "../data/viewshedScale";
import type { ViewshedScaleMode } from "../data/viewshedScale";
import type { ViewMetric, ViewScore } from "../data/viewshed";

export default function ViewshedLegend({ scores, metric, metricName, scale, scaleMode, open, rootRef, buttonRef, onToggle, children }: {
  scores: ViewScore[]; metric: ViewMetric; metricName: string; scale: ColorScale;
  scaleMode: ViewshedScaleMode; open: boolean; rootRef: RefObject<HTMLElement | null>; buttonRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void; children: ReactNode;
}) {
  const manualRange = scaleMode === "custom" || scaleMode === "fixed";
  const clippedBelow = manualRange ? scores.filter(score => score[metric] != null && score[metric]! < scale.edges[0] - 1e-12).length : 0;
  const clippedAbove = manualRange ? scores.filter(score => score[metric] != null && score[metric]! > scale.edges[10] + 1e-12).length : 0;
  const constant = scale.count > 0 && scale.edges[0] === scale.edges[10];
  return <LegendDropdown className="viewshed-legend" label="Viewshed legend" popupLabel="Viewshed color options"
    rootRef={rootRef} buttonRef={buttonRef} open={open}
    onOpenChange={value => { if (value !== open) onToggle(); }}
    title={`${metricName} · Color options`} preview={<>
        <div className="viewshed-gradient" role="img" aria-label={scale.count ? `Color range ${scalePercent(scale.edges[0])} to ${scalePercent(scale.edges[10])}` : "No scores available"}
          style={scale.count && !constant && scale.mode === "minmax" ? { background: `linear-gradient(to right, ${scale.colors.join(",")})` } : { background: scale.count ? scale.colors[5] : "#a9b3bb" }}>
          {scale.count > 0 && !constant && scale.mode === "quantile" && scale.colors.map((color, i) => <span key={color} style={{ background: color }} title={`${scalePercent(scale.edges[i])}–${scalePercent(scale.edges[i + 1])}`} />)}
        </div>
        <div className="viewshed-legend-ticks">{scale.count ? <><span>{clippedBelow ? "≤ " : ""}{scalePercent(scale.edges[0])}</span><span>{scalePercent(scale.edges[5])}</span><span>{clippedAbove ? "≥ " : ""}{scalePercent(scale.edges[10])}</span></> : <span>No scores available</span>}</div>
    </>}>
      {children}
    </LegendDropdown>;
}
