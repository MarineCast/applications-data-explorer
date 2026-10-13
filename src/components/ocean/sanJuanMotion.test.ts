import { describe, expect, it } from 'vitest';
import { heatOpacity, islandPose, mapTransform, MAP_SIZE } from './sanJuanMotion';
describe('San Juan scene motion',()=>{
 it('covers desktop and portrait frames without stretching geographic proportions',()=>{
  for(const [w,h] of [[1672,941],[390,850],[1920,1080]]){
   const t=mapTransform(w,h);
   expect(t.x).toBeLessThanOrEqual(0);expect(t.y).toBeLessThanOrEqual(0);
   expect(t.x+MAP_SIZE.width*t.scale).toBeGreaterThanOrEqual(w-.001);
   expect(t.y+MAP_SIZE.height*t.scale).toBeGreaterThanOrEqual(h-.001);
  }
 });
 it('fully fades and returns on a smooth repeating heat cycle',()=>{
  expect(heatOpacity(0)).toBeCloseTo(.72);expect(heatOpacity(7)).toBe(0);expect(heatOpacity(14)).toBeCloseTo(.72);
 });
 it('keeps the independent subjects in their bounded western water corridors',()=>{
  for(let t=0;t<=600;t+=.5){
   const boat=islandPose(t,'boat'),buoy=islandPose(t,'buoy'),orca=islandPose(t,'orca');
   expect(boat.x).toBeGreaterThanOrEqual(100);expect(boat.x).toBeLessThanOrEqual(136);
   expect(buoy.y).toBeGreaterThan(358);expect(buoy.y).toBeLessThan(364);
   expect(orca.x).toBeGreaterThanOrEqual(125);expect(orca.y).toBeGreaterThanOrEqual(737);
  }
  expect(islandPose(0,'boat')).not.toEqual(islandPose(10,'boat'));
 });
});
