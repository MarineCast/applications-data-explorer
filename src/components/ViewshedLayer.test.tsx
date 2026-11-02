import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adapter from "../data/viewshed";
import { viewshedOverlays } from "../data/viewshedMap";
import type { ViewshedMapProps } from "../data/viewshedMap";
import { pair, sourceA, sourceB, targetB, viewshedFixture, weightedViewshedFixture } from "../test/viewshedFixture";
import ViewshedLayer from "./ViewshedLayer";
import App from "../App";
vi.mock("../data/viewshed", async importOriginal => ({ ...await importOriginal<typeof adapter>(), loadViewshed: vi.fn(), loadSource: vi.fn(), loadTargetSources: vi.fn() }));
vi.mock("./MapCanvas", async () => ({ default: (await import("../test/MapInteractionDriver")).default }));
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
  vi.mocked(adapter.loadViewshed).mockResolvedValue(viewshedFixture());
  vi.mocked(adapter.loadSource).mockImplementation(async (_, source) => source === sourceA ? [pair()] : [pair(sourceB, targetB, .8, .8)]);
  vi.mocked(adapter.loadTargetSources).mockResolvedValue([pair()]);
});

function host() {
  const onMapChange = vi.fn<(view: ViewshedMapProps | undefined) => void>();
  const integration = { available: ["seascape"], names: {}, onSelect: vi.fn(), onMapChange };
  const mounted = render(<ViewshedLayer integration={integration} />);
  const current = () => onMapChange.mock.calls.at(-1)![0]!;
  return { ...mounted, current, onMapChange, integration };
}
async function ready(hosted?: ReturnType<typeof host>) {
  await screen.findByRole("button", { name: "Score display" });
  if (hosted) await waitFor(() => expect(hosted.onMapChange.mock.calls.at(-1)?.[0]).toBeDefined());
}
async function settings(user: ReturnType<typeof userEvent.setup>) {
  const active = screen.getByRole("button", { name: "Viewshed layers" });
  if (active.getAttribute("aria-expanded") !== "true") await user.click(active);
}
async function score(user: ReturnType<typeof userEvent.setup>, metric: adapter.ViewMetric) {
  await settings(user);
  const names: Record<adapter.ViewMetric, string> = { lower: "Lower estimate", upper: "Upper estimate", average_viewability: "Complete score",
    input_unknown_fraction: "Input uncertainty", above_ground_lower: "Above-ground weight (lower)", weight_above_ground: "Above-ground weight (complete)",
    weight_distance: "Distance weight", weight_terrain: "Terrain weight" };
  await user.click(screen.getByRole("button", { name: "Score display" }));
  await user.click(screen.getByRole("button", { name: `Select ${names[metric]}` }));
}
async function advanced(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Color options" }));
  await user.click(screen.getByText("Advanced", { exact: true }));
}

