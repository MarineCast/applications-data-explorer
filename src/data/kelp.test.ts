import { describe, expect, it } from "vitest";
import { kelpFeatures } from "./kelp";
import type { SeascapeFeature } from "./seascape";

const field = (column: string, family = "Kelp", resolution = 6): SeascapeFeature => ({
  id: `kelp__${column}`, column, family, resolution, dataset: "seascape", name: column,
  unit: "m2", qualifiers: ["QC"],
} as SeascapeFeature);

describe("canonical Kelp choices", () => {
  it("shows the two scientific extents and preserves source values and qualifiers", () => {
    const annual = field("ANNUAL_KELP_EXTENT_M2");
    const fields = kelpFeatures([annual, field("KELP_EXTENT_ALL_TIME_M2"), field("QC"),
      field("MAPPED_AREA_M2", "Mapped Kelp Mosaic"), field("DEPTH", "Bathymetry")]);
    expect(fields.map(f => f.name)).toEqual(["Annual Kelp Extent", "Kelp Extent (All Time)", "DEPTH"]);
    expect(fields[0].id).toBe(annual.id);
    expect(fields[0].qualifiers).toBe(annual.qualifiers);
  });
  it("preserves other domains and does not relabel historical Kelp source arrays", () => {
    const historical = field("MAPPED_BED_EXTENT_IN_FULL_H3_M2");
    expect(kelpFeatures([historical])).toEqual([historical]);
    const governance = { ...field("QC"), dataset: "governance" };
    expect(kelpFeatures([field("ANNUAL_KELP_EXTENT_M2"), governance])[1]).toBe(governance);
  });
});
