import { hydrologyFixture } from "../test/hydrologyFixture";
import { hydrologyPointSource } from "../data/hydrologyOverlay";
import { setAppTheme } from '../theme/appTheme';
import { createCategoryScale, createColorScale } from "../data/colorScale";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cells } from "../test/demoFixture";
const fake = vi.hoisted(() => ({
  instances: [] as Array<{
    camera: { center: [number, number]; zoom: number; bearing: number; pitch: number };
    events: Map<string, (event?: unknown) => void>;
    sourceData: ReturnType<typeof vi.fn>;
    sourcePayloads: Map<string, unknown>;
  }>,
  workerUrl: undefined as string | undefined,
  zoom: 6.7,
  sourceReady: true,
  styleLoaded: true,
  events: new Map<string, (event?: unknown) => void>(),
  data: vi.fn(),
  addLayer: vi.fn(),
  moveLayer: vi.fn(),
  setPaintProperty: vi.fn(),
  setLayoutProperty: vi.fn(),
  setFeatureState: vi.fn(),
  remove: vi.fn(),
  options: vi.fn(),
  jumpTo: vi.fn(),
  query: vi.fn(),
  project: vi.fn(() => ({ x: 100, y: 150 })),
  updateImage: vi.fn(),
  addImage: vi.fn(),
  removeImage: vi.fn(),
}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({default: "/bundled-map-worker.js"}));
vi.mock("maplibre-gl", () => ({
  setWorkerUrl: (url: string) => { fake.workerUrl = url; },
  Map: class {
    camera = { center: [-123.5, 48.45] as [number, number], zoom: fake.zoom, bearing: 0, pitch: 0 };
    events = new Map<string, (event?: unknown) => void>();
    sourceData = vi.fn();
    sourcePayloads = new Map<string, unknown>();
    constructor(options: unknown) {
      fake.options(options);
      const { center, zoom, bearing = 0, pitch = 0 } = options as typeof this.camera;
      this.camera = { center, zoom, bearing, pitch };
      fake.instances.push(this);
    }
    addControl() {}
    addImage = fake.addImage;
    removeImage = fake.removeImage;
    on(name: string, ...args: unknown[]) {
      fake.events.set(name, args.at(-1) as () => void);
      this.events.set(name, args.at(-1) as () => void);
      return this;
    }
    isStyleLoaded() {
      return fake.styleLoaded;
    }
    addSource() {}
    addLayer = fake.addLayer;
    moveLayer = fake.moveLayer;
    getStyle() {
      return { layers: [{ id: "labels", type: "symbol" }] };
    }
    getSource(id: string) {
      return fake.sourceReady ? { updateImage: fake.updateImage, setData: (data: unknown) => { this.sourcePayloads.set(id, data); this.sourceData(data); fake.data(data); } } : undefined;
    }
    queryRenderedFeatures = fake.query;
    setPaintProperty = fake.setPaintProperty;
    setLayoutProperty = fake.setLayoutProperty;
    removeFeatureState() {}
    setFeatureState = fake.setFeatureState;
    getCanvas() {
      return { style: { cursor: "" }, focus: vi.fn() };
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
import { pair, sourceA, sourceB, targetB, viewshedFixture } from "../test/viewshedFixture";
import { createViewshedScale } from "../data/viewshedScale";
import type { SurfaceRequest, SurfaceResult } from "../data/smoothSurface";
import type { ViewshedMapProps } from "../data/viewshedMap";
import MapTilerCanvas from "./MapTilerCanvas";
import MapCanvas from "./MapCanvas";
import type { MapLayer } from "../data/map";
beforeEach(() => {
  vi.clearAllMocks();
  fake.events.clear();
  fake.instances.length = 0;
  fake.zoom = 6.7;
  fake.sourceReady = true;
  fake.styleLoaded = true;
  fake.query.mockReturnValue([]);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("MapTiler renderer lifecycle", () => {
  it("reports geographic style timeout and authorization failure, and cancels its timer on removal", () => {
    vi.useFakeTimers(); fake.styleLoaded = false;
    const onUnavailable = vi.fn();
    const mounted = render(<MapTilerCanvas apiKey="test" onUnavailable={onUnavailable} />);
    act(() => vi.advanceTimersByTime(15000));
    expect(onUnavailable).toHaveBeenCalledOnce();
    act(() => fake.events.get("error")?.({ error: { status: 403 } }));
    expect(onUnavailable).toHaveBeenCalledTimes(2);
    mounted.unmount();
    act(() => vi.advanceTimersByTime(30000));
    expect(onUnavailable).toHaveBeenCalledTimes(2);
    expect(fake.remove).toHaveBeenCalledOnce();
  });
  it("uses fresh Viewshed callbacks for distinct roles and controlled coordinates on the existing map", () => {
    const data = viewshedFixture(), onUnavailable = vi.fn();
    const original: ViewshedMapProps = { data, scores: data.averages, source: sourceA, mode: "target", metric: "lower", allTargets: true,
      selection: null, coordinates: null, onCoordinates: vi.fn(), onSource: vi.fn(), onTarget: vi.fn(), onBackground: vi.fn() };
    const mounted = render(<MapTilerCanvas apiKey="test" viewshed={original} onUnavailable={onUnavailable} />);
    const instance = fake.instances[0]; act(() => instance.events.get("load")?.());
    const next = { ...original, onSource: vi.fn(), onTarget: vi.fn(), onCoordinates: vi.fn(), onBackground: vi.fn() };
    mounted.rerender(<MapTilerCanvas apiKey="test" viewshed={next} onUnavailable={onUnavailable} />);
    for (const source of ["viewshed-sources", "viewshed-targets"]) {
      fake.query.mockReturnValue([{ source, properties: { id: sourceA } }]);
      act(() => instance.events.get("click")?.({ point: { x: 1, y: 1 } }));
    }
    expect(next.onSource).toHaveBeenCalledWith(sourceA); expect(next.onTarget).toHaveBeenCalledWith(sourceA);
    expect(original.onSource).not.toHaveBeenCalled(); expect(original.onTarget).not.toHaveBeenCalled();
    const preventDefault = vi.fn();
    act(() => instance.events.get("contextmenu")?.({ originalEvent: { preventDefault }, lngLat: { lat: 48.25, lng: -123.1 } }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(next.onCoordinates).toHaveBeenCalledWith(expect.objectContaining({ lat: 48.25, lon: -123.1 }));
    expect(original.onCoordinates).not.toHaveBeenCalled();
    expect(fake.options).toHaveBeenCalledOnce(); expect(fake.jumpTo).not.toHaveBeenCalled();
  });
  it("configures the emitted worker URL for the geographic map", () => {
    expect(fake.workerUrl).toBe("/bundled-map-worker.js");
    render(<MapTilerCanvas apiKey="test" onUnavailable={vi.fn()} />);
    expect(fake.options).toHaveBeenCalledOnce();
  });

  it("smooths Viewshed water and reverse land weights on the existing map while retaining geometry picking and native fallback", () => {
    const jobs: { request?: SurfaceRequest; onmessage?: (event: { data: SurfaceResult }) => void; terminate: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal("Worker", class {
      request?: SurfaceRequest;
      onmessage?: (event: { data: SurfaceResult }) => void;
      terminate = vi.fn();
      constructor() { jobs.push(this); }
      postMessage(request: SurfaceRequest) { this.request = request; }
    });
    vi.stubGlobal("ImageData", class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
    const data = viewshedFixture(), onUnavailable = vi.fn();
    const view: ViewshedMapProps = { data, scores: data.averages, source: sourceA, mode: "target", metric: "lower", selection: null,
      coordinates: null, onCoordinates: vi.fn(), onBackground: vi.fn(), onSource: vi.fn(), onTarget: vi.fn(),
      opacity: .4, colorScale: createViewshedScale(data.averages, "lower", "balance", "auto", [0, 1]),
      smoothing: { enabled: true, radius: .75, contours: true } };
    const map = (view: ViewshedMapProps) => <MapTilerCanvas apiKey="test" viewshed={view} onUnavailable={onUnavailable} />;
    const mounted = render(map(view)), instance = fake.instances[0];
    act(() => instance.events.get("load")?.());
    expect(jobs[0].request?.ids).toEqual([sourceA, targetB]);
    expect(jobs[0].request?.geometries).toEqual(data.targets.map(cell => cell.geometry));
    const result: SurfaceResult = { width: 2, height: 2, pixels: new Uint8ClampedArray(16), coordinates: [[0,1],[1,1],[1,0],[0,0]], elapsedMs: 1 };
    act(() => jobs[0].onmessage?.({ data: result }));
    expect(fake.updateImage).toHaveBeenCalledOnce();
    expect(fake.setLayoutProperty).toHaveBeenCalledWith("smooth-surface", "visibility", "visible");
    expect(fake.setPaintProperty).toHaveBeenCalledWith("viewshed-target-fill", "fill-opacity", ["case", ["get", "paired"], 0, .4]);
    expect(fake.setPaintProperty).toHaveBeenCalledWith("smooth-surface", "raster-opacity", .4);
    const rows = [pair(sourceA, targetB), pair(sourceB, targetB, .8, .8)];
    const reverse = { ...view, scores: rows, mode: "targetSources" as const, selection: { role: "target" as const, id: targetB } };
    mounted.rerender(map(reverse));
    expect(jobs[0].terminate).toHaveBeenCalled();
    expect(jobs[1].request?.ids).toEqual([sourceA, sourceB]);
    expect(jobs[1].request?.geometries).toEqual(data.sources.map(cell => cell.geometry));
    expect([...jobs[1].request!.values]).toEqual([.4, .8]);
    expect(fake.setLayoutProperty).toHaveBeenCalledWith("smooth-surface", "visibility", "none");
    act(() => jobs[1].onmessage?.({ data: result }));
    expect(fake.setPaintProperty).toHaveBeenCalledWith("viewshed-source-fill", "fill-opacity", ["case", ["get", "paired"], 0, .14]);
    expect(fake.setPaintProperty).toHaveBeenCalledWith("viewshed-target-outline", "line-width", ["case", ["get", "selected"], 3, 0]);
    fake.query.mockReturnValue([{ source: "viewshed-sources", properties: { id: sourceB } }]);
    act(() => instance.events.get("click")?.({ point: { x: 1, y: 1 } }));
    expect(view.onSource).toHaveBeenCalledWith(sourceB);
    mounted.rerender(map({ ...reverse, smoothing: { ...view.smoothing!, enabled: false } }));
    expect(jobs).toHaveLength(2);
    expect(fake.setPaintProperty).toHaveBeenCalledWith("viewshed-source-fill", "fill-opacity", ["case", ["get", "paired"], .4, .14]);
    expect(fake.options).toHaveBeenCalledOnce();
    expect(data.averages[0].lower).toBe(.2);
    mounted.unmount();
  });
  it("applies and removes Viewshed on one existing map without changing its style or camera", () => {
    const onUnavailable = vi.fn(), onSelect = vi.fn();
    const view: ViewshedMapProps = { data: viewshedFixture(), scores: [pair()], source: sourceA,
      mode: "source", metric: "lower", allTargets: true, selection: { role: "source", id: sourceA },
      coordinates: null, onCoordinates: vi.fn(), onBackground: vi.fn(), onSource: vi.fn(), onTarget: vi.fn() };
    const renderMap = (overlay?: ViewshedMapProps) => <MapTilerCanvas apiKey="test" onUnavailable={onUnavailable} onSelect={onSelect} viewshed={overlay} />;
    const mounted = render(renderMap());
    const instance = fake.instances[0];
    act(() => instance.events.get("load")?.());
    const camera = { center: [-123.15, 48.8] as [number, number], zoom: 9.25, bearing: 17, pitch: 35 };
    instance.camera = camera;
    const canvas = screen.getByLabelText("MapTiler basemap awaiting native layer values");
    const resourceCount = fake.addLayer.mock.calls.length;
    mounted.rerender(renderMap(view));
    expect(screen.getByLabelText("MapTiler basemap with Viewshed weights")).toBe(canvas);
    expect(fake.options).toHaveBeenCalledTimes(1);
    expect(fake.options.mock.calls[0][0].style).toContain("api.maptiler.com");
    expect(instance.camera).toEqual(camera);
    expect(fake.jumpTo).not.toHaveBeenCalled();
    expect(instance.sourcePayloads.get("viewshed-sources")).toMatchObject({ features: expect.arrayContaining([
      expect.objectContaining({ id: sourceA, properties: expect.objectContaining({ role: "source" }) }),
    ]) });
    fake.query.mockReturnValue([{ source: "viewshed-targets", properties: { id: targetB } }]);
    act(() => instance.events.get("click")?.({ point: { x: 5, y: 5 } }));
    expect(view.onTarget).toHaveBeenCalledWith(targetB);
    expect(onSelect).not.toHaveBeenCalled();
    fake.query.mockReturnValue([{ source: "viewshed-sources", properties: { id: sourceA } }]);
    act(() => instance.events.get("click")?.({ point: { x: 5, y: 5 } }));
    expect(view.onSource).toHaveBeenCalledWith(sourceA);
    fake.query.mockReturnValue([]);
    act(() => instance.events.get("click")?.({ point: { x: 5, y: 5 } }));
    expect(view.onBackground).toHaveBeenCalled();
    mounted.rerender(renderMap());
    expect(fake.setLayoutProperty).toHaveBeenCalledWith("viewshed-target-fill", "visibility", "none");
    expect(instance.camera).toEqual(camera);
    expect(fake.options).toHaveBeenCalledTimes(1);
    expect(fake.addLayer).toHaveBeenCalledTimes(resourceCount);
    expect(fake.remove).not.toHaveBeenCalled();
    mounted.unmount();
    expect(fake.remove).toHaveBeenCalledTimes(1);
  });
  it("keeps one basemap and camera while native layers load, clear, and change resolution", async () => {
    const { latLngToCell } = await import("h3-js");
    const onUnavailable = vi.fn(), onSelect = vi.fn();
    const renderLayer = (layer?: MapLayer) => <MapTilerCanvas
      apiKey="test"
      layer={layer} onUnavailable={onUnavailable} onSelect={onSelect}
    />;
    const view = render(renderLayer());
    const instance = fake.instances[0];
    act(() => instance.events.get("load")?.());
    expect(instance.sourceData.mock.calls.at(-1)?.[0].features).toEqual([]);
    const installedLayerCount = fake.addLayer.mock.calls.length;
    expect(screen.queryByLabelText("Inspect H3 cell")).not.toBeInTheDocument();
    expect(screen.queryByText(/Synthetic/)).not.toBeInTheDocument();
    const camera = { center: [-123.15, 48.8] as [number, number], zoom: 9.25, bearing: 17, pitch: 35 };
    act(() => { instance.camera = camera; instance.events.get("moveend")?.(); });
    for (const resolution of [6, 8, 5]) {
      const id = latLngToCell(48.45, -123.5, resolution);
      const missingId = latLngToCell(48.8, -123.5, resolution);
      const cell = { id, lat: 48.45, lon: -123.5, boundary: [], zone: "north" as const };
      const layer: MapLayer = {
        id: `source-r${resolution}`, name: "Native values", unit: "m", resolution,
        range: [0, 100], cells: [cell, { ...cell, id: missingId, lat: 48.8 }],
        values: new Map([[id, resolution], [missingId, null]]), sourceLabel: "local",
      };
      view.rerender(renderLayer(layer));
      const features = instance.sourceData.mock.calls.at(-1)?.[0].features;
      expect(features.map((f: { id: string; properties: { value: number | null } }) => [f.id, f.properties.value]))
        .toEqual([[id, resolution], [missingId, null]]);
      onSelect.mockClear();
      act(() => instance.events.get("click")?.({ lngLat: { lat: cell.lat, lng: cell.lon } }));
      expect(onSelect).toHaveBeenCalledExactlyOnceWith(cell);
      view.rerender(renderLayer());
      expect(instance.sourceData.mock.calls.at(-1)?.[0].features).toEqual([]);
      onSelect.mockClear();
      act(() => instance.events.get("click")?.({ lngLat: { lat: cell.lat, lng: cell.lon } }));
      expect(onSelect).not.toHaveBeenCalled();
      expect(instance.camera).toEqual(camera);
      expect(fake.options).toHaveBeenCalledTimes(1);
      expect(fake.addLayer).toHaveBeenCalledTimes(installedLayerCount);
      expect(fake.remove).not.toHaveBeenCalled();
    }
    view.unmount();
    expect(fake.remove).toHaveBeenCalledTimes(1);
  });
  it("updates exact native values and display settings, selects geographically and releases the map", async () => {
    const { latLngToCell } = await import("h3-js");
    const cells = [48.45,48.8].map(lat=>({id:latLngToCell(lat,-123.5,6),lat,lon:-123.5,boundary:[],zone:"north" as const}));
    const layer: MapLayer = {id:"depth",name:"Depth",unit:"m",range:[0,10],resolution:6,cells,values:new Map([[cells[0].id,0],[cells[1].id,null]]),sourceLabel:"native fixture"};
    const onSelect = vi.fn(), onUnavailable = vi.fn();
    const mounted = render(<MapTilerCanvas apiKey="test" layer={layer} onSelect={onSelect} onUnavailable={onUnavailable} />);
    const instance = fake.instances[0]; act(() => instance.events.get("load")?.());
    expect(instance.sourcePayloads.get("native-h3")).toMatchObject({features:[{properties:{value:0}},{properties:{value:null}}]});
    expect(fake.moveLayer).toHaveBeenCalledWith("labels");
    mounted.rerender(<MapTilerCanvas apiKey="test" layer={layer} showGrid={false} opacity={.4} selected={cells[0].id} onSelect={onSelect} onUnavailable={onUnavailable} />);
    expect(fake.setLayoutProperty).toHaveBeenCalledWith("native-h3-fill", "visibility", "none");
    expect(fake.setPaintProperty).toHaveBeenCalledWith("native-h3-fill", "fill-opacity", .4);
    expect(fake.setFeatureState).toHaveBeenCalledWith({source:"native-h3",id:cells[0].id},{selected:true});
    expect(screen.queryByLabelText("Inspect H3 cell")).not.toBeInTheDocument();
    act(() => instance.events.get("click")?.({lngLat:{lat:48.45,lng:-123.5}}));
    expect(onSelect).toHaveBeenCalledWith(cells[0]);
    expect(fake.options).toHaveBeenCalledOnce();
    expect(layer.values.get(cells[0].id)).toBe(0); expect(layer.values.get(cells[1].id)).toBeNull();
    mounted.unmount(); expect(fake.remove).toHaveBeenCalledOnce();
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
      fake.events.get("click")?.({ lngLat: { lat: 48.45, lng: -123.5 } }),
    );
    expect(onSelect).toHaveBeenCalledWith(cell);
    view.rerender(
      <MapTilerCanvas
        apiKey="test"
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
    const data = viewshedFixture();
    const overlay: ViewshedMapProps = { data, scores: data.averages, source: sourceA, mode: "target", metric: "lower", selection: null,
      coordinates: null, onCoordinates: vi.fn(), onBackground: vi.fn(), onSource: vi.fn(), onTarget: vi.fn() };
    const view = render(
      <MapTilerCanvas
        apiKey="first"
        onUnavailable={onUnavailable}
      />,
    );
    act(() => fake.events.get("load")?.());
    fake.sourceReady = false;
    view.rerender(
      <MapTilerCanvas
        apiKey="replacement"
        onUnavailable={onUnavailable}
      />,
    );
    const calls = fake.data.mock.calls.length;
    view.rerender(
      <MapTilerCanvas
        apiKey="replacement"
        onUnavailable={onUnavailable}
        viewshed={overlay}
      />,
    );
    expect(fake.data).toHaveBeenCalledTimes(calls);
    // A stale ready counter must not write Viewshed paint/layout to a new, unloaded style.
    const writes = fake.setLayoutProperty.mock.calls.length;
    view.rerender(<MapTilerCanvas apiKey="replacement"
      onUnavailable={onUnavailable} viewshed={{ ...overlay, metric: "upper" }} />);
    expect(fake.setLayoutProperty).toHaveBeenCalledTimes(writes);
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
      <MapTilerCanvas apiKey="test" cameraLink={link}
        layer={{ ...base, values: new Map([[id, 0]]) }} onUnavailable={unavailable} />
      <MapTilerCanvas apiKey="test" cameraLink={link}
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
    render(<MapCanvas />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Basemap key not configured",
    );
    expect(fake.options).not.toHaveBeenCalled();
  });
});


it("inspects native cells at the keyboard crosshair and keeps Viewshed selection on the map", async () => {
  const { latLngToCell } = await import("h3-js");
  const id = latLngToCell(48.45, -123.5, 6);
  const cell = {id, lat:48.45, lon:-123.5, boundary:[], zone:"north" as const};
  const select = vi.fn();
  const onSource = vi.fn(), onTarget = vi.fn(), onBackground = vi.fn();
  const props = {apiKey:"test",onUnavailable:vi.fn()};
  const layer = {id:"depth",name:"Depth",unit:"m",range:[0,10] as [number,number],resolution:6,cells:[cell],values:new Map([[id,0]]),sourceLabel:"native"};
  const view = render(<MapTilerCanvas {...props} layer={layer} onSelect={select} />);
  act(() => fake.events.get("load")?.());
  fireEvent.keyDown(view.container.querySelector(".maplibre-container")!, {key:"Enter"});
  expect(select).toHaveBeenCalledExactlyOnceWith(cell);
  const data = viewshedFixture();
  const viewshed: ViewshedMapProps = {data, scores:[], mode:"target",metric:"lower",allTargets:true,source:sourceA,selection:null,coordinates:null,gridVisible:true,opacity:.8,
    colorScale:createViewshedScale([],"lower","ocean","fixed",[0,1]),onSource,onTarget,onBackground,onCoordinates:vi.fn()};
  view.rerender(<MapTilerCanvas {...props} viewshed={viewshed} />);
  fake.query.mockReturnValue([{source:"viewshed-sources",properties:{id:sourceA}}]);
  fireEvent.keyDown(view.container.querySelector(".maplibre-container")!, {key:"Enter"});
  expect(onSource).toHaveBeenCalledWith(sourceA);
  fake.query.mockReturnValue([{source:"viewshed-targets",properties:{id:sourceA}}]);
  fireEvent.keyDown(view.container.querySelector(".maplibre-container")!, {key:"Enter"});
  expect(onTarget).toHaveBeenCalledWith(sourceA);
  fireEvent.keyDown(view.container.querySelector(".maplibre-container")!, {key:"Escape"});
  expect(onBackground).toHaveBeenCalledOnce();
  fake.query.mockReturnValue([]);
  fireEvent.keyDown(view.container.querySelector(".maplibre-container")!, {key:"Enter"});
  expect(onBackground).toHaveBeenCalledTimes(2);
});

it("registers bounded overlap images and clears them when returning to numeric data on the same map", () => {
  const cell = cells.find(c => c.lon > -124 && c.lon < -122 && c.lat > 47 && c.lat < 50)!;
  const layer = { id:"areas",name:"Areas",unit:"membership",range:[0,2] as [number,number],resolution:6,cells:[cell],values:new Map([[cell.id,2]]),sourceLabel:"test",categories:["A","B","Multiple"],categoryKeys:["feature:a","feature:b","multiple"],categoryMemberships:new Map([[cell.id,[0,1]]]) };
  const scale=createCategoryScale(layer.values,layer.categories,"ocean");
  const select=vi.fn();
  const props={onSelect:select,apiKey:"test",onUnavailable:vi.fn()};
  const view=render(<MapTilerCanvas {...props} layer={layer} colorScale={scale} />);
  act(() => fake.instances[0].events.get("load")?.());
  expect(fake.addImage).toHaveBeenCalledOnce();
  const payload=fake.instances[0].sourcePayloads.get("native-h3") as { features:{properties:{membershipPattern:string}}[] };
  expect(payload.features[0].properties.membershipPattern).toMatch(/^membership-set-/);
  // The striped fill shares geographic picking with the native H3 cell; no
  // dominant membership or arbitrary rendered source feature becomes its ID.
  fake.query.mockReturnValue([{properties:{id:"wrong-stripe-id"}}]);
  act(()=>fake.instances[0].events.get("click")?.({lngLat:{lat:cell.lat,lng:cell.lon}}));
  expect(select).toHaveBeenCalledWith(cell);
  view.rerender(<MapTilerCanvas {...props} layer={{...layer,categories:undefined,categoryMemberships:undefined}} colorScale={createColorScale(layer.values,"ocean","equal")} />);
  expect(fake.removeImage).toHaveBeenCalledOnce();
  expect(fake.options).toHaveBeenCalledOnce();
});

it("updates theme paint on the existing provider map without rebuilding its camera or overlays", () => {
  act(()=>setAppTheme('light'));
  const view=render(<MapTilerCanvas apiKey="test" onUnavailable={vi.fn()} />);
  act(()=>fake.instances[0].events.get('load')?.());
  const camera={...fake.instances[0].camera};
  const layerCount=fake.addLayer.mock.calls.length;
  act(()=>setAppTheme('dark'));
  expect(fake.setPaintProperty).toHaveBeenCalledWith('labels','text-color','#B8CDD4');
  expect(fake.instances[0].camera).toEqual(camera);
  expect(fake.options).toHaveBeenCalledOnce();
  expect(fake.addLayer).toHaveBeenCalledTimes(layerCount);
  act(()=>setAppTheme('light'));
  expect(fake.setPaintProperty).toHaveBeenCalledWith('labels','text-color','#456273');
  view.unmount();
});

it("renders Hydrology as exact river bubbles, picks river identity, and clears nodes on domain change", () => {
 const data=hydrologyFixture(), onSelect=vi.fn(), onUnavailable=vi.fn();
 const nodes={data,metric:"discharge_mean" as const,day:"2026-09-25",onSelect};
 const mounted=render(<MapTilerCanvas apiKey="test" hydrologyPoints={nodes} showGrid={false} onUnavailable={onUnavailable}/>);
 const instance=fake.instances[0]; act(()=>instance.events.get("load")?.());
 expect(instance.sourcePayloads.get("native-h3")).toEqual({type:"FeatureCollection",features:[]});
 expect(instance.sourcePayloads.get(hydrologyPointSource)).toMatchObject({features:[{properties:{river:"fraser",value:0,missing:false}},{properties:{river:"cowichan",value:0,missing:false}}]});
 fake.query.mockReturnValue([{properties:{river:"fraser"}}]);
 act(()=>instance.events.get("click")?.({point:{x:1,y:2}})); expect(onSelect).toHaveBeenCalledWith("fraser");
 mounted.rerender(<MapTilerCanvas apiKey="test" onUnavailable={onUnavailable}/>);
 expect(fake.instances).toHaveLength(1);
 expect(instance.sourcePayloads.get(hydrologyPointSource)).toEqual({type:"FeatureCollection",features:[]});
});


it("opens coordinate copying on a native map without a Viewshed layer", async () => {
  const user = userEvent.setup();
  render(<MapTilerCanvas apiKey="test" onUnavailable={vi.fn()} />);
  const preventDefault = vi.fn();
  act(() => fake.events.get("contextmenu")?.({ originalEvent: { preventDefault }, lngLat: { lat: 48.5, lng: -123.25 } }));
  expect(preventDefault).toHaveBeenCalled();
  expect(screen.getByRole("textbox", { name: "Latitude, longitude" })).toHaveValue("48.500000, -123.250000");
  await user.click(screen.getByRole("button", { name: "Copy coordinates" }));
  expect(await navigator.clipboard.readText()).toBe("48.500000, -123.250000");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "Map coordinates" })).not.toBeInTheDocument();
});
