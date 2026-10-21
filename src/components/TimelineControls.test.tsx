import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TimelineControls from "./TimelineControls";

afterEach(() => vi.useRealTimers());
const common = { label:"Test timeline", rangeLabel:"Test date range", format:(value:string)=>value, basisLabel:"Provider dates" };
it("generates frames from start/end/increment, shows an axis below the range and emits exact selected dates", () => {
  const change = vi.fn();
  render(<TimelineControls {...common} startDate="2024-02-28" endDate="2024-03-03" increment={{unit:"day",step:2}} value="2024-02-28" onChange={change}/>);
  const slider = screen.getByRole("slider");
  expect(slider).toHaveAttribute("max","2");
  const axis = screen.getByLabelText("Timeline date axis");
  expect(axis).toHaveTextContent("Feb 28Mar 1Mar 3");
  expect(slider.compareDocumentPosition(axis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(document.querySelector('input[type="date"]')).toBeNull();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  fireEvent.change(slider,{target:{value:"1"}});
  expect(change).toHaveBeenLastCalledWith("2024-03-01");
  fireEvent.click(screen.getByRole("button",{name:"Next period"}));
  expect(change).toHaveBeenLastCalledWith("2024-03-01");
  expect(slider).toHaveAttribute("aria-valuetext","2024-02-28 · Provider dates");
});
it("honors explicit source keys, keeping an undated All time frame and empty support distinct", () => {
  const {rerender} = render(<TimelineControls {...common} startDate="" endDate="" increment={{unit:"day"}} values={["all"]} value="all" format={()=>"All retained records"} onChange={vi.fn()}/>);
  expect(screen.getByRole("slider")).toBeDisabled();
  expect(screen.getByRole("button",{name:"Play timeline"})).toBeDisabled();
  expect(screen.getByLabelText("Selected date")).toHaveTextContent("All retained records");
  expect(screen.getByLabelText("Timeline date axis")).toHaveTextContent("All time");
  rerender(<TimelineControls {...common} startDate="" endDate="" increment={{unit:"day"}} values={[]} value="unavailable" onChange={vi.fn()}/>);
  expect(screen.getByLabelText("Selected date")).toHaveTextContent("No available periods");
  expect(within(screen.getByLabelText("Timeline date axis")).queryByText("All time")).not.toBeInTheDocument();
});
it("plays configured monthly frames and pauses when the page is hidden", () => {
  vi.useFakeTimers();
  function Host() { const [value,setValue] = useState("2024-01-31"); return <TimelineControls {...common} startDate="2024-01-31" endDate="2024-03-31" increment={{unit:"month"}} value={value} onChange={setValue}/>; }
  render(<Host/>);
  fireEvent.click(screen.getByRole("button",{name:"Play timeline"}));
  act(() => vi.advanceTimersByTime(800));
  expect(screen.getByLabelText("Selected date")).toHaveTextContent("2024-02-29");
  const hidden = vi.spyOn(document,"hidden","get").mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByLabelText("Selected date")).toHaveTextContent("2024-02-29");
  expect(screen.getByRole("button",{name:"Play timeline"})).toHaveAttribute("aria-pressed","false");
  hidden.mockRestore();
});

it("preloads only three upcoming frames and cancels outdated look-ahead", () => {
  const prefetch = vi.fn().mockResolvedValue(undefined);
  const props = {...common,startDate:"2024-01-01",endDate:"2024-01-10",increment:{unit:"day" as const},onChange:vi.fn(),onPrefetch:prefetch};
  const {rerender,unmount} = render(<TimelineControls {...props} value="2024-01-01"/>);
  expect(prefetch.mock.calls[0][0]).toEqual(["2024-01-02","2024-01-03","2024-01-04"]);
  const signal = prefetch.mock.calls[0][1];
  rerender(<TimelineControls {...props} value="2024-01-10"/>);
  expect(signal.aborted).toBe(true);
  expect(prefetch.mock.calls[1][0]).toEqual(["2024-01-01","2024-01-02","2024-01-03"]);
  unmount();
  expect(prefetch.mock.calls[1][1].aborted).toBe(true);
});
