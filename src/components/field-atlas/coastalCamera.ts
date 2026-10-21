import type { WaterGrid } from './coastalMotion';
// A lower viewing angle reveals coastal relief; use the same projection for pan and bounds.
export const CAMERA_HEIGHT = 125;
export const CAMERA_DEPTH = 115;
export const GROUND_PROJECTION = CAMERA_HEIGHT / Math.hypot(CAMERA_HEIGHT, CAMERA_DEPTH);
// Offshore of Lime Kiln Point on western San Juan Island.
export const HOME_FOCUS = { x: -45, z: 16 };
export const HOME_ZOOM = 3.2;
export const MAX_ZOOM = 6;
export const BOAT_START = { x: -44, z: 16 };
export const BOAT_SCALE = .3;
export const WAKE_SCALE = BOAT_SCALE / .65;
export function clampCamera(x:number,z:number,world:WaterGrid,halfWidth:number,halfDepth:number){
  const clamp=(v:number,lo:number,hi:number)=>lo>hi?(lo+hi)/2:Math.max(lo,Math.min(hi,v));
  return {x:clamp(x,world.minX+halfWidth,world.maxX-halfWidth),z:clamp(z,world.minZ+halfDepth,world.maxZ-halfDepth)};
}
export function introProgress(seconds:number){const t=Math.max(0,Math.min(1,seconds/5));return t*t*(3-2*t);}
