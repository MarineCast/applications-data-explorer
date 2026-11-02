import { expect, it } from "vitest";
import { viewshedOverlays, viewshedSurfaceLayer } from "./viewshedMap";
import { pair, sourceA, sourceB, targetB, weightedViewshedFixture } from "../test/viewshedFixture";

it("keeps clipped land/water roles distinct for the same H3, preserving nulls, observer samples and selection", () => {
  const data = weightedViewshedFixture();
  const overlay = viewshedOverlays({ data, scores: data.averages, source: sourceA, mode: "target", metric: "weight_above_ground",
    allTargets: true, selection: { role: "target", id: sourceA } });
  expect(overlay.targets.features[0]).toMatchObject({ id: sourceA, geometry: data.targets[0].geometry, properties: { role: "target", selected: true } });
  expect(overlay.sources.features[0]).toMatchObject({ id: sourceA, geometry: data.sources[0].geometry, properties: { role: "source", selected: false } });
  expect(overlay.targets.features[1].properties!.color).toBe("#a9b3bb");
  expect(overlay.observers.features).toHaveLength(0);
  const focused = viewshedOverlays({ data, scores: [pair()], source: sourceA, mode: "source", metric: "lower", selection: { role: "source", id: sourceA } });
  expect(focused.observers.features.map(f => f.geometry.coordinates)).toEqual(data.sources[0].observers);
  expect(focused.targets.features).toHaveLength(1);
  expect(focused.sources.features[0].properties!.selected).toBe(true);
  expect(data.averages[1].weight_above_ground).toBeNull();
});

it("smooths the active role's original scores and clipped shapes, keeping absent pairs outside support", () => {
  const data = weightedViewshedFixture();
  const overview = viewshedSurfaceLayer({ data, scores: data.averages, mode: "target", metric: "weight_above_ground" });
  expect([...overview.values]).toEqual([[sourceA, .8], [targetB, null]]);
  expect(overview.surfaceGeometries?.get(sourceA)).toBe(data.targets[0].geometry);
  const source = viewshedSurfaceLayer({ data, scores: [pair(sourceA, targetB, 0, 0)], mode: "source", metric: "lower" });
  expect(source.cells.map(cell => cell.id)).toEqual([targetB]);
  expect([...source.values]).toEqual([[targetB, 0]]);
  const rows = [pair(sourceA, targetB, 0, 0), pair(sourceB, targetB, .8, .8)];
  const reverse = viewshedSurfaceLayer({ data, scores: rows, mode: "targetSources", metric: "lower" });
  expect([...reverse.values]).toEqual([[sourceA, 0], [sourceB, .8]]);
  expect(reverse.surfaceGeometries?.get(sourceA)).toBe(data.sources[0].geometry);
  expect(reverse.cells).toHaveLength(2);
  expect(rows[0].lower).toBe(0);
  expect(rows[1].lower).toBe(.8);
});
