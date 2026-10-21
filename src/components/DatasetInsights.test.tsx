import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import DatasetInsights from "./DatasetInsights";
import type { InsightDataset } from "./DatasetInsights";

beforeEach(() => sessionStorage.removeItem('marinecast.insights.size'));

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

it("keeps full-dataset statistics stable until visible-map scope is explicitly chosen", async () => {
  const dataset: InsightDataset = { name: "Depth", unit: "m", resolution: 6, scope: "Full native area",
    values: new Map([["a", 0], ["b", 10], ["c", null]]), visibleValues: new Map([["b", 10]]),
    colors: ["#247dcc"], metadata: [] };
  const view = render(<DatasetInsights focusSelection open onOpenChange={() => {}} dataset={dataset} />);
  const user = userEvent.setup();
  const mean = () => screen.getByText("Mean").parentElement;
  expect(mean()).toHaveTextContent("Mean5");
  view.rerender(<DatasetInsights focusSelection open onOpenChange={() => {}} dataset={{ ...dataset, visibleValues: new Map([["a", 0]]) }} />);
  expect(mean()).toHaveTextContent("Mean5");
  await user.selectOptions(screen.getByLabelText("Summary scope"), "visible");
  expect(mean()).toHaveTextContent("Mean0");
  expect(screen.getByText(/Cell centres within visible bounds/)).toBeVisible();
  expect(screen.getByLabelText("Value distribution")).not.toHaveAttribute("open");
});

it("resizes by keyboard, clamps to the legend boundary and resets without changing statistics", async () => {
  const original = HTMLElement.prototype.getBoundingClientRect;
  const rect = (x: number,y: number,width: number,height: number) => ({ x,y,width,height,left:x,top:y,right:x+width,bottom:y+height,toJSON:()=>({}) });
  const spy = vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.id === 'features-explorer') return rect(0,0,1200,800);
    if (this.classList.contains('insights-panel')) return rect(764,68,420,570);
    if (this.classList.contains('map-legends')) return rect(874,650,310,134);
    if (this.classList.contains('viewshed-bottom-dock')) return rect(874,590,310,194);
    return original.call(this);
  });
  const dataset: InsightDataset = { name:'Depth', unit:'m', resolution:6, scope:'Full native area',
    values:new Map([['a',0],['b',10]]), colors:['#247dcc'], metadata:[] };
  try {
    const view = render(<main id="features-explorer"><DatasetInsights open onOpenChange={()=>{}} dataset={dataset}/><div className="map-legends"/></main>);
    const width = screen.getByRole('separator',{name:'Resize Insights width'});
    const height = screen.getByRole('separator',{name:'Resize Insights height'});
    const initial=Number(width.getAttribute('aria-valuenow'));
    fireEvent.keyDown(width,{key:'ArrowLeft'});
    expect(Number(width.getAttribute('aria-valuenow'))).toBe(initial+16);
    fireEvent.keyDown(width,{key:'End'});
    expect(width.getAttribute('aria-valuenow')).toBe(width.getAttribute('aria-valuemax'));
    fireEvent.keyDown(width,{key:'Home'});
    expect(width.getAttribute('aria-valuenow')).toBe(width.getAttribute('aria-valuemin'));
    fireEvent.keyDown(height,{key:'End'});
    expect(Number(height.getAttribute('aria-valuenow'))).toBe(570);
    fireEvent.keyDown(height,{key:'ArrowDown',shiftKey:true});
    expect(Number(height.getAttribute('aria-valuenow'))).toBe(570);
    fireEvent.keyDown(height,{key:'Home'});
    expect(Number(height.getAttribute('aria-valuenow'))).toBe(220);
    fireEvent.click(screen.getByRole('button',{name:'Reset Insights size'}));
    expect(Number(width.getAttribute('aria-valuenow'))).toBe(420);
    expect(Number(height.getAttribute('aria-valuenow'))).toBe(420);
    expect(screen.getByText('Mean').parentElement).toHaveTextContent('5 m');
    view.rerender(<main id="features-explorer"><DatasetInsights open onOpenChange={()=>{}} dataset={dataset}/><div className="viewshed-bottom-dock"/></main>);
    await waitFor(() => expect(Number(height.getAttribute('aria-valuemax'))).toBe(510));
    expect(Number(height.getAttribute('aria-valuenow'))).toBe(420);
  } finally { spy.mockRestore(); }
});
