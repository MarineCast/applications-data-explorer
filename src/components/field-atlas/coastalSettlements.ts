import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { planTown, plotCorners, townRandom } from './coastalTownLayout';
import { coastalCities } from './coastalPlaces';

type Triangle = [number,number,number,number,number,number,number,number,number];
type Site = {text:string;x:number;z:number;radius:number;spacing:number;angle:number;skyline:boolean;harbor:boolean};
type Part = {x:number;y:number;z:number;w:number;h:number;d:number;angle:number;color:string};
type Rect = {left:number;right:number;top:number;bottom:number};
const configs:Record<string,[number,number,number,boolean,boolean]>={
  Vancouver:[11,1.15,.2,true,true],Seattle:[10,1.1,-.2,true,true],
  Victoria:[6,.85,.1,false,true],Nanaimo:[4.6,.85,-.4,false,true],Tacoma:[6.5,1.05,.2,true,true],
  Bellingham:[5.3,.95,-.2,false,true],Everett:[5.2,1,.1,false,true],Olympia:[4.5,.9,.1,false,true],
  'Port Angeles':[4.5,.82,0,false,true],Sequim:[3.7,.8,.05,false,false],
  'Friday Harbor':[2.8,.64,-.5,false,true],'Port Townsend':[3.5,.8,.35,false,true],Anacortes:[4.2,.85,.1,false,true],
};
const sites:Site[]=coastalCities.filter(c=>configs[c.text]).map(c=>{const [radius,spacing,angle,skyline,harbor]=configs[c.text];return {...c,radius,spacing,angle,skyline,harbor};});
const lime=coastalCities.find(c=>c.text==='Lime Kiln Point')!;

