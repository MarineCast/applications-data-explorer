import {stationTemperatureFixture} from "../test/stationTemperatureFixture";
import * as influenceData from "../data/riverInfluence";
import {riverInfluenceFixture} from "../test/riverInfluenceFixture";
import * as hydrologyData from "../data/hydrology";
import {hydrologyFixture,causalHydrologyFixture} from "../test/hydrologyFixture";
import * as orcaData from "../data/orca";
import {orcaFixture} from "../test/orcaFixture";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { latLngToCell } from "h3-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { loadSeascapeCatalog, loadSeascapeLayer } from "../data/seascape";
import type {
  SeascapeCatalog,
  SeascapeFeature,
  SeascapeLayer,
} from "../data/seascape";
import SeascapeMapPage from "./SeascapeMapPage";
import * as seascapeData from "../data/seascape";
import * as viewshedData from "../data/viewshed";
import { pair, sourceA, viewshedFixture } from "../test/viewshedFixture";
import * as weatherData from "../data/meteorology";
import { weatherFixture } from "../test/weatherFixture";
// Page state uses explicit native-layer callbacks. The production renderer suite
// owns geographic picking, camera persistence and WebGL lifecycle coverage.
vi.mock("../components/MapCanvas", async () => ({ default: (await import("../test/MapInteractionDriver")).default }));
vi.mock("../data/riverInfluence",async(importOriginal)=>({...await importOriginal<typeof import("../data/riverInfluence")>(),loadRiverInfluence:vi.fn()}));
vi.mock("../data/hydrology",async(importOriginal)=>({...await importOriginal<typeof import("../data/hydrology")>(),loadHydrologyData:vi.fn()}));
vi.mock("../data/orca", async (importOriginal) => ({...(await importOriginal<typeof import("../data/orca")>()),loadOrcaData: vi.fn().mockResolvedValue(undefined)}));
vi.mock("../data/seascape", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../data/seascape")>()),
  loadSeascapeCatalog: vi.fn(),
  loadSeascapeLayer: vi.fn(),
}));
const feature = (id: string, resolution: 6 | 8): SeascapeFeature => ({
  id,
  resolution,
  name: id,
  family: "PREFERRED",
  unit: "m",
  range: [0, 10],
  available: 1,
  rows: 2,
  role: "preferred_exact_source_alias",
  qualifiers: ["STATUS"],
  sourceRelease: "frozen",
  sourcePath: "depth.parquet",
  sourceSha256: "checksum",
  definition: "source depth",
  modelingEligibility: "not_assigned",
  arrowType: "double",
});
const catalog = {
  features: [
    feature("BATHYMETRY", 6),
    feature("BATHYMETRY_LOCAL_ANOMALY", 6),
    feature("BATHYMETRY", 8),
    feature("TERRAIN__SLOPE", 8),
  ],
  release: "frozen",
  manifestSha256: "hash",
  publishedAt: "2026-10-07",
} as SeascapeCatalog;
function nativeLayer(field: SeascapeFeature): SeascapeLayer {
  const cells = [48.45, 48.8].map((lat) => ({
    id: latLngToCell(lat, -123.5, field.resolution),
    lat,
    lon: -123.5,
    boundary: [],
    zone: "north" as const,
  }));
  return {
    id: field.id,
    name: field.name,
    unit: field.unit,
    resolution: field.resolution,
    range: field.range,
    cells,
    values: new Map([
      [cells[0].id, field.id === "BATHYMETRY" ? 0 : 3],
      [cells[1].id, null],
    ]),
    field,
    catalog,
    index: new Map(cells.map((c, i) => [c.id, i])),
    qualifiers: { STATUS: ["partial source coverage", "unknown"] },
    sourceLabel: "local",
  };
}
async function openLayers(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("region", { name: /^(Map|Left map) legend$/ });
  const trigger = screen.queryByRole("button", { name: "Map layers" });
  if (trigger) await user.click(trigger);
  const active = within(screen.getByRole("navigation", { name: "Data domains" })).getByRole("button", { pressed: true });
  if (active.getAttribute("aria-expanded") !== "true") await user.click(active);
}
async function chooseFeature(user: ReturnType<typeof userEvent.setup>, value: string, label = "Feature") {
  await user.click(screen.getByRole("button", { name: label }));
  const picker = screen.getByRole("dialog", { name: `${label} picker` });
  const choice = within(picker).getAllByRole("button").find(button => (button as HTMLButtonElement).value === value);
  expect(choice).toBeDefined();
  await user.click(choice!);
}
async function openSelectedInsights(user: ReturnType<typeof userEvent.setup>) {
  expect(screen.queryByLabelText("Dataset insights")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Insights" }));
  expect(screen.getByLabelText("Dataset insights")).toBeInTheDocument();
}
beforeEach(()=>{vi.mocked(influenceData.loadRiverInfluence).mockResolvedValue(undefined);vi.mocked(hydrologyData.loadHydrologyData).mockResolvedValue(undefined);vi.mocked(orcaData.loadOrcaData).mockResolvedValue(undefined);});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function mockSurveyLayers() {
  const binding = { rows: 2, cells: {url: "fixture", sha256: "fixture"}, columns: {}, sourceSha256: "fixture", sourcePath: "survey.parquet" };
  const surveyCatalog: SeascapeCatalog = { ...catalog,
    features: [feature("BATHYMETRY", 6), feature("BATHYMETRY_LOCAL_ANOMALY", 6)].map(f => ({...f, productId: "survey-depth"})),
    products: { "survey-depth": {axis: "Survey year", defaultSlice: "2024", slices: {
      "2021": {...binding, label: "2021"}, "2024": {...binding, label: "2024"},
    }} },
  };
  surveyCatalog.features.push(feature("STATIC_DEPTH", 6));
  vi.mocked(loadSeascapeCatalog).mockResolvedValue(surveyCatalog);
  vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field, slice) => {
    const layer = nativeLayer(field);
    if (field.productId) {
      const year = slice ?? "2024";
      layer.slice = {axis: "Survey year", value: year, label: year};
      layer.values = new Map(layer.values).set(layer.cells[0].id, Number(year) - 2000 + (field.id === "BATHYMETRY" ? 0 : 100));
    }
    return layer;
  });
  vi.spyOn(seascapeData, "loadSeascapeValues").mockResolvedValue(new Map());
}

