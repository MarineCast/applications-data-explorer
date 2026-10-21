export type Point = {x:number;z:number};
export type Road = {points:Point[];width:number};
export type Plot = Point & {angle:number;w:number;d:number;seed:number};
export type Height = (x:number,z:number)=>number|null;
export const townRandom=(x:number,z:number)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
export function plotCorners(p:Plot,padding=0){
  const c=Math.cos(p.angle),s=Math.sin(p.angle);
  return [[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,z])=>({x:p.x+x*(p.w/2+padding)*c+z*(p.d/2+padding)*s,z:p.z-x*(p.w/2+padding)*s+z*(p.d/2+padding)*c}));
}
function segmentDistance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
/** Roads are contours of distance inland from the rendered shoreline, then linked by short lanes. */
export function planTown(height:Height,center:Point,radius:number,spacing:number,angle:number){
  const step=.24,extent=radius+2,n=Math.ceil(2*extent/step)+1,x0=center.x-extent,z0=center.z-extent;
  const distance=new Float32Array(n*n),water=new Uint8Array(n*n);
  let waterCount=0;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const h=height(x0+i*step,z0+j*step),k=j*n+i;water[k]=h===null||h<.16?1:0;distance[k]=water[k]?0:1000;waterCount+=water[k];}
  const diagonal=step*Math.SQRT2;
  for(let j=1;j<n;j++)for(let i=1;i<n-1;i++){const k=j*n+i;distance[k]=Math.min(distance[k],distance[k-1]+step,distance[k-n]+step,distance[k-n-1]+diagonal,distance[k-n+1]+diagonal);}
  for(let j=n-2;j>=0;j--)for(let i=n-2;i>0;i--){const k=j*n+i;distance[k]=Math.min(distance[k],distance[k+1]+step,distance[k+n]+step,distance[k+n-1]+diagonal,distance[k+n+1]+diagonal);}
  const roads:Road[]=[];
  const valid=(p:Point)=>{const h=height(p.x,p.z);return h!==null&&h>.16&&Math.hypot(p.x-center.x,p.z-center.z)<radius;};
  const addRoad=(points:Point[],width:number)=>{
    let run:Point[]=[];
    const flush=()=>{if(run.length>3&&run.reduce((sum,p,i)=>sum+(i?Math.hypot(p.x-run[i-1].x,p.z-run[i-1].z):0),0)>.7)roads.push({points:run,width});run=[];};
    for(const p of points){const prev=run.at(-1);if(!valid(p)||prev&&Math.abs(height(p.x,p.z)!-height(prev.x,prev.z)!)>.23){flush();continue;}run.push(p);}flush();
  };
  if(waterCount){
    // Marching squares on the inland-distance field. Join segments before smoothing, so roads follow bays.
    for(let level=.55;level<radius*.9;level+=spacing*(1.25+level*.035)){
      const nodes=new Map<string,{p:Point;links:Set<string>}>();
      const key=(p:Point)=>`${p.x.toFixed(5)}:${p.z.toFixed(5)}`;
      for(let j=1;j<n-2;j++)for(let i=1;i<n-2;i++){
        const ids=[j*n+i,j*n+i+1,(j+1)*n+i+1,(j+1)*n+i],coords=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]],cross:Point[]=[];
        for(let e=0;e<4;e++){const next=(e+1)%4,a=distance[ids[e]],b=distance[ids[next]];if((a<level)===(b<level))continue;const t=(level-a)/(b-a);cross.push({x:x0+(coords[e][0]+t*(coords[next][0]-coords[e][0]))*step,z:z0+(coords[e][1]+t*(coords[next][1]-coords[e][1]))*step});}
        for(let e=0;e+1<cross.length;e+=2){const a=cross[e],b=cross[e+1],ka=key(a),kb=key(b);if(!nodes.has(ka))nodes.set(ka,{p:a,links:new Set()});if(!nodes.has(kb))nodes.set(kb,{p:b,links:new Set()});nodes.get(ka)!.links.add(kb);nodes.get(kb)!.links.add(ka);}
      }
      const starts=[...nodes.keys()].sort((a,b)=>nodes.get(a)!.links.size-nodes.get(b)!.links.size);
      for(const start of starts){
        if(!nodes.get(start)!.links.size)continue;
        const points:Point[]=[];let current=start;
        while(true){const node=nodes.get(current)!;points.push(node.p);const next=[...node.links][0];if(!next)break;node.links.delete(next);nodes.get(next)!.links.delete(current);current=next;if(current===start){points.push(nodes.get(start)!.p);break;}}
        let smooth=points;
        for(let pass=0;pass<3;pass++)smooth=smooth.map((p,i)=>i&&i<smooth.length-1?{x:(smooth[i-1].x+p.x*2+smooth[i+1].x)/4,z:(smooth[i-1].z+p.z*2+smooth[i+1].z)/4}:p);
        addRoad(smooth,level<1?.14:.085);
      }
    }
  }
  // Inland towns and detached inland neighborhoods grow along a gently winding spine.
  if(roads.length<2){
    for(let lane=-1;lane<=1;lane++){
      const points:Point[]=[];
      for(let t=-radius;t<=radius;t+=.15){const u=t,v=lane*spacing*1.8+Math.sin(t*.65+lane)*.34;points.push({x:center.x+u*Math.cos(angle)-v*Math.sin(angle),z:center.z+u*Math.sin(angle)+v*Math.cos(angle)});}
      addRoad(points,lane===0?.13:.08);
    }
  }
  // A few cross-lanes join neighboring contours; avoid a repeating ladder or full block grid.
  const mainRoads=[...roads];
  for(let r=1;r<mainRoads.length;r++){
    const current=mainRoads[r].points;
    for(const fraction of [.21,.68]){
      const a=current[Math.floor((current.length-1)*fraction)];let nearest:Point|undefined,best=spacing*2.3;
      for(const other of mainRoads.slice(0,r))for(const b of other.points){const d=Math.hypot(a.x-b.x,a.z-b.z);if(d<best&&d>.35){best=d;nearest=b;}}
      if(!nearest)continue;
      const b=nearest,points:Point[]=[];
      for(let k=0;k<=Math.ceil(best/.12);k++){const t=k/Math.ceil(best/.12),bend=Math.sin(t*Math.PI)*.12;points.push({x:a.x+(b.x-a.x)*t+(b.z-a.z)/best*bend,z:a.z+(b.z-a.z)*t-(b.x-a.x)/best*bend});}
      addRoad(points,.075);
    }
  }
  const plots:Plot[]=[];
  for(const road of mainRoads){
    let walked=0,next=.25;
    for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.001)continue;
      while(next<walked+length){
        const t=(next-walked)/length,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
        for(const side of [-1,1]){
          const seed=townRandom(x+side*5,z),kind=townRandom(x+42,z-3);if(seed<.13)continue;
          const w=spacing*(.27+kind*.37),d=spacing*(.28+townRandom(x-8,z+2)*.44),setback=road.width/2+d/2+.08+seed*.16;
          const p:Plot={x:x-dz*side*setback,z:z+dx*side*setback,w,d,angle:Math.atan2(dz*side,-dx*side)+(seed-.5)*.13,seed};
          const corners=plotCorners(p,.035),ys=corners.map(q=>height(q.x,q.z));
          if(!valid(p)||ys.some(y=>y===null||y<.18)||Math.max(...ys as number[])-Math.min(...ys as number[])>.27)continue;
          const radiusP=Math.hypot(w,d)/2;
          if(plots.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<radiusP+Math.hypot(q.w,q.d)/2+.06))continue;
          // Keep footprints off all streets, including cross-lanes.
          if(roads.some(r=>r.points.some((q,k)=>k>0&&segmentDistance(p,r.points[k-1],q)<Math.min(w,d)*.44+r.width/2)))continue;
          plots.push(p);
        }
        next+=spacing*(.53+townRandom(x+9,z-2)*.40);
      }walked+=length;
    }
  }
  return {roads,plots};
}
