export type WaterGrid = { width: number; height: number; minX:number;maxX:number;minZ:number;maxZ:number;clearanceScale:number;clearance: ArrayLike<number> };
export type Vessel = { x: number; z: number; heading: number; speed: number };
/** World units: 10 source-art pixels. Height/clearance are illustrative, not metres. */
export function navigable(grid: WaterGrid, x: number, z: number, radius = .65) {
  const col = (x-grid.minX)/(grid.maxX-grid.minX)*(grid.width-1), row = (z-grid.minZ)/(grid.maxZ-grid.minZ)*(grid.height-1);
  if (col < 2 || row < 2 || col >= grid.width - 2 || row >= grid.height - 2) return false;
  const i = Math.floor(col), j = Math.floor(row);
  return [0, 1, grid.width, grid.width + 1].every(offset => grid.clearance[j * grid.width + i + offset]*grid.clearanceScale > radius);
}
export function advanceVessel(v: Vessel, target: { x: number; z: number } | null, dt: number, grid: WaterGrid) {
  const distance = target ? Math.hypot(target.x - v.x, target.z - v.z) : 0;
  if (target && distance > .5) {
    const desired = Math.atan2(target.x - v.x, target.z - v.z);
    const angle = Math.atan2(Math.sin(desired - v.heading), Math.cos(desired - v.heading));
    v.heading += Math.max(-dt * 1.3, Math.min(dt * 1.3, angle));
  }
  const desiredSpeed = distance > 1.3 ? Math.min(5, distance) : 0;
  v.speed += (desiredSpeed - v.speed) * Math.min(1, dt * 1.8);
  const x = v.x + Math.sin(v.heading) * v.speed * dt, z = v.z + Math.cos(v.heading) * v.speed * dt;
  const steps=Math.max(1,Math.ceil(Math.hypot(x-v.x,z-v.z)/.25));
  const clear=Array.from({length:steps},(_,i)=>(i+1)/steps).every(t=>navigable(grid,v.x+(x-v.x)*t,v.z+(z-v.z)*t));
  if (clear) { v.x = x; v.z = z; } else v.speed = 0;
}
