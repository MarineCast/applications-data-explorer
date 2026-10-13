/** Decorative scene coordinates, tied to the north-up coastline plate, not live observations. */
export const MAP_SIZE = { width: 1536, height: 1024 };
export function mapTransform(width: number, height: number) {
  const scale = Math.max(width / MAP_SIZE.width, height / MAP_SIZE.height);
  // Phones look into the western channel, keeping all three floating subjects visible.
  const focusX = width < 700 ? 260 : MAP_SIZE.width / 2;
  return { scale, x: Math.min(0, Math.max(width - MAP_SIZE.width * scale, width / 2 - focusX * scale)), y: (height - MAP_SIZE.height * scale) / 2 };
}
export function heatOpacity(time: number) { return .72 * Math.pow((1 + Math.cos(time * Math.PI / 7)) / 2, 2); }
export function islandPose(time: number, kind: 'boat' | 'buoy' | 'orca', index = 0) {
  if (kind === 'boat') return { x: 118 + Math.sin(time * .065) * 18, y: 510 + Math.sin(time * .13) * 20, rotation: Math.cos(time * .13) * .035 };
  if (kind === 'buoy') return { x: 365 + Math.sin(time * .7) * 2, y: 361 + Math.sin(time * 1.6) * 2.3, rotation: Math.sin(time * 1.3) * .045 };
  return { x: 151 + index * 40 + Math.sin(time * .09 + index * .25) * 26, y: 755 + index * 32 + Math.sin(time * .14 + index * .2) * 18, rotation: Math.sin(time * .14) * .075 };
}
