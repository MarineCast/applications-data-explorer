import { WORLD, wrap } from "./oceanMotion";

export const GULL_FRAME_COUNT = 32;

export type BirdPose = {
  x: number;
  y: number;
  width: number;
  direction: 1 | -1;
  rotation: number;
  frame: number;
  alpha: number;
};

const birdProfiles = [
  { direction: 1 as const, speed: .0145, offset: .29, y: 137, width: 155, amplitude: 24, cycle: 8, alpha: .95 },
  { direction: -1 as const, speed: .0092, offset: .04, y: 194, width: 60, amplitude: 13, cycle: 9.3, alpha: .78 },
  { direction: 1 as const, speed: .0068, offset: .66, y: 218, width: 40, amplitude: 8, cycle: 10.1, alpha: .63 },
];

/** Decorative gull flight in illustration coordinates, authored from Blender wing poses. */
export function birdPose(time: number, index: number): BirdPose {
  const profile = birdProfiles[index % birdProfiles.length];
  const margin = 150;
  const distance = WORLD.width + margin * 2;
  const progress = wrap(time * profile.speed + profile.offset, 0, 1);
  const travel = -margin + progress * distance;
  const x = profile.direction === 1 ? travel : WORLD.width - travel;
  const arc = progress * Math.PI * 2;
  const ripple = time * .34 + index * 1.9;
  const y = profile.y + Math.sin(arc * 1.25 + index * .8) * profile.amplitude + Math.sin(ripple) * 3.5;
  const vx = distance * profile.speed;
  const vy = Math.cos(arc * 1.25 + index * .8) * profile.amplitude * Math.PI * 2 * 1.25 * profile.speed
    + Math.cos(ripple) * 3.5 * .34;
  const rotation = Math.max(-.22, Math.min(.22, Math.atan2(vy, vx) * profile.direction * .72));
  const scale = .92 + Math.sin(arc + index) * .08;

  // Six complete wingbeats settle into level glide. Integrated speed ramps let
  // the wings enter/leave the glide pose continuously, without a frame snap.
  const strokeTime = wrap(time + index * 2.13, 0, profile.cycle);
  const active = 4.2, ramp = .42;
  const t = Math.min(strokeTime, active);
  const integrated = t < ramp ? t * t / (2 * ramp)
    : t > active - ramp ? active - ramp - (active - t) ** 2 / (2 * ramp)
      : t - ramp / 2;
  const flapProgress = strokeTime >= active ? 0 : wrap(integrated / (active - ramp) * 6, 0, 1);
  const frame = Math.floor(flapProgress * GULL_FRAME_COUNT) % GULL_FRAME_COUNT;

  return { x, y, width: profile.width * scale, direction: profile.direction, rotation, frame, alpha: profile.alpha };
}
