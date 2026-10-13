import { createHash, webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSource, loadViewshed, scoreColor, validateScores, validateWeights } from "./viewshed";
import { pair, sourceA, sourceB, viewshedFixture, weightedViewshedFixture } from "../test/viewshedFixture";

let serial = 0;
function fixture(weighted = false) {
  const data = weighted ? weightedViewshedFixture() : viewshedFixture();
  data.catalog.snapshot = (++serial).toString(16).padStart(64, "0");
  const bodies = new Map<string, string>();
  const asset = (name: string, value: unknown) => {
    const url = `/local-data/viewshed/${data.catalog.snapshot}/${name}.json`;
    const body = JSON.stringify(value);
    bodies.set(url, body);
    return { url, sha256: createHash("sha256").update(body).digest("hex") };
  };
  const install = () => {
    const { catalog, ...common } = data;
    catalog.common = asset("common", common);
    catalog.sources = { [sourceA]: asset(sourceA, { source_h3: sourceA, pairs: [pair()] }),
      [sourceB]: asset(sourceB, { source_h3: sourceB, pairs: [pair(sourceB, data.targets[1].id, .8, .8)] }) };
    bodies.set("/local-data/viewshed/catalog.json", JSON.stringify(catalog));
  };
  install();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(bodies.get(url) ?? "missing", { status: bodies.has(url) ? 200 : 404 })));
  return { data, bodies, install };
}
afterEach(() => vi.unstubAllGlobals());
describe("viewshed read-only pilot adapter", () => {
  it("validates weight lineage, profile and conditional target denominators", async () => {
    fixture(true);
    const data = await loadViewshed();
    expect(data.averages[0].weight_above_ground).toBe(.8);
    expect(data.averages[1].above_ground_status).toBe("not_applicable");
    const f = fixture(true);
    f.data.catalog.components!.parent_sha256 = "d".repeat(64);
    f.install();
    await expect(loadViewshed()).rejects.toThrow("diagnostics");
    const g = fixture(true);
    g.data.averages[0].above_ground_source_count = 2;
    g.install();
    await expect(loadViewshed()).rejects.toThrow("denominator");
  });
  it("keeps unknown, not applicable, known zero and missing weight fields distinct", () => {
    const score = { ...pair(), weight_terrain: .2, weight_distance: .5, weight_above_ground: 0,
      above_ground_lower: 0, above_ground_upper: 0, above_ground_status: "known" as const };
    expect(() => validateWeights([score])).not.toThrow();
    expect(() => validateWeights([{ ...score, above_ground_status: "unknown", weight_above_ground: null, above_ground_upper: .4 }])).not.toThrow();
    expect(() => validateWeights([{ ...score, above_ground_status: "unknown", weight_above_ground: 0, above_ground_upper: .4 }])).toThrow("missingness");
    expect(() => validateWeights([{ ...score, weight_terrain: 0, above_ground_status: "not_applicable", weight_above_ground: null, above_ground_lower: null, above_ground_upper: null }])).not.toThrow();
    expect(() => validateWeights([pair()])).toThrow("weights");
  });
  it("preserves coastal source/target roles, nullable scores and all-source denominators", async () => {
    fixture();
    const data = await loadViewshed();
    const rows = await loadSource(data, sourceA);
    expect(data.sources[0].id).toBe(data.targets[0].id);
    expect(rows[0].lower).toBe(.4);
    expect(rows[0].average_viewability).toBeNull();
    expect(data.averages[0].lower).toBe(.2);
    expect(data.averages[0].source_count).toBe(2);
    expect(data.averages[0].outside_reach_source_count).toBe(1);
    expect(scoreColor(0)).not.toBe(scoreColor(null));
  });
  it("rejects corrupted source bytes and allows retry after a failed fetch", async () => {
    const f = fixture();
    const data = await loadViewshed();
    const url = data.catalog.sources[sourceA].url;
    const original = f.bodies.get(url)!;
    f.bodies.set(url, "{}");
    await expect(loadSource(data, sourceA)).rejects.toThrow("checksum mismatch");
    f.bodies.set(url, original);
    expect(await loadSource(data, sourceA)).toHaveLength(1);
  });
  it("rejects partial or invalid all-source averages", async () => {
    const f = fixture();
    f.data.averages[0].source_count = 1;
    f.install();
    await expect(loadViewshed()).rejects.toThrow("denominator");
  });
  it("rejects duplicate targets and false complete scores instead of filling missing inputs", () => {
    expect(() => validateScores([pair(), pair()])).toThrow("scores");
    expect(() => validateScores([{ ...pair(), average_viewability: 0 }])).toThrow("missingness");
    expect(() => validateScores([{ ...pair(), lower: NaN }])).toThrow("scores");
    expect(() => validateScores([{ ...pair(), upper: .2 }])).toThrow("bounds");
  });
  it("reports a missing local cache without synthetic fallback", async () => {
    fixture().bodies.clear();
    await expect(loadViewshed()).rejects.toThrow("cache is missing");
  });
});
