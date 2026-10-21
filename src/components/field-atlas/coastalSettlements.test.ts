import { expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
import { planTown, plotCorners } from './coastalTownLayout';
import { buildSettlements, terrainSampler } from './coastalSettlements';

it('interpolates actual terrain triangles and respects mesh transforms and empty water',()=>{
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([0,1,0,2,3,0,0,1,2],3));
  const terrain=new Mesh(g,new MeshBasicMaterial());terrain.position.set(10,2,20);
  const sample=terrainSampler(terrain,[{x:11,z:21,radius:3}]);
  expect(sample(10.5,20.5)).toBeCloseTo(3.5);
  expect(sample(11.8,21.8)).toBeNull();
  terrain.geometry.dispose();terrain.material.dispose();
});
it('builds every requested settlement on the shipped coastal terrain',async()=>{
  const data=readFileSync('public/assets/home/coastal-world/terrain.glb');
  const buffer=new ArrayBuffer(data.byteLength);new Uint8Array(buffer).set(data);
  const gltf=await new GLTFLoader().parseAsync(buffer,'');
  const towns=buildSettlements(gltf.scene);
  const counts=towns.group.userData.buildings as Record<string,number>;
  expect(towns.group.userData.harbors).toContain('Friday Harbor');
  expect(towns.group.userData.harbors).toContain('Victoria');
  expect(towns.group.userData.harbors).not.toContain('Sequim');
  for(const name of ['Seattle','Vancouver','Victoria','Sequim','Port Angeles','Friday Harbor'])expect(counts[name],name).toBeGreaterThan(12);
  expect(counts.Seattle).toBeGreaterThan(counts['Friday Harbor']);
  expect(towns.excludesTree(-300,300)).toBe(false);
  towns.dispose();
},20000);

it('follows a curved shoreline with varied plot headings and keeps buildings on land',()=>{
  const height=(x:number,z:number)=>x>.8*Math.sin(z*.9)+.3*Math.sin(z*.2)?.4+x*.02:-.65;
  const layout=planTown(height,{x:2,z:0},4,.65,0);
  expect(layout.roads.length).toBeGreaterThan(2);
  expect(layout.plots.length).toBeGreaterThan(10);
  expect(new Set(layout.plots.map(p=>Math.round(p.angle*10))).size).toBeGreaterThan(10);
  for(const road of layout.roads)for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i];
    expect(height((a.x+b.x)/2,(a.z+b.z)/2)).toBeGreaterThan(0);
  }
  for(const p of layout.plots)for(const corner of plotCorners(p))expect(height(corner.x,corner.z)).toBeGreaterThan(0);
  for(let i=0;i<layout.plots.length;i++)for(let j=i+1;j<layout.plots.length;j++){
    const a=layout.plots[i],b=layout.plots[j];
    expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThan(Math.hypot(a.w,a.d)/2+Math.hypot(b.w,b.d)/2);
  }
});
