import { createPortal } from "react-dom";
import { Minus, Plus } from "lucide-react";

export default function ViewshedZoomControls({ container, zoom, min, max, onIn, onOut }: {
  container?: HTMLElement | null; zoom: number; min: number; max: number;
  onIn: () => void; onOut: () => void;
}) {
  const controls = <div className="viewshed-zoom" role="group" aria-label="Map navigation">
    <button aria-label="Zoom in" disabled={zoom >= max} onClick={onIn}><Plus size={18} /></button>
    <button aria-label="Zoom out" disabled={zoom <= min} onClick={onOut}><Minus size={18} /></button>
  </div>;
  return container ? createPortal(controls, container) : controls;
}
