import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import MapLegend from "./MapLegend";
import { createColorScale, missingColor } from "../data/colorScale";
import type { MapLayer } from "../data/map";
const layer: MapLayer = {
  id: "depth",
  name: "Depth",
  unit: "m",
  resolution: 6,
  range: [0, 10],
  cells: [],
  values: new Map(),
  sourceLabel: "local",
};
it("preserves null and constant legend colors and dismisses settings outside the card", async () => {
  const values = new Map<string, number | null>([["a", null]]);
  const props = {
    layer,
    opacity: 0.8,
    onPalette: vi.fn(),
    onScaleMode: vi.fn(),
    onOpacity: vi.fn(),
  };
  const view = render(
    <MapLegend
      {...props}
      scale={createColorScale(values, "ocean", "minmax")}
    />,
  );
  const empty = screen.getByRole("img", { name: "No non-null values" });
  expect(empty).not.toHaveClass("continuous");
  expect(empty.children[0]).toHaveStyle({ background: missingColor });
  values.set("a", 0);
  const scale = createColorScale(values, "ocean", "minmax");
  view.rerender(<MapLegend {...props} scale={scale} />);
  const constant = screen.getByRole("img", { name: /Ten color classes/ });
  expect(constant).not.toHaveClass("continuous");
  for (const span of constant.children)
    expect(span).toHaveStyle({ background: scale.colors[5] });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Color options" }));
  const settings = screen.getByRole("dialog", { name: "Map color options" });
  expect(settings).toHaveTextContent("Constant value");
  await user.click(within(settings).getByRole("radio", { name: "Viridis" }));
  expect(props.onPalette).toHaveBeenCalledWith("viridis");
  expect(settings).toBeInTheDocument();
  await user.selectOptions(within(settings).getByRole("combobox", { name: "Coloring method" }), "quantile");
  expect(props.onScaleMode).toHaveBeenCalledWith("quantile");
  await user.click(screen.getByRole("button", { name: "Close color options" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Color options" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Color options" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Color options" }));
  await user.click(document.body);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
