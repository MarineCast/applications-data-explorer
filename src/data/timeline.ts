/** Calendar arithmetic for UI frames; the caller retains the source's time basis. */
export type TimelineIncrement = { unit: "day" | "week" | "month" | "year"; step?: number };
const day = 86_400_000;
function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
export function calendarFrames(startDate: string, endDate: string, increment: TimelineIncrement): string[] {
  const step = increment.step ?? 1;
  if (!Number.isSafeInteger(step) || step < 1) throw new RangeError("Timeline increment must be a positive whole number.");
  const start = parseDate(startDate), end = parseDate(endDate);
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  for (let index = 0; ; index++) {
    const offset = index * step;
    const next = new Date(start);
    if (increment.unit === "day" || increment.unit === "week") next.setTime(start.getTime() + offset * day * (increment.unit === "week" ? 7 : 1));
    else {
      next.setUTCDate(1);
      if (increment.unit === "month") next.setUTCMonth(start.getUTCMonth() + offset);
      else next.setUTCFullYear(start.getUTCFullYear() + offset);
      const last = new Date(next);
      last.setUTCMonth(last.getUTCMonth() + 1, 0);
      next.setUTCDate(Math.min(start.getUTCDate(), last.getUTCDate()));
    }
    if (!Number.isFinite(next.getTime()) || next > end) break;
    dates.push(next.toISOString().slice(0, 10));
  }
  return dates;
}
export function timelineTicks(length: number): number[] {
  if (length < 1) return [];
  const count = Math.min(length, 5);
  return [...new Set(Array.from({ length: count }, (_, i) =>
    Math.round(i * (length - 1) / Math.max(1, count - 1))))];
}
export function timelineTickLabel(value: string, first: string, last: string) {
  const calendarDate = (key: string) => parseDate(key.replace(/^(week|month):/, "").slice(0, 10));
  const date = calendarDate(value), lo = calendarDate(first), hi = calendarDate(last);
  if (!date || !lo || !hi) return value === "all" ? "All time" : value;
  const span = (hi.getTime() - lo.getTime()) / day;
  return new Intl.DateTimeFormat("en", { timeZone:"UTC", ...(span > 1461 ? { year:"numeric" as const }
    : span > 90 ? { month:"short" as const, year:"numeric" as const } : { month:"short" as const, day:"numeric" as const }) }).format(date);
}
