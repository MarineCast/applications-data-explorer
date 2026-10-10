import { beforeEach, describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { cells, valueFor, formatValue } from "./data/demo";
beforeEach(() => window.history.replaceState(null, "", "/"));
function renderAtMap() {
  window.history.replaceState(null, "", "/#map");
  return render(<App />);
}
async function navigate(name: string) {
  const user = userEvent.setup();
  if (screen.queryByRole("navigation", { name: "Home navigation" }))
    await user.click(screen.getByRole("link", { name: "Map" }));
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  await user.click(
    within(screen.getByRole("navigation")).getByRole("button", {
      name: new RegExp(name),
    }),
  );
  return user;
}
describe("frontend interactions", () => {
  it("shows a disconnected demo and opens a real H3 inspector", async () => {
    const user = userEvent.setup();
    renderAtMap();
    expect(screen.getByText(/No data connected/)).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: /Inspect cell/ })[0],
    );
    expect(
      screen.getByRole("region", { name: "Selected cell" }),
    ).toHaveTextContent("Synthetic / unvalidated");
    await user.click(
      screen.getByRole("button", { name: "Close cell inspector" }),
    );
    expect(
      screen.getByRole("region", { name: "Regional summary" }),
    ).toBeInTheDocument();
  });
  it("changes months, toggles comparison, and hides time for static features", async () => {
    const user = userEvent.setup();
    renderAtMap();
    await user.click(screen.getByRole("button", { name: "Show Oct 2026" }));
    expect(
      screen.getByRole("region", { name: "Map timeline" }),
    ).toHaveTextContent("Oct 2026");
    await user.click(screen.getByRole("button", { name: "Compare layers" }));
    expect(screen.getByLabelText("Right map feature")).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Dataset / feature"),
      "viewability",
    );
    expect(
      screen.queryByRole("slider", { name: "Map month" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Static feature/)).toBeInTheDocument();
  });
  it("keeps inspection feature and date tied to the selected comparison map", async () => {
    const user = userEvent.setup();
    renderAtMap();
    await user.click(screen.getByRole("button", { name: "Compare layers" }));
    const pick = async (side: number) =>
      user.click(
        screen.getAllByRole("button", { name: `Inspect cell ${cells[0].id}` })[
          side
        ],
      );
    const inspector = () =>
      screen.getByRole("region", { name: "Selected cell" });
    await pick(1);
    expect(inspector()).toHaveTextContent(
      "Right map · Chlorophyll concentration · Jan 2026",
    );
    expect(inspector()).toHaveTextContent(
      formatValue(valueFor(cells[0], "chlorophyll", 0), "chlorophyll"),
    );
    await user.selectOptions(screen.getByLabelText("Right map date"), "2");
    expect(inspector()).toHaveTextContent(
      "Right map · Chlorophyll concentration · Mar 2026",
    );
    expect(inspector()).toHaveTextContent(
      formatValue(valueFor(cells[0], "chlorophyll", 2), "chlorophyll"),
    );
    await user.selectOptions(
      screen.getByLabelText("Dataset / feature"),
      "traffic",
    );
    expect(inspector()).toHaveTextContent(
      "Right map · Chlorophyll concentration · Mar 2026",
    );
    await pick(0);
    expect(inspector()).toHaveTextContent(
      "Left map · Vessel activity · Jul 2026",
    );
    await user.click(screen.getByRole("button", { name: "Show Oct 2026" }));
    expect(inspector()).toHaveTextContent(
      "Left map · Vessel activity · Oct 2026",
    );
    await pick(1);
    expect(inspector()).toHaveTextContent(
      "Right map · Chlorophyll concentration · Mar 2026",
    );
    await user.selectOptions(
      screen.getByLabelText("Right map feature"),
      "viewability",
    );
    expect(inspector()).toHaveTextContent(
      "Right map · Physical viewability · Static demo",
    );
    await user.click(screen.getByRole("button", { name: "Close comparison" }));
    expect(
      screen.queryByRole("region", { name: "Selected cell" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: `Inspect cell ${cells[0].id}` }),
    );
    expect(inspector()).toHaveTextContent("Vessel activity · Oct 2026");
  });
  it("navigates and changes relationship pairs from the matrix", async () => {
    render(<App />);
    const user = await navigate("Relationships");
    await user.click(
      screen.getByRole("button", {
        name: "Compare Vessel activity with Viewability",
      }),
    );
    expect(screen.getByLabelText("X feature")).toHaveValue("traffic");
    expect(screen.getByLabelText("Y feature")).toHaveValue("viewability");
    await user.selectOptions(screen.getByLabelText("Season"), "summer");
    expect(screen.getByLabelText("Season")).toHaveValue("summer");
  });
  it("filters sightings and handles an empty combination", async () => {
    render(<App />);
    const user = await navigate("Sightings");
    await user.selectOptions(screen.getByLabelText("Species"), "orca");
    await user.selectOptions(screen.getByLabelText("Season"), "summer");
    await user.selectOptions(screen.getByLabelText("Encounter"), "single");
    expect(screen.getByRole("status")).toHaveTextContent(
      "No demo encounters match",
    );
  });
  it("supports health empty/error/retry and release comparison", async () => {
    render(<App />);
    const user = await navigate("Data health");
    await user.selectOptions(screen.getByLabelText("Demo state"), "empty");
    expect(screen.getByRole("status")).toHaveTextContent(
      "No products available",
    );
    await user.selectOptions(screen.getByLabelText("Demo state"), "error");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "no file or API request",
    );
    await user.click(screen.getByRole("button", { name: "Retry demo" }));
    await user.click(screen.getByRole("button", { name: "Compare releases" }));
    expect(
      screen.getByRole("heading", { name: "Release comparison" }),
    ).toBeInTheDocument();
  });
});
