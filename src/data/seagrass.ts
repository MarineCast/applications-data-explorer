import type { SeascapeFeature } from "./seascape";

const allTime = "SEAGRASS_EXTENT_ALL_TIME_M2";

/** One canonical Seagrass choice; source dates and methods remain qualifiers. */
export function seagrassFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  return features.flatMap(field => {
    if ((field.dataset ?? "seascape") !== "seascape") return [field];
    const column = (field.column ?? field.id).split("__").at(-1)!;
    if (column === allTime) return [{ ...field, name: "Seagrass Extent (All Time)", family: "Biogenic Habitats", unit: "m2" }];
    return column === "ANNUAL_SEAGRASS_EXTENT_M2" || ["Seagrass", "Seagrass Evidence", "Sentinel-2 Seagrass Habitat"].includes(field.family) ? [] : [field];
  });
}
