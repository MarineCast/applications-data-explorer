import { render, screen, within } from "@testing-library/react";
import { latLngToCell } from "h3-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { loadSeascapeCatalog, loadSeascapeLayer } from "../data/seascape";
import type {
  SeascapeCatalog,
  SeascapeFeature,
  SeascapeLayer,
} from "../data/seascape";
import SeascapeMapPage from "./SeascapeMapPage";
import type { MapCanvasProps } from "../data/map";
// Page interaction fixtures use an explicit local renderer. Production requests
// geographic cartography; its loading/failure contract is tested separately.
vi.mock("../components/MapCanvas", async (importOriginal) => {
  const { default: MapCanvas } = await importOriginal<typeof import("../components/MapCanvas")>();
  return { default: (props: MapCanvasProps) => <MapCanvas {...props} basemap="local" /> };
});
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
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("source-backed map interactions", () => {
  it("keeps Insights tied to original source values, selected cells, comparison sides and native resolution", async () => {
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    const user = userEvent.setup();
    render(<SeascapeMapPage />);
    await user.click(await screen.findByRole("button", { name: "Insights" }));
    const panel = screen.getByLabelText("Dataset insights");
    expect(panel).toHaveTextContent("Available 1Unavailable 1");
    expect(within(panel).getByText("Mean").parentElement).toHaveTextContent("0 m");
    await user.click(screen.getAllByRole("button", { name: /Inspect cell/ })[0]);
    expect(within(panel).getByLabelText("Insights selected cell")).toHaveTextContent("0 m");
    expect(within(panel).getByLabelText("Insights selected cell")).toHaveTextContent("partial source coverage");
    expect(screen.queryByLabelText("Map cell preview")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Map tools" }));
    await user.click(screen.getByRole("button", { name: "Compare" }));
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
    await user.click(screen.getByRole("button", { name: "Map layers" }));
    await user.selectOptions(screen.getByLabelText("Native H3 resolution"), "8");
    await within(panel).findByLabelText("Right layer summary");
    expect(panel).toHaveTextContent("H3 R8");
    expect(within(panel).getByLabelText("Right layer summary")).toHaveTextContent("Mean 0 m");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Close map layers" })).not.toBeInTheDocument();
    expect(panel).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Map layers" })).toHaveFocus();
    await user.keyboard("{Escape}");
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
    await user.selectOptions(await screen.findByLabelText("Data product", { exact: true }), "governance");
    expect(screen.getByLabelText("Dataset / feature")).toHaveValue(gov.id);
    expect(screen.getByText("Model-ineligible; not current law")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: `Inspect cell ${latLngToCell(48.45, -123.5, 6)}` }));
    expect(screen.getByRole("region", { name: "Map cell preview" })).toHaveTextContent("3 count");
    await user.selectOptions(screen.getByLabelText("Data product", { exact: true }), "kelp");
    expect(screen.getByLabelText("Survey year")).toHaveValue("2024");
    expect(within(screen.getByLabelText("Survey year")).queryByRole("option", { name: "1993" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Survey year"), "1989");
    await screen.findByRole("region", { name: "Map legend" });
    expect(vi.mocked(loadSeascapeLayer).mock.calls.at(-1)?.[2]).toBe("1989");
    await user.selectOptions(screen.getByLabelText("Dataset / feature"), kelpFraction.id);
    expect(screen.getByLabelText("Survey year")).toHaveValue("1989");
    await screen.findByRole("region", { name: "Map legend" });
    expect(vi.mocked(loadSeascapeLayer).mock.calls.at(-1)?.[2]).toBe("1989");
    await user.selectOptions(screen.getByLabelText("Native H3 resolution"), "8");
    expect(screen.getByLabelText("Data product", { exact: true })).toHaveValue("seascape");
    expect(screen.queryByLabelText("Survey year")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Dataset / feature"), terrain.id);
    const legend = await screen.findByRole("region", { name: "Map legend" });
    await user.click(screen.getByRole("switch", { name: "Standardize" }));
    await user.click(within(legend).getByRole("button", { name: "Color options" }));
    expect(screen.getByLabelText("Category key")).toHaveTextContent("valley");
    expect(screen.queryByRole("combobox", { name: "Coloring method" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText(/Zoom in to see native R8/)).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: `Inspect cell ${latLngToCell(48.45, -123.5, 8)}` }));
    expect(screen.getByRole("region", { name: "Map cell preview" })).toHaveTextContent("valley");
    expect(screen.getByRole("region", { name: "Map cell preview" })).not.toHaveTextContent("Standardized value");
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
    const toggle = screen.getByRole("switch", { name: "Standardize" });
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
    expect(
      screen.getByRole("region", { name: "Map cell preview" }),
    ).toHaveTextContent("Mean depth0 mStandardized value-1 z");
    await user.click(screen.getByRole("button", { name: "Source & quality" }));
    expect(
      screen.getByRole("dialog", { name: "Source & quality" }),
    ).toHaveTextContent("Mean: 5 m; std: 5 m");
    await user.click(
      screen.getByRole("button", { name: "Close source & quality" }),
    );
    await user.click(screen.getByRole("button", { name: "Map tools" }));
    await user.click(screen.getByRole("button", { name: "Compare" }));
    const rightLegend = await screen.findByRole("region", {
      name: "Right map legend",
    });
    expect(rightLegend).toHaveTextContent("z");
    const picks = await screen.findAllByRole("button", {
      name: `Inspect cell ${id}`,
    });
    await user.click(picks[1]);
    expect(
      screen.getByRole("region", { name: "Map cell preview" }),
    ).toHaveTextContent("103 mStandardized value-1 z");
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
    await user.click(screen.getByRole("button", { name: "Map tools" }));
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("dialog", { name: "Export local layer" })).toHaveTextContent("BATHYMETRY_LOCAL_ANOMALY");
    await user.click(screen.getByRole("button", { name: "Close export local layer" }));
    await user.click(screen.getByRole("button", { name: "Map layers" }));
    const restoredToggle = screen.getByRole("switch", { name: "Standardize" });
    await user.click(restoredToggle);
    expect(restoredToggle).not.toBeChecked();
    expect(rightLegend).toHaveTextContent("m");
    expect(
      screen.getByRole("region", { name: "Map cell preview" }),
    ).not.toHaveTextContent("Standardized value");
    expect(
      screen.getByRole("region", { name: "Map cell preview" }),
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
    expect(
      within(screen.getByRole("region", { name: "Map layers" })).queryByRole(
        "radiogroup",
      ),
    ).not.toBeInTheDocument();
    await user.click(
      within(legend).getByRole("button", { name: "Color options" }),
    );
    await user.click(screen.getByRole("radio", { name: "Viridis" }));
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
    expect(legend).not.toHaveTextContent("BATHYMETRY");
    expect(screen.queryByRole("region", { name: "Map layers" })).not.toBeInTheDocument();
    expect(legend).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Map layers" }));
    await user.click(
      within(legend).getByRole("button", { name: "Color options" }),
    );
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
    expect(
      screen.getByRole("region", { name: "Map cell preview" }),
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
    await user.click(screen.getByRole("button", { name: "Map tools" }));
    await user.click(screen.getByRole("button", { name: "Compare" }));
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
      screen.getByRole("region", { name: "Map cell preview" }),
    ).toHaveTextContent("3 m");
    await user.click(screen.getByRole("button", { name: "Map layers" }));
    await user.selectOptions(
      screen.getByLabelText("Native H3 resolution"),
      "8",
    );
    await user.selectOptions(
      screen.getByLabelText("Dataset / feature"),
      "TERRAIN__SLOPE",
    );
    expect(screen.getByLabelText("Dataset / feature")).toHaveValue(
      "TERRAIN__SLOPE",
    );
    await user.selectOptions(
      screen.getByLabelText("Native H3 resolution"),
      "6",
    );
    expect(screen.getByLabelText("Dataset / feature")).toHaveValue(
      "BATHYMETRY",
    );
    expect(
      within(screen.getByLabelText("Dataset / feature")).queryByRole("option", {
        name: "TERRAIN__SLOPE",
      }),
    ).not.toBeInTheDocument();
  });
  it("replaces the sidebar with a dismissible tool drawer and keeps panels exclusive", async () => {
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => nativeLayer(field));
    const user = userEvent.setup();
    const view = render(<SeascapeMapPage />);
    await screen.findByRole("region", { name: "Map legend" });
    expect(view.container.querySelector(".atlas-sidebar")).toBeNull();
    expect(screen.queryByRole("button", { name: "Compare" })).not.toBeInTheDocument();
    const tools = screen.getByRole("button", { name: "Map tools" });
    await user.click(tools);
    expect(tools).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Map tools" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
    expect(screen.queryByRole("region", { name: "Map layers" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(tools).toHaveAttribute("aria-expanded", "false");
    expect(tools).toHaveFocus();
    await user.click(tools);
    await user.click(tools);
    expect(tools).toHaveAttribute("aria-expanded", "false");
    await user.click(tools);
    await user.click(screen.getByRole("button", { name: "Color options" }));
    expect(screen.queryByRole("navigation", { name: "Map tools" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Map color options" })).toBeVisible();
    await user.click(tools);
    expect(screen.queryByRole("dialog", { name: "Map color options" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Map layers" }));
    expect(screen.getByRole("region", { name: "Map layers" })).toBeVisible();
    expect(tools).toHaveAttribute("aria-expanded", "false");
    await user.click(tools);
    await user.click(screen.getByRole("button", { name: "Map help" }));
    const help = screen.getByRole("dialog", { name: "Explore the data atlas" });
    expect(within(help).getByRole("link", { name: "© MapTiler" })).toBeVisible();
    expect(tools).toHaveAttribute("aria-expanded", "false");
  });
  it("fails visibly when source loading fails and retries without synthetic fallback", async () => {
    vi.mocked(loadSeascapeCatalog).mockRejectedValueOnce(
      new Error("Missing local source"),
    );
    vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog);
    vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) =>
      nativeLayer(field),
    );
    render(<SeascapeMapPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Missing local source",
    );
    expect(screen.queryByText(/Synthetic/)).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry local data" }));
    expect(await screen.findByLabelText("Dataset / feature")).toHaveValue(
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
    expect(
      screen.queryByRole("button", { name: "Bookmarks" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save cell" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Map cell preview" }),
    ).toHaveTextContent("0 m");
    await user.click(screen.getByRole("switch", { name: "Standardize" }));
    expect(
      within(screen.getByRole("region", { name: "Map layers" })).getByRole(
        "status",
      ),
    ).toHaveTextContent("zero standard deviation");
    await user.click(screen.getByRole("button", { name: "Map tools" }));
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
