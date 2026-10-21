import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';

type Axis = 'width' | 'height' | 'both';
type Size = { width: number; height: number | null };
const defaultSize: Size = { width: 420, height: null };
const defaultHeight = 420;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export default function useResizableInsights(open: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [size, setSize] = useState<Size>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('marinecast.insights.size') ?? 'null');
      if (saved && Number.isFinite(saved.width) && (saved.height === null || Number.isFinite(saved.height)))
        return { width: clamp(saved.width, 280, 1200), height: saved.height === null ? null : clamp(saved.height, 120, 1400) };
    } catch { /* Resizing works without storage. */ }
    return defaultSize;
  });
  const [limits, setLimits] = useState({ width: 800, height: 700 });
  const active = useRef<{ axis: Axis; x: number; y: number; width: number; height: number; pointer: number } | null>(null);
  useEffect(() => {
    try { sessionStorage.setItem('marinecast.insights.size', JSON.stringify(size)); } catch { /* Optional preference. */ }
  }, [size]);
  useEffect(() => {
    if (!open || !root.current || !panel.current) return;
    const surface = root.current.closest<HTMLElement>('#features-explorer') ?? root.current;
    const observedLegends = new Set<HTMLElement>();
    let observer: ResizeObserver | null = null;
    const measure = () => {
      if (!panel.current) return;
      const box = surface.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const pane = panel.current.getBoundingClientRect();
      const legends = [...surface.querySelectorAll<HTMLElement>('.map-bottom-controls, .map-legends, .viewshed-bottom-dock')];
      for (const legend of observedLegends) {
        if (!legends.includes(legend)) { observer?.unobserve(legend); observedLegends.delete(legend); }
      }
      for (const legend of legends) {
        if (!observedLegends.has(legend)) { observer?.observe(legend); observedLegends.add(legend); }
      }
      let bottom = box.bottom - 16;
      for (const legend of legends) {
        const rect = legend.getBoundingClientRect();
        if (rect.height && rect.right > pane.left && rect.left < pane.right && getComputedStyle(legend).display !== 'none') bottom = Math.min(bottom, rect.top - 12);
      }
      const layers = surface.querySelector<HTMLElement>('.domain-layer-panel');
      const layerBox = layers?.getBoundingClientRect();
      const left = box.width >= 1100 && layerBox?.width ? layerBox.right + 16 : box.left + 78;
      const next = { width: Math.max(180, box.right - left - 16), height: Math.max(80, bottom - pane.top) };
      setLimits(previous => previous.width === next.width && previous.height === next.height ? previous : next);
    };
    observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(surface);
    measure();
    // Opening/closing layers or adding a comparison legend can change the available region.
    const mutation = new MutationObserver(measure);
    mutation.observe(surface, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', measure);
    return () => { active.current = null; observer?.disconnect(); mutation.disconnect(); window.removeEventListener('resize', measure); };
  }, [open]);
  const minWidth = Math.min(320, limits.width);
  const minHeight = Math.min(220, limits.height);
  const width = clamp(size.width, minWidth, limits.width);
  const height = clamp(size.height ?? defaultHeight, minHeight, limits.height);
  const apply = (axis: Axis, w: number, h: number) => setSize(previous => ({
    width: axis === 'height' ? previous.width : clamp(w, minWidth, limits.width),
    height: axis === 'width' ? previous.height : clamp(h, minHeight, limits.height),
  }));
  const start = (axis: Axis) => (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !panel.current) return;
    event.preventDefault();
    const rect = panel.current.getBoundingClientRect();
    active.current = { axis, x: event.clientX, y: event.clientY, width: rect.width || width, height: rect.height || height, pointer: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const drag = active.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    apply(drag.axis, drag.width + drag.x - event.clientX, drag.height + event.clientY - drag.y);
  };
  const stop = () => { active.current = null; };
  const keyboard = (axis: Axis) => (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 16;
    const horizontal = axis !== 'height';
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault();
    let nextWidth = width, nextHeight = height;
    if (horizontal) {
      if (event.key === 'ArrowLeft') nextWidth += step;
      if (event.key === 'ArrowRight') nextWidth -= step;
      if (event.key === 'Home') nextWidth = minWidth;
      if (event.key === 'End') nextWidth = limits.width;
    }
    if (axis !== 'width') {
      if (event.key === 'ArrowDown') nextHeight += step;
      if (event.key === 'ArrowUp') nextHeight -= step;
      if (event.key === 'Home') nextHeight = minHeight;
      if (event.key === 'End') nextHeight = limits.height;
    }
    apply(axis, nextWidth, nextHeight);
  };
  const handles = (axis: Axis) => ({ onPointerDown:start(axis), onPointerMove:move, onPointerUp:stop, onPointerCancel:stop, onLostPointerCapture:stop, onKeyDown:keyboard(axis) });
  const style = { '--insights-user-width':`${width}px`, '--insights-user-height':`${height}px` } as CSSProperties;
  return { root, panel, style, handles, width, height, minWidth, minHeight, limits, reset:() => setSize(defaultSize) };
}
