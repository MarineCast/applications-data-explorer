import { describe, expect, it } from "vitest";
import { seagrassFeatures } from "./seagrass";
import type { SeascapeFeature } from "./seascape";
const field = (column: string, family = "Seagrass"): SeascapeFeature => ({
  id: `seagrass__${column}`, column, family, resolution: 6, dataset: "seascape", name: column,
  unit: "m2", qualifiers: ["OBSERVATION_YEARS_JSON", "SOURCE_PERIODS_JSON"],
} as SeascapeFeature);
describe("canonical Seagrass All Time only", () => {
  it("keeps one feature and its identity/date provenance, removing retired annual and diagnostics", () => {
    const all = field("SEAGRASS_EXTENT_ALL_TIME_M2");
    const fields = seagrassFeatures([field("ANNUAL_SEAGRASS_EXTENT_M2"), all, field("QC"), field("OLD_MODEL_AREA"), field("DEPTH", "Bathymetry")]);
    expect(fields.map(f => f.name)).toEqual(["Seagrass Extent (All Time)", "DEPTH"]);
    expect(fields[0].id).toBe(all.id);
    expect(fields[0].qualifiers).toBe(all.qualifiers);
  });
  it("does not revive annual from a stale catalog and preserves other domains", () => {
    expect(seagrassFeatures([field("ANNUAL_SEAGRASS_EXTENT_M2")])).toEqual([]);
    const governance = { ...field("QC"), dataset: "governance" };
    expect(seagrassFeatures([governance])).toEqual([governance]);
  });
});