/** Sparse triangle index: samples the actual rendered mesh, including its shoreline and transform. */
export function terrainSampler(terrain:Object3D,areas:{x:number;z:number;radius:number}[]){
  const buckets=new Map<string,Triangle[]>(),cell=2;
  for(const a of areas)for(let x=Math.floor((a.x-a.radius)/cell);x<=Math.floor((a.x+a.radius)/cell);x++)for(let z=Math.floor((a.z-a.radius)/cell);z<=Math.floor((a.z+a.radius)/cell);z++)buckets.set(`${x}:${z}`,[]);
  const a=new Vector3(),b=new Vector3(),c=new Vector3();terrain.updateMatrixWorld(true);
  terrain.traverse(node=>{
    if(!(node instanceof Mesh))return;
    const position=node.geometry.getAttribute('position'),index=node.geometry.index,count=index?index.count:position.count;
    for(let i=0;i<count;i+=3){
      a.fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(node.matrixWorld);
      b.fromBufferAttribute(position,index?index.getX(i+1):i+1).applyMatrix4(node.matrixWorld);
      c.fromBufferAttribute(position,index?index.getX(i+2):i+2).applyMatrix4(node.matrixWorld);
      const x0=Math.floor(Math.min(a.x,b.x,c.x)/cell),x1=Math.floor(Math.max(a.x,b.x,c.x)/cell),z0=Math.floor(Math.min(a.z,b.z,c.z)/cell),z1=Math.floor(Math.max(a.z,b.z,c.z)/cell);
      let triangle:Triangle|undefined;
      for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
        const bucket=buckets.get(`${x}:${z}`);if(!bucket)continue;
        triangle??=[a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z];bucket.push(triangle);
      }
    }
  });
  return (x:number,z:number):number|null=>{
    for(const [ax,ay,az,bx,by,bz,cx,cy,cz] of buckets.get(`${Math.floor(x/cell)}:${Math.floor(z/cell)}`)??[]){
      const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-10)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den;
      if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)return u*ay+v*by+(1-u-v)*cy;
    }return null;
  };
}
function roofGeometry(){
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute([-.5,0,-.5,.5,0,-.5,0,1,-.5,-.5,0,.5,.5,0,.5,0,1,.5],3));
  g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
}
/** Art-directed miniature settlements; neither building footprints nor population data. */
export function buildSettlements(terrain:Object3D){
  const height=terrainSampler(terrain,[...sites.map(s=>({...s,radius:s.radius+5})),{...lime,radius:3}]);
  const group=new Group();group.name='Coastal towns and cities';
  const boxes:Part[]=[],roofs:Part[]=[],hipRoofs:Part[]=[],windows:Part[]=[],decks:Part[]=[],roads:number[]=[],roadIndices:number[]=[];
  const clearings=new Map<string,Rect[]>(),stats:Record<string,number>={},harbors:string[]=[];
  const layouts:Record<string,ReturnType<typeof planTown>>={};
  const clear=(x:number,z:number,w:number,d:number)=>{
    const rect={left:x-w/2,right:x+w/2,top:z-d/2,bottom:z+d/2};
    for(let i=Math.floor(rect.left);i<=Math.floor(rect.right);i++)for(let j=Math.floor(rect.top);j<=Math.floor(rect.bottom);j++){const key=`${i}:${j}`,entries=clearings.get(key)??[];entries.push(rect);clearings.set(key,entries);}
  };
  const part=(target:Part[],x:number,y:number,z:number,w:number,h:number,d:number,angle:number,color:string)=>target.push({x,y,z,w,h,d,angle,color});
  const nearestLand=(x:number,z:number,limit:number)=>{
    const y=height(x,z);if(y!==null&&y>.2)return {x,z,y};
    for(let r=.2;r<limit;r+=.2)for(let a=0;a<Math.PI*2;a+=Math.PI/12){const px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r,py=height(px,pz);if(py!==null&&py>.2)return {x:px,z:pz,y:py};}
    return null;
  };
  for(const site of sites){
    const center=nearestLand(site.x,site.z,3);if(!center){stats[site.text]=0;continue;}
    const layout=planTown(height,center,site.radius,site.spacing,site.angle);layouts[site.text]=layout;
    stats[site.text]=layout.plots.length;
    for(const p of layout.plots){
      const {w,d,angle,seed}=p,c=Math.cos(angle),sn=Math.sin(angle);
      const ys=plotCorners(p).map(q=>height(q.x,q.z)!),lo=Math.min(...ys),base=Math.max(...ys)+.018;
      const r=Math.hypot(p.x-center.x,p.z-center.z)/site.radius;
      const kind=townRandom(p.x+51,p.z-17),tone=townRandom(p.x-28,p.z+7);
      const tower=site.skyline&&r<.5&&seed>.48;
      const shop=!tower&&kind>.28&&kind<.5,workshop=!tower&&kind>=.5&&kind<.66;
      const h=tower?.85+(1-r)*seed*2.1:workshop?.16+seed*.12:shop?.32+seed*.25:.16+seed*.24;
      const wall=['#c3b9a1','#9ca99e','#ae9b83','#a4a49a','#b5b1a0','#8a9d9c'][Math.floor(tone*6)];
      const roof=['#424e4c','#69534a','#5b6862','#795447','#6d7167'][Math.floor(townRandom(p.x+7,p.z)*5)];
      const at=(x:number,z:number)=>({x:p.x+x*c+z*sn,z:p.z-x*sn+z*c});
      const box=(x:number,y:number,z:number,bw:number,bh:number,bd:number,color:string)=>{const q=at(x,z);part(boxes,q.x,y,q.z,bw,bh,bd,angle,color);};
      const pitched=(x:number,z:number,bw:number,bd:number,top:number,rise:number,hip=false)=>{const q=at(x,z);part(hip?hipRoofs:roofs,q.x,top,q.z,bw,rise,bd,angle,roof);};
      if(base-lo>.04)box(0,(lo+base)/2,0,w*1.04,base-lo,d*1.04,'#85887b');
      if(tower){
        box(0,base+.12,0,w,.24,d,wall);
        box(0,base+h/2,0,w*.73,h,d*.78,wall);
        box(0,base+h+.055,0,w*.78,.11,d*.83,roof);
        box(-w*.08,base+h+.17,0,w*.36,.2,d*.4,'#65736e');
      }else if(kind>.72&&kind<.9){
        // An L-shaped cottage with a lower side wing, rather than another identical box.
        box(-w*.17,base+h/2,0,w*.66,h,d,wall);pitched(-w*.17,0,w*.72,d*1.09,base+h,.11+seed*.1);
        box(w*.32,base+h*.34,-d*.2,w*.36,h*.68,d*.6,wall);pitched(w*.32,-d*.2,w*.42,d*.68,base+h*.68,.09);
      }else{
        box(0,base+h/2,0,w,h,d,wall);
        if(shop&&seed>.55){box(0,base+h+.022,0,w*1.04,.044,d*1.04,roof);box(-w*.23,base+h+.065,-d*.18,w*.16,.06,d*.18,'#696e65');}
        else pitched(0,0,w*1.1,d*1.08,base+h,(workshop?.07:.1)+seed*.11,kind>.9);
      }
      // Individually spaced windows and doors; façades face their own street, not a global axis.
      const front=tower?d*.393:d*.505,facade=tower?w*.73:kind>.72&&kind<.9?w*.66:w;
      const shift=kind>.72&&kind<.9?-w*.17:0,columns=shop?3:2;
      for(let floor=.12;floor<h-.025;floor+=tower?.22:.19)for(let col=0;col<columns;col++){
        const x=shift+((col+.5)/columns-.5)*facade*.72,q=at(x,front);
        part(windows,q.x,base+floor,q.z,facade*(shop?.19:.15),tower?.08:.055,.012,angle,'#364e54');
        const side=at(tower?w*.368:w*.505,((col+.5)/columns-.5)*d*.64);
        part(windows,side.x,base+floor,side.z,.012,.055,d*.13,angle,'#40575b');
      }
      if(!tower){
        const door=at(shift+w*.17,d*.51);part(windows,door.x,base+.065,door.z,w*.13,.13,.016,angle,'#625b4d');
        if(shop){box(0,base+.16,d*.57,w*.83,.025,.12,seed>.5?'#8d6852':'#647d73');}
        else if(!workshop&&seed>.4){box(shift,base+.035,d*.57,w*.38,.05,.12,'#a3947c');}
        if(seed>.62)box(-w*.2,base+h+.12,-d*.18,.055,.22,.065,'#856c57');
      }
      clear(p.x,p.z,w+d+.5,w+d+.5);
    }
    // Tessellate the curved street network against the same rendered terrain as the buildings.
    for(const road of layout.roads)for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.001)continue;
      const nx=-(b.z-a.z)/length*road.width/2,nz=(b.x-a.x)/length*road.width/2;
      const points=[{x:a.x+nx,z:a.z+nz},{x:a.x-nx,z:a.z-nz},{x:b.x+nx,z:b.z+nz},{x:b.x-nx,z:b.z-nz}];
      const ys=points.map(q=>height(q.x,q.z));if(ys.some(y=>y===null||y<.16))continue;
      const offset=roads.length/3;points.forEach((q,k)=>roads.push(q.x,ys[k]!+.028,q.z));roadIndices.push(offset,offset+1,offset+2,offset+1,offset+3,offset+2);
      clear(a.x,a.z,road.width+.28,road.width+.28);
    }
    if(site.harbor){
      // Find a real land-to-water transition near the settlement before constructing a small marina.
      let shore:{x:number;z:number;dx:number;dz:number;r:number}|null=null;
      for(let a=0;a<Math.PI*2;a+=Math.PI/18){
        const dx=Math.cos(a),dz=Math.sin(a);let lastLand=false;
        for(let r=.3;r<site.radius+2;r+=.3){
          const x=center.x+dx*r,z=center.z+dz*r,y=height(x,z);
          if(y===null)break;
          if(y<-.3&&lastLand&&(!shore||r<shore.r)&&[.3,.7,1.2,1.8,2.3].every(step=>(height(x+dx*step,z+dz*step)??1)<-.3)){shore={x,z,dx,dz,r};break;}
          if(y>.05)lastLand=true;else if(y<-.3)lastLand=false;
        }
      }
      if(shore){
        harbors.push(site.text);
        const {x,z,dx,dz}=shore,angle=Math.atan2(dx,dz),length=site.radius>5?2.1:1.35;
        // A sloping quay access connects the deck to the raised shore.
        const backX=x-dx*.6,backZ=z-dz*.6,backY=height(backX,backZ);
        if(backY!==null&&backY>.05){
          const offset=roads.length/3;
          for(const [px,py,pz] of [[backX,backY+.04,backZ],[x,.23,z]])for(const side of [-1,1])roads.push(px+dz*.10*side,py,pz-dx*.10*side);
          roadIndices.push(offset,offset+1,offset+2,offset+1,offset+3,offset+2);clear(backX,backZ,.45,.45);
        }
        part(decks,x+dx*length/2,.18,z+dz*length/2,.13,.09,length,angle,'#a39170');
        for(let k=0;k<4;k++){
          const t=.3+k*(length-.4)/3,px=x+dx*t,pz=z+dz*t;
          for(const side of [-1,1]){
            const fx=px+dz*.27*side,fz=pz-dx*.27*side;
            if((height(fx,fz)??1)>-.3)continue;
            part(decks,fx,.18,fz,.54,.065,.075,angle,'#b2a181');
            part(boxes,px,.0,pz,.055,.5,.055,0,'#69695c');
            part(boxes,fx,.16,fz+dz*.13,.10,.10,.27,angle,'#e8e3d3');
            part(boxes,fx,.23,fz+dz*.13,.065,.07,.12,angle,k%2?'#617b81':'#b77353');
          }
        }
      }
    }
  }
  // A small lighthouse and keeper's cottage identify the otherwise undeveloped Lime Kiln shore.
  const beacon=nearestLand(lime.x,lime.z,1.5);
  if(beacon){
    clear(beacon.x,beacon.z,1.5,1.5);
    const white=new MeshStandardMaterial({color:'#e6dfcb',roughness:.85}),dark=new MeshStandardMaterial({color:'#334448',roughness:.65});
    const tower=new Mesh(new CylinderGeometry(.11,.18,.75,8),white);tower.position.set(beacon.x,beacon.y+.375,beacon.z);tower.castShadow=true;group.add(tower);
    const lantern=new Mesh(new CylinderGeometry(.14,.14,.16,8),dark);lantern.position.set(beacon.x,beacon.y+.82,beacon.z);group.add(lantern);
    const cap=new Mesh(new ConeGeometry(.20,.15,8),dark);cap.position.set(beacon.x,beacon.y+.975,beacon.z);group.add(cap);
    const cottage=nearestLand(beacon.x+.45,beacon.z+.3,.7);
    if(cottage){part(boxes,cottage.x,cottage.y+.13,cottage.z,.38,.26,.45,0,'#e1d6bd');part(roofs,cottage.x,cottage.y+.26,cottage.z,.44,.16,.5,0,'#626c64');}
  }
  const batch=(parts:Part[],geometry:BufferGeometry)=>{
    const material=new MeshStandardMaterial({roughness:.88}),mesh=new InstancedMesh(geometry,material,parts.length),transform=new Object3D();
    parts.forEach((p,i)=>{transform.position.set(p.x,p.y,p.z);transform.rotation.set(0,p.angle,0);transform.scale.set(p.w,p.h,p.d);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);mesh.setColorAt(i,new Color(p.color));});
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
  };
  const hip=new ConeGeometry(1,1,4);hip.rotateY(Math.PI/4);hip.scale(Math.SQRT1_2,1,Math.SQRT1_2);hip.translate(0,.5,0);
  batch(boxes,new BoxGeometry());batch(roofs,roofGeometry());batch(hipRoofs,hip);batch(windows,new BoxGeometry());batch(decks,new BoxGeometry());
  const roadGeometry=new BufferGeometry();roadGeometry.setAttribute('position',new Float32BufferAttribute(roads,3));roadGeometry.setIndex(roadIndices);roadGeometry.computeVertexNormals();
  const roadMesh=new Mesh(roadGeometry,new MeshStandardMaterial({color:'#747d72',roughness:1,side:DoubleSide}));roadMesh.receiveShadow=true;group.add(roadMesh);
  group.userData.layouts=layouts;group.userData.buildings=stats;group.userData.harbors=harbors;
  return {group,excludesTree:(x:number,z:number)=>(clearings.get(`${Math.floor(x)}:${Math.floor(z)}`)??[]).some(r=>x>=r.left&&x<=r.right&&z>=r.top&&z<=r.bottom),dispose:()=>{
    const materials=new Set<MeshStandardMaterial>();group.traverse(n=>{if(n instanceof Mesh){n.geometry.dispose();materials.add(n.material as MeshStandardMaterial);}});materials.forEach(m=>m.dispose());
  }};
}
