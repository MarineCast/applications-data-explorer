import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import WeatherTimeSlider from "./WeatherTimeSlider";
import { weatherFixture } from "../test/weatherFixture";

afterEach(() => vi.useRealTimers());

it("plays complete daily frames, pauses, stops at the end and restarts from the first date", () => {
  vi.useFakeTimers();
  function Host() {
    const [value, setValue] = useState(weatherFixture.dates[0]);
    return <WeatherTimeSlider dates={weatherFixture.dates} value={value} onChange={setValue} busy={false} />;
  }
  render(<Host />);
  const date = screen.getByLabelText("Selected date");
  expect(screen.queryByLabelText("Weather date")).not.toBeInTheDocument();
  expect(document.querySelector('input[type="date"]')).toBeNull();
  expect(screen.getByRole("button", { name:"Previous weather day" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name:"Play weather playback" }));
  act(() => vi.advanceTimersByTime(800));
  expect(date).toHaveTextContent("Oct 7, 2026");
  fireEvent.click(screen.getByRole("button", { name:"Pause weather playback" }));
  act(() => vi.advanceTimersByTime(3000));
  expect(date).toHaveTextContent("Oct 7, 2026");
  fireEvent.click(screen.getByRole("button", { name:"Play weather playback" }));
  act(() => vi.advanceTimersByTime(800));
  expect(date).toHaveTextContent("Oct 8, 2026");
  expect(screen.getByRole("button", { name:"Play weather playback" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("button", { name:"Play weather playback" }));
  expect(date).toHaveTextContent("Oct 6, 2026");
  fireEvent.change(screen.getByRole("slider",{name:"Daily weather timeline"}), {target:{value:"1"}});
  expect(date).toHaveTextContent("Oct 7, 2026");
  expect(screen.getByRole("button", {name:"Play weather playback"})).toHaveAttribute("aria-pressed", "false");
});

it("waits for the displayed day to load before advancing and releases timers on unmount", () => {
  vi.useFakeTimers();
  const change = vi.fn();
  const props = { dates:weatherFixture.dates, value:weatherFixture.dates[0], onChange:change };
  const {rerender, unmount} = render(<WeatherTimeSlider {...props} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name:"Play weather playback" }));
  rerender(<WeatherTimeSlider {...props} busy />);
  act(() => vi.advanceTimersByTime(2000));
  expect(change).not.toHaveBeenCalled();
  rerender(<WeatherTimeSlider {...props} busy={false} />);
  act(() => vi.advanceTimersByTime(800));
  expect(change).toHaveBeenCalledWith("2026-10-07");
  unmount();
  change.mockClear();
  act(() => vi.advanceTimersByTime(2000));
  expect(change).not.toHaveBeenCalled();
});
