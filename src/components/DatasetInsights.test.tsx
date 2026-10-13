import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import DatasetInsights from "./DatasetInsights";
import type { InsightDataset } from "./DatasetInsights";

it("opens source-backed statistics and selected values, updates to categories and dismisses by keyboard", async () => {
  const base: InsightDataset = { name: "Depth", unit: "m", resolution: 8, scope: "Full native area",
    values: new Map([['a', 0], ['b', 10], ['c', null]]), colors: ["#f0f7ff", "#1261ab"], metadata: [{ label: "Release", value: "frozen" }] };
  function Host({ dataset }: { dataset: InsightDataset }) {
    const [open, setOpen] = useState(false);
    return <DatasetInsights open={open} onOpenChange={setOpen} dataset={dataset}
      cell={{ id: "a", value: 0, coordinates: [48.5, -123.5] }} />;
  }
  const view = render(<Host dataset={base} />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: "Insights" });
  expect(screen.queryByLabelText("Dataset insights")).not.toBeInTheDocument();
  await user.click(trigger);
  const panel = screen.getByLabelText("Dataset insights");
  expect(panel).toHaveTextContent("H3 R8");
  expect(panel).toHaveTextContent("Mean5 mMedian5 m");
  expect(panel).toHaveTextContent("Available 2Unavailable 1");
  expect(within(panel).getByLabelText("Insights selected cell")).toHaveTextContent("0 m");
  expect(panel).toHaveTextContent("48.500000, -123.500000");
  view.rerender(<Host dataset={{ ...base, name: "Source status", categorical: true, values: new Map([['a', false], ['b', true], ['c', null]]) }} />);
  expect(panel).toHaveTextContent("Category distribution");
  expect(within(panel).queryByRole("img")).not.toBeInTheDocument();
  expect(panel).not.toHaveTextContent("Mean");
  await user.keyboard("{Escape}");
  expect(screen.queryByLabelText("Dataset insights")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
