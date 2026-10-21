import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import HydrologyHistory from "./HydrologyHistory";
import { hydrologyFixture } from "../test/hydrologyFixture";
import { hydrologyRiverColor } from "../data/hydrologyOverlay";
it("shows each river once, preserves gaps and allows date inspection without a playback slider", async () => {
  const data = hydrologyFixture();
  function Host() { const [day, setDay] = useState("2026-09-30"); return <HydrologyHistory data={data} metric="discharge_mean" day={day} onDate={setDay}/>; }
  render(<Host/>);
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", {name:"Playback speed"})).not.toBeInTheDocument();
  expect(screen.getByTestId("river-history-fraser").getAttribute("d")?.match(/M/g)).toHaveLength(2);
  expect(screen.getByTestId("river-history-fraser")).toHaveAttribute("stroke", hydrologyRiverColor("fraser"));
  expect(screen.getAllByTestId(/^river-history-/)).toHaveLength(data.rivers.length);
  const chart = screen.getByRole("img");
  fireEvent.keyDown(chart, {key:"ArrowLeft"});
  expect(screen.getByLabelText("Selected date")).toHaveTextContent("Sep 29, 2026");
  fireEvent.keyDown(chart, {key:"Home"});
  expect(screen.getByLabelText("Selected date")).toHaveTextContent("Sep 24, 2026");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", {name:"Collapse river history"}));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Selected date")).toHaveTextContent("Sep 24, 2026");
  await user.click(screen.getByRole("button", {name:"Expand river history"}));
  expect(screen.getByRole("img")).toBeInTheDocument();
});
it("keeps an uncollected river's history empty, rather than drawing zero", () => {
  render(<HydrologyHistory data={hydrologyFixture()} metric="temperature_mean" day="2026-09-30" onDate={()=>{}}/>);
  expect(screen.getByTestId("river-history-cowichan")).toHaveAttribute("d", "");
  expect(screen.getByTestId("river-history-fraser").getAttribute("d")).not.toBe("");
});
