import { createRef } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import DataDomainDock from "./DataDomainDock";

it("exposes product names and unavailability on touch while preserving product order and selection", async () => {
  const select = vi.fn();
  const user = userEvent.setup();
  render(<DataDomainDock active="seascape" open={false} available={["seascape","viewshed"]} names={{}} onSelect={select} onCollapse={vi.fn()} activeButton={createRef<HTMLButtonElement>()}>{null}</DataDomainDock>);
  const dock = screen.getByRole("navigation", {name:"Data domains"});
  const products = within(dock).getAllByRole("button").filter(button => button.getAttribute("aria-label")?.endsWith(" layers"));
  expect(products.slice(0,4).map(button => button.getAttribute("aria-label"))).toEqual(["Meteorology layers","Hydrology layers","Oceanography layers","Seascape layers"]);
  await user.click(screen.getByRole("button", {name:"Show product names"}));
  expect(dock).toHaveClass("domain-labels-open");
  expect(within(screen.getByRole("button", {name:"Hydrology layers"})).getByText("No available layers")).toBeInTheDocument();
  await user.click(screen.getByRole("button", {name:"Hydrology layers"}));
  expect(select).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", {name:"Viewshed layers"}));
  expect(select).toHaveBeenCalledExactlyOnceWith("viewshed");
  expect(dock).not.toHaveClass("domain-labels-open");
});

it.each([["loading", "Loading layers"], ["error", "Layer list unavailable"]] as const)("keeps the dock visible with accurate %s availability", async (status, message) => {
  const select = vi.fn(); const user = userEvent.setup();
  render(<DataDomainDock active="seascape" open={false} available={["viewshed"]} names={{}} availabilityStatus={status}
    onSelect={select} onCollapse={vi.fn()} activeButton={createRef<HTMLButtonElement>()}>{null}</DataDomainDock>);
  const dock = screen.getByRole("navigation", { name: "Data domains" });
  await user.click(screen.getByRole("button", { name: "Show product names" }));
  const seascape = within(dock).getByRole("button", { name: "Seascape layers" });
  expect(seascape).toHaveAttribute("aria-disabled", "true");
  expect(within(seascape).getByText(message)).toBeVisible();
  expect(within(dock).queryByText("No available layers")).not.toBeInTheDocument();
  await user.click(seascape); expect(select).not.toHaveBeenCalled();
});
