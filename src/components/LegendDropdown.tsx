import { useCallback, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { X } from "lucide-react";

/** Shared legend trigger, popup and dismissal behavior for all data pages. */
export default function LegendDropdown({ label, buttonLabel = "Color options", popupLabel,
  heading = "Map colors", title, preview, info, items, children, className = "", popupClassName = "",
  open: controlledOpen, onOpenChange, rootRef, buttonRef, closeLabel = "Close color options",
}: {
  label: string; buttonLabel?: string; popupLabel: string; heading?: string; title?: string;
  preview: ReactNode; info?: ReactNode; items?: ReactNode; children: ReactNode; className?: string; popupClassName?: string;
  open?: boolean; onOpenChange?: (open: boolean) => void; closeLabel?: string;
  rootRef?: RefObject<HTMLElement | null>; buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const localRoot = useRef<HTMLElement>(null);
  const localButton = useRef<HTMLButtonElement>(null);
  const root = rootRef ?? localRoot;
  const trigger = buttonRef ?? localButton;
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = controlledOpen ?? localOpen;
  const setOpen = useCallback((value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setLocalOpen(value);
  }, [onOpenChange]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const dismiss = useEffectEvent((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  });
  // The browser's top layer escapes Safari's clipping of fixed descendants
  // inside the scrollable legend. Keep the DOM relationship for dismissal/focus.
  useLayoutEffect(() => {
    const element = popup.current, button = trigger.current;
    if (!open || !element || !button) return;
    const place = () => {
      const rect = button.getBoundingClientRect();
      const width = Math.min(310, window.innerWidth - 24);
      const bottom = Math.max(12, window.innerHeight - rect.top + 10);
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left));
      Object.assign(element.style, { position:"fixed", inset:"auto", margin:"0", left:`${left}px`, bottom:`${bottom}px`,
        width:`${width}px`, maxWidth:"calc(100vw - 24px)", maxHeight:`${Math.max(100, window.innerHeight - bottom - 80)}px` });
    };
    place();
    element.showPopover?.();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(place);
    observer?.observe(button);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, trigger]);
  useEffect(() => {
    if (!open) return;
    (popup.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked') ??
      popup.current?.querySelector<HTMLButtonElement>("button"))?.focus({ preventScroll:true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) dismiss(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss(true);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, root, trigger]);
  return <section ref={root} className={`colorbar-legend ${open ? "settings-open" : ""} ${className}`} aria-label={label}>
    <button ref={trigger} className="panel colorbar-trigger" aria-label={buttonLabel} title={title}
      aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
      {preview}
    </button>
    {items}
    {info}
    {open && <div ref={popup} popover="manual" id={id} className={`panel colorbar-settings ${popupClassName}`} role="dialog" aria-label={popupLabel}>
      <header className="legend-popup-heading"><strong>{heading}</strong>
        <button aria-label={closeLabel} onClick={close}><X size={17} /></button>
      </header>
      {children}
    </div>}
  </section>;
}
