export type WeatherPeriod = "day" | "week" | "month";
export function parseWeatherFrame(key: string): { period: WeatherPeriod; date: string } {
  const match = /^(week|month):(\d{4}-\d{2}-\d{2})$/.exec(key);
  return match ? { period: match[1] as WeatherPeriod, date: match[2] } : { period: "day", date: key };
}
export function periodEnd(date: string, period: WeatherPeriod) {
  const end = new Date(`${date}T00:00:00Z`);
  if (period === "week") end.setUTCDate(end.getUTCDate() + 6);
  if (period === "month") end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return end.toISOString().slice(0, 10);
}
/** Only whole calendar periods within retained coverage; internal nulls remain unavailable. */
export function weatherFrames(dates: readonly string[], period: WeatherPeriod): string[] {
  if (period === "day") return [...dates];
  return dates.filter(date => (period === "week" ? new Date(`${date}T00:00:00Z`).getUTCDay() === 1 : date.endsWith("-01"))
    && periodEnd(date, period) <= dates.at(-1)!).map(date => `${period}:${date}`);
}
export function weatherFrameLabel(key: string) {
  const { period, date } = parseWeatherFrame(key);
  const format = (value: string) => new Intl.DateTimeFormat("en", { timeZone:"UTC",month:"short",day:"numeric",year:"numeric" }).format(new Date(`${value}T00:00:00Z`));
  return period === "day" ? format(date) : period === "month"
    ? new Intl.DateTimeFormat("en", { timeZone:"UTC",month:"short",year:"numeric" }).format(new Date(`${date}T00:00:00Z`))
    : `${format(date).replace(/, \d{4}$/, "")} – ${format(periodEnd(date, period))}`;
}
