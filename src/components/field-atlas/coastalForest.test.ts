import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { decodeForest, forestDetail } from './coastalForest';
import { terrainSampler } from './coastalSettlements';

it('rejects truncated or invalid forest records and bounds distant detail',()=>{
  const record=new Float32Array([1,2,3,.5,0,1]);
  expect(decodeForest(record.buffer,1)).toHaveLength(6);
  expect(()=>decodeForest(record.buffer,2)).toThrow('Incomplete');
  record[5]=4;expect(()=>decodeForest(record.buffer,1)).toThrow('Invalid');
  expect(forestDetail(3.2)).toEqual({distant:false,fraction:1,canopyScale:1});
  expect(forestDetail(.3).fraction).toBeGreaterThan(0);
  expect(forestDetail(.3).canopyScale).toBeLessThanOrEqual(3.4);
});

it('ships dense regional forests and Olympic, Baker and Canadian mountain relief',async()=>{
  const meta=JSON.parse(readFileSync('public/assets/home/coastal-world/world.json','utf8'));
  const file=readFileSync('public/assets/home/coastal-world/forest.bin');
  const buffer=new ArrayBuffer(file.byteLength);new Uint8Array(buffer).set(file);
  const trees=decodeForest(buffer,meta.treeCount);
  // Broad lowland regions outside the San Juan inset must have substantial forest.
  for(const [name,x0,x1,z0,z1] of [
    ['Vancouver Island',-200,-110,-100,0],['Olympic Peninsula',-170,-30,95,260],
    ['Eastern mainland',55,140,-70,80],['Canadian mainland',-80,100,-260,-150],
  ] as const){
    let count=0;for(let i=0;i<trees.length;i+=6)if(trees[i]>x0&&trees[i]<x1&&trees[i+2]>z0&&trees[i+2]<z1)count++;
    expect(count,name).toBeGreaterThan(2500);
  }
  const terrain=readFileSync('public/assets/home/coastal-world/terrain.glb');
  const glb=new ArrayBuffer(terrain.byteLength);new Uint8Array(glb).set(terrain);
  const scene=(await new GLTFLoader().parseAsync(glb,'')).scene;
  const anchors=[{name:'Olympus',x:-120,z:174},{name:'Olympic eastern ridges',x:-51,z:172},
    {name:'Baker in-bounds slopes',x:153,z:-42},{name:'Garibaldi',x:-16,z:-280}];
  const height=terrainSampler(scene,anchors.map(p=>({...p,radius:2})));
  for(const p of anchors)expect(height(p.x,p.z),p.name).toBeGreaterThan(12);
  const roots=Array.from({length:100},(_,i)=>{const offset=Math.floor(i*meta.treeCount/100)*6;return {x:trees[offset],y:trees[offset+1],z:trees[offset+2],radius:1};});
  const ground=terrainSampler(scene,roots);
  for(const root of roots)expect(ground(root.x,root.z)).toBeCloseTo(root.y,2);
  expect(meta.minX).toBeCloseTo(-381.951219512,5);
  expect(meta.maxX).toBeCloseTo(159.512195122,5);
},20000);
