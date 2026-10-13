import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

beforeEach(() => window.history.replaceState(null, "", "/"));

describe("home entry and navigation", () => {
  it("opens each explorer destination and returns through the brand", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { name: "MarineCast" })).toBeInTheDocument();
    expect(screen.queryByText(/An illustrated Salish Sea/)).not.toBeInTheDocument();
    for (const [label, hash, visible] of [
      ["Features", "map", "Features"],
      ["Relationships", "relationships", "Relationships"],
      ["Sightings", "sightings", "Sightings"],
      ["Health", "health", "Health"],
    ]) {
      await user.click(screen.getByRole("button", { name: "Page navigation" }));
      const menu = screen.getByRole("navigation", { name: "Main navigation" });
      expect(within(menu).getAllByRole("button").map(button => button.querySelector("strong")?.textContent)).toEqual([
        "Home", "Features", "Sightings", "Relationships", "Viewshed", "Health",
      ]);
      expect(menu).not.toHaveTextContent("Map: local Data products");
      expect(screen.queryByRole("navigation", { name: "Home navigation" })).not.toBeInTheDocument();
      await user.click(within(menu).getByRole("button", { name: new RegExp(`^${label}`) }));
      expect(screen.getByRole("button", { name: "Page navigation" })).toBeInTheDocument();
      expect(screen.getByRole("banner")).toHaveTextContent("Data Atlas");
      expect(window.location.hash).toBe(`#${hash}`);
      expect(screen.getByRole("heading", { name: visible })).toBeInTheDocument();
      await user.click(screen.getByRole("link", { name: "MarineCast home" }));
      expect(screen.getByRole("heading", { name: "MarineCast" })).toBeInTheDocument();
    }
  });

  it("previews the stationary lookout on keyboard focus and opens Viewshed", async () => {
    const user = userEvent.setup();
    render(<App />);
    const lookout = screen.getByRole("button", { name: "Open Viewshed from the lookout" });
    fireEvent.focus(lookout);
    expect(screen.getByText("Illustrative viewing fan")).toBeInTheDocument();
    expect(lookout).toHaveAttribute("aria-describedby", "lookout-description");
    fireEvent.blur(lookout);
    expect(screen.queryByText("Illustrative viewing fan")).not.toBeInTheDocument();
    await user.click(lookout);
    expect(window.location.hash).toBe("#viewshed");
  });

  it("restores the home route on a history event", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Page navigation" }));
    await user.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("button", { name: /Relationships/ }));
    window.history.replaceState(null, "", "/#home");
    fireEvent.popState(window);
    expect(screen.getByRole("heading", { name: "MarineCast" })).toBeInTheDocument();
  });
});


describe("field atlas controls", () => {
  it("keeps floating destination cards off the ocean scene", () => {
    render(<App />);
    expect(screen.queryByRole("navigation", { name: "Explore MarineCast" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Data Health/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Data Atlas/ })).not.toBeInTheDocument();
    expect(screen.queryByText("UNDERSTAND")).not.toBeInTheDocument();
    expect(screen.queryByText("PROTECT")).not.toBeInTheDocument();
  });
  it("preserves the user pause choice after closing the menu", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Pause animation" }));
    expect(screen.getByRole("button", { name: "Play animation" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Page navigation" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Page navigation" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Play animation" })).toHaveAttribute("aria-pressed", "true");
  });
});
