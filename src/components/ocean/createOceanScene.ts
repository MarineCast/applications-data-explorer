import { Application, Assets, Container, Filter, GlProgram, Graphics, MeshPlane, Sprite, Texture } from 'pixi.js';
import { heatOpacity, islandPose, mapTransform, MAP_SIZE } from './sanJuanMotion';
import { islandFragment, vertex } from './sanJuanShaders';
export type OceanController = { setPaused: (paused: boolean) => void; destroy: () => void };
const base = '/assets/home/san-juan/';
export async function createOceanScene(host: HTMLDivElement, signal: AbortSignal, initiallyPaused: boolean): Promise<OceanController | undefined> {
  const app = new Application();
  let initialized = false;
  let filter: Filter | undefined;
  try {
    await app.init({ preference: 'webgl', width: Math.max(1,host.clientWidth), height: Math.max(1,host.clientHeight), resolution: Math.min(window.devicePixelRatio || 1,1.5), autoDensity:true, antialias:true, backgroundAlpha:0, autoStart:false, powerPreference:'low-power' });
    initialized = true;
    const textures = await Promise.all(['background.webp','land-mask.png','boat.webp','buoy.webp','orca.webp'].map(name=>Assets.load<Texture>(base+name)));
    if(signal.aborted){app.destroy(true,{children:true});return;}
    const [backdrop,land,boatTexture,buoyTexture,orcaTexture]=textures;
    // Read the source mask once; every animated water mark must pass its shoreline test.
    const maskImage = new Image(); maskImage.src=base+'land-mask.png'; await maskImage.decode();
    if(signal.aborted){app.destroy(true,{children:true});return;}
    const maskCanvas=document.createElement('canvas'); maskCanvas.width=MAP_SIZE.width;maskCanvas.height=MAP_SIZE.height;
    const context=maskCanvas.getContext('2d',{willReadFrequently:true});
    if(!context) throw new Error('Unable to read coastline mask');
    context.drawImage(maskImage,0,0);
    const mask=context.getImageData(0,0,MAP_SIZE.width,MAP_SIZE.height).data;
    const water=(x:number,y:number,margin=0)=>{
      for(const [dx,dy] of [[0,0],[-margin,0],[margin,0],[0,-margin],[0,margin]]) {
        const px=Math.round(x+dx),py=Math.round(y+dy);
        if(px<0||px>=1536||py<0||py>=1024||mask[(py*1536+px)*4]>24)return false;
      }
      return true;
    };
    const background=new Sprite(backdrop),world=new Container();app.stage.addChild(background,world);
    filter=new Filter({glProgram:GlProgram.from({vertex,fragment:islandFragment}),resources:{uLand:land.source,islandUniforms:{uTime:{value:0,type:'f32'},uHeat:{value:.48,type:'f32'},uScale:{value:1,type:'f32'},uOffset:{value:new Float32Array([0,0]),type:'vec2<f32>'}}}});
    background.filters=[filter];const uniforms=filter.resources.islandUniforms.uniforms;
    const currents=new Graphics();world.addChild(currents);
    const wakes=new Graphics();world.addChild(wakes);
    const makeSprite=(texture:Texture,width:number)=>{const sprite=new Sprite(texture);sprite.anchor.set(.5);sprite.scale.set(width/texture.width);world.addChild(sprite);return sprite;};
    const boat=makeSprite(boatTexture,84),buoy=makeSprite(buoyTexture,30);
    buoy.anchor.set(.5,.92);
    const orcas=[94,57].map(width=>{
      const mesh=new MeshPlane({texture:orcaTexture,verticesX:14,verticesY:5});mesh.pivot.set(orcaTexture.width/2,orcaTexture.height/2);mesh.scale.set(width/orcaTexture.width);world.addChild(mesh);
      const buffer=mesh.geometry.getAttribute('aPosition').buffer;
      return {mesh,buffer,original:Float32Array.from(buffer.data)};
    });
    let transform=mapTransform(host.clientWidth,host.clientHeight),paused=initiallyPaused,disposed=false,lost=false;
    const frame=import.meta.env.DEV?Number(new URLSearchParams(location.search).get('ocean-frame')??0):0;
    let time=Number.isFinite(frame)?Math.max(0,Math.min(frame,3600)):0;
    let seed=7143; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    type Tracer={x:number;y:number;vx:number;vy:number;age:number;life:number;sample:number;points:{x:number;y:number}[]};
    const reset=(tracer:Tracer)=>{
      for(let i=0;i<1000;i++){tracer.x=random()*1536;tracer.y=random()*1024;if(water(tracer.x,tracer.y,14))break;}
      tracer.vx=0;tracer.vy=0;tracer.age=0;tracer.life=15+random()*10;tracer.sample=0;tracer.points=[];
    };
    const tracers=Array.from({length:105},()=>{const t:Tracer={x:0,y:0,vx:0,vy:0,age:0,life:0,sample:0,points:[]};reset(t);return t;});
    // A blurred coastline potential makes continuous steering instead of binary
    // eight-direction kicks, which produced visible zigzags beside islands.
    context.clearRect(0,0,1536,1024);context.filter='blur(24px)';context.drawImage(maskImage,0,0);
    const shore=context.getImageData(0,0,1536,1024).data;
    const potential=(x:number,y:number)=>{
      x=Math.max(0,Math.min(1534,x));y=Math.max(0,Math.min(1022,y));
      const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
      const at=(dx:number,dy:number)=>shore[((iy+dy)*1536+ix+dx)*4]/255;
      return (at(0,0)*(1-fx)+at(1,0)*fx)*(1-fy)+(at(0,1)*(1-fx)+at(1,1)*fx)*fy;
    };
    const velocity=(x:number,y:number)=>{
      const gx=(potential(x+6,y)-potential(x-6,y))/12;
      const gy=(potential(x,y+6)-potential(x,y-6))/12;
      return {x:6+Math.sin(y*.008)*8-gx*1700,y:-13+Math.sin(x*.009)*5-gy*1700};
    };
    const draw=(delta:number)=>{
      time+=delta;uniforms.uTime=time;uniforms.uHeat=heatOpacity(time);
      currents.clear();
      for(const [tracerIndex,tracer] of tracers.entries()){
        if(delta>0){
          tracer.age+=delta;
          const v=velocity(tracer.x,tracer.y),blend=1-Math.exp(-delta*2.5);
          tracer.vx+=(v.x-tracer.vx)*blend;tracer.vy+=(v.y-tracer.vy)*blend;
          const x=tracer.x+tracer.vx*delta,y=tracer.y+tracer.vy*delta;
          if(tracer.age>tracer.life||!water(x,y,8)){reset(tracer);}else{tracer.x=x;tracer.y=y;tracer.sample+=delta;if(tracer.sample>=.08){tracer.sample=0;tracer.points.push({x,y});if(tracer.points.length>95)tracer.points.shift();}}
        }
        const pts=tracer.points,alpha=Math.min(tracer.age/1.5,1,Math.max(0,(tracer.life-tracer.age)/1.5))*.78;
        if(pts.length>1){
          const trace=()=>{currents.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)currents.lineTo(pts[i].x,pts[i].y);};
          // A restrained dark keyline separates the bright flow from watercolor texture.
          const lineWidth=Math.max(1.35,1.15/transform.scale);
          trace();currents.stroke({color:0x07516a,width:lineWidth+2,alpha:alpha*.23,cap:'round',join:'round'});
          trace();currents.stroke({color:0xe2ffff,width:lineWidth,alpha,cap:'round',join:'round'});
          // Sparse arrowheads follow the animated front, keeping direction readable.
          if(pts.length>20 && tracerIndex%3===0){
            const end=pts[pts.length-1],prior=pts[pts.length-5];
            const angle=Math.atan2(end.y-prior.y,end.x-prior.x),size=5.5;
            const left={x:end.x-Math.cos(angle-.48)*size,y:end.y-Math.sin(angle-.48)*size};
            const right={x:end.x-Math.cos(angle+.48)*size,y:end.y-Math.sin(angle+.48)*size};
            if(water(left.x,left.y,2)&&water(right.x,right.y,2)){
              currents.moveTo(left.x,left.y).lineTo(end.x,end.y).lineTo(right.x,right.y).stroke({color:0xe2ffff,width:lineWidth,alpha,cap:'round',join:'round'});
            }
          }
        }
      }
      const bp=islandPose(time,'boat'),up=islandPose(time,'buoy');boat.position.set(bp.x,bp.y);boat.rotation=bp.rotation;
      buoy.position.set(up.x,up.y);buoy.rotation=up.rotation;
      wakes.clear();
      // Ripples travel outwards while their objects bob independently above them.
      for(let i=0;i<3;i++){
        const phase=(time*.34+i/3)%1;
        wakes.ellipse(up.x,up.y+2,15+phase*27,4+phase*9).stroke({color:0xe5ffff,alpha:(1-phase)*.45,width:.8});
      }
      for(let i=0;i<7;i++){
        const phase=(time*.35+i/7)%1;
        wakes.moveTo(bp.x-30-phase*48,bp.y+12+phase*9).lineTo(bp.x-24-phase*48,bp.y+9+phase*7).stroke({color:0xf0ffff,alpha:(1-phase)*.45,width:1});
      }
      orcas.forEach((whale,index)=>{
        const pose=islandPose(time,'orca',index);whale.mesh.position.set(pose.x,pose.y);whale.mesh.rotation=pose.rotation;
        for(let i=0;i<whale.original.length;i+=2){const tail=whale.original[i]/orcaTexture.width;whale.buffer.data[i+1]=whale.original[i+1]+Math.sin(time*2+index-tail*3.5)*tail*tail*orcaTexture.height*.055;}
        whale.buffer.update();
        wakes.ellipse(pose.x,pose.y+9,index?27:45,index?6:9).stroke({color:0xd9ffff,alpha:.3,width:.7});
      });
      host.dataset.sceneTime=time.toFixed(3);host.dataset.heatOpacity=uniforms.uHeat.toFixed(3);host.dataset.boatPosition=`${bp.x.toFixed(1)},${bp.y.toFixed(1)}`;
    };
    const resize=()=>{
      const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);app.renderer.resize(width,height);transform=mapTransform(width,height);
      world.scale.set(transform.scale);world.position.set(transform.x,transform.y);background.width=width;background.height=height;
      uniforms.uScale=transform.scale;uniforms.uOffset[0]=transform.x;uniforms.uOffset[1]=transform.y;draw(0);app.render();
    };
    const sync=()=>{if(disposed)return;const stop=paused||document.hidden||lost;host.dataset.motion=stop?'paused':'playing';if(stop)app.stop();else app.start();};
    host.appendChild(app.canvas);app.canvas.setAttribute('aria-hidden','true');
    // Seed an already flowing frame so reduced motion still has a finished composition.
    const saved=time;for(let i=0;i<180;i++)draw(.04);time=saved;draw(0);
    app.ticker.maxFPS=45;app.ticker.add(ticker=>draw(Math.min(ticker.deltaMS/1000,.05)));
    const observer=new ResizeObserver(resize);observer.observe(host);document.addEventListener('visibilitychange',sync);
    const contextLost=(event:Event)=>{event.preventDefault();lost=true;sync();app.canvas.style.visibility='hidden';host.querySelector('.ocean-fallback')?.classList.remove('is-ready');host.dataset.renderer='fallback';};
    const contextRestored=()=>{lost=false;app.canvas.style.visibility='visible';host.querySelector('.ocean-fallback')?.classList.add('is-ready');host.dataset.renderer='webgl';resize();sync();};
    app.canvas.addEventListener('webglcontextlost',contextLost);app.canvas.addEventListener('webglcontextrestored',contextRestored);
    resize();sync();
    return {setPaused(value){paused=value;sync();},destroy(){
      if(disposed)return;disposed=true;app.stop();observer.disconnect();document.removeEventListener('visibilitychange',sync);app.canvas.removeEventListener('webglcontextlost',contextLost);app.canvas.removeEventListener('webglcontextrestored',contextRestored);
      background.filters=[];filter?.groups[0]?.destroy();filter?.destroy();orcas.forEach(whale=>whale.mesh.geometry.destroy());app.destroy(true,{children:true,texture:false,textureSource:false});
    }};
  }catch(error){filter?.groups[0]?.destroy();filter?.destroy();if(initialized)app.destroy(true,{children:true,texture:false,textureSource:false});throw error;}
}
