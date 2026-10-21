/* eslint-disable react-hooks/immutability -- Three resources and frame simulation are mutable, outside React state. */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BufferAttribute, BufferGeometry, CanvasTexture, Color, ConeGeometry, DodecahedronGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshDepthMaterial, MeshStandardMaterial, Object3D, OrthographicCamera, PCFShadowMap, RGBADepthPacking, ShaderMaterial, Sprite, SpriteMaterial, TextureLoader, Vector2, Vector3, Vector4 } from 'three';
import { clampCamera, introProgress, HOME_FOCUS, CAMERA_HEIGHT, CAMERA_DEPTH, GROUND_PROJECTION, BOAT_START, BOAT_SCALE, WAKE_SCALE } from './coastalCamera';
import { advanceVessel, navigable } from './coastalMotion';
import { buildSettlements } from './coastalSettlements';
import { coastalCities } from './coastalPlaces';
import { forestDetail } from './coastalForest';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seaMist } from './coastalAtmosphere';
import { detailedWaterFragment, terrainMaterial } from './coastalMaterials';
import type { WaterGrid } from './coastalMotion';
const ROOT = '/assets/home/coastal-world/';
export type CoastalInput = { target: { x: number; z: number } | null; keys: Set<string>; panX:number;panY:number;dragged:boolean;interacted:boolean;follow?:boolean;invalidate?:()=>void };
type WorldData = WaterGrid & { rocks: {x:number;y:number;z:number;size:number;phase:number}[]; trees: Float32Array };
type Props = { paused: boolean; driving: boolean; zoom: number; resetView:number; input: React.RefObject<CoastalInput>; onReady: () => void; onFailure: () => void; host: React.RefObject<HTMLDivElement | null>; world: WorldData };
const waterVertex = `varying vec2 world; void main(){world=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const waterFragment = detailedWaterFragment;
function World(props: Props) {
  const { paused, driving, zoom, resetView, input, world, onReady, onFailure, host } = props;
  const [terrain, firA, firB, firC, boat, orca] = useLoader(GLTFLoader, ['terrain','fir-0','fir-1','fir-2','boat','orca'].map(n => ROOT+n+'.glb'));
  const [coast, rock] = useLoader(TextureLoader, [ROOT+'coast-field.png',ROOT+'coastal-rock.png']);

  const ground = useMemo(()=>terrainMaterial(rock,true),[rock]);
  const terrainScene = useMemo(()=>{const scene=terrain.scene.clone(true);scene.traverse(n=>{if(n instanceof Mesh){n.material=ground;n.castShadow=true;n.receiveShadow=true;}});return scene;},[terrain,ground]);
  const settlements=useMemo(()=>buildSettlements(terrainScene),[terrainScene]);
  useEffect(()=>()=>settlements.dispose(),[settlements]);
  const { camera, size, gl, invalidate } = useThree();
  const focus=useRef(paused?{...HOME_FOCUS}:{x:-90,z:-70}),intro=useRef(paused?5:0),lastZoom=useRef(zoom);
  const time = useRef(0), vessel = useRef({ ...BOAT_START, speed: 0, heading: 2 });
  const boatGroup = useRef<Group>(null), whaleGroup = useRef<Group>(null), calfGroup = useRef<Group>(null), trail = useRef<InstancedMesh>(null);
  const history = useMemo(() => Array.from({ length: 100 }, () => ({ ...BOAT_START, age: 99, heading: 0 })), []);
  const ribbon = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(100 * 6), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(100 * 8), 4));
    g.setIndex(Array.from({length:99},(_,i)=>[i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2]).flat());
    return g;
  }, []);
  const trailCursor = useRef(0), lastDrop = useRef(0);
  const scratch = useMemo(() => new Object3D(), []);
  const water = useMemo(() => new ShaderMaterial({ vertexShader: waterVertex, fragmentShader: waterFragment, uniforms: { region: {value:new Vector4(world.minX,world.maxX,world.minZ,world.maxZ)}, coast: {value: coast}, time: { value: 0 }, boat: { value: new Vector2(BOAT_START.x,-BOAT_START.z) }, boatScale: {value:WAKE_SCALE}, whale: { value: new Vector2(-47,0) }, splash: { value: 0 } }, side: DoubleSide }), [coast,world]);
  const mist = useMemo(()=>[seaMist(water.uniforms.time),seaMist(water.uniforms.time,1)],[water]);
  const vesselScene = useMemo(()=>{
    const scene=boat.scene.clone(true);
    scene.traverse(node=>{if(node instanceof Mesh){const material=(node.material as MeshStandardMaterial).clone();
      if(material.name==='Hull deep navy'||material.name==='Safety orange')material.color.set('#cd6044');
      if(material.name==='Warm ivory')material.color.set('#f1ede2');
      node.material=material;
    }});return scene;
  },[boat]);
  const calf = useMemo(()=>orca.scene.clone(true),[orca]);
  const labels = useMemo(()=>[
    {text:'Orcas Island',x:4,y:7,z:-13},
    {text:'San Juan Island',x:-28,y:5,z:12},
    {text:'Lopez Island',x:0,y:4,z:25},
    {text:'Shaw Island',x:-9,y:4,z:5},
    {text:'Haro Strait',x:-43,y:1,z:-13},
    {text:'Rosario Strait',x:28,y:1,z:-5},
    {text:'Strait of Georgia',x:-95,y:1,z:-160},
    {text:'Puget Sound',x:53,y:1,z:220},
    {text:'Hood Canal',x:12,y:1,z:260},
    {text:'Vancouver Island',x:-210,y:10,z:-140},
    {text:'Strait of Juan de Fuca',x:-110,y:1,z:90},
  ].map((label,index)=>({...label,city:false,major:false,minZoom:index<6?.55:0,maxZoom:index<6?10:.8,span:index<6?13:20})).concat(coastalCities.map(city=>({...city,y:3,city:true,maxZoom:10,span:city.major?16:14}))).map(label=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
    const context=canvas.getContext('2d')!;
    context.font=label.city?`${label.major?'500':'400'} 40px system-ui`:'italic 40px Georgia';
    context.textAlign=label.city?'left':'center';context.textBaseline='middle';
    context.shadowColor='#123345';context.shadowBlur=6;context.fillStyle='#f1ede2';
    context.strokeStyle='#12334588';context.lineWidth=3;context.strokeText(label.text,label.city?48:256,48);
    context.fillText(label.text,label.city?48:256,48);
    if(label.city){
      context.beginPath();context.arc(16,48,label.major?8:6,0,Math.PI*2);context.fillStyle='#cd6044';context.fill();
      context.strokeStyle='#f1ede2';context.lineWidth=2;context.stroke();
    }
    const map=new CanvasTexture(canvas);const material=new SpriteMaterial({map,transparent:true,opacity:label.city?.96:.85,depthTest:false,depthWrite:false});
    const sprite=new Sprite(material);sprite.position.set(label.x,label.y,label.z);sprite.scale.set(label.span,label.span*96/512,1);
    if(label.city)sprite.center.set(16/512,.5);
    sprite.userData={minZoom:label.minZoom,maxZoom:label.maxZoom,span:label.span,textWidth:context.measureText(label.text).width,city:label.city,priority:label.city?(label.major?0:1):2};
    sprite.name=label.text;sprite.renderOrder=3;return sprite;
  }).sort((a,b)=>a.userData.priority-b.userData.priority),[]);
  const labelPoint=useMemo(()=>new Vector3(),[]);
  const boulders = useMemo(()=>{
    const material=new MeshStandardMaterial({map:rock,color:'#b7b4a5',roughness:.95});
    const mesh=new InstancedMesh(new DodecahedronGeometry(1,0),material,(world.rocks??[]).length);
    const transform=new Object3D();
    (world.rocks??[]).forEach((r,i)=>{transform.position.set(r.x,r.y-.08,r.z);transform.rotation.set(r.phase*.3,r.phase,.2);transform.scale.set(r.size*1.35,r.size*.8,r.size);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
    mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
  },[rock,world]);
  const forest = useMemo(() => {
    const meshes: InstancedMesh[] = [];
    type Tree={x:number;y:number;z:number;scale:number;phase:number};
    const regionalTiles=[0,1,2].map(()=>new Map<string,Tree[]>());
    for(let i=0;i<world.trees.length;i+=6){
      const [x,y,z,scale,phase,variant]=world.trees.subarray(i,i+6);
      if(settlements.excludesTree(x,z))continue;
      const key=`${Math.floor(x/35)}:${Math.floor(z/35)}`,tiles=regionalTiles[variant];
      const tile=tiles.get(key)??[];tile.push({x,y,z,scale,phase});tiles.set(key,tile);
    }
    [firA,firB,firC].forEach((fir,variant)=>{
    const tiles=regionalTiles[variant];
    fir.scene.updateMatrixWorld(true);
    fir.scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
      const material = (node.material as MeshStandardMaterial).clone();
      material.transparent=false;material.alphaTest=.48;material.alphaToCoverage=true;material.depthWrite=true;
      material.onBeforeCompile = shader => {
        shader.uniforms.windTime = water.uniforms.time;
        shader.uniforms.forestTint = {value:new Color('#56765b')};
        if(material.map){
          shader.fragmentShader='uniform vec3 forestTint;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,forestTint*(.55+dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*2.),.38);');
        }
        shader.vertexShader = 'uniform float windTime;\n'+shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += pow(max(position.y,0.)/3.,2.) * (sin(windTime*1.4+instanceMatrix[3].x*.3+instanceMatrix[3].z*.2)*.08 + sin(windTime*.37)*.055);');
      };
      // Spatial batches let the renderer cull forest outside the moving camera.
      const crowns=[0,1,2].map(i=>{const cone=new ConeGeometry(.82-i*.19,1.85-i*.22,7);cone.translate(0,1.25+i*.82,0);return cone;});
      const distantGeometry=mergeGeometries(crowns);crowns.forEach(g=>g.dispose());
      const distantMaterial=new MeshStandardMaterial({color:'#365039',roughness:1});
      const canopyScale={value:1};
      distantMaterial.onBeforeCompile=shader=>{
        shader.uniforms.windTime=water.uniforms.time;shader.uniforms.canopyScale=canopyScale;
        shader.vertexShader='uniform float windTime;uniform float canopyScale;\n'+shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.xz*=canopyScale; transformed.x+=pow(max(position.y,0.)/3.,2.)*sin(windTime*1.4+instanceMatrix[3].x*.3+instanceMatrix[3].z*.2)*.08;');
      };
      const depth=new MeshDepthMaterial({depthPacking:RGBADepthPacking,map:material.map,alphaTest:.48,side:DoubleSide});depth.onBeforeCompile=material.onBeforeCompile;
      for(const tile of tiles.values()){
        const mesh=new InstancedMesh(geometry,material,tile.length),matrix=new Matrix4();
        tile.forEach((tree,i)=>{matrix.makeRotationY(tree.phase);matrix.scale(new Vector3(tree.scale*(.8+.2*Math.sin(tree.phase)),tree.scale,tree.scale));matrix.setPosition(tree.x,tree.y,tree.z);mesh.setMatrixAt(i,matrix);const tone=.86+.18*(.5+.5*Math.sin(tree.phase*3+tree.x*.1));mesh.setColorAt(i,new Color(tone,tone*(.97+.04*Math.sin(tree.phase)),tone*.96));});
        mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=depth;mesh.userData={fullCount:tile.length,nearGeometry:geometry,nearMaterial:material,distantGeometry,distantMaterial,canopyScale,foliage:!!material.map};mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=4;meshes.push(mesh);
      }
    });
    });
    return meshes;
  }, [firA, firB, firC, world, water, settlements]);
  useEffect(()=>{const controls=input.current;controls.invalidate=invalidate;return()=>{controls.invalidate=undefined;};},[input,invalidate]);
  useEffect(()=>{if(resetView){focus.current={...HOME_FOCUS};intro.current=5;input.current.interacted=false;invalidate();}},[resetView,input,invalidate]);
  useEffect(()=>{if(lastZoom.current!==zoom){intro.current=5;lastZoom.current=zoom;invalidate();}},[zoom,invalidate]);
  useEffect(() => {
    terrain.scene.traverse(n => { if(n instanceof Mesh) { n.receiveShadow=true; n.castShadow=true; } });
    onReady();
    const lost = (event: Event) => { event.preventDefault();onFailure(); };
    gl.domElement.addEventListener('webglcontextlost',lost);
    return () => gl.domElement.removeEventListener('webglcontextlost',lost);
  }, [terrain,gl,onReady,onFailure]);
  useEffect(() => () => {vesselScene.traverse(node=>{if(node instanceof Mesh)(node.material as MeshStandardMaterial).dispose();});labels.forEach(label=>{label.material.map?.dispose();label.material.dispose();});boulders.geometry.dispose();(boulders.material as MeshStandardMaterial).dispose();mist.forEach(material=>material.dispose());ground.dispose();water.dispose();ribbon.dispose();new Set(forest.flatMap(m=>[m.userData.nearGeometry,m.userData.distantGeometry])).forEach(g=>g.dispose());new Set(forest.flatMap(m=>[m.userData.nearMaterial,m.userData.distantMaterial])).forEach(m=>m.dispose());new Set(forest.map(m=>m.customDepthMaterial)).forEach(m=>m?.dispose());}, [vesselScene,labels,boulders,mist,ground,water,forest,ribbon]);
  useFrame((_,delta) => {
    const dt=paused?0:Math.min(delta,.05);time.current+=dt;const t=time.current;
    water.uniforms.time.value=t;
    const v=vessel.current;
    if(driving && dt) {
      const keys=input.current.keys;
      if(keys.size) {
        input.current.follow=true;
        v.heading+=((keys.has('ArrowLeft')||keys.has('a')?1:0)-(keys.has('ArrowRight')||keys.has('d')?1:0))*dt*1.4;
        input.current.target=(keys.has('ArrowUp')||keys.has('w'))?{x:v.x+Math.sin(v.heading)*8,z:v.z+Math.cos(v.heading)*8}:null;
      }
      advanceVessel(v,input.current.target,dt,world);
    } else if(dt) { v.speed*=Math.exp(-dt*3); }
    const controls=input.current;
    if(controls.interacted||driving)intro.current=5;
    if(!paused)intro.current=Math.min(5,intro.current+Math.min(delta,.25));
    const progress=introProgress(intro.current),cam=camera as OrthographicCamera;
    const extent=size.width<size.height?110:124;
    const minimumZoom=Math.max(extent/(world.maxX-world.minX-80),extent*size.height/size.width/((world.maxZ-world.minZ-160)*GROUND_PROJECTION));
    const effectiveZoom=Math.max(minimumZoom,.26+(zoom-.26)*progress);
    const detail=forestDetail(effectiveZoom);
    forest.forEach(mesh=>{
      const data=mesh.userData;mesh.visible=!detail.distant||data.foliage;
      mesh.count=Math.ceil(data.fullCount*detail.fraction);
      mesh.geometry=detail.distant?data.distantGeometry:data.nearGeometry;
      mesh.material=detail.distant?data.distantMaterial:data.nearMaterial;
      data.canopyScale.value=detail.canopyScale;
      mesh.castShadow=!detail.distant;
    });
    cam.left=-extent/2;cam.right=extent/2;cam.top=extent*size.height/size.width/2;cam.bottom=-cam.top;cam.zoom=effectiveZoom;
    if(intro.current<5){focus.current.x=-90+(HOME_FOCUS.x+90)*progress;focus.current.z=-70+(HOME_FOCUS.z+70)*progress;}
    if(controls.panX||controls.panY){
      const scale=extent/(size.width*effectiveZoom);
      focus.current.x-=controls.panX*scale;focus.current.z-=controls.panY*scale/ GROUND_PROJECTION;
      controls.panX=0;controls.panY=0;controls.follow=false;
    } else if(driving&&controls.follow!==false){
      const ease=1-Math.exp(-Math.min(delta,.05)*3);
      focus.current.x+=(v.x-focus.current.x)*ease;focus.current.z+=(v.z-focus.current.z)*ease;
    }
    const bounded=clampCamera(focus.current.x,focus.current.z,world,extent/(2*effectiveZoom)+20,cam.top/effectiveZoom/GROUND_PROJECTION+40);
    focus.current=bounded;cam.position.set(bounded.x+6,CAMERA_HEIGHT,bounded.z+CAMERA_DEPTH);cam.lookAt(bounded.x,0,bounded.z);cam.updateProjectionMatrix();cam.updateMatrixWorld();
    const occupied:{left:number;right:number;top:number;bottom:number}[]=[];
    labels.forEach(label=>{
      const meta=label.userData;
      const scale=meta.span*Math.max(1,1428/size.width)/effectiveZoom;
      label.scale.set(scale,scale*96/512,1);
      label.visible=effectiveZoom>meta.minZoom&&effectiveZoom<meta.maxZoom;
      if(!label.visible)return;
      labelPoint.copy(label.position).project(cam);
      const px=(labelPoint.x+1)*size.width/2,py=(1-labelPoint.y)*size.height/2;
      const unit=scale*effectiveZoom/extent*size.width/512;
      const left=px+(meta.city?32:-meta.textWidth/2)*unit;
      const rect={left:left-5,right:left+meta.textWidth*unit+5,top:py-25*unit-3,bottom:py+25*unit+3};
      if(rect.right<0||rect.left>size.width||rect.bottom<0||rect.top>size.height){label.visible=false;return;}
      label.visible=!occupied.some(r=>rect.left<r.right&&rect.right>r.left&&rect.top<r.bottom&&rect.bottom>r.top);
      if(label.visible)occupied.push(rect);
    });
    if(host.current){host.current.dataset.cameraPosition=`${bounded.x.toFixed(2)},${bounded.z.toFixed(2)}`;host.current.dataset.cameraZoom=effectiveZoom.toFixed(3);}
    if(boatGroup.current){boatGroup.current.position.set(v.x,.07+Math.sin(t*1.9)*.025,v.z);boatGroup.current.rotation.set(Math.sin(t*1.3)*.025,v.heading+Math.PI,Math.cos(t*1.4)*.025);}
    water.uniforms.boat.value.set(v.x,-v.z);
    if(dt && v.speed>.25 && t-lastDrop.current>.09){const p=history[trailCursor.current++%history.length];p.x=v.x-Math.sin(v.heading)*1.2*WAKE_SCALE;p.z=v.z-Math.cos(v.heading)*1.2*WAKE_SCALE;p.age=0;p.heading=v.heading;lastDrop.current=t;}
    history.forEach((p,i)=>{
      p.age+=dt;const fade=Math.max(0,1-p.age/8);
      scratch.position.set(p.x,.08,p.z);scratch.rotation.set(-Math.PI/2,0,-p.heading);scratch.scale.set((.3+p.age*.55)*fade*WAKE_SCALE,(.6+p.age*.18)*fade*WAKE_SCALE,1);scratch.updateMatrix();trail.current?.setMatrixAt(i,scratch.matrix);
    });
    if(trail.current)trail.current.instanceMatrix.needsUpdate=true;
    const positions=ribbon.getAttribute('position'), colors=ribbon.getAttribute('color');
    for(let i=0;i<100;i++) {
      const p=history[(trailCursor.current+i)%100]; const fade=Math.max(0,1-p.age/8), width=(.15+Math.min(8,p.age)*.4)*WAKE_SCALE;
      for(let side=0;side<2;side++) {
        const sign=side?1:-1,index=i*2+side;
        positions.setXYZ(index,p.x+Math.cos(p.heading)*width*sign,.065,p.z-Math.sin(p.heading)*width*sign);
        colors.setXYZW(index,.55,.8,.8,p.age<8?fade*.12:0);
      }
    }
    positions.needsUpdate=true;colors.needsUpdate=true;
    const wx=-52+Math.sin(t*.05)*1.2,wz=18+Math.sin(t*.075)*8,cycle=t%19;
    const breach=cycle<2.4?Math.sin(cycle/2.4*Math.PI):0;
    if(whaleGroup.current){whaleGroup.current.position.set(wx,(-.35+breach*2.4)*.22,wz);whaleGroup.current.rotation.set(breach*-.65,Math.cos(t*.075)>0?Math.PI:0,breach*.22);}
    if(calfGroup.current){const leap=Math.max(0,Math.sin(Math.min(Math.max(cycle-1.5,0)/2.4,1)*Math.PI));calfGroup.current.position.set(wx+.7,(-.15+leap*1.3)*.22,wz+2);calfGroup.current.rotation.set(-leap*.5,Math.cos(t*.075)>0?Math.PI:0,leap*.18);}
    water.uniforms.whale.value.set(wx,-wz);water.uniforms.splash.value=cycle>=2.4&&cycle<5.4?(cycle-2.4)/3:0;
    if(host.current){host.current.dataset.sceneTime=t.toFixed(3);host.current.dataset.boatPosition=`${v.x.toFixed(2)},${v.z.toFixed(2)}`;}
  });
  return <>
    <color attach="background" args={['#123345']}/><fog attach="fog" args={['#aac4bd',900,1600]}/>
    <hemisphereLight args={['#e5f3ff','#827754',1.65]}/>
    <directionalLight position={[-45,65,35]} intensity={3.7} color="#fff3d9" castShadow shadow-mapSize={[4096,4096]} shadow-camera-left={-65} shadow-camera-right={95} shadow-camera-top={80} shadow-camera-bottom={-80} shadow-normalBias={.035} shadow-bias={-.00015}/>
    <primitive object={terrainScene}/><primitive object={settlements.group} dispose={null}/><primitive object={boulders} dispose={null}/>{forest.map((m,i)=><primitive key={i} object={m} dispose={null}/>)}
    <mesh rotation={[-Math.PI/2,0,0]} material={water} onPointerUp={e=>{if(driving&&!paused&&!input.current.dragged&&navigable(world,e.point.x,e.point.z)){input.current.target={x:e.point.x,z:e.point.z};input.current.follow=true;}}}>
      <planeGeometry args={[2000,2000]}/>
    </mesh>
    {labels.map((label,i)=><primitive key={i} object={label} dispose={null}/>)}
    <group ref={boatGroup} scale={BOAT_SCALE}><primitive object={vesselScene}/></group>
    <group ref={whaleGroup} scale={.22}><primitive object={orca.scene}/></group>
    <group ref={calfGroup} scale={.132}><primitive object={calf}/></group>
    {mist.map((material,i)=><mesh key={i} position={[0,22+i*7,0]} rotation={[-Math.PI/2,0,0]} material={material} raycast={()=>{}}><planeGeometry args={[2000,2000]}/></mesh>)}
    <mesh geometry={ribbon} frustumCulled={false}><meshBasicMaterial vertexColors transparent depthWrite={false} side={DoubleSide}/></mesh>
    <instancedMesh ref={trail} args={[undefined,undefined,100]} frustumCulled={false}>
      <ringGeometry args={[.65,1,16,1,0,Math.PI*2]}/><meshBasicMaterial color={new Color('#b4d9d7')} transparent opacity={.22} depthWrite={false} side={DoubleSide}/>
    </instancedMesh>
  </>;
}
export default function CoastalWorld(props: Props){return <Canvas shadows={{type:PCFShadowMap}} orthographic dpr={[1,1.5]} camera={{position:[15,95,85],near:.1,far:2400}} frameloop={props.paused?'demand':'always'} gl={{antialias:true,powerPreference:'high-performance'}}><Suspense fallback={null}><World {...props}/></Suspense></Canvas>;}
