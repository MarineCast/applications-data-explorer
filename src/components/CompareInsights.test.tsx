import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import DatasetInsights from "./DatasetInsights";
import type { InsightDataset } from "./DatasetInsights";
import { summarizeBox } from "../data/compareInsights";

const left: InsightDataset = { name: "Depth", unit: "m", resolution: 8, scope: "native", values: new Map([["a", 0], ["b", 1], ["c", 2], ["d", null]]), colors: ["#123456"], metadata: [{ label: "Release", value: "depth-frozen" }] };
const right: InsightDataset = { ...left, name: "Extent", unit: "m²", values: new Map([["a", 4], ["b", 6], ["c", 8], ["d", 10]]), metadata: [{ label: "Release", value: "extent-frozen" }] };
it("uses one comparison panel with original-unit paired plots, full-pair correlations and both selected values", () => {
  render(<DatasetInsights open onOpenChange={() => {}} dataset={left} comparison={{ left, right,
    cell: { id: "a", coordinates: [48, -123], leftQualifiers: [{ label: "Coverage", value: "partial" }], rightQualifiers: [] } }} />);
  expect(screen.getAllByLabelText("Dataset insights")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Comparison Insights" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Insights layer")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Paired histograms" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Paired box plots" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Correlation scatter plot, 3 paired H3 cells/ })).toBeInTheDocument();
  expect(screen.getByLabelText("Correlation")).toHaveTextContent("Pearson r1.000Spearman ρ1.000Paired cells3Excluded cells1");
  expect(screen.getByLabelText("Insights selected cell")).toHaveTextContent("Left value0 mRight value4 m²");
  expect(screen.getByText(/Separate value axes in original units/)).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Box plots over time" })).not.toBeInTheDocument();
});
it("renders paired recorded-time boxes with unavailable support and preserves categorical fallbacks", () => {
  const box = summarizeBox([0, 2])!;
  const view = render(<DatasetInsights open onOpenChange={() => {}} dataset={left} comparison={{ left, right: { ...right, unit: "m" }, temporal: {
    loading: false, rows: [{ key: "1990", label: "1990", time: Date.parse("1990-01-01"), left: box, right: box }, { key: "1992", label: "1992", time: Date.parse("1992-01-01"), right: box }],
  } }} />);
  expect(screen.getByRole("img", { name: "Time series of paired box plots (m)" })).toHaveTextContent("1992 · Left: unavailable");
  expect(screen.queryByText("1991")).not.toBeInTheDocument();
  view.rerender(<DatasetInsights open onOpenChange={() => {}} dataset={left} comparison={{ left, right: { ...right, categorical: true, values: new Map([["a", false], ["b", true]]) } }} />);
  expect(screen.getByLabelText("Right layer summary")).toHaveTextContent("false1true1");
  expect(screen.queryByRole("img", { name: /Correlation scatter plot/ })).not.toBeInTheDocument();
  expect(screen.getByText(/require two numeric layers/)).toBeInTheDocument();
});
