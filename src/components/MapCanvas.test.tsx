import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import MapCanvas from "./MapCanvas";
import type { MapLayer } from "../data/map";

const moduleGate = vi.hoisted(() => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  return { pending, release };
});
vi.mock("./MapTilerCanvas", async () => {
  await moduleGate.pending;
  return {
    default: ({ onUnavailable }: { onUnavailable: () => void }) => (
      <section aria-label="Geographic map">
        <button onClick={onUnavailable}>Simulate basemap failure</button>
      </section>
    ),
  };
});
const layer: MapLayer = {
  id: "BATHYMETRY", name: "Bathymetry", unit: "m", range: [0, 100],
  resolution: 6, cells: [], values: new Map(), sourceLabel: "Source-backed native data",
};
afterEach(() => vi.unstubAllEnvs());

it("shows a neutral loading state until the geographic renderer loads, without illustrative geometry", async () => {
  vi.stubEnv("VITE_MAPTILER_KEY", "synthetic-test-key");
  const view = render(<MapCanvas basemap="maptiler" layer={layer} feature="temperature" month={0} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading map");
  expect(view.container.querySelector("svg")).toBeNull();
  expect(screen.queryByText(/VANCOUVER ISLAND|Synthetic|Illustrative/)).not.toBeInTheDocument();
  await act(async () => moduleGate.release());
  expect(await screen.findByRole("region", { name: "Geographic map" })).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("shows an honest missing-key state for native data rather than an illustrated substitute", () => {
  vi.stubEnv("VITE_MAPTILER_KEY", "");
  const view = render(<MapCanvas basemap="maptiler" layer={layer} feature="temperature" month={0} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Basemap key not configured");
  expect(view.container.querySelector("svg")).toBeNull();
});

it("retries a failed geographic renderer without switching to an illustrative map", async () => {
  vi.stubEnv("VITE_MAPTILER_KEY", "synthetic-test-key");
  const user = userEvent.setup();
  const view = render(<MapCanvas basemap="maptiler" layer={layer} feature="temperature" month={0} />);
  await user.click(await screen.findByRole("button", { name: "Simulate basemap failure" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Basemap unavailable");
  expect(view.container.querySelector("svg")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Retry basemap" }));
  expect(await screen.findByRole("region", { name: "Geographic map" })).toBeInTheDocument();
});

it("retains the explicitly requested local demo renderer", () => {
  render(<MapCanvas basemap="local" feature="temperature" month={0} />);
  expect(screen.getByLabelText("Illustrative Pacific Northwest map with synthetic H3 values")).toBeInTheDocument();
});
