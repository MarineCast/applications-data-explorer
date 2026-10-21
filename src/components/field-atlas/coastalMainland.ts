import { BufferGeometry, Float32BufferAttribute } from 'three';

/** Art-directed eastern mainland, not surveyed topography. Shared with boat clearance. */
export const mainlandCoast = (z: number) => 44 + 3 * Math.sin(z * .09) + 1.8 * Math.sin(z * .23);
export function mainlandHeight(x: number, z: number) {
  const inland = x - mainlandCoast(z);
  if (inland < 0) return -.5;
  const peaks = [[63,-36,14,25],[74,-12,7,27],[76,24,5,30]];
  let massif = 0;
  for (const [px,pz,h,r] of peaks) {
    const distance = Math.hypot((x-px)*1.15,z-pz);
    const angle=Math.atan2(z-pz,x-px);
    const spurs=1+.18*Math.sin(angle*5+px)+.10*Math.cos(angle*9+pz);
    massif = Math.max(massif,h*Math.max(0,1-distance/(r*spurs)));
    massif += Math.max(0,1-distance/(r*1.3))*.4;
  }
  const ridge = Math.abs(Math.sin(x*.55+z*.31)+.5*Math.sin(z*.91-x*.37));
  const ravines = Math.abs(Math.sin(x*.92+z*.48+Math.sin(z*.39))*Math.sin(z*.71-x*.61))*2.3;
  const grain = Math.sin(x*2.6+z*1.7)*Math.sin(z*2.2-x*1.3)*.22;
  return Math.min(1,inland/7)*(.5+massif+ridge*.45-ravines*.35*Math.min(1,massif/5)+grain);
}
export function createMainland() {
  const positions:number[]=[],indices:number[]=[];
  const nx=150,nz=1000;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=38+i*.35,z=-300+j*.6;
    positions.push(x,mainlandHeight(x,z),z);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
export function mainlandTrees() {
  let seed=901;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const trees=[];
  for(let i=0;i<12000;i++){
    const x=41+random()*44,z=-60+random()*120,y=mainlandHeight(x,z);
    const slope=Math.hypot(mainlandHeight(x+.2,z)-mainlandHeight(x-.2,z),mainlandHeight(x,z+.2)-mainlandHeight(x,z-.2))/.4;
    if(x>mainlandCoast(z)+1&&y>.5&&y<7.5&&slope<1.8&&random()<(.42+.35*Math.sin(x*.16+Math.sin(z*.19))*Math.cos(z*.12)))
      trees.push({x,y,z,scale:.3+random()*.4,phase:random()*Math.PI*2,variant:i%3});
  }
  return trees;
}
