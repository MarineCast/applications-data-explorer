import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pair, sourceA, sourceB, targetB, viewshedFixture } from "../test/viewshedFixture";
import type { ViewshedMapProps } from "../data/viewshedMap";
import { createViewshedScale } from "../data/viewshedScale";

const fake = vi.hoisted(() => ({
  events: new Map<string, (event?: unknown) => void>(),
  data: new Map<string, ReturnType<typeof vi.fn>>(),
  controls: vi.fn(), options: vi.fn(), addLayer: vi.fn(), paint: vi.fn(), remove: vi.fn(),
  fitBounds: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), query: vi.fn(),
  loaded: true, fail: false, layers: true, cursor: { cursor: "" }, disableRotation: vi.fn(),
}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({ default: "/bundled-map-worker.js" }));
vi.mock("maplibre-gl", () => ({
  setWorkerUrl: vi.fn(),
  AttributionControl: class {},
  ScaleControl: class {},
  Map: class {
    constructor(options: unknown) {
      fake.options(options);
      if (fake.fail) throw new Error("WebGL unavailable");
    }
    on(name: string, listener: (event?: unknown) => void) { fake.events.set(name, listener); return this; }
    addControl = fake.controls;
    touchZoomRotate = { disableRotation: fake.disableRotation };
    addSource(id: string) { fake.data.set(id, vi.fn()); }
    getSource(id: string) { return { setData: fake.data.get(id) }; }
    getStyle() { return { layers: [{ id: "geographic-labels", type: "symbol" }] }; }
    getLayer() { return fake.layers; }
    isStyleLoaded() { return fake.loaded; }
    getZoom() { return 8; }
    getCanvas() { return { style: fake.cursor, focus: vi.fn() }; }
    project() { return { x: 100, y: 150 }; }
    resize() {}
    addLayer = fake.addLayer;
    setPaintProperty = fake.paint;
    fitBounds = fake.fitBounds;
    zoomIn = fake.zoomIn;
    zoomOut = fake.zoomOut;
    queryRenderedFeatures = fake.query;
    remove = fake.remove;
  },
}));
import ViewshedBasemap from "./ViewshedBasemap";
import ViewshedMap from "./ViewshedMap";

