import { act, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cells } from "../data/demo";
const fake = vi.hoisted(() => ({
  events: new Map<string, (event?: unknown) => void>(),
  data: vi.fn(),
  addLayer: vi.fn(),
  setPaintProperty: vi.fn(),
  setLayoutProperty: vi.fn(),
  setFeatureState: vi.fn(),
  remove: vi.fn(),
  options: vi.fn(),
}));
vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(options: unknown) {
      fake.options(options);
    }
    addControl() {}
    on(name: string, ...args: unknown[]) {
      fake.events.set(name, args.at(-1) as () => void);
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
      return { setData: fake.data };
    }
    setPaintProperty = fake.setPaintProperty;
    setLayoutProperty = fake.setLayoutProperty;
    removeFeatureState() {}
    setFeatureState = fake.setFeatureState;
    getCanvas() {
      return { style: { cursor: "" } };
    }
    resize() {}
    remove = fake.remove;
    zoomIn() {}
    zoomOut() {}
    jumpTo() {}
  },
  AttributionControl: class {},
}));
import MapTilerCanvas from "./MapTilerCanvas";
import MapCanvas from "./MapCanvas";
beforeEach(() => {
  vi.clearAllMocks();
  fake.events.clear();
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
  it("does not create a network map when the key is absent", () => {
    vi.stubEnv("VITE_MAPTILER_KEY", "");
    render(<MapCanvas basemap="maptiler" feature="temperature" month={6} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "MapTiler key not configured",
    );
    expect(fake.options).not.toHaveBeenCalled();
  });
});
