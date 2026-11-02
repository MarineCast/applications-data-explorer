import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import HydrologyInsights from "./HydrologyInsights";
import {HydrologyOverview} from "./HydrologyControls";
import {causalHydrologyFixture,hydroCell,hydroOtherCell} from "../test/hydrologyFixture";
import {causalMetricIds} from "../data/hydrology";
afterEach(cleanup);
it("offers all eight selectors and inspects warmup, multiple rivers, dates and step plots",()=>{
 const data=causalHydrologyFixture(),onMetric=vi.fn(),onDate=vi.fn(),onRiver=vi.fn();
 const props={data,day:data.dates[0],cell:hydroCell,onMetric,onDate,onRiver};
 const view=render(<HydrologyInsights {...props} metric="causal_discharge_seasonal_mean"/>);
 expect(screen.getByText("Warmup / insufficient seasonal reference")).toBeInTheDocument();
 expect(screen.getByText(/as-of discharge date: 2026-09-23/)).toBeInTheDocument();
 expect(screen.getByText(/historical operational availability is unknown/)).toBeInTheDocument();
 expect(screen.getByText(/0 samples \/ 0 years/)).toBeInTheDocument();
 for(const metric of causalMetricIds){
  fireEvent.change(screen.getByLabelText("Hydrology insight metric"),{target:{value:metric}});expect(onMetric).toHaveBeenLastCalledWith(metric);
  view.rerender(<HydrologyInsights {...props} day={data.dates[2]} metric={metric}/>);
  expect(screen.getByLabelText("Hydrology insight metric")).toHaveValue(metric);
  expect(screen.getByRole("img")).toHaveAttribute("aria-label",expect.stringContaining("missing days remain gaps"));
 }
 view.rerender(<HydrologyInsights {...props} day={data.dates[2]} metric="causal_discharge_pulse"/>);
 expect(screen.getByTestId("hydrology-history-line").getAttribute("d")).toContain("H");
 expect(screen.getByText(/1 = witnessed upward crossing/)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText("Hydrology river"),{target:{value:"cowichan"}});expect(onRiver).toHaveBeenLastCalledWith("cowichan");
 view.rerender(<HydrologyInsights {...props} cell={hydroOtherCell} riverId="cowichan" day={data.dates[2]} metric="causal_discharge_pulse"/>);
 expect(screen.getByRole("heading",{name:"Cowichan · upstream gauge"})).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText("Hydrology insight date"),{target:{value:data.dates[1]}});expect(onDate).toHaveBeenLastCalledWith(data.dates[1]);
});
it("shows a stale companion notice while retaining the native river overview",()=>{
 const data=causalHydrologyFixture();data.causalUnavailable="Causal discharge unavailable: sources changed. Existing native metrics remain available.";
 render(<HydrologyOverview data={data} metric="discharge_mean" day={data.dates[1]} onInspect={()=>{}}/>);
 expect(screen.getByRole("alert")).toHaveTextContent("sources changed");expect(screen.getByText("Fraser")).toBeInTheDocument();
});
