import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HomePage from "./HomePage";
afterEach(() => vi.unstubAllGlobals());
it("starts paused for reduced motion and responds to preference changes", () => {
  let change = () => {};
  const media = { matches: true, addEventListener: vi.fn((_: string, callback: () => void) => { change = callback; }), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  const view = render(<HomePage onNavigate={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Play animation" })).toHaveAttribute("aria-pressed", "true");
  media.matches = false;
  act(() => change());
  expect(screen.getByRole("button", { name: "Pause animation" })).toHaveAttribute("aria-pressed", "false");
  view.unmount();
  expect(media.removeEventListener).toHaveBeenCalledWith("change", change);
});
