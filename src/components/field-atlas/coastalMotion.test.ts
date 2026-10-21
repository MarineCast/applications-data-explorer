import { describe, expect, it } from 'vitest';
import { advanceVessel, navigable } from './coastalMotion';
import { readFileSync } from 'node:fs';
import region from '../../../public/assets/home/coastal-world/region.json';
import { clampCamera, introProgress, BOAT_START, HOME_FOCUS, HOME_ZOOM, GROUND_PROJECTION } from './coastalCamera';
const world={...region,clearance:readFileSync('public/assets/home/coastal-world/clearance.bin')};
describe('coastal vessel navigation',()=>{
 it('starts in navigable water off Lime Kiln with the boat inside the landing frame',()=>{
  expect(navigable(world,BOAT_START.x,BOAT_START.z)).toBe(true);
  expect(navigable(world,HOME_FOCUS.x,HOME_FOCUS.z)).toBe(true);
  expect(Math.abs(BOAT_START.x-HOME_FOCUS.x)).toBeLessThan(62/HOME_ZOOM);
  expect(Math.abs(BOAT_START.z-HOME_FOCUS.z)).toBeLessThan(30/HOME_ZOOM/GROUND_PROJECTION);
 });
 it('keeps the complete hull away from shore and world boundaries',()=>{
  expect(navigable(world,-49,25)).toBe(true);
  expect(navigable(world,world.minX,0)).toBe(false);
  const vessel={x:-49,z:25,heading:1.8,speed:0};
  for(let i=0;i<10000;i++){
   advanceVessel(vessel,{x:Math.sin(i*.01)*45,z:Math.cos(i*.013)*30},1/60,world);
   expect(navigable(world,vessel.x,vessel.z)).toBe(true);
  }
 });
 it('extends navigable water beyond the original San Juan frame',()=>{
  expect(navigable(world,-118.54,-158.06)).toBe(true);
  expect(navigable(world,62.93,196.01)).toBe(true);
  expect(world.clearance.length).toBe(world.width*world.height);
 });
 it('connects the San Juan boat corridor to Georgia Strait and Puget Sound',()=>{
  const cell=(x:number,z:number)=>Math.floor((z-world.minZ)/(world.maxZ-world.minZ)*(world.height-1))*world.width+Math.floor((x-world.minX)/(world.maxX-world.minX)*(world.width-1));
  const targets=new Set([cell(-118.54,-158.05),cell(62.93,196.01)]);
  const visited=new Uint8Array(world.width*world.height),queue=new Int32Array(visited.length);
  let head=0,tail=1;queue[0]=cell(-49,25);visited[queue[0]]=1;
  while(head<tail&&targets.size){
   const i=queue[head++];targets.delete(i);
   for(const n of [i-1,i+1,i-world.width,i+world.width]){
    if(n<world.width||n>=visited.length-world.width-1||n%world.width===0||visited[n])continue;
    if([n,n+1,n+world.width,n+world.width+1].some(k=>world.clearance[k]*world.clearanceScale<=.65))continue;
    visited[n]=1;queue[tail++]=n;
   }
  }
  expect(targets.size).toBe(0);
 });
 it('keeps pan bounds within the regional footprint and settles the introduction',()=>{
  expect(introProgress(0)).toBe(0);expect(introProgress(5)).toBe(1);
  const bounded=clampCamera(10000,-10000,world,62,50);
  expect(bounded.x+62).toBeLessThanOrEqual(world.maxX);
  expect(bounded.z-50).toBeGreaterThanOrEqual(world.minZ);
 });
 it('keeps the whale corridor clear of the expanded islands',()=>{
  for(let t=0;t<600;t+=.2){
   const x=-52+Math.sin(t*.05)*1.2,z=18+Math.sin(t*.075)*8;
   expect(navigable(world,x,z,2)).toBe(true);
   expect(navigable(world,x+.7,z+2,1.2)).toBe(true);
  }
  expect(navigable(world,-30,12)).toBe(false);
 });
 it('is approximately frame-rate independent and decelerates without a destination',()=>{
  const a={x:-49,z:25,heading:Math.PI,speed:0},b={...a};
  for(let i=0;i<120;i++)advanceVessel(a,{x:-49,z:10},1/60,world);
  for(let i=0;i<60;i++)advanceVessel(b,{x:-49,z:10},1/30,world);
  expect(Math.abs(a.z-b.z)).toBeLessThan(.1);
  for(let i=0;i<240;i++)advanceVessel(a,null,1/60,world);
  expect(a.speed).toBeLessThan(.01);
 });
});
