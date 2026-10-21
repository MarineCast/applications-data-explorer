import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { startCoastalCinemagraph } from './coastalPhotoMotion';

type Motion = ReturnType<typeof startCoastalCinemagraph>;

export default function CoastalCinemagraph({ theme = 'light', sweep = false, onSweepComplete }: {
  theme?: 'light' | 'dark'; sweep?: boolean; onSweepComplete?: () => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const nightImage = useRef<HTMLImageElement>(null);
  const nightCanvas = useRef<HTMLCanvasElement>(null);
  const nightMotion = useRef<Motion | null>(null);
  const [nightReady, setNightReady] = useState(false);
  const motion = useRef<Motion | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
    motion.current?.setPaused(paused);
    nightMotion.current?.setPaused(paused);
  }, [paused]);
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onPreference = () => setPaused(preference?.matches ?? true);
    preference?.addEventListener('change', onPreference);
    return () => preference?.removeEventListener('change', onPreference);
  }, []);
  useEffect(() => {
    const img = image.current;
    const surface = canvas.current;
    if (!img || !surface || typeof WebGLRenderingContext === 'undefined') return;
    let disposed = false;
    const load = async () => {
      try {
        const { startCoastalCinemagraph } = await import('./coastalPhotoMotion');
        if (disposed) return;
        motion.current = startCoastalCinemagraph(surface, img, pausedRef.current);
        setReady(true);
      } catch {
        // Keep the unchanged image if this device cannot render the effect.
      }
    };
    if (img.complete && img.naturalWidth) void load();
    else img.addEventListener('load', load, { once: true });
    return () => {
      disposed = true; img.removeEventListener('load', load);
      motion.current?.dispose(); motion.current = null;
    };
  }, []);
  useEffect(() => {
    const img = nightImage.current;
    const surface = nightCanvas.current;
    if (!img || !surface || typeof WebGLRenderingContext === 'undefined') return;
    let disposed = false;
    const load = async () => {
      try {
        const { startCoastalCinemagraph } = await import('./coastalPhotoMotion');
        if (disposed) return;
        nightMotion.current = startCoastalCinemagraph(surface, img, pausedRef.current, true);
        setNightReady(true);
      } catch { /* The night image remains available without WebGL. */ }
    };
    if (img.complete && img.naturalWidth) void load();
    else img.addEventListener('load', load, { once: true });
    return () => {
      disposed = true; img.removeEventListener('load', load);
      nightMotion.current?.dispose(); nightMotion.current = null;
    };
  }, []);
  return <>
    <div className="coastal-backdrop" aria-hidden="true">
      <img ref={image} className="coastal-background" src="/assets/home/salish-sea-preview.png" alt="" fetchPriority="high" decoding="async" draggable={false} />
      <canvas ref={canvas} className={`coastal-motion ${ready ? 'is-ready' : ''}`} />
      <div className={`coastal-night-layer ${theme === 'dark' ? 'is-night' : ''} ${sweep ? 'is-sweeping' : ''}`}
        onAnimationEnd={event => {
          if (event.target === event.currentTarget && event.animationName === `coastal-${theme}-from-east`) onSweepComplete?.();
        }}>
        <img ref={nightImage} className="coastal-background" src="/assets/home/salish-sea-night-soft.png" alt="" decoding="async" draggable={false} />
        <canvas ref={nightCanvas} className={`coastal-motion ${nightReady ? 'is-ready' : ''}`} />
      </div>
    </div>
    {(ready || nightReady) && <button className="coastal-motion-toggle" onClick={() => setPaused(value => !value)}
      aria-label={paused ? 'Play background animation' : 'Pause background animation'}
      title={paused ? 'Play background animation' : 'Pause background animation'}>
      {paused ? <Play size={15} /> : <Pause size={15} />}
    </button>}
  </>;
}
