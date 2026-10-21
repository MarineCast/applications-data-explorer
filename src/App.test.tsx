import { beforeEach, describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import DemoMapPage from "./pages/DemoMapPage";
import { cells, valueFor, formatValue } from "./data/demo";
beforeEach(() => window.history.replaceState(null, "", "/"));
async function renderAtMap() {
  return render(<DemoMapPage />);
}
describe("frontend interactions", () => {
  it("opens page navigation from the wave icon on hover and removes header navigation links", async () => {
    window.history.replaceState(null, "", "/#health");
    const user = userEvent.setup();
    const view = render(<App />);
    const trigger = screen.getByRole("button", { name: "Page navigation" });
    expect(view.container.querySelector(".menu-button")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Atlas navigation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
    await user.hover(trigger);
    const menu = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(menu).getAllByRole("button").map(button => button.querySelector("strong")?.textContent)).toEqual([
      "Home", "Features", "Relationships", "Models", "Forecasts", "Data Health",
    ]);
    const relationship = within(menu).getByRole("button", { name: /Relationships/ });
    await user.hover(relationship);
    expect(menu).toBeVisible();
    await user.click(relationship);
    expect(window.location.hash).toBe("#relationships");
    expect(screen.getByRole("heading", { name: "Relationships" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
    await user.hover(trigger);
    await user.unhover(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });
  it("supports wave navigation by touch and keyboard, with outside and Escape dismissal", async () => {
    window.history.replaceState(null, "", "/#health");
    const user = userEvent.setup();
    render(<App />);
    const trigger = screen.getByRole("button", { name: "Page navigation" });
    await user.pointer([{ keys: "[TouchA>]", target: trigger }, { keys: "[/TouchA]", target: trigger }]);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("heading", { name: "Data Health" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("button", { name: /Home/ })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.tab();
    expect(screen.getByRole("link", { name: "MarineCast home" })).toHaveFocus();
    for (let i = 0; i < 7; i++) await user.tab();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  });
  it("shows a disconnected demo and opens a real H3 inspector", async () => {
    const user = userEvent.setup();
    await renderAtMap();
    expect(screen.getByText(/available cells · Synthetic/)).toBeInTheDocument();
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
    await renderAtMap();
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
    await renderAtMap();
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
  it.each(["models", "forecasts"])("shows %s as coming soon", (page) => {
    window.history.replaceState(null, "", `/#${page}`);
    render(<App />);
    expect(screen.getByText("Coming soon")).toBeVisible();
    expect(screen.getByRole("link", { name: "Explore Features" })).toHaveAttribute("href", "#map");
    expect(screen.queryByLabelText("X feature")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Legend" })).not.toBeInTheDocument();
  });
  it.each(["#sightings", "#sightings?species=orca"])("opens legacy %s links in Features", (hash) => {
    window.history.replaceState(null, "", `/${hash}`);
    render(<App />);
    expect(window.location.hash).toBe("#map");
    expect(screen.getByRole("heading", { name: "Features" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sightings" })).not.toBeInTheDocument();
  });
  it.each(["hashchange", "popstate"])("redirects legacy Sightings navigation on %s", (event) => {
    window.history.replaceState(null, "", "/#health");
    render(<App />);
    window.history.replaceState(null, "", "/#sightings");
    fireEvent(window, new Event(event));
    expect(window.location.hash).toBe("#map");
    expect(screen.getByRole("heading", { name: "Features" })).toBeInTheDocument();
  });
  it("supports health empty/error/retry and release comparison", async () => {
    window.history.replaceState(null, "", "/#health");
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Legend" }));
    expect(screen.getByRole("dialog", { name: "Health legend key" })).toHaveTextContent("Missing ≠ observed zero");
    await user.keyboard("{Escape}");
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
