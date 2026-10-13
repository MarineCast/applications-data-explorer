import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { atlasFrame, LOOKOUT } from './atlasMotion';
import grove from './grove.json';
const AtlasCanvas = lazy(() => import('./AtlasCanvas'));
const ROOT = '/assets/home/field-atlas/';
class SceneBoundary extends Component<{
    children: ReactNode;
    onFailure: () => void;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch() { this.props.onFailure(); }
    render() { return this.state.failed ? null : this.props.children; }
}
export default function FieldAtlasScene({ paused, onNavigate }: {
    paused: boolean;
    onNavigate: () => void;
}) {
    const host = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false), [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(document.hidden);
    const [frame, setFrame] = useState({ scale: 1, x: 0, y: 0 });
    const active = hovered || focused, still = paused || hidden;
    const onReady = useCallback(() => setReady(true), []), onFailure = useCallback(() => setReady(false), []);
    useEffect(() => {
        const update = () => setHidden(document.hidden);
        document.addEventListener('visibilitychange', update);
        return () => document.removeEventListener('visibilitychange', update);
    }, []);
    useEffect(() => {
        const element = host.current;
        if (!element || typeof ResizeObserver === 'undefined')
            return;
        const update = () => setFrame(atlasFrame(element.clientWidth, element.clientHeight));
        const observer = new ResizeObserver(update);
        observer.observe(element);
        update();
        return () => observer.disconnect();
    }, []);
    const canvasSupported = typeof window.WebGLRenderingContext !== 'undefined';
    return <div ref={host} className="field-atlas-scene" data-renderer={ready ? 'webgl' : 'static'} data-motion={still ? 'paused' : 'playing'} data-preview={active ? 'viewing-fan' : 'none'}>
  <div className={`atlas-static ${ready ? 'is-ready' : ''}`} aria-hidden="true">
   <div className="atlas-static-world" style={{ transform: `translate(${frame.x}px,${frame.y}px) scale(${frame.scale})` }}>
    <div className="atlas-static-island"/>
    {grove.map((tree, i) => <img key={i} className="atlas-static-tree" src={`${ROOT}tree-${tree.variant + 1}.webp`} alt="" style={{ left: tree.x, top: tree.y, height: tree.height }}/>)}
    <img className="atlas-static-tree" src={`${ROOT}lookout.webp`} alt="" style={{ left: LOOKOUT.x, top: LOOKOUT.y, height: LOOKOUT.height }}/>
   </div>
  </div>
  {canvasSupported && <div className="atlas-webgl" aria-hidden="true"><SceneBoundary onFailure={onFailure}><Suspense fallback={null}>
   <AtlasCanvas paused={still} preview={active} onReady={onReady} host={host}/>
  </Suspense></SceneBoundary></div>}
  <div className="atlas-lookout-target" style={{ left: frame.x + LOOKOUT.x * frame.scale, top: frame.y + (LOOKOUT.y - LOOKOUT.height) * frame.scale }}>
   <button className="atlas-lookout" aria-label="Open Viewshed from the lookout" aria-describedby={active ? 'lookout-description' : undefined} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onClick={onNavigate} style={{ height: Math.max(54, LOOKOUT.height * frame.scale + 38), width: Math.max(90, 86 * frame.scale) }}>
    <span>Viewshed <ArrowUpRight size={13}/></span>
   </button>
   {active && <div className="atlas-lookout-note" id="lookout-description"><strong>A different point of view</strong><p>Explore what can be seen from shore.</p><small>Illustrative viewing fan</small></div>}
  </div>
 </div>;
}