describe("Viewshed on the production Features host", () => {
  it.each([1, 2])("starts version %s with the production metric, no selection and compact pickers", async version => {
    const data = version === 2 ? weightedViewshedFixture() : viewshedFixture();
    vi.mocked(adapter.loadViewshed).mockResolvedValue(data);
    const h = host(); await ready(h);
    expect(h.current()).toMatchObject({ mode: "target", selection: null, allTargets: true, metric: version === 2 ? "weight_terrain" : "lower" });
    expect(within(screen.getByRole("region", { name: "Map layers" })).getAllByRole("button").map(b => b.getAttribute("aria-label")))
      .toEqual(["Close map layers", "Family", "Score display"]);
    expect(screen.queryByRole("region", { name: "Source cell details" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Dataset insights")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Map tools" })).not.toBeInTheDocument();
  });
  it("keeps family selection independent of reverse reads and switches roles for the same H3", async () => {
    const user = userEvent.setup(), h = host(); await ready(h);
    await user.click(screen.getByRole("button", { name: "Family" }));
    await user.click(screen.getByRole("button", { name: "Select Water → land" }));
    expect(adapter.loadTargetSources).not.toHaveBeenCalled();
    act(() => h.current().onSource(sourceA));
    expect(h.current()).toMatchObject({ mode: "source", selection: { role: "source", id: sourceA } });
    expect(screen.getByRole("region", { name: "Source cell details" })).toHaveTextContent("Outdoor observer samples");
    act(() => h.current().onTarget(sourceA));
    await waitFor(() => expect(adapter.loadTargetSources).toHaveBeenCalledWith(expect.anything(), sourceA));
    expect(h.current()).toMatchObject({ mode: "targetSources", selection: { role: "target", id: sourceA } });
    expect(await screen.findByRole("region", { name: "Land sources for water target" })).toHaveTextContent(sourceA);
    expect(screen.queryByRole("region", { name: "Source cell details" })).not.toBeInTheDocument();
  });
  it("keeps smoothing, outlines and opacity in Advanced across focus and reset", async () => {
    const user = userEvent.setup(), h = host(); await ready(h);
    await advanced(user);
    await user.click(screen.getByRole("switch", { name: "Smooth surface" }));
    fireEvent.change(screen.getByRole("slider", { name: "Smoothing radius" }), { target: { value: "1.5" } });
    await user.click(screen.getByRole("checkbox", { name: "Contour lines" }));
    expect(screen.getByRole("checkbox", { name: "Cell outlines" })).toBeDisabled();
    const smoothing = { enabled: true, radius: 1.5, contours: false };
    expect(h.current().smoothing).toEqual(smoothing);
    act(() => h.current().onSource(sourceA));
    expect(h.current().smoothing).toEqual(smoothing);
    act(() => h.current().onSource(sourceA));
    expect(h.current()).toMatchObject({ mode: "target", smoothing, scores: viewshedFixture().averages });
  });
  it("updates Insights from the original overview/source scores and keeps unknown separate from zero", async () => {
    const data = viewshedFixture(); data.averages[0].lower = 0;
    vi.mocked(adapter.loadViewshed).mockResolvedValue(data);
    const user = userEvent.setup(), h = host(); await ready(h);
    expect(h.current().scores).toEqual(data.averages);
    await user.click(screen.getByRole("button", { name: "Insights" }));
    const panel = screen.getByLabelText("Dataset insights");
    expect(within(panel).getByText("Mean").parentElement).toHaveTextContent("20%");
    await score(user, "average_viewability");
    expect(panel).toHaveTextContent("Available 1Unavailable 1");
    expect(within(panel).getByText("Mean").parentElement).toHaveTextContent("40%");
    act(() => h.current().onSource(sourceB));
    await waitFor(() => expect(h.current().scores).toEqual([pair(sourceB, targetB, .8, .8)]));
    expect(panel).toHaveTextContent("Available 1Unavailable 0");
    expect(within(panel).getByText("Mean").parentElement).toHaveTextContent("80%");
    expect(data.averages[0]).toMatchObject({ lower: 0, source_count: 2, outside_reach_source_count: 1, average_viewability: null });
  });
  it("preserves uncertain above-ground bounds, null complete factors and not-applicable support", async () => {
    const data = weightedViewshedFixture();
    Object.assign(data.averages[0], { above_ground_status: "unknown", weight_above_ground: null, above_ground_lower: .25, above_ground_upper: .85, above_ground_unknown_source_count: 1 });
    vi.mocked(adapter.loadViewshed).mockResolvedValue(data);
    const user = userEvent.setup(), h = host(); await ready(h);
    await score(user, "above_ground_lower");
    const lower = viewshedOverlays(h.current()).targets.features[0].properties!.color;
    expect(lower).not.toBe("#a9b3bb");
    expect(h.current().scores[0]).toMatchObject({ above_ground_lower: .25, above_ground_upper: .85 });
    await score(user, "weight_above_ground");
    expect(viewshedOverlays(h.current()).targets.features.map(f => f.properties!.color)).toEqual(["#a9b3bb", "#a9b3bb"]);
    expect(h.current().scores[1]).toMatchObject({ above_ground_status: "not_applicable", weight_above_ground: null });
    await score(user, "weight_distance");
    expect(h.current().scores[0].weight_distance).toBe(.3);
  });
  it.each([["land", "same"], ["land", "background"], ["water", "same"], ["water", "background"]])("resets %s focus on %s without changing the metric or original weights", async (role, reset) => {
    const user = userEvent.setup(), h = host(); await ready(h); await score(user, "upper");
    const initial = h.current().scores;
    act(() => role === "land" ? h.current().onSource(sourceA) : h.current().onTarget(sourceA));
    await waitFor(() => expect(h.current().mode).toBe(role === "land" ? "source" : "targetSources"));
    act(() => reset === "background" ? h.current().onBackground() : role === "land" ? h.current().onSource(sourceA) : h.current().onTarget(sourceA));
    expect(h.current()).toMatchObject({ mode: "target", metric: "upper", selection: null, scores: initial });
    expect(screen.queryByRole("region", { name: "Source cell details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Land sources for water target" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Viewshed legend" })).toHaveTextContent("All-source water mean");
  });
  it("ignores late source loads and retains the latest source configuration", async () => {
    let finish!: (rows: adapter.ViewPair[]) => void;
    vi.mocked(adapter.loadSource).mockImplementation((_, source) => source === sourceA ? new Promise(resolve => { finish = resolve; }) : Promise.resolve([pair(sourceB, targetB, .8, .8)]));
    const h = host(); await ready(h); act(() => h.current().onSource(sourceB));
    await waitFor(() => expect(h.current().scores).toEqual([pair(sourceB, targetB, .8, .8)]));
    await act(async () => finish([pair()]));
    expect(h.current()).toMatchObject({ source: sourceB, scores: [pair(sourceB, targetB, .8, .8)] });
  });
  it.each(["new target", "background"])("ignores stale reverse reads after %s", async next => {
    let finish!: (rows: adapter.ViewPair[]) => void;
    vi.mocked(adapter.loadTargetSources).mockImplementation((_, target) => target === sourceA ? new Promise(resolve => { finish = resolve; }) : Promise.resolve([pair(sourceB, targetB, .8, .8)]));
    const h = host(); await ready(h); act(() => h.current().onTarget(sourceA));
    act(() => next === "background" ? h.current().onBackground() : h.current().onTarget(targetB));
    await act(async () => finish([pair()]));
    if (next === "background") expect(h.current()).toMatchObject({ mode: "target", scores: viewshedFixture().averages });
    else await waitFor(() => expect(h.current()).toMatchObject({ selection: { role: "target", id: targetB }, scores: [pair(sourceB, targetB, .8, .8)] }));
  });
  it("retries failed catalog and source loads without substituting fixtures", async () => {
    vi.mocked(adapter.loadViewshed).mockRejectedValueOnce(new Error("Local cache unavailable"));
    vi.mocked(adapter.loadSource).mockRejectedValueOnce(new Error("Source checksum mismatch"));
    const user = userEvent.setup(), h = host();
    expect(await screen.findByRole("alert")).toHaveTextContent("Local cache unavailable");
    await user.click(screen.getByRole("button", { name: "Retry viewshed data" })); await ready(h);
    await waitFor(() => expect(adapter.loadSource).toHaveBeenCalled());
    act(() => h.current().onSource(sourceA));
    expect(await screen.findByRole("alert")).toHaveTextContent("Source checksum mismatch");
    expect(h.current().scores).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Retry source scores" }));
    await waitFor(() => expect(h.current().scores).toEqual([pair()]));
  });
  it("retries a failed reverse lookup without showing partial weights", async () => {
    vi.mocked(adapter.loadTargetSources).mockRejectedValueOnce(new Error("Reverse checksum mismatch"));
    const user = userEvent.setup(), h = host(); await ready(h); act(() => h.current().onTarget(sourceA));
    expect((await screen.findAllByRole("alert")).some(alert => alert.textContent?.includes("Reverse checksum mismatch"))).toBe(true);
    expect(h.current().scores).toEqual([]);
    await user.click(screen.getAllByRole("button", { name: "Retry land-source weights" })[0]);
    await waitFor(() => expect(h.current().scores).toEqual([pair()]));
  });
  it("colors reverse sources by their own saved weights and preserves every source row", async () => {
    const rows = [pair(), pair(sourceB, sourceA, .8, .8)];
    vi.mocked(adapter.loadTargetSources).mockResolvedValue(rows);
    const h = host(); await ready(h); act(() => h.current().onTarget(sourceA));
    await waitFor(() => expect(h.current().scores).toEqual(rows));
    const overlays = viewshedOverlays(h.current());
    expect(overlays.sources.features[0].properties!.color).not.toBe(overlays.sources.features[1].properties!.color);
    expect(overlays.targets.features.every(f => f.properties!.color === "#cddfe6")).toBe(true);
    expect(await within(screen.getByRole("region", { name: "Land sources for water target" })).findByText(/2 saved land/)).toBeInTheDocument();
  });
  it("keeps palette, log coloring, invalid ranges and opacity in the legend without changing scores", async () => {
    const user = userEvent.setup(), h = host(); await ready(h); const original = h.current().scores;
    await advanced(user);
    await user.click(screen.getByRole("radio", { name: "Warm glow" }));
    await user.selectOptions(screen.getByLabelText("Coloring method"), "custom");
    const maximum = screen.getByRole("spinbutton", { name: "Color scale maximum (%)" });
    await user.clear(maximum); await user.type(maximum, "20");
    expect(screen.getByText("1 cell beyond color limits · original scores retained")).toBeInTheDocument();
    expect(viewshedOverlays(h.current()).targets.features[1].properties!.color).toBe("#fcffa4");
    fireEvent.change(screen.getByLabelText("Layer opacity"), { target: { value: "0.4" } });
    expect(h.current().opacity).toBe(.4);
    await user.clear(maximum);
    expect(screen.getByText(/last valid range/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Viewshed legend" })).toHaveTextContent("≥ 20%");
    expect(h.current().scores).toBe(original);
    await user.selectOptions(screen.getByLabelText("Coloring method"), "log");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Color options" })).toHaveFocus();
    await settings(user);
    expect(screen.queryByLabelText("Layer opacity")).not.toBeInTheDocument();
    await advanced(user);
    expect(screen.getByLabelText("Coloring method")).toHaveValue("log");
    expect(screen.getByLabelText("Layer opacity")).toHaveValue("0.4");
  });
  it("dismisses dock panels on X, outside click and Escape while retaining score configuration", async () => {
    const user = userEvent.setup(), h = host(); await ready(h); await score(user, "upper");
    await user.click(screen.getByRole("button", { name: "Close map layers" }));
    expect(screen.getByRole("button", { name: "Viewshed layers" })).toHaveFocus();
    await settings(user); await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Score display")).not.toBeInTheDocument();
    await settings(user); fireEvent.pointerDown(document.body);
    expect(screen.queryByLabelText("Score display")).not.toBeInTheDocument();
    await settings(user); expect(screen.getByLabelText("Score display")).toHaveValue("upper");
  });
  it("keeps coordinates, cell details and help mutually exclusive", async () => {
    const user = userEvent.setup(), h = host(); await ready(h); act(() => h.current().onSource(sourceA));
    expect(screen.getByRole("region", { name: "Source cell details" })).toBeInTheDocument();
    act(() => h.current().onCoordinates({ lat: 48.25, lon: -123.1, left: 100, top: 120 }));
    expect(screen.getByRole("dialog", { name: "Map coordinates" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Source cell details" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Map help" }));
    expect(screen.queryByRole("dialog", { name: "Map coordinates" })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Viewshed help" })).toHaveTextContent("Physical viewability is separate");
    expect(screen.getByRole("link", { name: "© MapTiler" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Viewshed help")).not.toBeInTheDocument();
  });
  it("clears the hosted overlay on unmount", async () => {
    const h = host(); await ready(h); h.unmount(); expect(h.onMapChange).toHaveBeenLastCalledWith(undefined);
  });
  it("opens legacy Viewshed links in Features with the shared dock and header", async () => {
    const user = userEvent.setup(); window.history.replaceState(null, "", "/#viewshed"); render(<App />);
    expect(window.location.hash).toBe("#map?layer=viewshed"); await ready();
    expect(screen.getByRole("main", { name: "Features explorer" })).toBeInTheDocument();
    expect(screen.getByLabelText("Active layer")).toHaveTextContent("Viewshed/Lower estimate");
    await score(user, "upper"); expect(screen.getByLabelText("Active layer")).toHaveTextContent("Upper estimate");
    await user.click(screen.getByRole("button", { name: "Page navigation" }));
    expect(within(screen.getByRole("navigation", { name: "Main navigation" })).queryByRole("button", { name: /^Viewshed/ })).not.toBeInTheDocument();
  });
});
