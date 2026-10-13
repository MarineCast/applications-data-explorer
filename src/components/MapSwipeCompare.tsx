import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronsLeftRight } from "lucide-react";

export default function MapSwipeCompare({ left, right, onDragStart }: {
  left: ReactNode;
  right: ReactNode;
  onDragStart: () => void;
}) {
  const [position, setPosition] = useState(50);
  const root = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef(0);
  const move = (x: number) => {
    const rect = root.current?.getBoundingClientRect();
    if (rect?.width) setPosition(Math.max(0, Math.min(100, 100 * (x - rect.left) / rect.width)));
  };
  return <div className="map-swipe-compare" ref={root} aria-label="Geographically linked layer comparison">
    <div className="swipe-map-pane swipe-left">{left}</div>
    <div className="swipe-map-pane swipe-right" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>{right}</div>
    <div className="swipe-divider" role="slider" tabIndex={0}
      aria-label="Compare divider" aria-orientation="horizontal"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position)}
      aria-valuetext={`${Math.round(position)}% left layer, ${Math.round(100 - position)}% right layer`}
      style={{ left: `${position}%` }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        const rect = root.current?.getBoundingClientRect();
        dragOffset.current = rect ? event.clientX - (rect.left + rect.width * position / 100) : 0;
        onDragStart();
      }}
      onPointerMove={(event) => { if (dragging.current) move(event.clientX - dragOffset.current); }}
      onPointerUp={(event) => {
        if (dragging.current) move(event.clientX - dragOffset.current);
        dragging.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { dragging.current = false; }}
      onLostPointerCapture={() => { dragging.current = false; }}
      onKeyDown={(event) => {
        const delta = event.shiftKey ? 10 : 2;
        const next = event.key === "Home" ? 0 : event.key === "End" ? 100
          : event.key === "ArrowLeft" ? position - delta : event.key === "ArrowRight" ? position + delta : undefined;
        if (next !== undefined) {
          event.preventDefault();
          onDragStart();
          setPosition(Math.max(0, Math.min(100, next)));
        }
      }}
    ><span className="swipe-divider-track" aria-hidden="true" /><span className="swipe-divider-handle"><ChevronsLeftRight size={22} /></span></div>
  </div>;
}
