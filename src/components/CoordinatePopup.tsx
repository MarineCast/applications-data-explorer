import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { coordinateText } from "../data/mapCoordinates";
import type { MapCoordinates } from "../data/mapCoordinates";

export default function CoordinatePopup({ coordinates, onClose }: {
  coordinates: MapCoordinates;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const copy = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const text = coordinateText(coordinates.lat, coordinates.lon);
  useEffect(() => { copy.current?.focus(); }, []);
  return <section className="viewshed-coordinate-popup" role="dialog" aria-label="Map coordinates"
    style={{ left: coordinates.left, top: coordinates.top }}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <header><strong>Coordinates</strong><button aria-label="Close coordinates" onClick={onClose}><X size={14} /></button></header>
    <label>Latitude, longitude
      <input ref={input} aria-label="Latitude, longitude" readOnly value={text} onFocus={event => event.currentTarget.select()} />
    </label>
    <button ref={copy} className="viewshed-copy-coordinates" onClick={async () => {
      setError(false);
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } catch {
        setCopied(false);
        setError(true);
        input.current?.focus();
        input.current?.select();
      }
    }}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy coordinates"}</button>
    <span className="viewshed-copy-status" role="status">{error ? "Copy unavailable. Select the text and copy it." : copied ? "Coordinates copied." : ""}</span>
  </section>;
}
