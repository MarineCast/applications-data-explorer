import { act, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cells } from "../data/demo";
const fake = vi.hoisted(() => ({
  instances: [] as Array<{
    camera: { center: [number, number]; zoom: number; bearing: number; pitch: number };
    events: Map<string, (event?: unknown) => void>;
    sourceData: ReturnType<typeof vi.fn>;
  }>,
  zoom: 6.7,
  sourceReady: true,
  events: new Map<string, (event?: unknown) => void>(),
  data: vi.fn(),
  addLayer: vi.fn(),
  setPaintProperty: vi.fn(),
  setLayoutProperty: vi.fn(),
  setFeatureState: vi.fn(),
  remove: vi.fn(),
  options: vi.fn(),
  jumpTo: vi.fn(),
  project: vi.fn(() => ({ x: 100, y: 150 })),
}));
vi.mock("maplibre-gl", () => ({
  Map: class {
    camera = { center: [-123.5, 48.45] as [number, number], zoom: fake.zoom, bearing: 0, pitch: 0 };
    events = new Map<string, (event?: unknown) => void>();
    sourceData = vi.fn();
    constructor(options: unknown) {
      fake.options(options);
      const { center, zoom, bearing = 0, pitch = 0 } = options as typeof this.camera;
      this.camera = { center, zoom, bearing, pitch };
      fake.instances.push(this);
    }
    addControl() {}
    on(name: string, ...args: unknown[]) {
      fake.events.set(name, args.at(-1) as () => void);
      this.events.set(name, args.at(-1) as () => void);
      return this;
    }
    isStyleLoaded() {
      return true;
    }
    addSource() {}
    addLayer = fake.addLayer;
    getStyle() {
      return { layers: [{ id: "labels", type: "symbol" }] };
    }
    getSource() {
      return fake.sourceReady ? { setData: (data: unknown) => { this.sourceData(data); fake.data(data); } } : undefined;
    }
    setPaintProperty = fake.setPaintProperty;
    setLayoutProperty = fake.setLayoutProperty;
    removeFeatureState() {}
    setFeatureState = fake.setFeatureState;
    getCanvas() {
      return { style: { cursor: "" } };
    }
    getBounds() {
      return {
        getWest: () => -124,
        getSouth: () => 47,
        getEast: () => -122,
        getNorth: () => 50,
      };
    }
    getZoom() {
      return this.camera.zoom;
    }
    getCenter() { return { lng: this.camera.center[0], lat: this.camera.center[1] }; }
    getBearing() { return this.camera.bearing; }
    getPitch() { return this.camera.pitch; }
    resize() {}
    remove = fake.remove;
    zoomIn() { this.camera.zoom++; this.events.get("move")?.(); this.events.get("moveend")?.(); }
    zoomOut() { this.camera.zoom--; this.events.get("move")?.(); this.events.get("moveend")?.(); }
    jumpTo = (camera: Partial<typeof this.camera>) => {
      fake.jumpTo(camera);
      this.camera = { ...this.camera, ...camera };
      this.events.get("move")?.();
      this.events.get("moveend")?.();
    };
    project = fake.project;
  },
  AttributionControl: class {},
}));
import MapTilerCanvas from "./MapTilerCanvas";
import MapCanvas from "./MapCanvas";
beforeEach(() => {
  vi.clearAllMocks();
  fake.events.clear();
  fake.instances.length = 0;
  fake.zoom = 6.7;
  fake.sourceReady = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("MapTiler renderer lifecycle", () => {
  it("adds local overlays, reacts to filters, selects cells, and releases the map", async () => {
    const onSelect = vi.fn(),
      onUnavailable = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <MapTilerCanvas
        apiKey="synthetic-test-key"
        feature="temperature"
        month={6}
        onSelect={onSelect}
        onUnavailable={onUnavailable}
      />,
    );
    act(() => fake.events.get("load")?.());
    expect(fake.addLayer).toHaveBeenCalledTimes(2);
    expect(fake.data.mock.calls.at(-1)?.[0].features).toHaveLength(
      cells.length,
    );
    view.rerender(
      <MapTilerCanvas
        apiKey="synthetic-test-key"
        feature="traffic"
        month={1}
        region="north"
        showGrid={false}
        opacity={0.4}
        selected={cells[0].id}
        onSelect={onSelect}
        onUnavailable={onUnavailable}
      />,
    );
    expect(fake.setLayoutProperty).toHaveBeenCalledWith(
      "demo-h3-fill",
      "visibility",
      "none",
    );
    expect(fake.setPaintProperty).toHaveBeenCalledWith(
      "demo-h3-fill",
      "fill-opacity",
      0.4,
    );
    expect(fake.setFeatureState).toHaveBeenCalledWith(
      { source: "demo-h3", id: cells[0].id },
      { selected: true },
    );
    const north = cells.find((c) => c.zone === "north")!;
    await user.selectOptions(
      screen.getByLabelText("Inspect H3 cell"),
      north.id,
    );
    expect(onSelect).toHaveBeenCalledWith(north);
    act(() => fake.events.get("error")?.({ error: { status: 403 } }));
    expect(onUnavailable).toHaveBeenCalled();
    view.unmount();
    expect(fake.remove).toHaveBeenCalled();
  });
  it("renders native R8 values at overview zoom, filters the viewport, and selects without zooming", async () => {
    const { latLngToCell } = await import("h3-js");
    const id = latLngToCell(48.45, -123.5, 8);
    const cell = {
      id,
      lat: 48.45,
      lon: -123.5,
      boundary: [],
      zone: "north" as const,
    };
    const layer = {
      id: "BATHYMETRY",
      name: "Depth",
      unit: "m",
      range: [0, 100] as [number, number],
      resolution: 8,
      cells: [cell, { ...cell, id: latLngToCell(51, -123.5, 8), lat: 51 }],
      values: new Map([[id, 74.27570093457943], [latLngToCell(51, -123.5, 8), 20]]),
      sourceLabel: "local",
    };
    const onSelect = vi.fn();
    const onUnavailable = vi.fn();
    const view = render(
      <MapTilerCanvas
        apiKey="test"
        feature="temperature"
        month={0}
        layer={layer}
        onUnavailable={onUnavailable}
        onSelect={onSelect}
      />,
    );
    act(() => fake.events.get("load")?.());
    expect(fake.data.mock.calls.at(-1)?.[0].features).toHaveLength(1);
    expect(screen.queryByText(/Zoom in to see native R8/)).not.toBeInTheDocument();
    expect(fake.data.mock.calls.at(-1)?.[0].features[0].properties.value).toBe(
      74.27570093457943,
    );
    const { createPropertyExpression, latest } = await import(
      "@maplibre/maplibre-gl-style-spec"
    );
    const width = fake.setPaintProperty.mock.calls.find(
      ([, property]) => property === "line-width",
    )?.[2];
    expect(createPropertyExpression(
      width,
      "paint.line-width",
      latest.paint_line["line-width"] as Parameters<typeof createPropertyExpression>[2],
    ).result).toBe("success");
    act(() =>
      fake.events.get("click")?.({ features: [{ properties: { id } }] }),
    );
    expect(onSelect).toHaveBeenCalledWith(cell);
    view.rerender(
      <MapTilerCanvas
        apiKey="test"
        feature="temperature"
        month={0}
        layer={layer}
        selected={id}
        popup={<section aria-label="R8 preview">Native depth</section>}
        onUnavailable={onUnavailable}
        onSelect={onSelect}
      />,
    );
    await screen.findByRole("region", { name: "R8 preview" });
    expect(fake.jumpTo).not.toHaveBeenCalled();
  });
  it("waits for a replacement source before updating overlays", () => {
    const onUnavailable = vi.fn();
    const view = render(
      <MapTilerCanvas
        apiKey="first"
        feature="temperature"
        month={0}
        onUnavailable={onUnavailable}
      />,
    );
    act(() => fake.events.get("load")?.());
    fake.sourceReady = false;
    view.rerender(
      <MapTilerCanvas
        apiKey="replacement"
        feature="temperature"
        month={0}
        onUnavailable={onUnavailable}
      />,
    );
    const calls = fake.data.mock.calls.length;
    view.rerender(
      <MapTilerCanvas
        apiKey="replacement"
        feature="temperature"
        month={1}
        onUnavailable={onUnavailable}
      />,
    );
    expect(fake.data).toHaveBeenCalledTimes(calls);
    fake.sourceReady = true;
    act(() => fake.events.get("load")?.());
    expect(fake.data.mock.calls.length).toBeGreaterThan(calls);
  });
  it("positions the selected card from the native cell center and removes move listeners", async () => {
    const layer = {
      id: "depth",
      name: "Depth",
      unit: "m",
      range: [0, 100] as [number, number],
      resolution: 6,
      cells: [cells[0]],
      values: new Map([[cells[0].id, 0]]),
      sourceLabel: "local",
    };
    const view = render(
      <MapTilerCanvas
        apiKey="test"
        feature="temperature"
        month={0}
        layer={layer}
        selected={cells[0].id}
        popup={
          <section aria-label="Test cell preview">Exact value 0 m</section>
        }
        onUnavailable={vi.fn()}
      />,
    );
    act(() => fake.events.get("load")?.());
    expect(
      await screen.findByRole("region", { name: "Test cell preview" }),
    ).toHaveTextContent("0 m");
    expect(fake.project).toHaveBeenCalledWith([cells[0].lon, cells[0].lat]);
    view.unmount();
    expect(fake.remove).toHaveBeenCalled();
  });
  it("links both geographic cameras bidirectionally and refreshes native geometry only at gesture end", async () => {
    const { createMapCameraLink } = await import("../data/mapCamera");
    const { latLngToCell } = await import("h3-js");
    const id = latLngToCell(48.45, -123.5, 8);
    const base = { id: "depth", name: "Depth", unit: "m", range: [0, 110] as [number, number],
      resolution: 8, sourceLabel: "native", cells: [{ id, lat: 48.45, lon: -123.5, boundary: [], zone: "north" as const }] };
    const link = createMapCameraLink();
    const unavailable = vi.fn();
    const view = render(<>
      <MapTilerCanvas apiKey="test" feature="temperature" month={0} cameraLink={link}
        layer={{ ...base, values: new Map([[id, 0]]) }} onUnavailable={unavailable} />
      <MapTilerCanvas apiKey="test" feature="temperature" month={0} cameraLink={link}
        layer={{ ...base, values: new Map([[id, 105]]) }} showControls={false} onUnavailable={unavailable} />
    </>);
    const [left, right] = fake.instances;
    act(() => { left.events.get("load")?.(); right.events.get("load")?.(); });
    expect(screen.getAllByRole("button", { name: "Zoom in" })).toHaveLength(1);
    expect(left.sourceData.mock.calls.at(-1)?.[0].features[0].properties.value).toBe(0);
    expect(right.sourceData.mock.calls.at(-1)?.[0].features[0].properties.value).toBe(105);
    expect(left.sourceData.mock.calls.at(-1)?.[0].features[0].geometry)
      .toEqual(right.sourceData.mock.calls.at(-1)?.[0].features[0].geometry);
    const leftUpdates = left.sourceData.mock.calls.length, rightUpdates = right.sourceData.mock.calls.length;
    left.camera = { center: [-123.8, 48.7], zoom: 8, bearing: 20, pitch: 35 };
    act(() => left.events.get("move")?.());
    expect(right.camera).toEqual(left.camera);
    expect(left.sourceData).toHaveBeenCalledTimes(leftUpdates);
    expect(right.sourceData).toHaveBeenCalledTimes(rightUpdates);
    act(() => left.events.get("moveend")?.());
    expect(left.sourceData).toHaveBeenCalledTimes(leftUpdates + 1);
    expect(right.sourceData).toHaveBeenCalledTimes(rightUpdates + 1);
    right.camera = { center: [-123.2, 48.2], zoom: 7.5, bearing: 5, pitch: 10 };
    const jumps = fake.jumpTo.mock.calls.length;
    act(() => right.events.get("move")?.());
    expect(left.camera).toEqual(right.camera);
    expect(fake.jumpTo).toHaveBeenCalledTimes(jumps + 1);
    await userEvent.setup().click(screen.getByRole("button", { name: "Zoom in" }));
    expect(left.camera.zoom).toBe(8.5);
    expect(right.camera).toEqual(left.camera);
    view.unmount();
    const calls = fake.jumpTo.mock.calls.length;
    const late = { setCamera: vi.fn(), finishMove: vi.fn() };
    link.connect(late);
    expect(late.setCamera).toHaveBeenCalledWith(left.camera);
    link.publish(late, { center: [-123.5, 48.45], zoom: 6, bearing: 0, pitch: 0 }, false);
    expect(fake.jumpTo).toHaveBeenCalledTimes(calls);
  });
  it("does not create a network map when the key is absent", () => {
    vi.stubEnv("VITE_MAPTILER_KEY", "");
    render(<MapCanvas basemap="maptiler" feature="temperature" month={6} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "MapTiler key not configured",
    );
    expect(fake.options).not.toHaveBeenCalled();
  });
});
