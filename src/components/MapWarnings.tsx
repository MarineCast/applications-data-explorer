import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MapWarningsContext } from './MapWarningsContext';
import './SourceWarning.css';

export function MapWarningsProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ host, setHost }), [host]);
  return <MapWarningsContext.Provider value={value}>{children}</MapWarningsContext.Provider>;
}

/** One warning stack for the mounted map, including nested renderers and Viewshed. */
export function MapWarningsRegion() {
  const context = useContext(MapWarningsContext);
  const region = useRef<HTMLDivElement | null>(null);
  const setHost = context?.setHost;
  const attach = useCallback((node: HTMLDivElement | null) => {
    region.current = node;
    setHost?.(node);
  }, [setHost]);
  useLayoutEffect(() => {
    const node = region.current;
    const map = node?.closest('#features-explorer');
    if (!node || !map || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const controls = () => [...map.querySelectorAll<HTMLElement>(
      '.map-legends,.weather-time-slider,.hydrology-history,.viewshed-bottom-dock,.timeline-side-control',
    )];
    const position = () => {
      frame = 0;
      const bounds = map.getBoundingClientRect();
      const warning = node.getBoundingClientRect();
      let bottom = 16;
      for (const control of controls()) {
        const style = getComputedStyle(control);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        const box = control.getBoundingClientRect();
        if (box.width && box.height && warning.left < box.right && warning.right > box.left) {
          bottom = Math.max(bottom, bounds.bottom - box.top + 12);
        }
      }
      // Short screens scroll the stack rather than losing warnings above the map.
      bottom = Math.min(bottom, Math.max(16, bounds.height - 112));
      node.style.setProperty('--map-warning-bottom', `${bottom}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(position); };
    const resize = new ResizeObserver(schedule);
    const observe = () => {
      resize.disconnect();
      for (const element of [map, node, ...controls()]) resize.observe(element);
      schedule();
    };
    const mutations = new MutationObserver(observe);
    mutations.observe(map, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    observe();
    return () => {
      resize.disconnect(); mutations.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return <div ref={attach} className="map-warning-stack" role="region" aria-label="Map warnings" />;
}
