import { expect, it } from "vitest";
import { viewshedSurfaceLayer } from "./viewshedMap";
import { pair, sourceA, sourceB, targetB, weightedViewshedFixture } from "../test/viewshedFixture";

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
