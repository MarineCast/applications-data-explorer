import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  window.sessionStorage.removeItem("marinecast.home.sidebar");
});

describe("home entry and navigation", () => {
  it("opens each explorer destination and returns through the brand", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("main", { name: "MarineCast home" })).toBeInTheDocument();
    expect(screen.queryByText(/An illustrated Salish Sea/)).not.toBeInTheDocument();
    for (const [label, hash, visible] of [
      ["Features", "map", "Features"],
      ["Relationships", "relationships", "Relationships"],
      ["Models", "models", "Models"],
      ["Forecasts", "forecasts", "Forecasts"],
    ]) {
      expect(screen.queryByRole("button", { name: "Page navigation" })).not.toBeInTheDocument();
      await user.click(within(screen.getByRole("navigation", { name: "Atlas destinations" })).getByRole("button", { name: label }));
      expect(screen.getByRole("button", { name: "Page navigation" })).toBeInTheDocument();
      expect(screen.getByRole("banner")).toHaveTextContent("Data Atlas");
      expect(window.location.hash).toBe(`#${hash}`);
      expect(screen.getByRole("heading", { name: visible })).toBeInTheDocument();
      await user.click(screen.getByRole("link", { name: "MarineCast home" }));
      expect(screen.getByRole("main", { name: "MarineCast home" })).toBeInTheDocument();
    }
  });

  it("opens all four main-view cards and restores Models from its URL", async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const [label, hash] of [["Features", "map"], ["Relationships", "relationships"], ["Models", "models"], ["Forecasts", "forecasts"]]) {
      const cards = screen.getByRole("navigation", { name: "Explore MarineCast" });
      await user.click(within(cards).getByRole("link", { name: new RegExp(`^${label}`) }));
      expect(window.location.hash).toBe(`#${hash}`);
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
      if (hash === "models") expect(screen.getByText("Coming soon")).toBeInTheDocument();
      await user.click(screen.getByRole("link", { name: "MarineCast home" }));
    }
    window.history.replaceState(null, "", "/#models");
    fireEvent.popState(window);
    expect(screen.getByRole("heading", { name: "Models" })).toBeInTheDocument();
  });

  it("restores the home route on a history event", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole("navigation", { name: "Atlas destinations" })).getByRole("button", { name: "Relationships" }));
    window.history.replaceState(null, "", "/#home");
    fireEvent.popState(window);
    expect(screen.getByRole("main", { name: "MarineCast home" })).toBeInTheDocument();
  });
});


describe("field atlas controls", () => {
  it("places destinations in the coastal sidebar", () => {
    render(<App />);
    expect(within(screen.getByRole("navigation", { name: "Explore MarineCast" })).getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /^Forecasts/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Data Atlas/ })).not.toBeInTheDocument();
    const destinations = screen.getByRole("navigation", { name: "Atlas destinations" });
    expect(within(destinations).getAllByRole("button").map(button => button.textContent)).toEqual([
      "Features", "Relationships", "Models", "Forecasts",
    ]);
    expect(within(destinations).queryByRole("button", { name: /Sightings/ })).not.toBeInTheDocument();

  });
  it("starts collapsed even with a previously saved expanded preference", async () => {
    window.sessionStorage.setItem("marinecast.home.sidebar", "expanded");
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("main", { name: "MarineCast home" })).toHaveClass("rail-collapsed");
    await user.click(screen.getByRole("button", { name: "Relationships" }));
    await user.click(screen.getByRole("link", { name: "MarineCast home" }));
    expect(screen.getByRole("main", { name: "MarineCast home" })).toHaveClass("rail-collapsed");
  });
  it("expands over empty sidebar space, waves and Help, then closes on leaving without pinning", async () => {
    const user = userEvent.setup();
    render(<App />);
    const home = screen.getByRole("main", { name: "MarineCast home" });
    const sidebar = screen.getByLabelText("Home sidebar");
    const waves = screen.getByRole("button", { name: "Expand sidebar" });
    const help = screen.getByRole("button", { name: "Help" });
    for (const target of [sidebar, waves, help]) {
      await user.hover(target);
      await waitFor(() => expect(home).not.toHaveClass("rail-collapsed"));
      if (target === waves) await user.click(waves);
      await user.unhover(target);
      await waitFor(() => expect(home).toHaveClass("rail-collapsed"));
    }
    await user.hover(screen.getByRole("button", { name: "Relationships" }));
    await waitFor(() => expect(home).not.toHaveClass("rail-collapsed"));
    await user.hover(help); // Staying within the sidebar must keep it open.
    expect(home).not.toHaveClass("rail-collapsed");
    await user.unhover(help);
    await waitFor(() => expect(home).toHaveClass("rail-collapsed"));
  });
  it("supports keyboard expansion, Escape and focus leaving the sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);
    const home = screen.getByRole("main", { name: "MarineCast home" });
    const waves = screen.getByRole("button", { name: "Expand sidebar" });
    waves.focus();
    await user.keyboard("{Enter}");
    expect(home).not.toHaveClass("rail-collapsed");
    await user.keyboard("{Escape}");
    expect(home).toHaveClass("rail-collapsed");
    expect(waves).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
    expect(home).not.toHaveClass("rail-collapsed");
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(home).toHaveClass("rail-collapsed");
  });
  it("keeps touch navigation usable without synthesizing hover or a saved pin", async () => {
    const user = userEvent.setup();
    render(<App />);
    const home = screen.getByRole("main", { name: "MarineCast home" });
    await user.pointer({ keys: "[TouchA>]", target: screen.getByRole("link", { name: "Home" }) });
    expect(home).toHaveClass("rail-collapsed");
    await user.pointer({ keys: "[/TouchA]" });
    await user.pointer([{ keys: "[TouchA>]", target: screen.getByRole("button", { name: "Expand sidebar" }) }, { keys: "[/TouchA]" }]);
    expect(home).not.toHaveClass("rail-collapsed");
    await user.click(screen.getByRole("button", { name: "Close sidebar" }));
    expect(home).toHaveClass("rail-collapsed");
    expect(window.sessionStorage.getItem("marinecast.home.sidebar")).toBeNull();
  });
  it("retains the original photograph beneath the optional motion canvas", () => {
    const view = render(<App />);
    const background = view.container.querySelector(".coastal-background");
    expect(background).toHaveAttribute("src", "/assets/home/salish-sea-preview.png");
    expect(view.container.querySelector("canvas.coastal-motion")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Interactive coastal scene" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Explore by boat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause animation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Page navigation" })).not.toBeInTheDocument();
    expect(view.container.querySelector(".coastal-background")).toBe(background);
  });
});
