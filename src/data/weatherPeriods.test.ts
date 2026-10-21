import { expect, it } from "vitest";
import { calendarFrames } from "./timeline";
import { weatherFrames, weatherFrameLabel } from "./weatherPeriods";
it("keeps complete calendar months and Monday–Sunday weeks, including leap days", () => {
  const dates = calendarFrames("2024-01-15", "2024-03-10", {unit:"day"});
  expect(weatherFrames(dates,"month")).toEqual(["month:2024-02-01"]);
  expect(weatherFrames(dates,"week").at(-1)).toBe("week:2024-03-04");
  expect(weatherFrameLabel("month:2024-02-01")).toBe("Feb 2024");
  expect(weatherFrameLabel("week:2024-03-04")).toContain("Mar 10, 2024");
});
