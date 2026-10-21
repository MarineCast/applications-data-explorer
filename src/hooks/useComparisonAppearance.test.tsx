import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useComparisonAppearance from "./useComparisonAppearance";

describe("shared comparison appearance", () => {
  it("links edits from either side, snapshots on unlink, and adopts left on relink", () => {
    const {result} = renderHook(useComparisonAppearance);
    act(() => result.current.change("right", "palette", "viridis"));
    expect(result.current.left.palette).toBe("viridis");
    act(() => result.current.link(false));
    act(() => result.current.change("right", "opacity", .3));
    expect(result.current.left.opacity).toBe(.8);
    expect(result.current.right.opacity).toBe(.3);
    act(() => result.current.link(true));
    expect(result.current.right.opacity).toBe(.8);
  });
  it("keeps river colors and history appearance independent and swaps complete sides", () => {
    const {result} = renderHook(useComparisonAppearance);
    act(() => result.current.link(false));
    const river = {...result.current.right.hydrology, colors: {fraser: "#abcdef"}, radius: 12};
    act(() => result.current.change("right", "hydrology", river));
    expect(result.current.left.hydrology.colors).toEqual({});
    expect(result.current.right.hydrology).toEqual(river);
    act(() => result.current.swap());
    expect(result.current.left.hydrology).toEqual(river);
    expect(result.current.right.hydrology.colors).toEqual({});
    act(() => result.current.link(true));
    expect(result.current.right.hydrology).toEqual(river);
  });
});
