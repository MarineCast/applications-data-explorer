import { useState } from "react";
import type { PaletteId, ScaleMode } from "../data/colorScale";
import type { SurfaceSettings } from "../data/smoothSurface";
import { defaultHydrologyAppearance } from "../data/hydrologyOverlay";

const defaults = { palette: "ocean" as PaletteId, scaleMode: undefined as ScaleMode | undefined,
  opacity: .8, outlines: false, smoothing: { enabled: false, radius: .75, contours: true } as SurfaceSettings,
  standardize: false, hydrology: defaultHydrologyAppearance };
export type MapAppearance = typeof defaults;
/** One owner for side appearance. Linking adopts left; unlinking snapshots it. */
export default function useComparisonAppearance() {
  const [left, setLeft] = useState(defaults);
  const [independentRight, setRight] = useState(defaults);
  const [linked, setLinked] = useState(true);
  const right = linked ? left : independentRight;
  const change = <K extends keyof MapAppearance>(side: "left" | "right", key: K, value: MapAppearance[K]) => {
    const set = side === "left" || linked ? setLeft : setRight;
    set(previous => ({ ...previous, [key]: value }));
  };
  const link = (value: boolean) => {
    if (!value) setRight(left);
    setLinked(value);
  };
  const swap = () => { if (!linked) { setLeft(right); setRight(left); } };
  return { left, right, linked, change, link, swap };
}
