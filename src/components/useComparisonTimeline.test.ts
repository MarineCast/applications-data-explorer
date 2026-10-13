import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useComparisonTimeline } from "./useComparisonTimeline";
import { loadSeascapeValues } from "../data/seascape";
import type { NativeProduct, SeascapeCatalog, SeascapeFeature } from "../data/seascape";
vi.mock("../data/seascape", () => ({ loadSeascapeValues: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const left = { id: "extent", productId: "left", kind: "numeric" } as SeascapeFeature;
const right = { id: "share", productId: "right", kind: "numeric" } as SeascapeFeature;
const native = {} as NativeProduct;
const catalog = { products: {
  left: { axis: "Survey year", defaultSlice: "2024", slices: { "1989": native, "2024": native } },
  right: { axis: "Survey year", defaultSlice: "2024", slices: { "1991": native, "2024": native } },
} } as unknown as SeascapeCatalog;
it("loads only when open, aligns recorded periods, retains gaps and original slice values", async () => {
  vi.mocked(loadSeascapeValues).mockImplementation(async (_, field, slice) => new Map([["a", field === left ? slice === "1989" ? 0 : 4 : 10], ["b", null]]));
  const view = renderHook(({ enabled }) => useComparisonTimeline(catalog, left, right, enabled), { initialProps: { enabled: false } });
  expect(view.result.current).toBeUndefined();
  expect(loadSeascapeValues).not.toHaveBeenCalled();
  view.rerender({ enabled: true });
  await waitFor(() => expect(view.result.current?.loading).toBe(false));
  expect(view.result.current?.rows.map(row => row.key)).toEqual(["1989", "1991", "2024"]);
  expect(view.result.current?.rows[0]).toMatchObject({ left: { min: 0, count: 1, missing: 1 }, right: undefined });
  expect(view.result.current?.rows[1]).toMatchObject({ left: undefined, right: { median: 10 } });
  expect(loadSeascapeValues).toHaveBeenCalledTimes(4);
});
it("keeps failed slices unavailable and rejects differing time grains without resampling", async () => {
  vi.mocked(loadSeascapeValues).mockRejectedValue(new Error("Source checksum mismatch"));
  const view = renderHook(({ data }) => useComparisonTimeline(data, left, right, true), { initialProps: { data: catalog } });
  await waitFor(() => expect(view.result.current?.loading).toBe(false));
  expect(view.result.current?.rows[0].left).toBeUndefined();
  expect(view.result.current?.rows[0].error).toContain("checksum mismatch");
  const monthCatalog = { ...catalog, products: { ...catalog.products, right: { axis: "Month", defaultSlice: "2024-01", slices: { "2024-01": native } } } };
  view.rerender({ data: monthCatalog });
  expect(view.result.current?.error).toContain("different time grains");
});
it("ignores unfinished history reads after the active field changes", async () => {
  let finish!: (values: ReadonlyMap<string, number>) => void;
  vi.mocked(loadSeascapeValues).mockImplementation(async () => new Map([["a", 7]]));
  vi.mocked(loadSeascapeValues).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = renderHook(({ field }) => useComparisonTimeline(catalog, left, field, true), { initialProps: { field: right } });
  view.rerender({ field: { ...right, id: "changed" } });
  await waitFor(() => expect(view.result.current?.loading).toBe(false));
  expect(view.result.current?.rows[0].left?.median).toBe(7);
  await act(async () => finish(new Map([["a", 999]])));
  expect(view.result.current?.rows[0].left?.median).toBe(7);
});
