import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import useDataRevision from "./useDataRevision";

class Source extends EventTarget {
  static instances: Source[] = [];
  close = vi.fn();
  constructor(public url: string) { super(); Source.instances.push(this); }
  update(data: unknown) { this.dispatchEvent(new MessageEvent("sources", { data: JSON.stringify(data) })); }
}
afterEach(() => { vi.unstubAllGlobals(); Source.instances = []; });
it("refreshes when a watched folder changes, reconnects, or the window regains focus", () => {
  vi.stubGlobal("EventSource", Source);
  const { result, unmount } = renderHook(() => useDataRevision(["human"]));
  const source = Source.instances[0];
  expect(source.url).toBe("/api/local-data/events");
  act(() => source.update({human:"a", orca:"one"}));
  expect(result.current).toBe(1);
  act(() => source.update({human:"a", orca:"two"}));
  expect(result.current).toBe(1);
  act(() => source.update({human:"b", orca:"two"}));
  expect(result.current).toBe(2);
  act(() => window.dispatchEvent(new Event("focus")));
  expect(result.current).toBe(3);
  unmount();
  expect(source.close).toHaveBeenCalledOnce();
});
it("ignores malformed transport data without losing its current version", () => {
  vi.stubGlobal("EventSource", Source);
  const { result } = renderHook(() => useDataRevision(["human"]));
  act(() => Source.instances[0].dispatchEvent(new MessageEvent("sources", {data:"{"})));
  expect(result.current).toBe(0);
  act(() => Source.instances[0].update({human:"new"}));
  expect(result.current).toBe(1);
});
