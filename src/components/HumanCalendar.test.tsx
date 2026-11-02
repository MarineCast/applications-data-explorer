import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CivilCalendarView } from "./HumanCalendar";
import type { CivilCalendar } from "./HumanCalendar";
afterEach(cleanup);
const data: CivilCalendar = { metadata: { rules_version: "0.100", timezone_rules_version: "2026.3", temporal_support: {start:"2009-01-01",end_exclusive:"2027-01-01",as_of:"2026-07-01"}, limitations:["Convert event timestamps to local civil dates before joining."] }, rows: [
  {date:"2009-01-01",country:"US",timezone:"America/Los_Angeles",is_weekend:false,is_holiday:true,holiday_names:"New Year's Day"},
  {date:"2026-07-01",country:"US",timezone:"America/Los_Angeles",is_weekend:false,is_holiday:false,holiday_names:""},
  {date:"2026-07-01",country:"CA",timezone:"America/Vancouver",is_weekend:false,is_holiday:true,holiday_names:"Canada Day"},
  {date:"2026-11-01",country:"CA",timezone:"America/Vancouver",is_weekend:true,is_holiday:false,holiday_names:""},
  {date:"2026-12-31",country:"CA",timezone:"America/Vancouver",is_weekend:false,is_holiday:false,holiday_names:""},
] };
it("switches countries without shifting civil dates and preserves named holidays", () => {
  render(<CivilCalendarView data={data}/>);
  expect(screen.getByText("America/Los_Angeles")).toBeInTheDocument();
  expect(screen.getByText("No named holiday")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Calendar country"), {target:{value:"CA"}});
  expect(screen.getByText("America/Vancouver")).toBeInTheDocument();
  expect(screen.getByText("Canada Day")).toBeInTheDocument();
  expect(screen.getByLabelText("Calendar civil date")).toHaveValue("2026-07-01");
  fireEvent.change(screen.getByLabelText("Calendar civil date"), {target:{value:"2026-11-01"}});
  expect(screen.getByText("2026-11-01")).toBeInTheDocument();
  expect(screen.getByText("Yes")).toBeInTheDocument();
  expect(screen.getByText(/Future rule-based/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Calendar civil date"), {target:{value:"2027-01-01"}});
  expect(screen.getByRole("status")).toHaveTextContent("No calendar record");
});