describe("source-backed map interactions", () => {
  // Migrated from the retired DemoMapPage: exercise the current production page.
  it("inspects native zero and unavailable cells with their source qualifiers and returns to the overview", async () => {
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    await user.click(await screen.findByRole("button", {name: `Inspect cell ${latLngToCell(48.45, -123.5, 6)}`}));
    await openSelectedInsights(user);
    const selected = screen.getByLabelText("Insights selected cell");
    expect(selected).toHaveTextContent("0 m");
    expect(selected).toHaveTextContent("partial source coverage");
    await user.click(screen.getByRole("button", {name: `Inspect cell ${latLngToCell(48.8, -123.5, 6)}`}));
    expect(selected).toHaveTextContent("Unavailable");
    expect(selected).toHaveTextContent("unknown");
    await user.click(screen.getByRole("tab", {name: "Overview"}));
    expect(screen.getByRole("tabpanel", {name: "Overview"})).toHaveTextContent("Available 1Unavailable 1");
  });

  it("changes recorded survey slices, opens comparison and removes time selection for a static feature", async () => {
    mockSurveyLayers();
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    await openLayers(user);
    await user.selectOptions(screen.getByLabelText("Survey year"), "2021");
    await waitFor(() => expect(screen.getByRole("region", {name: "Map legend"})).toHaveTextContent("21 m"));
    expect(screen.getByLabelText("Survey year")).toHaveValue("2021");
    expect(vi.mocked(loadSeascapeLayer).mock.calls.at(-1)?.[2]).toBe("2021");
    await user.click(screen.getByRole("button", {name: "Compare"}));
    expect(screen.getByLabelText("Right survey year")).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "Show maps"}));
    expect(await screen.findByRole("region", {name: "Right map legend"})).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "Exit comparison"}));
    await openLayers(user);
    await chooseFeature(user, "STATIC_DEPTH");
    await waitFor(() => expect(screen.getByRole("region", {name: "Map legend"})).toHaveTextContent("STATIC_DEPTH"));
    expect(screen.queryByLabelText("Survey year")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Right survey year")).not.toBeInTheDocument();
  });

  it("keeps selected comparison source details tied to their side, variable, survey year and exact value", async () => {
    mockSurveyLayers();
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    await screen.findByRole("region", {name: "Map legend"});
    await user.click(screen.getByRole("button", {name: "Compare"}));
    await user.selectOptions(screen.getByLabelText("Right survey year"), "2021");
    await user.click(screen.getByRole("button", {name: "Show maps"}));
    await screen.findByRole("region", {name: "Right map legend"});
    const id = latLngToCell(48.45, -123.5, 6);
    const check = async (side: number, variable: string, year: string, value: string) => {
      await user.click(screen.getAllByRole("button", {name: `Inspect cell ${id}`})[side]);
      if (!screen.queryByLabelText("Dataset insights")) await user.click(screen.getByRole("button", {name: "Insights"}));
      await user.click(screen.getByRole("button", {name: "Source & quality"}));
      const details = screen.getByRole("dialog", {name: "Source & quality"});
      expect(details).toHaveTextContent(variable);
      expect(details).toHaveTextContent(`Survey year: ${year}`);
      expect(details).toHaveTextContent(`Exact stored value ${value}`);
      await user.click(screen.getByRole("button", {name: "Close source & quality"}));
    };
    await check(1, "BATHYMETRY_LOCAL_ANOMALY", "2021", "121");
    await user.click(screen.getByRole("button", {name: "Edit left comparison layer"}));
    await user.selectOptions(screen.getByLabelText("Survey year"), "2021");
    await user.click(screen.getByRole("button", {name: "Show maps"}));
    await check(1, "BATHYMETRY_LOCAL_ANOMALY", "2021", "121");
    await check(0, "BATHYMETRY", "2021", "21");
    await user.click(screen.getByRole("button", {name: "Edit right comparison layer"}));
    await user.selectOptions(screen.getByLabelText("Right survey year"), "2024");
    await user.click(screen.getByRole("button", {name: "Show maps"}));
    await check(1, "BATHYMETRY_LOCAL_ANOMALY", "2024", "124");
    await user.click(screen.getByRole("button", {name: "Exit comparison"}));
    expect(screen.queryByRole("region", {name: "Right map legend"})).not.toBeInTheDocument();
    await check(0, "BATHYMETRY", "2021", "21");
  });

  it("mounts map controls before the catalog and keeps the same surface while native values load", async () => {
    let resolveCatalog!: (value: SeascapeCatalog) => void;
    let resolveLayer!: (value: SeascapeLayer) => void;
    vi.mocked(loadSeascapeCatalog).mockReturnValue(new Promise(resolve => { resolveCatalog = resolve; }));
    vi.mocked(loadSeascapeLayer).mockReturnValue(new Promise(resolve => { resolveLayer = resolve; }));
    const view = render(<SeascapeMapPage />);
    const map = view.container.querySelector(".maps .map-canvas");
    expect(map).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Data domains" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Insights" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Seascape layers" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Loading layer…")).toBeInTheDocument();
    expect(screen.queryByText("Loading local Data catalog…")).not.toBeInTheDocument();
    expect(map!.querySelectorAll(".hex-cell")).toHaveLength(0);
    const expectSameMap = () => {
      expect(view.container.querySelector(".maps .map-canvas")).toBe(map);
    };
    await act(async () => resolveCatalog(catalog));
    expectSameMap();
    expect(screen.getByRole("button", { name: "Seascape layers" })).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByText("Loading native source values…")).toBeInTheDocument();
    expect(map!.querySelectorAll(".hex-cell")).toHaveLength(0);
    await act(async () => resolveLayer(nativeLayer(catalog.features[0])));
    expectSameMap();
    expect(await screen.findByRole("region", { name: "Map legend" })).toBeInTheDocument();
    expect(map!.querySelectorAll(".hex-cell")).toHaveLength(2);
  });

  it.each(["numeric", "categorical"] as const)("keeps %s map selection separate from opening Insights", async (kind) => {
    const field: SeascapeFeature = { ...feature("BATHYMETRY", 6), kind,
      ...(kind === "categorical" ? { categories: ["valley", "ridge"], unit: "category" } : {}) };
    vi.mocked(loadSeascapeCatalog).mockResolvedValue({ ...catalog, features: [field] });
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, selectedField) => {
      const layer = nativeLayer(selectedField);
      if (kind === "categorical") { layer.categories = ["valley", "ridge"]; layer.rawValues = new Map([[layer.cells[0].id, "valley"], [layer.cells[1].id, null]]); }
      return layer;
    });
    const user = userEvent.setup(); render(<SeascapeMapPage />);
    const cells = await screen.findAllByRole("button", { name: /Inspect cell/ });
    await user.click(cells[0]);
    await openSelectedInsights(user);
    const panel = screen.getByLabelText("Dataset insights");
    expect(within(panel).getByLabelText("Insights selected cell")).toHaveTextContent(kind === "categorical" ? "valley" : "0 m");
    await user.click(cells[1]);
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByLabelText("Insights selected cell")).toHaveTextContent("Unavailable");
    await user.click(screen.getByRole("button", { name: "Close insights" }));
    await user.click(cells[0]);
    await openSelectedInsights(user);
    expect(screen.getByRole("tab", { name: "Selected cell" })).toHaveAttribute("aria-selected", "true");
  });
  it("selects river bubbles while leaving Insights under user control", async () => {
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    vi.mocked(hydrologyData.loadHydrologyData).mockResolvedValue(hydrologyFixture());
    const user = userEvent.setup(); render(<SeascapeMapPage />);
    await screen.findByRole("region", { name: "Map legend" });
    await user.click(screen.getByRole("button", { name: "Hydrology layers" }));
    fireEvent.click(screen.getByRole("button", { name: "Inspect Fraser river" }));
    await openSelectedInsights(user);
    expect(screen.getByRole("region", { name: "Hydrology river insights" })).toHaveTextContent("Fraser · upstream gauge");
    await user.click(screen.getByRole("button", { name: "Close insights" }));
    fireEvent.click(screen.getByRole("button", { name: "Inspect Cowichan river" }));
    await openSelectedInsights(user);
    expect(screen.getByRole("region", { name: "Hydrology river insights" })).toHaveTextContent("Cowichan · upstream gauge");
  });
  it("keeps both comparison map selections from reopening closed Insights", async () => {
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    const user = userEvent.setup(); render(<SeascapeMapPage />);
    await screen.findByRole("region", { name: "Map legend" });
    await user.click(screen.getByRole("button", { name: "Compare" }));
    await user.click(screen.getByRole("button", { name: "Show maps" }));
    await screen.findByRole("region", { name: "Right map legend" });
    const cell = nativeLayer(catalog.features[0]).cells[0];
    const picks = screen.getAllByRole("button", { name: `Inspect cell ${cell.id}` });
    expect(picks).toHaveLength(2);
    await user.click(picks[1]); await openSelectedInsights(user);
    expect(screen.getByRole("tab", { name: "Selected cell" })).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByLabelText("Dataset insights")).getByText(cell.id, { selector: "code" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close insights" }));
    await user.click(picks[0]); await openSelectedInsights(user);
    expect(screen.getByRole("tab", { name: "Selected cell" })).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByLabelText("Dataset insights")).getByText(cell.id, { selector: "code" })).toBeVisible();
  });

  it.each([true, false])("keeps selection beside Insights only on wide screens: %s", async (wide) => {
    const viewportListeners = new Set<(event: MediaQueryListEvent) => void>();
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === '(min-width: 1100px)' && wide,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => { if (query === '(min-width: 1100px)') viewportListeners.add(listener); },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => viewportListeners.delete(listener) })));
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    await openLayers(user);
    await user.click(screen.getByRole('button', { name: 'Insights' }));
    expect(screen.getByLabelText('Dataset insights')).toBeInTheDocument();
    expect(Boolean(screen.queryByRole('button', { name: 'Close map layers' }))).toBe(wide);
    if (wide) {
      act(() => viewportListeners.forEach(listener => listener({ matches: false } as MediaQueryListEvent)));
      expect(screen.queryByRole('button', { name: 'Close map layers' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Dataset insights')).toBeInTheDocument();
    }
  });
  it("keeps the Features map surface mounted when Viewshed is selected and dismissed", async () => {
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    vi.spyOn(viewshedData, "loadViewshed").mockResolvedValue(viewshedFixture());
    vi.spyOn(viewshedData, "loadSource").mockResolvedValue([pair()]);
    vi.spyOn(viewshedData, "loadTargetSources").mockResolvedValue([pair()]);
    const user = userEvent.setup();
    const rendered = render(<SeascapeMapPage />);
    await screen.findByRole("region", { name: "Map legend" });
    const canvas = rendered.container.querySelector(".maps .map-canvas")!;
    await user.click(screen.getByRole("button", { name: "Viewshed layers" }));
    await screen.findByLabelText("Score display");
    expect(screen.getByRole("button", { name:"Compare" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name:"Export" })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("button", {name:"Compare"}));
    expect(screen.getByRole("status")).toHaveTextContent("Viewshed uses land–water pairs");
    await user.click(screen.getByRole("button", {name:"Dismiss action message"}));
    await screen.findByRole("button", { name: "Select land source Dungeness" });
    expect(rendered.container.querySelector(".maps .map-canvas")).toBe(canvas);
    expect(rendered.container.querySelectorAll(".maps .map-canvas")).toHaveLength(1);
    expect(rendered.container.querySelector(".viewshed-basemap")).toBeNull();
    await user.click(screen.getByRole("button", { name: `Inspect water target ${sourceA}` }));
    expect(await screen.findByRole("region", { name: "Land sources for water target" })).toHaveTextContent(sourceA);
    await user.click(screen.getByRole("button", { name: "Seascape layers" }));
    await screen.findByRole("region", { name: "Map legend" });
    expect(rendered.container.querySelector(".maps .map-canvas")).toBe(canvas);
    expect(screen.queryByRole("button", { name: "Select land source Dungeness" })).not.toBeInTheDocument();
  });
  it("opens Human at native R7 and connects its population feature picker", async () => {
    const population: SeascapeFeature = { ...feature("HUMAN__population_count_collected", 6),
      column: "population_count_collected", resolution: 7, dataset: "human", name: "Population Count", family: "Population", unit: "persons" };
    const collected: SeascapeFeature = { ...population, id: "HUMAN__population_within_100km_collected", column: "population_within_100km_collected", name: "Population Within 100km" };
    const density: SeascapeFeature = { ...population, id: "HUMAN__population_density_per_km2_collected", column: "population_density_per_km2_collected", name: "Population Density (people/km²)", unit: "persons/km2" };
    vi.mocked(loadSeascapeCatalog).mockResolvedValue({ ...catalog,
      features: [...catalog.features, population, density, collected],
      datasets: { human: { name: "Human", release: "2020/2021", status: "partial", limitations: "Static resident baseline" } } });
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    await screen.findByRole("region", { name: "Map legend" });
    await user.click(screen.getByRole("button", { name: "Human layers" }));
    expect(screen.getByText("H3 R7", { selector: "strong" })).toBeInTheDocument();
    expect(loadSeascapeLayer).toHaveBeenLastCalledWith(expect.anything(), collected, undefined);
    await chooseFeature(user, density.id);
    expect(loadSeascapeLayer).toHaveBeenLastCalledWith(expect.anything(), density, undefined);
    expect(await screen.findByRole("region", { name: "Map legend" })).toHaveTextContent("persons/km2");
  });

  it("keeps the map mounted through pending layer changes, resolution changes, errors and retries", async () => {
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    let requested!: SeascapeFeature;
    let resolve!: (layer: SeascapeLayer) => void;
    let reject!: (error: Error) => void;
    vi.mocked(loadSeascapeLayer).mockResolvedValueOnce(nativeLayer(catalog.features[0]))
      .mockImplementation((_, field) => {
        requested = field;
        return new Promise<SeascapeLayer>((done, fail) => { resolve = done; reject = fail; });
      });
    const user = userEvent.setup();
    const view = render(<SeascapeMapPage />);
    await screen.findByRole("region", { name: "Map legend" });
    const map = view.container.querySelector(".maps .map-canvas");
    const expectSameMap = () => {
      expect(view.container.querySelector(".maps .map-canvas")).toBe(map);
    };
    await openLayers(user);
    await chooseFeature(user, "BATHYMETRY_LOCAL_ANOMALY");
    expectSameMap();
    expect(screen.getByText("Loading native source values…")).toBeVisible();
    expect(map!.querySelectorAll(".hex-cell")).toHaveLength(0);
    expect(screen.queryByRole("region", { name: "Map legend" })).not.toBeInTheDocument();
    await act(async () => resolve(nativeLayer(requested)));
    expectSameMap();
    expect(screen.getByRole("region", { name: "Map legend" })).toHaveTextContent("BATHYMETRY_LOCAL_ANOMALY");
    await user.selectOptions(screen.getByLabelText("Native H3 resolution"), "8");
    expectSameMap();
    expect(map!.querySelectorAll(".hex-cell")).toHaveLength(0);
    await act(async () => reject(new Error("Layer request failed")));
    expect(screen.getByText("Layer request failed").closest('[role="alert"]')?.parentElement).toHaveClass("map-warning-stack");
    expectSameMap();
    await user.click(screen.getByRole("button", { name: "Retry layer" }));
    expectSameMap();
    await act(async () => resolve(nativeLayer(requested)));
    expectSameMap();
    expect(screen.getByRole("region", { name: "Map legend" })).toHaveTextContent("H3 R8");
    expect(map!.querySelectorAll(".hex-cell")).toHaveLength(2);
  });
  it("enables checked daily meteorology at native R5, advances dates with a stable scale and removes time controls on static layers", async () => {
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    vi.spyOn(weatherData, "loadMeteorologyCatalog").mockResolvedValue(weatherFixture);
    const weatherLoad = vi.spyOn(weatherData, "loadMeteorologyLayer").mockImplementation(async (c, field, day) => ({
      ...nativeLayer(field), catalog:c, slice:{ axis:"UTC date", value:day ?? "2026-10-08", label:weatherData.weatherDate(day ?? "2026-10-08") },
    }));
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    await user.click(await screen.findByRole("button", {name:"Meteorology layers"}));
    expect(await screen.findByRole("region", {name:"Meteorology timeline"})).toBeVisible();
    const legend = await screen.findByRole("region", {name:"Map legend"});
    expect(await within(legend).findByText(/Oct 8, 2026 UTC/)).toBeVisible();
    expect(within(legend).getByRole("img")).toHaveAccessibleName(/-20 to 40 degC/);
    expect(screen.getByLabelText("Feature")).toHaveValue("METEOROLOGY__TEMPERATURE_2M_C_MEAN");
    await user.click(screen.getByRole("button", {name:"Previous weather day"}));
    expect(await within(legend).findByText(/Oct 7, 2026 UTC/)).toBeVisible();
    expect(within(legend).getByRole("img")).toHaveAccessibleName(/-20 to 40 degC/);
    expect(weatherLoad.mock.calls.at(-1)?.[2]).toBe("2026-10-07");
    expect(weatherLoad.mock.calls.at(-1)?.[1].resolution).toBe(5);
    await user.click(screen.getByRole("button", {name:"Seascape layers"}));
    expect(screen.queryByRole("region", {name:"Meteorology timeline"})).not.toBeInTheDocument();
    expect(screen.getByLabelText("Feature")).toHaveValue("BATHYMETRY");
  });
  it("pins product icons, preserves selection on close and offers a map-only collapse", async () => {
    const gov = { ...feature("GOVERNANCE__count", 8), dataset: "governance", unit: "count" };
    vi.mocked(loadSeascapeCatalog).mockResolvedValue({ ...catalog, features: [...catalog.features, gov], datasets: {
      seascape: { name: "Seascape", release: "test", status: "partial", limitations: "Native source" },
      governance: { name: "Governance", release: "test", status: "research", limitations: "Recorded inventory" },
    } });
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    await screen.findByRole("navigation", { name: "Data domains" });
    expect(screen.getByRole("button", { name: "Meteorology layers" })).toHaveAttribute("aria-disabled", "true");
    await user.click(await screen.findByRole("button", { name: "Governance layers" }));
    expect(screen.getByRole("heading", { name: "Governance" })).toBeVisible();
    expect(screen.queryByLabelText("Native H3 resolution")).not.toBeInTheDocument();
    expect(screen.getByText("H3 R8")).toBeVisible();
    expect(screen.getByLabelText("Feature")).toHaveValue(gov.id);
    await user.click(screen.getByRole("button", { name: "Close map layers" }));
    expect(screen.getByRole("button", { name: "Governance layers" })).toHaveAttribute("aria-pressed", "true");
    await user.click(await screen.findByRole("button", { name: "Governance layers" }));
    expect(screen.getByLabelText("Feature")).toHaveValue(gov.id);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Governance layers" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Collapse product dock" }));
    const trigger = screen.getByRole("button", { name: "Map layers" });
    expect(screen.queryByRole("navigation", { name: "Data domains" })).not.toBeInTheDocument();
    await user.click(trigger);
    await openLayers(user);
    await user.click(document.body);
    expect(screen.queryByRole("region", { name: "Map layers" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Data domains" })).toBeVisible();
  });
  it("uses depth bands only with declared metric semantics and exposes exact selected measurements", async () => {
    const depth = { ...feature("BATHYMETRY", 6), name: "Bathymetry", measurement: { quantity: "depth", statistic: "mean", positiveDirection: "down" } as const };
    vi.mocked(loadSeascapeCatalog).mockResolvedValue({ ...catalog, sourceCompleteness: "partial", features: [depth] });
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => {
      const layer = nativeLayer(field);
      layer.values = new Map([[layer.cells[0].id, 12.3456789012345], [layer.cells[1].id, null]]);
      return layer;
    });
    render(<SeascapeMapPage />);
    const user = userEvent.setup();
    const legend = await screen.findByRole("region", { name: "Map legend" });
    expect(legend).toHaveTextContent("Mean depth · m · H3 R6 · positive down");
    expect(legend).not.toHaveTextContent("Partial source coverage");
    expect(legend).not.toHaveTextContent("Outside domain");
    expect(within(legend).queryByText("Appearance", { exact: true })).not.toBeInTheDocument();
    expect(within(legend).getByRole("img")).toHaveAccessibleName(/Depth bands/);
    await user.click(screen.getAllByRole("button", { name: /Inspect cell/ })[0]);
    await openSelectedInsights(user);
    expect(screen.queryByLabelText("Map cell preview")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Selected cell" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Insights selected cell")).toHaveTextContent("12.3456789012345 m");
  });
  it("shares class breaks for the same metric across recorded slices", async () => {
    const depth = { ...feature("BATHYMETRY", 6), productId: "depth" };
    const support = { rows: 2, cells: { url: "fixture", sha256: "fixture" }, columns: {}, sourceSha256: "fixture", sourcePath: "fixture" };
    const data = { ...catalog, features: [depth], products: { depth: { axis: "Survey year", defaultSlice: "2024", slices: { "2024": support, "2025": support } } } };
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(data);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field, slice) => {
      const layer = nativeLayer(field);
      layer.values = new Map(layer.cells.map((cell, i) => [cell.id, slice === "2025" ? 100 + i * 100 : i * 10]));
      return layer;
    });
    render(<SeascapeMapPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Compare" }));
    await user.click(screen.getByRole("button", { name: "Show maps" }));
    await screen.findByRole("region", { name: "Right map legend" });
    await user.click(screen.getByRole("button", { name: "Edit right comparison layer" }));
    await user.selectOptions(screen.getByLabelText("Right survey year"), "2025");
    await user.click(screen.getByRole("button", { name: "Show maps" }));
    const right = screen.getByRole("region", { name: "Right map legend" });
    await within(right).findByRole("img", { name: /0 to 200 m/ });
    expect(within(screen.getByRole("region", { name: "Left map legend" })).getByRole("img")).toHaveAccessibleName(/0 to 200 m/);
  });
  it("opens namespaced flat bathymetry by default and keeps both comparison layers native", async () => {
    const flatFeature = (column: string, resolution: 6 | 8) => ({
      ...feature(`bathymetry_static__${column}`, resolution), column,
      productId: `seascape-bathymetry-static-r${resolution}`, dataset: "seascape",
    });
    const flatCatalog = { ...catalog, features: [
      { ...feature("anthropogenic_static__AREA", 6), dataset: "seascape" },
      flatFeature("BATHYMETRY__BATHYMETRY", 6),
      flatFeature("WATERGRAPH_ANOMALY__BATHYMETRY_LOCAL_ANOMALY", 6),
      flatFeature("BATHYMETRY__BATHYMETRY", 8),
    ] };
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(flatCatalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    render(<SeascapeMapPage />);
    const user = userEvent.setup();
    await screen.findByRole("region", { name: "Map legend" });
    expect(vi.mocked(loadSeascapeLayer).mock.calls[0][1]).toBe(flatCatalog.features[1]);
    await user.click(screen.getByRole("button", { name: "Compare" }));
    await user.click(screen.getByRole("button", { name: "Show maps" }));
    await screen.findByRole("region", { name: "Right map legend" });
    expect(vi.mocked(loadSeascapeLayer).mock.calls.some(call => call[1] === flatCatalog.features[2])).toBe(true);
    await openLayers(user);
    expect(screen.getByLabelText("Feature")).toHaveValue(flatCatalog.features[1].id);
    await user.selectOptions(screen.getByLabelText("Native H3 resolution"), "8");
    expect(screen.getByLabelText("Feature")).toHaveValue(flatCatalog.features[3].id);
  });
  it("keeps Insights tied to original source values, selected cells, comparison sides and native resolution", async () => {
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    await user.click(await screen.findByRole("button", { name: "Insights" }));
    const panel = screen.getByLabelText("Dataset insights");
    expect(panel).toHaveTextContent("Available 1Unavailable 1");
    expect(within(panel).getByText("Mean").parentElement).toHaveTextContent("0");
    await user.click(screen.getAllByRole("button", { name: /Inspect cell/ })[0]);
    expect(within(panel).getByLabelText("Insights selected cell")).toHaveTextContent("0 m");
    expect(within(panel).getByLabelText("Insights selected cell")).toHaveTextContent("partial source coverage");
    expect(screen.queryByLabelText("Map cell preview")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Compare" }));
    await user.click(screen.getByRole("button", { name: "Show maps" }));
    await within(panel).findByLabelText("Right layer summary");
    expect(within(panel).getByLabelText("Right layer summary")).toHaveTextContent("Mean 3 m");
    expect(screen.queryByLabelText("Insights layer")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Dataset insights")).toHaveLength(1);
    const leftLegend = screen.getByRole("region", { name: "Left map legend" });
    const rightLegend = screen.getByRole("region", { name: "Right map legend" });
    expect(leftLegend).toHaveTextContent("Left · BATHYMETRY");
    expect(rightLegend).toHaveTextContent("Right · BATHYMETRY_LOCAL_ANOMALY");
    expect(within(leftLegend).getByRole("img")).toHaveAccessibleName(/0 to 0 m/);
    expect(within(rightLegend).getByRole("img")).toHaveAccessibleName(/3 to 3 m/);
    await openLayers(user);
    await user.selectOptions(screen.getByLabelText("Native H3 resolution"), "8");
    await within(panel).findByLabelText("Right layer summary");
    expect(panel).toHaveTextContent("H3 R8");
    expect(within(panel).getByLabelText("Right layer summary")).toHaveTextContent("Mean 0 m");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Close map layers" })).not.toBeInTheDocument();
    expect(panel).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seascape layers" })).toHaveFocus();
    await user.keyboard("{Escape}{Escape}");
    expect(screen.queryByLabelText("Dataset insights")).not.toBeInTheDocument();
  });
  it("offers native Data products, categorical classes and explicit survey years without standardizing categories", async () => {
    vi.stubEnv("VITE_MAPTILER_KEY", "");
    const terrain = { ...feature("TERRAIN_FORM__TERRAIN_FORM_PROXY", 8), dataset: "seascape", kind: "categorical" as const, categories: ["valley", "ridge"], unit: "category" };
    const gov = { ...feature("GOVERNANCE__ports__recorded_feature_count", 6), dataset: "governance", productId: "governance-r6", unit: "count" };
    const kelp = { ...feature("KELP_ANNUAL__MAPPED_BED_EXTENT_IN_FULL_H3_M2", 6), dataset: "kelp", productId: "kelp-r6", unit: "m²" };
    const kelpFraction = { ...kelp, id: "KELP_ANNUAL__POSITIVE_MAPPED_BED_EXTENT_WATER_FRAC", unit: "fraction" };
    const dataCatalog: SeascapeCatalog = { ...catalog,
      datasets: {
        seascape: { name: "Seascape", release: "v5", status: "partial", limitations: "Historical source coverage" },
        governance: { name: "Governance", release: "v2", status: "research only", limitations: "Model-ineligible; not current law" },
        kelp: { name: "Annual kelp", release: "annual", status: "mapped evidence", limitations: "Not survey absence" },
        "coastal-rays": { name: "Directional coastal bounds", release: "rays", status: "bounds", limitations: "Not physical fetch" },
      },
      features: [...catalog.features, terrain, gov, kelp, kelpFraction],
      products: { "kelp-r6": { axis: "Survey year", defaultSlice: "2024", slices: {
        "1989": { rows: 2, cells: { url: "fixture", sha256: "fixture" }, columns: {}, sourceSha256: "fixture", sourcePath: "fixture", label: "1989" },
        "2024": { rows: 2, cells: { url: "fixture", sha256: "fixture" }, columns: {}, sourceSha256: "fixture", sourcePath: "fixture", label: "2024" },
      } } },
    };
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(dataCatalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field, slice) => {
      const layer = nativeLayer(field);
      if (field.kind === "categorical") {
        layer.categories = field.categories!.map(String);
        layer.values = new Map(layer.cells.map((c, i) => [c.id, i]));
        layer.rawValues = new Map(layer.cells.map((c, i) => [c.id, field.categories![i]]));
      }
      if (field.dataset === "kelp") layer.slice = { axis: "Survey year", value: slice ?? "2024", label: slice ?? "2024" };
      return layer;
    });
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    await user.click(await screen.findByRole("button", { name: "Governance layers" }));
    expect(screen.getByLabelText("Feature")).toHaveValue(gov.id);
    expect(screen.queryByText("Data details")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Feature" }));
    await user.click(screen.getByRole("button", { name: `About ${gov.name}` }));
    expect(screen.getByRole("region", { name: `About ${gov.name}` })).toHaveTextContent("Model-ineligible; not current law");
    await user.click(screen.getByRole("button", { name: "Close feature picker" }));
    await user.click(await screen.findByRole("button", { name: `Inspect cell ${latLngToCell(48.45, -123.5, 6)}` }));
    await openSelectedInsights(user);
    expect(screen.getByLabelText("Insights selected cell")).toHaveTextContent("3 count");
    await user.click(screen.getByRole("button", { name: "Annual kelp layers" }));
    expect(screen.getByLabelText("Survey year")).toHaveValue("2024");
    expect(within(screen.getByLabelText("Survey year")).queryByRole("option", { name: "1993" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Survey year"), "1989");
    await screen.findByRole("region", { name: "Map legend" });
    expect(vi.mocked(loadSeascapeLayer).mock.calls.at(-1)?.[2]).toBe("1989");
    await chooseFeature(user, kelpFraction.id);
    expect(screen.getByLabelText("Survey year")).toHaveValue("1989");
    await screen.findByRole("region", { name: "Map legend" });
    expect(vi.mocked(loadSeascapeLayer).mock.calls.at(-1)?.[2]).toBe("1989");
    expect(within(screen.getByRole("region", { name: "Map layers" })).getByText("H3 R6")).toBeInTheDocument();
    expect(screen.queryByLabelText("Native H3 resolution")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seascape layers" }));
    await user.selectOptions(screen.getByLabelText("Native H3 resolution"), "8");
    expect(screen.getByRole("button", { name: "Seascape layers" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Survey year")).not.toBeInTheDocument();
    await chooseFeature(user, terrain.id);
    const legend = await screen.findByRole("region", { name: "Map legend" });
    expect(within(screen.getByRole("region", { name: "Map layers" })).queryByRole("switch", { name: "Display z-scores" })).not.toBeInTheDocument();
    await user.click(within(legend).getByRole("button", { name: "Color options" }));
    expect(screen.queryByRole("switch", { name: "Display z-scores" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Category key")).toHaveTextContent("valley");
    expect(screen.queryByRole("combobox", { name: "Coloring method" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button",{name:"valley"}));
    expect(screen.queryByRole("button",{name:`Inspect cell ${latLngToCell(48.45,-123.5,8)}`})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"valley"})).toHaveAttribute("aria-pressed","false");
    await user.click(screen.getByRole("button",{name:"valley"}));
    expect(screen.queryByText(/Zoom in to see native R8/)).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: `Inspect cell ${latLngToCell(48.45, -123.5, 8)}` }));
    expect(screen.getByLabelText("Insights selected cell")).toHaveTextContent("valley");
    expect(screen.getByLabelText("Insights selected cell")).not.toHaveTextContent("Standardized value");
  });
  it("standardizes each comparison layer independently and restores original display values", async () => {
    vi.stubEnv("VITE_MAPTILER_KEY", "");
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => {
      const result = nativeLayer(field);
      const values = field.id === "BATHYMETRY" ? [0, 10] : [103, 107];
      result.values = new Map(
        result.cells.map((cell, i) => [cell.id, values[i]]),
      );
      return result;
    });
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    const legend = await screen.findByRole("region", { name: "Map legend" });
    await openLayers(user);
    expect(within(screen.getByRole("region", { name: "Map layers" })).queryByRole("switch", { name: "Display z-scores" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Color options" }));
    await user.click(screen.getByText("Advanced"));
    const toggle = within(screen.getByRole("dialog", { name: "Map color options" })).getByRole("switch", { name: "Display z-scores" });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByText("Advanced options")).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(legend).toHaveTextContent("-1");
    expect(legend).toHaveTextContent("1");
    expect(legend).toHaveTextContent("z");
    const id = latLngToCell(48.45, -123.5, 6);
    await user.click(
      screen.getByRole("button", { name: `Inspect cell ${id}` }),
    );
    await openSelectedInsights(user);
    expect(
      screen.getByLabelText("Insights selected cell"),
    ).toHaveTextContent("Value0 mH3 index");
    await user.click(screen.getByRole("button", { name: "Source & quality" }));
    expect(
      screen.getByRole("dialog", { name: "Source & quality" }),
    ).toHaveTextContent("Mean: 5 m; std: 5 m");
    await user.click(
      screen.getByRole("button", { name: "Close source & quality" }),
    );
    await user.click(screen.getByRole("button", { name: "Compare" }));
    await user.click(screen.getByRole("button", { name: "Show maps" }));
    const rightLegend = await screen.findByRole("region", {
      name: "Right map legend",
    });
    expect(rightLegend).toHaveTextContent("z");
    const picks = await screen.findAllByRole("button", {
      name: `Inspect cell ${id}`,
    });
    await user.click(picks[1]);
    expect(
      screen.getByLabelText("Insights selected cell"),
    ).toHaveTextContent("103 m");
    await user.click(screen.getByRole("button", { name: "Source & quality" }));
    expect(
      screen.getByRole("dialog", { name: "Source & quality" }),
    ).toHaveTextContent("Exact stored value 103");
    expect(
      screen.getByRole("dialog", { name: "Source & quality" }),
    ).toHaveTextContent("Mean: 105 m; std: 2 m");
    await user.click(
      screen.getByRole("button", { name: "Close source & quality" }),
    );
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("dialog", { name: "Export local layer" })).toHaveTextContent("BATHYMETRY_LOCAL_ANOMALY");
    await user.click(screen.getByRole("button", { name: "Close export local layer" }));
    await user.click(within(rightLegend).getByRole("button", { name: "Right map color options" }));
    await user.click(screen.getByText("Advanced"));
    const restoredToggle = screen.getByRole("switch", { name: "Display z-scores" });
    expect(restoredToggle).toBeChecked();
    await user.click(restoredToggle);
    expect(restoredToggle).not.toBeChecked();
    expect(rightLegend).toHaveTextContent("m");
    await user.click((await screen.findAllByRole("button", { name: `Inspect cell ${id}` }))[1]);
    expect(
      screen.getByLabelText("Insights selected cell"),
    ).not.toHaveTextContent("Standardized value");
    expect(
      screen.getByLabelText("Insights selected cell"),
    ).toHaveTextContent("103 m");
  });
  it("opens static bathymetry, inspects exact values/qualifiers and follows comparison selection", async () => {
    vi.stubEnv("VITE_MAPTILER_KEY", "");
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) =>
      nativeLayer(field),
    );
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    const legend = await screen.findByRole("region", { name: "Map legend" });
    expect(legend.closest(".layer-panel")).toBeNull();
    expect(
      within(legend).getByRole("img", { name: /Ten color classes/ }).children,
    ).toHaveLength(10);
    expect(
      screen.queryByRole("region", { name: "Map details" }),
    ).not.toBeInTheDocument();
    await openLayers(user);
    expect(
      within(screen.getByRole("region", { name: "Map layers" })).queryByRole(
        "radiogroup",
      ),
    ).not.toBeInTheDocument();
    await user.click(
      within(legend).getByRole("button", { name: "Color options" }),
    );
    await user.click(screen.getByRole("radio", { name: "Viridis" }));
    await user.click(screen.getByText("Advanced", { exact: true }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Coloring method" }), "quantile");
    expect(screen.getByRole("radio", { name: "Viridis" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Coloring method" })).toHaveValue("quantile");
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Map color options" }),
    ).not.toBeInTheDocument();
    expect(
      within(legend).getByRole("button", { name: "Color options" }),
    ).toHaveFocus();
    expect(legend).toHaveTextContent("BATHYMETRY");
    expect(screen.queryByRole("region", { name: "Map layers" })).not.toBeInTheDocument();
    expect(legend).toBeVisible();
    await openLayers(user);
    await user.click(
      within(legend).getByRole("button", { name: "Color options" }),
    );
    await user.click(screen.getByText("Advanced", { exact: true }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Coloring method" }), "minmax");
    await user.keyboard("{Escape}");
    expect(
      within(legend).getByRole("img", {
        name: /Ten color classes/,
      }),
    ).toBeInTheDocument();
    const id = latLngToCell(48.45, -123.5, 6);
    await user.click(
      await screen.findByRole("button", { name: `Inspect cell ${id}` }),
    );
    await openSelectedInsights(user);
    expect(
      screen.getByLabelText("Insights selected cell"),
    ).toHaveTextContent("0 m");
    expect(
      screen.queryByRole("slider", { name: "Map month" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Source & quality" }));
    expect(
      screen.getByRole("dialog", { name: "Source & quality" }),
    ).toHaveTextContent("partial source coverage");
    expect(
      screen.getByRole("dialog", { name: "Source & quality" }),
    ).toHaveTextContent("Exact stored value 0");
    expect(
      within(
        screen.getByRole("dialog", { name: "Source & quality" }),
      ).queryByRole("button", { name: "Save cell" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Close source & quality" }),
    );
    await user.click(screen.getByRole("button", { name: "Compare" }));
    await user.click(screen.getByRole("button", { name: "Show maps" }));
    expect(
      screen.getByRole("region", { name: "Left map legend" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: "Right map legend" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Compare divider" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getAllByRole("button", { name: "Zoom in" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Left map color options" }));
    expect(screen.getByRole("dialog", { name: "Left map color options" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Right map color options" }));
    expect(screen.queryByRole("dialog", { name: "Left map color options" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Right map color options" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Viridis" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Close color options" }));
    const picks = await screen.findAllByRole("button", {
      name: `Inspect cell ${id}`,
    });
    await user.click(picks[1]);
    await user.click(screen.getByRole("button", { name: "Source & quality" }));
    expect(
      screen.getByRole("dialog", { name: "Source & quality" }),
    ).toHaveTextContent("BATHYMETRY_LOCAL_ANOMALY");
    await user.click(
      screen.getByRole("button", { name: "Close source & quality" }),
    );
    expect(
      screen.getByLabelText("Insights selected cell"),
    ).toHaveTextContent("3 m");
    await openLayers(user);
    await user.selectOptions(
      screen.getByLabelText("Native H3 resolution"),
      "8",
    );
    await chooseFeature(user, "TERRAIN__SLOPE");
    expect(screen.getByLabelText("Feature")).toHaveValue(
      "TERRAIN__SLOPE",
    );
    await user.selectOptions(
      screen.getByLabelText("Native H3 resolution"),
      "6",
    );
    expect(screen.getByLabelText("Feature")).toHaveValue(
      "BATHYMETRY",
    );
    await user.click(screen.getByRole("button", { name: "Feature" }));
    expect(screen.queryByRole("button", { name: "Select TERRAIN__SLOPE" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
  });
  it("keeps header actions available while Appearance and layer controls dismiss predictably", async () => {
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    const user = userEvent.setup();
    const view = render(<SeascapeMapPage />);
    await screen.findByRole("region", { name: "Map legend" });
    expect(view.container.querySelector(".atlas-sidebar")).toBeNull();
    expect(screen.getByRole("button", { name: "Compare" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
    await openLayers(user);
    await user.click(screen.getByRole("button", { name: "Color options" }));
    expect(screen.queryByRole("region", { name: "Map layers" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Map color options" })).toHaveTextContent("Appearance");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Color options" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Map help" }));
    const help = screen.getByRole("dialog", { name: "Explore the data atlas" });
    expect(within(help).getByRole("link", { name: "© MapTiler" })).toBeVisible();
  });
  it("keeps source diagnostics in one bottom warning and recovers on retry without remounting the map", async () => {
    const user = userEvent.setup();
    vi.mocked(loadSeascapeCatalog).mockResolvedValueOnce({ ...catalog, unavailableProducts: [{ name: "Kelp", reason: "No retained survey product" }] });
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    vi.spyOn(weatherData, "loadMeteorologyCatalog").mockResolvedValue(undefined);
    vi.mocked(influenceData.loadRiverInfluence).mockRejectedValueOnce(new Error("Influence source changed; rebuild the configured influence product"));
    vi.mocked(influenceData.loadRiverInfluence).mockResolvedValue(undefined);
    vi.mocked(hydrologyData.loadHydrologyData).mockRejectedValueOnce(new Error("Retained Hydrology product unavailable"));
    vi.mocked(hydrologyData.loadHydrologyData).mockResolvedValue(undefined);
    const view = render(<SeascapeMapPage />);
    const map = view.container.querySelector(".maps .map-canvas");
    const warning = await screen.findByRole("alert", { name: "Source availability warning" });
    expect(warning.parentElement).toHaveClass("map-warning-stack");
    expect(within(warning).getByRole("heading")).toHaveTextContent("Some sources unavailable");
    expect(warning.querySelector("details")).not.toHaveAttribute("open");
    await user.click(within(warning).getByText("Details", { exact: true }));
    expect(warning.querySelector("details")).toHaveAttribute("open");
    expect(warning).toHaveTextContent("Influence source changed; rebuild the configured influence product");
    expect(warning).toHaveTextContent("Retained Hydrology product unavailable");
    expect(warning).toHaveTextContent("No retained survey product");
    expect(screen.queryByText(/^Hydrology unavailable:/)).not.toBeInTheDocument();
    expect(view.container.querySelector(".maps .map-canvas")).toBe(map);
    await user.click(within(warning).getByRole("button", { name: "Retry sources" }));
    await waitFor(() => expect(screen.queryByRole("alert", { name: "Source availability warning" })).not.toBeInTheDocument());
    expect(view.container.querySelector(".maps .map-canvas")).toBe(map);
    expect(influenceData.loadRiverInfluence).toHaveBeenCalledTimes(2);
    expect(hydrologyData.loadHydrologyData).toHaveBeenCalledTimes(2);
  });
  it("fails visibly when source loading fails and retries without synthetic fallback", async () => {
    vi.mocked(loadSeascapeCatalog).mockRejectedValueOnce(
      new Error("Missing local source"),
    );
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) =>
      nativeLayer(field),
    );
    const view = render(<SeascapeMapPage />);
    const map = view.container.querySelector(".maps .map-canvas");
    expect(map).not.toBeNull();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Missing local source",
    );
    expect(screen.queryByText(/Synthetic/)).not.toBeInTheDocument();
    expect(view.container.querySelector(".maps .map-canvas")).toBe(map);
    expect(screen.getByRole("navigation", { name: "Data domains" })).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry local data" }));
    await openLayers(userEvent.setup());
    expect(view.container.querySelector(".maps .map-canvas")).toBe(map);
    expect(await screen.findByLabelText("Feature")).toHaveValue(
      "BATHYMETRY",
    );
  });
  it("exports exact values and qualifiers without cell bookmarks or an analysis sheet", async () => {
    vi.stubEnv("VITE_MAPTILER_KEY", "");
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) =>
      nativeLayer(field),
    );
    const createObjectURL = vi.fn<(blob: Blob) => string>(
      () => "blob:local-layer",
    );
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    const id = latLngToCell(48.45, -123.5, 6);
    await user.click(
      await screen.findByRole("button", { name: `Inspect cell ${id}` }),
    );
    await openSelectedInsights(user);
    expect(
      screen.queryByRole("button", { name: "Bookmarks" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save cell" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Insights selected cell"),
    ).toHaveTextContent("0 m");
    await user.click(screen.getByRole("button", { name: "Color options" }));
    await user.click(screen.getByText("Advanced"));
    await user.click(screen.getByRole("switch", { name: "Smooth surface" }));
    await user.click(screen.getByRole("switch", { name: "Display z-scores" }));
    expect(
      within(screen.getByRole("dialog", { name: "Map color options" })).getByRole(
        "status",
      ),
    ).toHaveTextContent("zero standard deviation");
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(
      screen.getByRole("button", { name: "Download layer JSON" }),
    );
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(createObjectURL.mock.calls[0][0] as Blob);
    });
    const exported = JSON.parse(text);
    expect(exported).toMatchObject({
      release: "frozen",
      manifest_sha256: "hash",
      source_sha256: "checksum",
      unit: "m",
      h3_resolution: 6,
      qualifiers: { STATUS: ["partial source coverage", "unknown"] },
      display_smoothing: { requested: true, visualization_only: true, sigma_cell_widths: 0.75, contours: true },
      display_standardization: {
        formula: "(value - mean) / std",
        ddof: 0,
        count: 1,
        mean: 0,
        std: 0,
        unavailable: "constant",
      },
    });
    expect(
      exported.cells.map((cell: { value: number | null }) => cell.value),
    ).toEqual([0, null]);
    expect(exported.cells[0].h3_index).toBe(id);
    expect(
      screen.queryByRole("region", { name: "Map details" }),
    ).not.toBeInTheDocument();
  });
});

it("opens symmetric comparison selectors, swaps both layers and applies unlinked appearance only to its own side", async () => {
  vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
  vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
  const user = userEvent.setup();
  render(<SeascapeMapPage />);
  await user.click(await screen.findByRole("button", {name:"Compare"}));
  const setup = screen.getByRole("dialog", {name:"Compare layers"});
  expect(within(setup).getByRole("button", {name:"Left map feature"})).toHaveValue("BATHYMETRY");
  expect(within(setup).getByRole("button", {name:"Right map feature"})).toHaveValue("BATHYMETRY_LOCAL_ANOMALY");
  await user.click(within(setup).getByRole("button", {name:"Swap layers"}));
  expect(within(setup).getByRole("button", {name:"Left map feature"})).toHaveValue("BATHYMETRY_LOCAL_ANOMALY");
  expect(within(setup).getByRole("button", {name:"Right map feature"})).toHaveValue("BATHYMETRY");
  await user.click(within(setup).getByRole("button", {name:"Show maps"}));
  expect(screen.getByRole("button", {name:"Edit left comparison layer"})).toBeVisible();
  expect(screen.getByRole("button", {name:"Edit right comparison layer"})).toBeVisible();
  await user.click(screen.getByRole("button", {name:"Edit right comparison layer"}));
  expect(screen.getByRole("button", {name:"Right map feature"})).toHaveFocus();
  await user.click(screen.getByRole("button", {name:"Show maps"}));
  await user.click(screen.getByRole("button", {name:"Right map color options"}));
  await user.click(screen.getByRole("checkbox", {name:"Link appearance between maps"}));
  expect(screen.getByText("Applies to the right map only")).toBeVisible();
  await user.click(screen.getByRole("radio", {name:"Viridis"}));
  await user.click(screen.getByText("Advanced", {exact:true}));
  await user.click(screen.getByRole("switch", {name:"Display z-scores"}));
  expect(screen.getByRole("region", {name:"Right map legend"})).toHaveTextContent("z · H3");
  expect(screen.getByRole("region", {name:"Left map legend"})).toHaveTextContent("m · H3");
  await user.click(screen.getByRole("button", {name:"Left map color options"}));
  expect(screen.getByRole("radio", {name:"Ocean blue"})).toBeChecked();
  expect(screen.getByRole("radio", {name:"Viridis"})).not.toBeChecked();
  await user.click(screen.getByRole("checkbox", {name:"Link appearance between maps"}));
  expect(screen.getByText("Applies to both maps")).toBeVisible();
  expect(screen.getByRole("region", {name:"Right map legend"})).toHaveTextContent("m · H3");
  await user.click(screen.getByRole("button", {name:"Exit comparison"}));
  expect(screen.queryByRole("region", {name:"Right map legend"})).not.toBeInTheDocument();
});

it("makes grid fallback and identical comparisons explicit and omits tautological correlation", async () => {
  vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
  vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
  const user = userEvent.setup();
  render(<SeascapeMapPage />);
  await user.click(await screen.findByRole("button", {name:"Compare"}));
  await user.click(screen.getByRole("button", {name:"Show maps"}));
  await openLayers(user);
  await user.selectOptions(screen.getByLabelText("Native H3 resolution"), "8");
  expect(screen.getByRole("status")).toHaveTextContent("The right variable is unavailable at H3 R8");
  await user.click(screen.getByRole("button", {name:"Insights"}));
  const insights = screen.getByLabelText("Dataset insights");
  await within(insights).findByText(/Both maps show the same variable and slice/);
  expect(within(insights).queryByRole("region", {name:"Correlation"})).not.toBeInTheDocument();
});

it("preserves overlap identities and native cell support in the mounted inspector and returns to numeric rendering", async () => {
  const payload=(await import("../data/governanceMemberships.fixture.json")).default;
  const {decodeGovernanceMemberships,governanceIdentityView}=await import("../data/governanceMemberships");
  const data=decodeGovernanceMemberships(payload,payload);
  const identity:SeascapeFeature={...feature("GOVERNANCE__identities",6),dataset:"governance",family:"Management Areas",name:"Recorded features",kind:"categorical",membershipColumn:payload.column,unit:"membership",qualifiers:[]};
  const count:SeascapeFeature={...identity,id:"counts",name:"Recorded feature count",kind:"numeric",membershipColumn:undefined,unit:"count"};
  const fields={...catalog,features:[...catalog.features,identity,count]};
  vi.mocked(loadSeascapeCatalog).mockResolvedValue(fields);
  vi.mocked(loadSeascapeLayer).mockImplementation(async (_,field)=>{
    const layer=nativeLayer(field);
    if(!field.membershipColumn)return layer;
    const cells=[48,48.5,49,49.5].map(lat=>({...layer.cells[0],id:latLngToCell(lat,-123.5,6),lat}));
    const view=governanceIdentityView(data,cells.map(c=>c.id));
    return {...layer,...view,cells,governanceMemberships:data,membershipLegend:view.legend,index:new Map(cells.map((c,i)=>[c.id,i]))};
  });
  const user=userEvent.setup();render(<SeascapeMapPage />);
  await screen.findByRole("region",{name:"Map legend"});
  await user.click(screen.getByRole("button",{name:"Governance layers"}));
  await chooseFeature(user,identity.id);
  const cell=latLngToCell(48,-123.5,6);
  await user.click(await screen.findByRole("button",{name:`Inspect cell ${cell}`}));
  const popup=screen.getByRole("dialog",{name:"Cell information"});
  expect(popup).toHaveTextContent("dfo:21-0");expect(popup).toHaveTextContent("wdfw:7");expect(popup).toHaveTextContent("2 recorded areas");
  await user.click(screen.getByRole("button",{name:`Inspect cell ${latLngToCell(48.5,-123.5,6)}`}));
  expect(screen.getByRole("dialog",{name:"Cell information"})).toHaveTextContent("Unknown membership support");
  await user.click(screen.getByRole("button",{name:`Inspect cell ${latLngToCell(49,-123.5,6)}`}));
  expect(screen.getByRole("dialog",{name:"Cell information"})).toHaveTextContent("No recorded areas under verified empty support");
  await user.click(screen.getByRole("button",{name:`Inspect cell ${cell}`}));
  await openSelectedInsights(user);
    const inspector=screen.getByRole("region",{name:"Governance feature memberships"});
  expect(inspector).toHaveTextContent("dfo.marine: 21-0");
  expect(inspector).toHaveTextContent("wdfw.marine: 7");
  expect(inspector).toHaveTextContent("Feature count: 2 · Support: partial");
  expect(screen.getByRole("dialog",{name:"Cell information"})).toHaveTextContent(cell);
  await user.click(screen.getByRole("button",{name:"Close insights"}));
  await user.click(screen.getByRole("button",{name:"Color options"}));
  expect(screen.queryByRole("combobox",{name:"Coloring method"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("button",{name:"Close color options"}));
  await user.click(screen.getByRole("button",{name:"Governance layers"}));
  await chooseFeature(user,count.id);
  await user.click(screen.getByRole("button",{name:"Close map layers"}));
  await user.click(screen.getByRole("button",{name:"Color options"}));
  await user.click(screen.getByText("Advanced",{exact:true}));
  expect(screen.getByRole("combobox",{name:"Coloring method"})).toHaveValue("equal");
  expect(screen.getByRole("switch",{name:"Display z-scores"})).not.toBeDisabled();
});

it("opens Orca, unions categories and preserves temporal/representation state through map updates",async()=>{
 vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
 vi.mocked(loadSeascapeLayer).mockImplementation(async(_,f)=>nativeLayer(f));
 const orca=orcaFixture();
 orca.catalog.source.providers=[{source:"SYNTHETIC_TEST_ONLY",status:"retained_local_only",retrieved_at_utc:null,actual_latest_study_sighting_native_date:"2024-02-29",scope:"Synthetic retained records",availability_caveat:"Synthetic fixture only"}];
 orca.catalog.source.dailyCoverage={daily_included:4,daily_unbinned:2,total_records:6};
 vi.mocked(orcaData.loadOrcaData).mockResolvedValue(orca);
 const user=userEvent.setup();render(<SeascapeMapPage/>);
 await screen.findByRole("region",{name:"Map legend"});
 await user.click(screen.getByRole("button",{name:"Marine mammals layers"}));
 expect(screen.getByRole("button",{name:"Family"})).toHaveTextContent("Orca");
 expect(screen.queryByRole("button",{name:"Feature"})).not.toBeInTheDocument();
 expect(screen.getByRole("checkbox",{name:"All sighting types"})).toBeChecked();
 const selector=screen.getByRole("region",{name:"Map layers"});
 expect(selector).not.toHaveTextContent(orcaData.orcaCaveat);
 expect(selector).not.toHaveTextContent("Source coverage and freshness");
 expect(selector).not.toHaveTextContent("records can enter daily UTC bins");
 expect(screen.queryByText("Source coverage and freshness")).not.toBeInTheDocument();
 await user.selectOptions(screen.getByRole("combobox",{name:"Sighting time granularity"}),"all");
 expect(screen.getByRole("region",{name:"Orca sightings timeline"})).toHaveTextContent("6 records");
 await user.click(screen.getByRole("button",{name:"Close map layers"}));
 await user.click(screen.getByRole("button",{name:"Marine mammals layers"}));
 await user.selectOptions(screen.getByRole("combobox",{name:"Orca representation"}),"points");
 expect(screen.getByRole("region",{name:"Sighting point legend"})).toHaveTextContent("SRKW");
 await user.click(screen.getByRole("button",{name:"SRKW"}));
 expect(screen.getByRole("region",{name:"Orca sightings timeline"})).toHaveTextContent("3 records");
 expect(screen.getByRole("button",{name:"SRKW"})).toHaveAttribute("aria-pressed","false");
 await user.click(screen.getByRole("button",{name:"SRKW"}));
 await user.click(screen.getByRole("button",{name:"Marine mammals layers"}));
 await user.click(screen.getByRole("checkbox",{name:"Whale symbols"}));
 await user.selectOptions(screen.getByRole("combobox",{name:"Sighting time granularity"}),"daily");
 await user.click(screen.getByRole("button",{name:"Close map layers"}));
 await user.click(screen.getByRole("button",{name:"Marine mammals layers"}));
 expect(screen.getByRole("combobox",{name:"Orca representation"})).toHaveValue("points");
 expect(screen.getByRole("checkbox",{name:"Whale symbols"})).toBeChecked();
 await user.click(screen.getByRole("button",{name:"Close map layers"}));
 await user.click(screen.getByRole("button",{name:"Inspect sighting synthetic:mixed"}));
 await openSelectedInsights(user);
    expect(await screen.findByRole("region",{name:"Reported sighting records"})).toHaveTextContent("native mixed");
 await user.click(screen.getByText("Source coverage and freshness"));
 const insights=screen.getByRole("region",{name:"Insights content"});
 expect(insights).toHaveTextContent("Latest retained native date: 2024-02-29");
 expect(insights).toHaveTextContent("Retrieved: Not refreshed");
 expect(insights).toHaveTextContent("Synthetic retained records");
 expect(insights).toHaveTextContent("4 of 6 records can enter daily UTC bins");
 expect(insights).toHaveTextContent("2 unbinned daily; All time retains them.");
});

it("opens Hydrology bubbles and history, retains selected river through dates/metrics and returns to Orca/Governance",async()=>{
 vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);vi.mocked(loadSeascapeLayer).mockImplementation(async(_,f)=>nativeLayer(f));vi.mocked(hydrologyData.loadHydrologyData).mockResolvedValue(hydrologyFixture());vi.mocked(orcaData.loadOrcaData).mockResolvedValue(orcaFixture());
 const user=userEvent.setup();render(<SeascapeMapPage/>);await screen.findByRole("region",{name:"Map legend"});await user.click(screen.getByRole("button",{name:"Hydrology layers"}));expect(screen.getByRole("region",{name:"River history"})).not.toHaveTextContent("UTC");expect(screen.queryByRole("slider",{name:"Hydrology day timeline"})).not.toBeInTheDocument();expect(screen.getAllByRole("button",{name:"Inspect Fraser river"})).toHaveLength(1);
 const selector=screen.getByRole("region",{name:"Map layers"});
 expect(within(selector).getByRole("button",{name:"Family"})).toBeInTheDocument();
 expect(within(selector).getByRole("button",{name:"Feature"})).toBeInTheDocument();
 expect(within(selector).queryByRole("combobox",{name:"River to inspect"})).not.toBeInTheDocument();
 expect(within(selector).queryByRole("button",{name:"Inspect river"})).not.toBeInTheDocument();
 fireEvent.keyDown(screen.getByRole("button",{name:"Inspect Fraser river"}),{key:"Enter"});await openSelectedInsights(user);expect(await screen.findByRole("region",{name:"Hydrology river insights"})).toHaveTextContent("Fraser · upstream gauge");

 await user.selectOptions(screen.getByRole("combobox",{name:"Hydrology insight metric"}),"temperature_mean");expect(screen.getByRole("region",{name:"Hydrology river insights"})).toHaveTextContent("Fraser · upstream gauge");
 await user.selectOptions(screen.getByRole("combobox",{name:"Hydrology river"}),"cowichan");expect(screen.getByText("Not collected",{selector:"output"})).toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Close insights"}));await user.click(screen.getByRole("button",{name:"Marine mammals layers"}));expect(screen.queryByRole("region",{name:"River history"})).not.toBeInTheDocument();expect(screen.getByRole("region",{name:"Orca sightings timeline"})).toBeInTheDocument();
 await user.selectOptions(screen.getByRole("combobox",{name:"Orca representation"}),"points");await user.click(screen.getByRole("button",{name:"Close map layers"}));await user.click(screen.getByRole("button",{name:"Inspect sighting synthetic:mixed"}));await openSelectedInsights(user);expect(screen.getByRole("tab",{name:"Selected record"})).toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Hydrology layers"}));expect(screen.getByRole("tab",{name:"Overview"})).toHaveAttribute("aria-selected","true");expect(screen.getByRole("region",{name:"Hydrology gauge overview"})).toBeInTheDocument();expect(screen.getByLabelText("Selected date")).toHaveTextContent("Sep 30, 2026");
});

it("opens native Human records and clears their geometry and popup when changing to an H3 summary",async()=>{
 const {decodeHumanGeometry}=await import("../data/humanGeometry");
 const geometry=decodeHumanGeometry({schema:"human.native_features.v1",type:"FeatureCollection",features:[{type:"Feature",id:"places:synthetic",geometry:{type:"Point",coordinates:[-123.5,48.45]},properties:{record_id:"places:synthetic",group:"places",role:"record",name:"Synthetic Park",category:"park",location_method:"marine_facing_representative_point_not_entrance",label_point:[-123.5,48.45],h3_index:"reference",attributes:{source_id:"synthetic",access:null}}}]},"places",1);
 const locations:SeascapeFeature={...feature("HUMAN_NATIVE__places",6),resolution:7,dataset:"human",family:"Places",name:"Named Destinations",column:"places",geometryGroup:"places",kind:"categorical",categories:["park"],rows:1,available:1};
 const summary:SeascapeFeature={...locations,id:"HUMAN__place_count",column:"places__CATALOG_RECORD_COUNT",name:"Named Destination Records · H3 summary",geometryGroup:undefined,kind:"numeric",categories:undefined};
 const fixture={...catalog,features:[...catalog.features,locations,summary],datasets:{human:{name:"Human",release:"synthetic",status:"partial",limitations:"Synthetic fixture"}}};
 vi.mocked(loadSeascapeCatalog).mockResolvedValue(fixture);
 vi.mocked(loadSeascapeLayer).mockImplementation(async(_,field)=>field.geometryGroup?{...nativeLayer(field),cells:[],values:new Map(),index:new Map(),qualifiers:{},categories:["park"],humanGeometry:geometry}:nativeLayer(field));
 const user=userEvent.setup();render(<SeascapeMapPage/>);await screen.findByRole("region",{name:"Map legend"});
 await user.click(screen.getByRole("button",{name:"Human layers"}));await chooseFeature(user,locations.id);
 const selector=screen.getByRole("region",{name:"Map layers"});
 expect(within(selector).queryByRole("searchbox",{name:"Search Human locations"})).not.toBeInTheDocument();
 expect(within(selector).queryByRole("combobox",{name:"Inspect Human location"})).not.toBeInTheDocument();
 expect(selector).not.toHaveTextContent(/source records match|Native source geometry/);
 await user.click(await screen.findByRole("button",{name:"Inspect Synthetic Park"}));
 await openSelectedInsights(user);
    expect(screen.getByRole("tab",{name:"Selected record"})).toHaveAttribute("aria-selected","true");
 expect(screen.getByRole("heading",{name:"Synthetic Park"})).toBeInTheDocument();expect(screen.getAllByText(/not a surveyed entrance/).length).toBeGreaterThan(0);
 await user.click(screen.getByRole("button",{name:"Human layers"}));await chooseFeature(user,summary.id);
 await screen.findByRole("region",{name:"Map legend"});expect(screen.queryByRole("button",{name:"Inspect Synthetic Park"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Close Human location popup"})).not.toBeInTheDocument();
 const cell=nativeLayer(summary).cells[0];await user.click(screen.getByRole("button",{name:`Inspect cell ${cell.id}`}));
 expect(screen.getByRole("tab",{name:"Selected cell"})).toHaveAttribute("aria-selected","true");
});

it("shows configurable overlapping river influence and preserves it through inspection and layer switches",async()=>{
 const d=riverInfluenceFixture();vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);vi.mocked(loadSeascapeLayer).mockImplementation(async(_,f)=>nativeLayer(f));vi.mocked(influenceData.loadRiverInfluence).mockResolvedValue(d);vi.mocked(hydrologyData.loadHydrologyData).mockResolvedValue(hydrologyFixture());
 const user=userEvent.setup();render(<SeascapeMapPage/>);await screen.findByRole("region",{name:"Map legend"});expect(screen.queryByRole("button",{name:"River influence layers"})).not.toBeInTheDocument();await user.click(screen.getByRole("button",{name:"Hydrology layers"}));await chooseFeature(user,"River influence","Family");
 expect(await screen.findByRole("combobox",{name:"Water-distance weights"})).toHaveValue("broad");expect(screen.getByRole("slider",{name:"River influence provider date"})).toHaveAttribute("aria-valuetext",expect.stringContaining("provider date"));
 await user.selectOptions(screen.getByRole("combobox",{name:"Water-distance weights"}),"local");
 await user.click(await screen.findByRole("button",{name:`Inspect cell ${d.recipe.cells[0]}`}));await openSelectedInsights(user);
 const region=await screen.findByRole("region",{name:"River influence contributions"});expect(region).toHaveTextContent("Fraser River");expect(region).toHaveTextContent("Skagit River");expect(region).toHaveTextContent("2/2 river routes known");expect(region).toHaveTextContent("50.0%");expect(region).toHaveTextContent("Local · 20 km decay");
 await user.click(screen.getByText("Data source",{exact:true}));
 const source=screen.getByRole("region",{name:"Insights content"});expect(source).toHaveTextContent("Hydrology/influence.parquet");expect(source).toHaveTextContent(d.recipe.method);expect(source).not.toHaveTextContent("Bubbles mark approximate mouth references");
 await user.click(screen.getByRole("button",{name:"Compare"}));
 const dialog=screen.getByRole("dialog",{name:"Compare layers"}),leftSettings=within(dialog).getByRole("region",{name:"Left layer settings"}),rightSettings=within(dialog).getByRole("region",{name:"Right layer settings"});
 await chooseFeature(user,"hydrology","Right data product");
 await chooseFeature(user,"River influence","Right map family");
 expect(within(leftSettings).getByRole("combobox",{name:"Water-distance weights"})).toHaveValue("local");expect(within(rightSettings).getByRole("combobox",{name:"Water-distance weights"})).toHaveValue("broad");
 await user.selectOptions(within(rightSettings).getByRole("combobox",{name:"Flow lag weights"}),"later");
 await user.click(within(dialog).getByRole("button",{name:"Swap layers"}));
 expect(within(leftSettings).getByRole("combobox",{name:"Water-distance weights"})).toHaveValue("broad");expect(within(leftSettings).getByRole("combobox",{name:"Flow lag weights"})).toHaveValue("later");
 await user.click(within(dialog).getByRole("button",{name:"Show maps"}));
 await user.click(screen.getByRole("button",{name:"Exit comparison"}));
 await user.click(screen.getByRole("button",{name:"Hydrology layers"}));await chooseFeature(user,"Discharge","Family");expect(screen.getByRole("region",{name:"River history"})).toBeInTheDocument();expect(screen.queryByRole("combobox",{name:"Water-distance weights"})).not.toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Seascape layers"}));expect(screen.queryByRole("slider",{name:"River influence provider date"})).not.toBeInTheDocument();
});

it("offers only the retained influence variables and keeps the gauge flow indicators",async()=>{
 const d=riverInfluenceFixture();vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);vi.mocked(loadSeascapeLayer).mockImplementation(async(_,f)=>nativeLayer(f));vi.mocked(influenceData.loadRiverInfluence).mockResolvedValue(d);vi.mocked(hydrologyData.loadHydrologyData).mockResolvedValue(hydrologyFixture());
 const user=userEvent.setup();render(<SeascapeMapPage/>);await screen.findByRole("region",{name:"Map legend"});
 await user.click(screen.getByRole("button",{name:"Hydrology layers"}));await chooseFeature(user,"River influence","Family");
 await user.click(screen.getByRole("button",{name:"Feature"}));
 const picker=screen.getByRole("dialog",{name:"Feature picker"});
 expect(within(picker).getByRole("button",{name:"Select Relative flow influence"})).toBeInTheDocument();
 expect(within(picker).getByRole("button",{name:"Select Discharge influence"})).toBeInTheDocument();
 expect(picker).not.toHaveTextContent("Relative pulse influence");expect(picker).not.toHaveTextContent("Overlapping pulse rivers");
 await user.click(within(picker).getByRole("button",{name:"Select Discharge influence"}));
 expect(screen.queryByRole("button",{name:/Go to previous pulse/})).not.toBeInTheDocument();
 expect(screen.getByRole("combobox",{name:"Flow lag weights"})).toHaveValue("now");
 await chooseFeature(user,"Flow indicators","Family");
 expect(screen.getByRole("region",{name:"River history"})).toBeInTheDocument();
});


it("shows refuge percent and exports the exact fraction with its conversion", async () => {
  const coverage: SeascapeFeature = { ...feature("GOVERNANCE__wildlife_refuges__recorded_polygon_union_area_fraction", 6), dataset: "governance", family: "Wildlife Refuges", name: "Wildlife Refuge Coverage", column: "wildlife_refuges__recorded_polygon_union_area_fraction", unit: "fraction" };
  vi.mocked(loadSeascapeCatalog).mockResolvedValue({ ...catalog, features: [...catalog.features, coverage] });
  vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => {
    const layer = nativeLayer(field);
    if (field === coverage) return { ...layer, unit: "%", range: [0, 100], values: new Map([[layer.cells[0].id, 42.5], [layer.cells[1].id, null]]), rawValues: new Map([[layer.cells[0].id, .425], [layer.cells[1].id, null]]) };
    return layer;
  });
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:refuge");
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const user = userEvent.setup(); render(<SeascapeMapPage />);
  await user.click(await screen.findByRole("button", { name: "Governance layers" }));
  await user.click(await screen.findByRole("button", { name: `Inspect cell ${latLngToCell(48.45, -123.5, 6)}` }));
  await openSelectedInsights(user);
  expect(screen.getByLabelText("Insights selected cell")).toHaveTextContent("42.5%");
  await user.click(screen.getByRole("button", { name: "Color options" }));
  await user.click(screen.getByText("Advanced"));
  await user.click(screen.getByRole("switch", { name: "Display z-scores" }));
  await user.click(screen.getByRole("button", { name: "Export" }));
  await user.click(screen.getByRole("button", { name: "Download layer JSON" }));
  const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(createObjectURL.mock.calls[0][0]); });
  const exported = JSON.parse(text);
  expect(exported.unit).toBe("fraction");
  expect(exported.display_conversion).toEqual({ unit: "%", scale: 100, formula: "fraction * 100" });
  expect(exported.display_standardization).toMatchObject({ formula: "(value * 100 - mean) / std", input_unit: "fraction", mean_unit: "%", std_unit: "%", mean: 42.5, std: 0 });
  expect(exported.cells.map((cell: { value: number | null }) => cell.value)).toEqual([.425, null]);
});

it.each([
  ["wildlife_refuges", "Wildlife Refuges", "Wildlife Refuge Count"],
  ["management_areas", "Fisheries Management Areas", "Management Area Count"],
])("falls back to %s Count when a previously selected support field disappears", async (group, family, name) => {
  vi.stubGlobal("EventSource", class extends EventTarget { close() {} });
  const removed: SeascapeFeature = { ...feature(`GOVERNANCE__${group}__recorded_line_union_length_m`, 6), dataset: "governance", family, name: "Old line diagnostic" };
  const count: SeascapeFeature = { ...removed, id: `GOVERNANCE__${group}__recorded_feature_count`, column: `${group}__recorded_feature_count`, name, unit: "count" };
  vi.mocked(loadSeascapeCatalog).mockResolvedValue({ ...catalog, features: [...catalog.features, removed] });
  vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
  const user = userEvent.setup(); render(<SeascapeMapPage />);
  await user.click(await screen.findByRole("button", { name: "Governance layers" }));
  expect(screen.getByLabelText("Feature")).toHaveValue(removed.id);
  vi.mocked(loadSeascapeCatalog).mockResolvedValue({ ...catalog, features: [...catalog.features, count] });
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(screen.getByLabelText("Feature")).toHaveValue(count.id));
  expect(await screen.findByRole("region", { name: "Map legend" })).toHaveTextContent(name);
});


it.each(["recorded_feature_count", "feature_memberships_v1"])("migrates a removed tribal component saved selection (%s) to its combined feature", async suffix => {
  vi.stubGlobal("EventSource", class extends EventTarget { close() {} });
  const prefix="tribal_first_nations_areas__";
  const removed: SeascapeFeature = {...feature("GOVERNANCE__"+prefix+"nrcan_indian_reserve_reference__"+suffix,6),dataset:"governance",family:"Tribal First Nations Areas",name:"Old Canadian component"};
  const nextColumn=prefix+(suffix==="feature_memberships_v1"?"feature_memberships_v1":"mapped_area");
  const combined: SeascapeFeature={...removed,id:"GOVERNANCE__"+nextColumn,column:nextColumn,name:suffix==="feature_memberships_v1"?"Tribal / First Nations Assignment":"Tribal / First Nations Area",kind:"categorical"};
  vi.mocked(loadSeascapeCatalog).mockResolvedValue({...catalog,features:[...catalog.features,removed]});
  vi.mocked(loadSeascapeLayer).mockImplementation(async(_,field)=>nativeLayer(field));
  const user=userEvent.setup();render(<SeascapeMapPage/>);
  await user.click(await screen.findByRole("button",{name:"Governance layers"}));
  expect(screen.getByLabelText("Feature")).toHaveValue(removed.id);
  vi.mocked(loadSeascapeCatalog).mockResolvedValue({...catalog,features:[...catalog.features,combined]});
  act(()=>window.dispatchEvent(new Event("focus")));
  await waitFor(()=>expect(screen.getByLabelText("Feature")).toHaveValue(combined.id));
});

it("connects all causal choices to mouth inspection and synchronized river history",async()=>{
 const data=causalHydrologyFixture();vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);vi.mocked(loadSeascapeLayer).mockImplementation(async(_,f)=>nativeLayer(f));vi.mocked(hydrologyData.loadHydrologyData).mockResolvedValue(data);
 const user=userEvent.setup();render(<SeascapeMapPage/>);await screen.findByRole("region",{name:"Map legend"});await user.click(screen.getByRole("button",{name:"Hydrology layers"}));
 fireEvent.keyDown(screen.getByRole("button",{name:"Inspect Fraser river"}),{key:"Enter"});await openSelectedInsights(user);
 for(const metric of data.metrics.filter(m=>m.causal)){
  await user.selectOptions(screen.getByRole("combobox",{name:"Hydrology insight metric"}),metric.id);
  expect(screen.getByRole("region",{name:"River history"})).toHaveTextContent(metric.name);
  expect(screen.getByRole("region",{name:"Hydrology river insights"})).toHaveTextContent("as-of discharge date: 2026-09-29");
 }
 fireEvent.change(screen.getByLabelText("Hydrology insight date"),{target:{value:data.dates[0]}});
 expect(screen.getByRole("region",{name:"River history"})).toHaveTextContent("as-of 2026-09-23");
 await user.selectOptions(screen.getByRole("combobox",{name:"Hydrology insight metric"}),"causal_discharge_seasonal_mean");
 expect(screen.getByRole("region",{name:"Hydrology river insights"})).toHaveTextContent("Warmup / insufficient seasonal reference");
 await user.selectOptions(screen.getByRole("combobox",{name:"Hydrology river"}),"cowichan");
 expect(screen.getByRole("region",{name:"Hydrology river insights"})).toHaveTextContent("Cowichan · upstream gauge");
});

it("switches Oceanography metrics on their native grids and preserves the selected daily slice", async () => {
  const user=userEvent.setup();
  vi.mocked(loadSeascapeLayer).mockImplementation(async (_, f, day) => { const layer=nativeLayer(f); return {...layer,slice:{axis:"Date",value:day??"2009-01-01",label:day??"2009-01-01"},values:day==="2026-10-25"?new Map([...layer.values.keys()].map(key=>[key,null])):layer.values}; });
  const fields:SeascapeFeature[]=[{...feature("sst_c",6),dataset:"oceanography",name:"Sea Surface Temperature",family:"Ocean Conditions",productId:"oceanography-sst",qualifiers:[],unit:"°C"},{...feature("chlorophyll_mg_m3",6),resolution:5,dataset:"oceanography",name:"Chlorophyll",family:"Ocean Conditions",productId:"oceanography-chlorophyll",qualifiers:[],unit:"mg/m³"}];
  fields.push({...fields[0],id:"hycom__current_east_m_s",column:"current_east_m_s",productId:"oceanography-hycom-currents",name:"Eastward current · HYCOM (0 m)",resolution:5,unit:"m/s",signed:true});
  const product={axis:"Date",defaultSlice:"2009-01-01",slices:Object.fromEntries(["2009-01-01","2024-07-02","2026-10-25"].map(day=>[day,{rows:2,cells:{url:"",sha256:""},columns:{},sourceSha256:"test",sourcePath:"test"}]))};
  vi.mocked(loadSeascapeCatalog).mockResolvedValue({...catalog,features:[...catalog.features,...fields],products:{"oceanography-sst":product,"oceanography-chlorophyll":product,"oceanography-hycom-currents":{...product,defaultSlice:"2024-07-02",slices:{"2024-07-02":product.slices["2024-07-02"]}}},datasets:{oceanography:{name:"Oceanography",release:"daily",status:"published",limitations:"No filling"}}});
  render(<SeascapeMapPage/>);
  await user.click(await screen.findByRole("button",{name:"Oceanography layers"}));
  await user.click(await screen.findByRole("button",{name:"Feature"}));
  await user.click(await screen.findByRole("button",{name:"Select Chlorophyll"}));
  await waitFor(()=>expect(loadSeascapeLayer).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({id:"chlorophyll_mg_m3",resolution:5}),undefined));
  fireEvent.change(screen.getByRole("slider",{name:"Oceanography date"}),{target:{value:"1"}});
  await waitFor(()=>expect(loadSeascapeLayer).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({id:"chlorophyll_mg_m3",resolution:5}),"2024-07-02"));
  fireEvent.change(screen.getByRole("slider",{name:"Oceanography date"}),{target:{value:"2"}});
  await waitFor(()=>expect(loadSeascapeLayer).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({id:"chlorophyll_mg_m3",resolution:5}),"2026-10-25"));
  expect(await screen.findByText("No qualified values on this date · unavailable, not zero · no date substitution")).toBeInTheDocument();
  await user.click(screen.getByRole("button",{name:"Feature"}));
  await user.click(await screen.findByRole("button",{name:"Select Eastward current · HYCOM (0 m)"}));
  await waitFor(()=>expect(loadSeascapeLayer).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({id:"hycom__current_east_m_s",resolution:5}),"2024-07-02"));
  expect(screen.getByText("Date switched to 2024-07-02; this product covers 2024-07-02–2024-07-02.")).toBeInTheDocument();
});

it("opens the independent measured temperature station from the actual-location marker",async()=>{
 const user=userEvent.setup();vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);vi.mocked(loadSeascapeLayer).mockImplementation(async(_,f)=>nativeLayer(f));
 vi.mocked(hydrologyData.loadHydrologyData).mockResolvedValue({...hydrologyFixture(),stationTemperature:stationTemperatureFixture});
 render(<SeascapeMapPage/>);await user.click(await screen.findByRole("button",{name:"Hydrology layers"}));
 await user.click(await screen.findByRole("button",{name:"Inspect Fraser River at Qualark temperature station"}));
 expect(await screen.findByRole("dialog",{name:"Station water temperature"})).toHaveTextContent("DFO-QUALARK");
 expect(screen.getByText("Unavailable on this date")).toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:/Latest reported observation/}));expect(screen.getByText("16.1 °C · reported daily mean")).toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Close station water temperature"}));expect(screen.queryByRole("dialog",{name:"Station water temperature"})).not.toBeInTheDocument();
});
