import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CoastalInput } from './CoastalWorld';
import { decodeForest } from './coastalForest';
const World = lazy(()=>import('./CoastalWorld'));
class Boundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure();}render(){return this.state.failed?null:this.props.children;}
}
export default function CoastalScene({paused,driving,zoom,resetView,onZoom,onExit,onAvailability}:{paused:boolean;driving:boolean;zoom:number;resetView:number;onZoom:(factor:number)=>void;onExit:()=>void;onAvailability:(ready:boolean)=>void}){
  const host=useRef<HTMLDivElement>(null), input=useRef<CoastalInput>({target:null,keys:new Set(),panX:0,panY:0,dragged:false,interacted:false});
  const pointer=useRef<{x:number;y:number;distance:number}|null>(null);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[hidden,setHidden]=useState(document.hidden);
  const [world,setWorld]=useState<React.ComponentProps<typeof World>['world']|null>(null);
  const onReady=useCallback(()=>setReady(true),[]),onFailure=useCallback(()=>{setReady(false);setFailed(true);},[]);
  useEffect(()=>{const abort=new AbortController();fetch('/assets/home/coastal-world/world.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('Scene unavailable');return r.json();}).then(async data=>{const response=await fetch(data.clearanceUrl,{signal:abort.signal});if(!response.ok)throw Error('Coast clearance unavailable');const clearance=new Uint8Array(await response.arrayBuffer());if(clearance.length!==data.width*data.height)throw Error('Incomplete coastline');const forestResponse=await fetch(data.forestUrl,{signal:abort.signal});if(!forestResponse.ok)throw Error('Forest unavailable');const trees=decodeForest(await forestResponse.arrayBuffer(),data.treeCount);setWorld({...data,clearance,trees});}).catch(()=>{if(!abort.signal.aborted)onFailure();});return()=>abort.abort();},[onFailure]);
  useEffect(()=>{const changed=()=>{setHidden(document.hidden);input.current.keys.clear();};document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[]);
  useEffect(()=>{onAvailability(ready);},[ready,onAvailability]);
  useEffect(()=>{if(driving){host.current?.focus();input.current.follow=true;}else {input.current.target=null;input.current.keys.clear();}},[driving]);
  const supported=typeof window.WebGLRenderingContext!=='undefined';
  return <div ref={host} className={`coastal-scene ${driving?'is-driving':''}`} tabIndex={0} role="region" aria-label="Interactive coastal scene" aria-describedby="boat-hint" onPointerDown={e=>{if(e.button!==0)return;pointer.current={x:e.clientX,y:e.clientY,distance:0};input.current.dragged=false;}} onPointerMove={e=>{const p=pointer.current;if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.distance+=Math.abs(dx)+Math.abs(dy);p.x=e.clientX;p.y=e.clientY;if(p.distance>5){e.currentTarget.setPointerCapture(e.pointerId);input.current.panX+=dx;input.current.panY+=dy;input.current.dragged=true;input.current.interacted=true;input.current.invalidate?.();}}} onPointerUp={()=>{pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}} onWheel={e=>{input.current.interacted=true;onZoom(e.deltaY<0?1.12:1/1.12);}} data-renderer={ready?'webgl':'loading'} data-motion={paused||hidden?'paused':'playing'} onBlur={()=>{if(input.current.keys.size)input.current.target=null;input.current.keys.clear();}} onKeyDown={e=>{
    if(!driving){
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();input.current.panX+=e.key==='ArrowLeft'?70:e.key==='ArrowRight'?-70:0;input.current.panY+=e.key==='ArrowUp'?70:e.key==='ArrowDown'?-70:0;input.current.interacted=true;input.current.invalidate?.();}return;
    }if(e.key==='Escape'){onExit();return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)){e.preventDefault();input.current.keys.add(e.key);}
  }} onKeyUp={e=>{input.current.keys.delete(e.key);if(!input.current.keys.size)input.current.target=null;}}>
    {!ready&&<div className="coastal-loading" role="status">{!supported||failed?'Interactive coastal map unavailable':'Loading coastal atlas…'}</div>}
    {supported&&!failed&&world&&<Boundary onFailure={onFailure}><Suspense fallback={null}><World world={world} paused={paused||hidden} driving={driving} zoom={zoom} resetView={resetView} input={input} onReady={onReady} onFailure={onFailure} host={host}/></Suspense></Boundary>}
  </div>;
}
