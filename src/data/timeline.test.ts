import { expect, it } from "vitest";
import { calendarFrames, timelineTickLabel, timelineTicks } from "./timeline";

it("steps date-only calendars across leap days, year boundaries and DST without shifting dates", () => {
  expect(calendarFrames("2024-02-28","2024-03-01",{unit:"day"})).toEqual(["2024-02-28","2024-02-29","2024-03-01"]);
  expect(calendarFrames("2026-03-07","2026-03-10",{unit:"day"})).toEqual(["2026-03-07","2026-03-08","2026-03-09","2026-03-10"]);
  expect(calendarFrames("2025-12-29","2026-01-15",{unit:"week"})).toEqual(["2025-12-29","2026-01-05","2026-01-12"]);
  expect(calendarFrames("2026-01-01","2026-01-06",{unit:"day",step:2})).toEqual(["2026-01-01","2026-01-03","2026-01-05"]);
});
it("clamps short months without drifting the original calendar anchor", () => {
  expect(calendarFrames("2024-01-31","2024-04-30",{unit:"month"})).toEqual(["2024-01-31","2024-02-29","2024-03-31","2024-04-30"]);
  expect(calendarFrames("2024-02-29","2028-02-29",{unit:"year",step:2})).toEqual(["2024-02-29","2026-02-28","2028-02-29"]);
});
it("does not invent frames for invalid or reversed extents or allow a zero increment", () => {
  expect(calendarFrames("2026-02-30","2026-03-01",{unit:"day"})).toEqual([]);
  expect(calendarFrames("2026-10-02","2026-10-01",{unit:"day"})).toEqual([]);
  expect(calendarFrames("","",{unit:"day"})).toEqual([]);
  expect(() => calendarFrames("2026-01-01","2026-01-03",{unit:"day",step:0})).toThrow(RangeError);
});
it("uses unique proportional tick positions including both endpoints and readable date labels", () => {
  expect(timelineTicks(0)).toEqual([]);
  expect(timelineTicks(1)).toEqual([0]);
  expect(timelineTicks(3)).toEqual([0,1,2]);
  expect(timelineTicks(6497)).toEqual([0,1624,3248,4872,6496]);
  expect(timelineTickLabel("2009-01-01","2009-01-01","2026-10-15")).toBe("2009");
  expect(timelineTickLabel("2026-10-07","2026-10-06","2026-10-08")).toBe("Oct 7");
  expect(timelineTickLabel("all","all","all")).toBe("All time");
});
