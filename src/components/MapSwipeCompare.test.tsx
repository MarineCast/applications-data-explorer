import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import MapSwipeCompare from "./MapSwipeCompare";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("drags only the reveal boundary, clamps both ends, and releases captured gestures", () => {
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  });
  const start = vi.fn();
  const { container } = render(<MapSwipeCompare left={<div>Left native values</div>} right={<div>Right native values</div>} onDragStart={start} />);
  const slider = screen.getByRole("slider", { name: "Compare divider" });
  const capture = vi.fn(), release = vi.fn();
  slider.setPointerCapture = capture;
  slider.hasPointerCapture = () => true;
  slider.releasePointerCapture = release;
  vi.spyOn(slider.parentElement!, "getBoundingClientRect").mockReturnValue({ left: 100, width: 1000 } as DOMRect);
  expect(slider).toHaveAttribute("aria-valuenow", "50");
  fireEvent.pointerMove(slider, { clientX: 400, pointerId: 1 });
  expect(slider).toHaveAttribute("aria-valuenow", "50");
  fireEvent.pointerDown(slider, { clientX: 600, pointerId: 1 });
  expect(capture).toHaveBeenCalledWith(1);
  expect(slider).toHaveAttribute("aria-valuenow", "50");
  fireEvent.pointerMove(slider, { clientX: 400, pointerId: 1 });
  expect(slider).toHaveAttribute("aria-valuenow", "30");
  expect(container.querySelector<HTMLElement>(".swipe-right")?.style.clipPath).toBe("inset(0 0 0 30%)");
  fireEvent.pointerMove(slider, { clientX: 1400, pointerId: 1 });
  expect(slider).toHaveAttribute("aria-valuenow", "100");
  fireEvent.pointerUp(slider, { clientX: 0, pointerId: 1 });
  expect(slider).toHaveAttribute("aria-valuenow", "0");
  expect(release).toHaveBeenCalledWith(1);
  fireEvent.pointerMove(slider, { clientX: 900, pointerId: 1 });
  expect(slider).toHaveAttribute("aria-valuenow", "0");
  expect(start).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Left native values")).toBeInTheDocument();
  expect(screen.getByText("Right native values")).toBeInTheDocument();
});

it("supports keyboard reveals and preserves the divider position when layers change", async () => {
  const user = userEvent.setup(), start = vi.fn();
  const view = render(<MapSwipeCompare left={<div>Layer A</div>} right={<div>Layer B</div>} onDragStart={start} />);
  const slider = screen.getByRole("slider", { name: "Compare divider" });
  slider.focus();
  await user.keyboard("{ArrowRight}");
  expect(slider).toHaveAttribute("aria-valuenow", "52");
  await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
  expect(slider).toHaveAttribute("aria-valuenow", "42");
  await user.keyboard("{Home}");
  expect(slider).toHaveAttribute("aria-valuetext", "0% left layer, 100% right layer");
  await user.keyboard("{End}");
  view.rerender(<MapSwipeCompare left={<div>New source slice</div>} right={<div>Layer B</div>} onDragStart={start} />);
  expect(slider).toHaveAttribute("aria-valuenow", "100");
  expect(start).toHaveBeenCalledTimes(4);
});
