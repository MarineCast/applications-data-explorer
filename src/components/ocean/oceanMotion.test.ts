import { describe, expect, it } from "vitest";
import { coverTransform, currentAt, springStep, wrap } from "./oceanMotion";

describe("ocean simulation", () => {
  it("keeps submarine integration consistent across frame rates", () => {
    const run = (fps: number) => {
      const body = { x: 710, y: 605, vx: 0, vy: 0 };
      for (let frame = 0; frame < fps * 6; frame++) springStep(body, { x: 1000, y: 550 }, 1 / fps);
      return body;
    };
    const slow = run(15), fast = run(60);
    expect(slow.x).toBeCloseTo(fast.x, 5);
    expect(slow.y).toBeCloseTo(fast.y, 5);
    expect(fast.x).toBeCloseTo(1000, 0);
    expect(fast.y).toBeCloseTo(550, 0);
  });
  it("bounds a long frame and leaves a paused body unchanged", () => {
    const body = { x: 710, y: 605, vx: 0, vy: 0 };
    springStep(body, { x: 1000, y: 500 }, 0);
    expect(body).toEqual({ x: 710, y: 605, vx: 0, vy: 0 });
    springStep(body, { x: 1000, y: 500 }, 60);
    expect(body.x).toBeGreaterThan(710);
    expect(body.x).toBeLessThan(720);
    expect(Number.isFinite(body.vx)).toBe(true);
  });
  it("covers a portrait screen without distorting world proportions", () => {
    const { scale, x, y } = coverTransform(390, 844);
    expect(1672 * scale).toBeGreaterThan(390);
    expect(941 * scale).toBeCloseTo(844);
    expect(x).toBeLessThan(0);
    expect(y).toBe(0);
    expect(wrap(-5, 0, 100)).toBe(95);
    expect(currentAt(400, 600, 10).x).toBeGreaterThan(0);
  });
});
