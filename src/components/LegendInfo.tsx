import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import "./LegendInfo.css";

/** Supplemental legend notes, independent of the appearance button. */
export default function LegendInfo({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const show = () => {
    const rect = root.current?.getBoundingClientRect();
    if (!rect) return;
    const above = rect.top > 220;
    setPosition({ left: Math.max(12, Math.min(rect.right - 320, window.innerWidth - 332)),
      ...(above ? { bottom: window.innerHeight - rect.top, maxHeight: rect.top - 12 }
        : { top: rect.bottom, maxHeight: window.innerHeight - rect.bottom - 12 }) });
  };
  const leave = (target: EventTarget | null) => {
    if (target instanceof Node && (root.current?.contains(target) || popup.current?.contains(target))) return;
    if (root.current?.contains(document.activeElement)) return;
    setPosition(null);
  };
  useEffect(() => {
    if (!position) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !popup.current?.contains(event.target)) setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); setPosition(null); }
    };
    const dismiss = () => setPosition(null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", dismiss);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); window.removeEventListener("resize", dismiss); };
  }, [position]);
  return <div className="legend-info" ref={root} onMouseEnter={show} onMouseLeave={event => leave(event.relatedTarget)}
    onFocus={show} onBlur={event => { if (!(event.relatedTarget instanceof Node && popup.current?.contains(event.relatedTarget))) setPosition(null); }}>
    <button type="button" className="legend-info-trigger" aria-label={label} aria-expanded={Boolean(position)} aria-describedby={position ? id : undefined} onClick={show}><Info size={16} aria-hidden="true" /></button>
    {position && createPortal(<div ref={popup} id={id} className="legend-info-popup" role="tooltip" style={position}
      onMouseLeave={event => leave(event.relatedTarget)}><div className="legend-info-content">{children}</div></div>, document.body)}
  </div>;
}
