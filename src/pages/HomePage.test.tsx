import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

beforeEach(() => window.history.replaceState(null, "", "/"));

describe("home entry and navigation", () => {
  it("opens each explorer destination and returns through the brand", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { name: "MARINECAST" })).toBeInTheDocument();
    expect(screen.getByText(/Illustrative artwork/)).toHaveTextContent("No data connected");
    for (const [label, hash, visible] of [
      ["Map", "map", "Map timeline"],
      ["Analyze", "relationships", "Relationships"],
      ["Sightings", "sightings", "Sightings"],
      ["Data Health", "health", "Data health"],
    ]) {
      await user.click(within(screen.getByRole("navigation", { name: "Home navigation" })).getByRole("link", { name: label }));
      expect(window.location.hash).toBe(`#${hash}`);
      if (hash === "map") expect(screen.getByRole("region", { name: visible })).toBeInTheDocument();
      else expect(screen.getByRole("heading", { name: visible })).toBeInTheDocument();
      await user.click(screen.getByRole("link", { name: "MarineCast home" }));
      expect(screen.getByRole("heading", { name: "MARINECAST" })).toBeInTheDocument();
    }
  });

  it("opens a synthetic catalog and preserves the selected static feature on the map", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Data" }));
    const catalog = screen.getByRole("dialog", { name: "Explore demo data" });
    expect(catalog).toHaveTextContent("No product files or data API connected");
    expect(within(catalog).getAllByRole("button")).toHaveLength(5);
    await user.click(within(catalog).getByRole("button", { name: /Physical viewability/ }));
    expect(screen.getByLabelText("Dataset / feature")).toHaveValue("viewability");
    expect(screen.queryByRole("slider", { name: "Map month" })).not.toBeInTheDocument();
    expect(screen.getByText(/Static feature/)).toBeInTheDocument();
  });

  it("closes the catalog and restores the home route on a history event", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Data" }));
    await user.click(screen.getByRole("button", { name: "Close data catalog" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Analyze" }));
    window.history.replaceState(null, "", "/#home");
    fireEvent.popState(window);
    expect(screen.getByRole("heading", { name: "MARINECAST" })).toBeInTheDocument();
  });
});
