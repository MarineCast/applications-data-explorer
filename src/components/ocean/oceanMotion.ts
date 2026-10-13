/** Decorative motion only. Coordinates are illustration pixels, never observations. */
export const WORLD = { width: 1672, height: 941 };
export function coverTransform(width: number, height: number) {
  const scale = Math.max(width / WORLD.width, height / WORLD.height);
  return { scale, x: (width - WORLD.width * scale) / 2, y: (height - WORLD.height * scale) / 2 };
}
export function wrap(value: number, min: number, max: number) {
  return min + ((value - min) % (max - min) + max - min) % (max - min);
}
export function currentAt(x: number, y: number, time: number) {
  return { x: 10 + 4 * Math.sin(y / 120 + time * .2), y: 3 * Math.sin(x / 160 + time * .35) };
}
export type Body = { x: number; y: number; vx: number; vy: number };
/** Bounded semi-implicit spring integration; subdividing keeps low-FPS motion stable. */
export function springStep(body: Body, target: { x: number; y: number }, delta: number) {
  let remaining = Math.min(Math.max(delta, 0), .1);
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120);
    body.vx += ((target.x - body.x) * 2 - body.vx * 2.8) * dt;
    body.vy += ((target.y - body.y) * 2 - body.vy * 2.8) * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    remaining -= dt;
  }
}
