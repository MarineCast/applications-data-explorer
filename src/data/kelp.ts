import type { SeascapeFeature } from "./seascape";

const names: Record<string, string> = {
  ANNUAL_KELP_EXTENT_M2: "Annual Kelp Extent",
  KELP_EXTENT_ALL_TIME_M2: "Kelp Extent (All Time)",
};

/** Keep producer quality/provenance fields in inspectors, with two extent choices. */
export function kelpFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  const canonical = new Set(features.filter(f => names[(f.column ?? f.id).split("__").at(-1)!])
    .map(f => f.resolution));
  return features.flatMap(field => {
    if ((field.dataset ?? "seascape") !== "seascape" || !canonical.has(field.resolution)) return [field];
    const column = (field.column ?? field.id).split("__").at(-1)!;
    if (names[column]) return [{ ...field, name: names[column], family: "Biogenic Habitats", unit: "m2" }];
    return ["Kelp", "Annual Kelp Footprints", "Mapped Kelp Mosaic"].includes(field.family) ? [] : [field];
  });
}
