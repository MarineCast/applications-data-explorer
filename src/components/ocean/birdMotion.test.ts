import { describe, expect, it } from "vitest";
import { birdPose, GULL_FRAME_COUNT } from "./birdMotion";

describe("birdPose", () => {
  it("keeps every Blender frame and bank angle within render bounds", () => {
    for (let bird = 0; bird < 3; bird++) {
      for (let time = 0; time < 120; time += .17) {
        const pose = birdPose(time, bird);
        expect(pose.frame).toBeGreaterThanOrEqual(0);
        expect(pose.frame).toBeLessThan(GULL_FRAME_COUNT);
        expect(Math.abs(pose.rotation)).toBeLessThanOrEqual(.22);
        expect(Number.isFinite(pose.x + pose.y + pose.width)).toBe(true);
      }
    }
  });

  it("gives near and distant birds different directions and flap timing", () => {
    expect(birdPose(12, 0).direction).toBe(1);
    expect(birdPose(12, 1).direction).toBe(-1);
    expect(birdPose(12, 0).width).toBeGreaterThan(birdPose(12, 1).width);
    const frames = new Set(Array.from({ length: 40 }, (_, step) => birdPose(step * .08, 0).frame));
    expect(frames.size).toBeGreaterThan(3);
  });

  it("settles into the level glide pose without snapping from a mid-stroke pose", () => {
    expect(birdPose(4.1999, 0).frame).toBe(GULL_FRAME_COUNT - 1);
    expect(birdPose(4.2, 0).frame).toBe(0);
    expect(birdPose(7.9999, 0).frame).toBe(0);
    expect(birdPose(8.0001, 0).frame).toBe(0);
    expect(birdPose(1, 1).frame).not.toBe(birdPose(1, 2).frame);
  });
});
