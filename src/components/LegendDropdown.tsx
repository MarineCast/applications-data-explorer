import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { X } from "lucide-react";

/** Shared legend trigger, popup and dismissal behavior for all data pages. */
export default function LegendDropdown({ label, buttonLabel = "Color options", popupLabel,
  heading = "Map colors", title, preview, children, className = "", popupClassName = "",
  open: controlledOpen, onOpenChange, rootRef, buttonRef, closeLabel = "Close color options",
}: {
  label: string; buttonLabel?: string; popupLabel: string; heading?: string; title?: string;
  preview: ReactNode; children: ReactNode; className?: string; popupClassName?: string;
  open?: boolean; onOpenChange?: (open: boolean) => void; closeLabel?: string;
  rootRef?: RefObject<HTMLElement | null>; buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const localRoot = useRef<HTMLElement>(null);
  const localButton = useRef<HTMLButtonElement>(null);
  const root = rootRef ?? localRoot;
  const trigger = buttonRef ?? localButton;
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
  useEffect(() => {
    if (!open) return;
    const popup = root.current?.querySelector<HTMLElement>('[role="dialog"]');
    (popup?.querySelector<HTMLInputElement>('input[type="radio"]:checked') ??
      popup?.querySelector<HTMLButtonElement>("button"))?.focus();
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
    {open && <div id={id} className={`panel colorbar-settings ${popupClassName}`} role="dialog" aria-label={popupLabel}>
      <header className="legend-popup-heading"><strong>{heading}</strong>
        <button aria-label={closeLabel} onClick={close}><X size={17} /></button>
      </header>
      {children}
    </div>}
  </section>;
}