function props(): ViewshedMapProps {
  return { data: viewshedFixture(), scores: [pair()], source: sourceA, selection: null, coordinates: null, onCoordinates: vi.fn(), onBackground: vi.fn(),
    metric: "lower", mode: "source", onSource: vi.fn(), onTarget: vi.fn() };
}
beforeEach(() => {
  vi.clearAllMocks();
  fake.events.clear(); fake.data.clear(); fake.loaded = true; fake.fail = false; fake.layers = true;
  fake.query.mockReturnValue([]);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("viewshed geographic basemap", () => {
  it("uses the OrcaCast_Public basemap with direct wheel/drag/pinch gestures, labels and separate coastal roles", () => {
    const view = render(<ViewshedBasemap {...props()} onUnavailable={vi.fn()} />);
    expect(fake.options).toHaveBeenCalledWith(expect.objectContaining({
      style: "https://tiles.openfreemap.org/styles/bright", scrollZoom: true,
      dragPan: true, touchZoomRotate: true, cooperativeGestures: false,
    }));
    act(() => fake.events.get("load")?.());
    const targets = fake.data.get("viewshed-targets")!.mock.calls.at(-1)![0];
    const sources = fake.data.get("viewshed-sources")!.mock.calls.at(-1)![0];
    expect(targets.features[0].id).toBe(sources.features[0].id);
    expect(targets.features[0].properties.role).toBe("target");
    expect(sources.features[0].properties.role).toBe("source");
    expect(sources.features.every((f: { properties: { selected: boolean } }) => !f.properties.selected)).toBe(true);
    expect(fake.addLayer).toHaveBeenCalledTimes(5);
    expect(fake.controls).not.toHaveBeenCalled();
    expect(fake.addLayer.mock.calls.every(call => call[1] === "geographic-labels")).toBe(true);
    view.unmount();
    expect(fake.remove).toHaveBeenCalledOnce();
  });
  it("updates target colors and selections without replacing the camera, and uses fresh click callbacks", () => {
    const original = props();
    const stable = vi.fn();
    const view = render(<ViewshedBasemap {...original} onUnavailable={stable} />);
    act(() => fake.events.get("load")?.());
    const next = { ...original, scores: original.data.averages, metric: "average_viewability" as const,
      mode: "target" as const, onSource: vi.fn(), onTarget: vi.fn() };
    // Keep the unavailable callback stable, as in the real wrapper.
    view.rerender(<ViewshedBasemap {...next} onUnavailable={stable} />);
    act(() => fake.events.get("load")?.());
    const constructed = fake.options.mock.calls.length;
    view.rerender(<ViewshedBasemap {...next} selection={{ role: "target", id: targetB }} onUnavailable={stable} />);
    expect(fake.options).toHaveBeenCalledTimes(constructed);
    const targets = fake.data.get("viewshed-targets")!.mock.calls.at(-1)![0];
    expect(targets.features[0].properties.color).toBe("#a9b3bb");
    expect(targets.features[1].properties.selected).toBe(true);
    expect(fake.data.get("viewshed-observers")!.mock.calls.at(-1)![0].features).toHaveLength(0);
    fake.query.mockReturnValue([{ source: "viewshed-sources", properties: { id: sourceB } }]);
    act(() => fake.events.get("click")?.({ point: { x: 1, y: 1 } }));
    expect(next.onSource).toHaveBeenCalledWith(sourceB);
    expect(original.onSource).not.toHaveBeenCalled();
    fake.query.mockReturnValue([{ source: "viewshed-targets", properties: { id: sourceA } }]);
    act(() => fake.events.get("click")?.({ point: { x: 1, y: 1 } }));
    expect(next.onTarget).toHaveBeenCalledWith(sourceA);
    const colorScale = createViewshedScale(next.scores, "lower", "viridis", "custom", [0, .1]);
    view.rerender(<ViewshedBasemap {...next} metric="lower" colorScale={colorScale} onUnavailable={stable} />);
    expect(fake.options).toHaveBeenCalledTimes(constructed);
    expect(fake.data.get("viewshed-targets")!.mock.calls.at(-1)![0].features[0].properties.color).toBe(colorScale.colors[9]);
  });
  it("connects only zoom in/out controls to the geographic camera", async () => {
    const user = userEvent.setup();
    render(<ViewshedBasemap {...props()} onUnavailable={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.queryByRole("button", { name: "Reset viewshed map" })).not.toBeInTheDocument();
    expect(fake.zoomIn).toHaveBeenCalledOnce();
    expect(fake.zoomOut).toHaveBeenCalledOnce();
    expect(fake.fitBounds).toHaveBeenCalledOnce();
  });
  it("retains source/target scores in an explicitly labeled fallback and retries WebGL initialization", async () => {
    const user = userEvent.setup();
    fake.fail = true;
    render(<ViewshedMap {...props()} />);
    expect(await screen.findByText(/Basemap unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Inspect water target ${sourceA}` })).toBeInTheDocument();
    fake.fail = false;
    await user.click(screen.getByRole("button", { name: "Retry basemap" }));
    act(() => fake.events.get("load")?.());
    expect(screen.getByLabelText("Interactive viewshed basemap")).toBeInTheDocument();
    expect(screen.queryByText(/Basemap unavailable/)).not.toBeInTheDocument();
  });
  it("reports a style timeout and clears timers/listeners when removed", () => {
    vi.useFakeTimers(); fake.loaded = false;
    const unavailable = vi.fn();
    const view = render(<ViewshedBasemap {...props()} onUnavailable={unavailable} />);
    act(() => vi.advanceTimersByTime(15000));
    expect(unavailable).toHaveBeenCalledOnce();
    view.unmount();
    act(() => vi.advanceTimersByTime(30000));
    expect(unavailable).toHaveBeenCalledOnce();
  });
  it("right-clicks any map location for controlled coordinates without selecting a viewshed cell", () => {
    const inputs = props();
    const view = render(<ViewshedBasemap {...inputs} onUnavailable={vi.fn()} />);
    act(() => fake.events.get("load")?.());
    const preventDefault = vi.fn();
    act(() => fake.events.get("contextmenu")?.({ lngLat: { lat: 48.25, lng: -123.1 }, originalEvent: { preventDefault } }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(inputs.onCoordinates).toHaveBeenCalledWith(expect.objectContaining({ lat: 48.25, lon: -123.1 }));
    expect(inputs.onSource).not.toHaveBeenCalled();
    expect(inputs.onTarget).not.toHaveBeenCalled();
    inputs.onCoordinates = vi.fn();
    const stable = vi.fn();
    view.rerender(<ViewshedBasemap {...inputs} onUnavailable={stable} />);
    act(() => fake.events.get("move")?.());
    expect(inputs.onCoordinates).not.toHaveBeenCalled();
  });
  it("clears on empty map clicks, changes only the cursor on hover and updates overlay display without resetting the camera", () => {
    const inputs = props();
    const stable = vi.fn();
    const view = render(<ViewshedBasemap {...inputs} onUnavailable={stable} />);
    act(() => fake.events.get("load")?.());
    fake.query.mockReturnValue([{ source: "viewshed-targets", properties: { id: sourceA } }]);
    act(() => fake.events.get("mousemove")?.({ point: { x: 1, y: 1 } }));
    expect(fake.cursor.cursor).toBe("pointer");
    expect(inputs.onTarget).not.toHaveBeenCalled();
    expect(inputs.onCoordinates).not.toHaveBeenCalled();
    fake.query.mockReturnValue([]);
    act(() => fake.events.get("click")?.({ point: { x: 1, y: 1 } }));
    expect(inputs.onBackground).toHaveBeenCalledOnce();
    view.rerender(<ViewshedBasemap {...inputs} gridVisible={false} opacity={.4} selection={{ role: "source", id: sourceA }} onUnavailable={stable} />);
    expect(fake.options).toHaveBeenCalledOnce();
    expect(fake.fitBounds).toHaveBeenCalledOnce();
    expect(fake.paint).toHaveBeenCalledWith("viewshed-target-fill", "fill-opacity", .4);
    expect(fake.paint).toHaveBeenCalledWith("viewshed-target-outline", "line-width", ["case", ["get", "selected"], 3, 0]);
    expect(fake.data.get("viewshed-sources")!.mock.calls.at(-1)![0].features[0].properties.selected).toBe(true);
  });

  it("does not paint an unready replacement map when renderer state survives reinitialization", () => {
    const inputs = props();
    const view = render(<ViewshedBasemap {...inputs} onUnavailable={vi.fn()} />);
    act(() => fake.events.get("load")?.());
    fake.layers = false;
    fake.paint.mockClear();
    view.rerender(<ViewshedBasemap {...inputs} opacity={.4} onUnavailable={vi.fn()} />);
    expect(fake.options).toHaveBeenCalledTimes(2);
    expect(fake.paint).not.toHaveBeenCalled();
  });

});
