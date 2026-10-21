import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import WeatherInsights from "./WeatherInsights";
import { loadHourlyWeather } from "../data/meteorology";
import { weatherFixture } from "../test/weatherFixture";

vi.mock("../data/meteorology", async importOriginal => ({ ...await importOriginal<typeof import("../data/meteorology")>(), loadHourlyWeather: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it("shows the selected UTC day's hours and long-term daily summaries with explicit scope and missing support", async () => {
  const metric = weatherFixture.metrics[0].column, day = weatherFixture.dates.at(-1)!;
  vi.mocked(loadHourlyWeather).mockResolvedValue({ snapshot:weatherFixture.snapshot, date:day, metric, hourlyColumn:"TEMPERATURE_2M_C",
    values:Array.from({length:24}, (_, i) => i === 4 ? null : i), counts:Array(24).fill(2), hours:Array.from({length:24}, (_, i) => `${day}T${String(i).padStart(2,"0")}:00:00Z`) });
  const {rerender} = render(<WeatherInsights catalog={weatherFixture} day={day} metric={metric} />);
  expect(await screen.findByRole("img", {name:/Hourly weather for the selected UTC day/})).toBeVisible();
  expect(screen.getByText(/23 of 24 hours available/)).toBeVisible();
  expect(screen.getByRole("img", {name:/Long-term daily weather history/})).toBeVisible();
  expect(screen.getByText(/unweighted mean of available cells/)).toBeVisible();
  rerender(<WeatherInsights catalog={weatherFixture} day={day} metric={metric} cell={weatherFixture.cells[0]} />);
  await waitFor(() => expect(vi.mocked(loadHourlyWeather).mock.calls.at(-1)?.[4]).toBe(weatherFixture.cells[0]));
  expect(screen.getByText(/Selected native H3 cell/)).toBeVisible();
});
