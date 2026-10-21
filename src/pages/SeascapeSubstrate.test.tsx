import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { latLngToCell } from "h3-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadSeascapeCatalog, loadSeascapeLayer } from "../data/seascape";
import type { SeascapeCatalog, SeascapeFeature, SeascapeLayer } from "../data/seascape";
import SeascapeMapPage from "./SeascapeMapPage";
import { loadOrcaData } from "../data/orca";
import { loadHydrologyData } from "../data/hydrology";
import { loadRiverInfluence } from "../data/riverInfluence";

vi.mock("../data/seascape", async original => ({ ...await original<typeof import("../data/seascape")>(), loadSeascapeCatalog: vi.fn(), loadSeascapeLayer: vi.fn() }));
vi.mock("../data/orca", async original => ({ ...await original<typeof import("../data/orca")>(), loadOrcaData: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../data/hydrology", async original => ({ ...await original<typeof import("../data/hydrology")>(), loadHydrologyData: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../data/riverInfluence", async original => ({ ...await original<typeof import("../data/riverInfluence")>(), loadRiverInfluence: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../components/MapCanvas", () => ({ default: () => <div aria-label="QA map"/> }));

const omitted = ["SOURCE_OBSERVATION_DATE_STATUS", "SEDIMENT_TEXTURE_STATUS", "SAND_POINT_SAMPLE_STATUS", "SAND_MASK_STATUS", "ROCK_POINT_SAMPLE_STATUS", "ROCK_MASK_STATUS", "POINT_SUPPORT_STATUS", "MUD_POINT_SAMPLE_STATUS", "MUD_MASK_STATUS", "H3_AREAL_SUBSTRATE_COVERAGE", "GRAVEL_POINT_SAMPLE_STATUS", "GRAVEL_MASK_STATUS", "UNSUPPORTED_PHYSICAL_METRICS_REASON", "SOURCE_OBSERVATION_PERIOD", "SOURCE_GRID_DEGREES"];
function feature(native: string, family = "Substrate"): SeascapeFeature {
  const column = "SUBSTRATE_MODEL__" + native;
  return { id: "substrate_static__" + column, column, productId: "seascape-substrate-static-r6", dataset: "seascape", family,
    resolution: 6, name: native.replaceAll("_", " ").toLowerCase(), kind: "numeric", unit: "source units", range: [0, 1], available: 1, rows: 2,
    role: "source_field", qualifiers: [], sourceRelease: "current", sourcePath: "substrate-r6-static.parquet", sourceSha256: "fixture", definition: "Native source values", modelingEligibility: "not_assigned", arrowType: "double" };
}
const sand = feature("MODELED_SEDIMENT_SAND_FRACTION");
const depth: SeascapeFeature = { ...feature("BATHYMETRY", "Bathymetry"), id: "BATHYMETRY", productId: "seascape-bathymetry-static-r6" };
function catalog(features: SeascapeFeature[]) { return { features, release: "current", manifestSha256: "fixture", publishedAt: "2026-10-19" } as SeascapeCatalog; }
function layer(field: SeascapeFeature): SeascapeLayer {
  const cell = { id: latLngToCell(48.5, -123, 6), lat: 48.5, lon: -123, boundary: [], zone: "north" as const };
  return { id: field.id, name: field.name, unit: field.unit, resolution: 6, range: field.range, cells: [cell], values: new Map([[cell.id, 0]]), index: new Map([[cell.id, 0]]), field, catalog: catalog([depth, sand]), qualifiers: {}, sourceLabel: "local" };
}
beforeEach(() => { vi.mocked(loadOrcaData).mockResolvedValue(undefined); vi.mocked(loadHydrologyData).mockResolvedValue(undefined); vi.mocked(loadRiverInfluence).mockResolvedValue(undefined); });
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

it.each(omitted)("falls back from removed substrate selection %s and keeps remaining features usable", async native => {
  vi.stubGlobal("EventSource", class extends EventTarget { close() {} });
  const removed = feature(native);
  vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog([depth, removed, sand]));
  vi.mocked(loadSeascapeLayer).mockImplementation(async (_, field) => layer(field));
  const user = userEvent.setup(); render(<SeascapeMapPage/>);
  await user.click(await screen.findByRole("button", { name: "Seascape layers" }));
  await user.click(screen.getByRole("button", { name: "Family" }));
  await user.click(screen.getByRole("button", { name: "Select Substrate" }));
  await user.click(screen.getByRole("button", { name: "Feature" }));
  await user.click(screen.getByRole("button", { name: "Select " + removed.name }));
  expect(screen.getByLabelText("Feature", { exact: true })).toHaveValue(removed.id);
  vi.mocked(loadSeascapeCatalog).mockResolvedValue(catalog([depth, sand]));
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(screen.getByLabelText("Feature", { exact: true })).toHaveValue(depth.id));
  await user.click(screen.getByRole("button", { name: "Family" }));
  await user.click(screen.getByRole("button", { name: "Select Substrate" }));
  expect(screen.getByLabelText("Feature", { exact: true })).toHaveValue(sand.id);
  await user.click(screen.getByRole("button", { name: "Feature" }));
  expect(screen.getByRole("button", { name: "Select " + sand.name })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Select " + removed.name })).not.toBeInTheDocument();
});
