import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeGridGlow from "./HomeGridGlow";
import { artworkTransform, gridCandidates } from "./homeGridMotion";

let reduced = false;
let hidden = false;
const changes = new Set<() => void>();
const frames = new Map<number, FrameRequestCallback>();
const cancelled = vi.fn();
let nextFrame = 0;
const draw = vi.fn();
const clear = vi.fn();
const observerDisconnect = vi.fn();
const stops = vi.fn();
const removeMedia = vi.fn((_: string, callback: () => void) =>
  changes.delete(callback),
);

beforeEach(() => {
  reduced = hidden = false;
  changes.clear();
  frames.clear();
  nextFrame = 0;
  vi.clearAllMocks();
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1536,
    bottom: 1024,
    width: 1536,
    height: 1024,
    toJSON() {},
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("reduced-motion") ? reduced : true;
    },
    addEventListener: (_: string, callback: () => void) =>
      changes.add(callback),
    removeEventListener: removeMedia,
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    cancelled(id);
    frames.delete(id);
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = observerDisconnect;
    },
  );
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      set src(_: string) {
        this.onload?.();
      }
    },
  );
  const pixels = new Uint8ClampedArray(1536 * 1024 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 60;
    pixels[i + 1] = 145;
    pixels[i + 2] = 185;
    pixels[i + 3] = 255;
  }
  const mockContext = {
    setTransform: vi.fn(),
    clearRect: clear,
    drawImage: draw,
    fillRect: vi.fn(),
    putImageData: vi.fn(),
    getImageData: () => ({ data: pixels }),
    createRadialGradient: () => ({ addColorStop: stops }),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((kind: string) =>
    kind === "2d" ? mockContext : null
  ) as typeof HTMLCanvasElement.prototype.getContext);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function runFrame(time: number) {
  const entry = frames.entries().next().value!;
  frames.delete(entry[0]);
  act(() => entry[1](time));
}

describe("home grid motion safeguards", () => {
  it("maps glow coordinates to the same cover crop and limits ambient twinkles", () => {
    expect(artworkTransform(1536, 1024)).toEqual({ scale: 1, x: 0, y: 0 });
    const mobile = artworkTransform(390, 844);
    expect(mobile.scale).toBeCloseTo(844 / 1024);
    expect(mobile.x).toBeCloseTo((390 - 1536 * mobile.scale) * 0.1);
    const points = gridCandidates();
    expect(points.length).toBeLessThan(950);
    expect(points.filter((p) => p.twinkles).length).toBeLessThan(
      points.length / 4,
    );
    expect(
      points.every((p) => p.x >= 330 + p.y * 0.4 && p.y >= 0 && p.y <= 1024),
    ).toBe(true);
  });

  it("disables drawing for reduced motion and handles a live preference change", () => {
    reduced = true;
    const { container, unmount } = render(
      <div>
        <HomeGridGlow />
      </div>,
    );
    const canvas = container.querySelector("canvas")!;
    expect(canvas.dataset.motion).toBe("reduced");
    expect(frames.size).toBe(0);
    reduced = false;
    act(() => changes.forEach((callback) => callback()));
    expect(canvas.dataset.motion).toBe("running");
    runFrame(1000);
    expect(draw).toHaveBeenCalled();
    reduced = true;
    act(() => changes.forEach((callback) => callback()));
    expect(canvas.dataset.motion).toBe("reduced");
    expect(frames.size).toBe(0);
    expect(clear).toHaveBeenCalled();
    unmount();
    expect(observerDisconnect).toHaveBeenCalled();
    expect(changes.size).toBe(0);
  });

  it("pauses in a hidden tab, caps rendered frames, and cancels on unmount", () => {
    const { container, unmount } = render(
      <div>
        <HomeGridGlow />
      </div>,
    );
    runFrame(1000);
    const calls = draw.mock.calls.length;
    runFrame(1010);
    expect(draw.mock.calls.length).toBe(calls);
    hidden = true;
    fireEvent(document, new Event("visibilitychange"));
    expect(container.querySelector("canvas")!.dataset.motion).toBe("paused");
    expect(frames.size).toBe(0);
    hidden = false;
    fireEvent(document, new Event("visibilitychange"));
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
    expect(cancelled).toHaveBeenCalled();
  });

  it("ignores touch input and eases mouse proximity out after leaving", () => {
    const { container } = render(
      <div>
        <HomeGridGlow />
      </div>,
    );
    const root = container.firstElementChild!;
    const move = (pointerType: string) =>
      fireEvent(
        root,
        Object.assign(new Event("pointermove"), {
          pointerType,
          clientX: 568,
          clientY: 354,
        }),
      );
    const advance = (start: number, count: number) => {
      for (let i = 0; i < count; i++) runFrame(start + i * 100);
    };
    const maximum = () =>
      Math.max(
        0,
        ...stops.mock.calls.map(([, color]) =>
          Number(String(color).match(/,([.\d]+)\)$/)?.[1] ?? 0),
        ),
      );
    move("touch");
    advance(1000, 10);
    expect(maximum()).toBeLessThanOrEqual(0.15);
    stops.mockClear();
    move("mouse");
    advance(2000, 10);
    expect(maximum()).toBeGreaterThan(0.18);
    fireEvent(root, new Event("pointerleave"));
    advance(3000, 20);
    stops.mockClear();
    advance(5000, 3);
    expect(maximum()).toBeLessThan(0.16);
  });

  it("keeps the artwork quiet while the catalog is open", () => {
    const { container } = render(
      <div>
        <HomeGridGlow paused />
      </div>,
    );
    expect(container.querySelector("canvas")!.dataset.motion).toBe("paused");
    expect(frames.size).toBe(0);
  });
});
