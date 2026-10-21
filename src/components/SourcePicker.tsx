import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SourcePickerItem } from "../data/sourcePicker";
import "./SourcePicker.css";

// Scroll only the choices, keeping the surrounding selector and popup heading fixed.
function revealInResults(element?: HTMLElement | null) {
  const list = element?.closest<HTMLElement>(".source-picker-results");
  if (!element || !list) return;
  const item = element.getBoundingClientRect(), viewport = list.getBoundingClientRect();
  const inset = Math.min(8, Math.max(0, ((viewport.bottom - viewport.top) - (item.bottom - item.top)) / 2));
  if (item.top < viewport.top + inset) list.scrollTop += item.top - viewport.top - inset;
  else if (item.bottom > viewport.bottom - inset)
    list.scrollTop += Math.min(item.top - viewport.top - inset, item.bottom - viewport.bottom + inset);
}

export default function SourcePicker({ label, items, value, onChange, copyable = false, compactCopyFeedback = false, showInformation = true, preserveOrder = false, iconFor }: {
  label: string;
  items: SourcePickerItem[];
  value: string;
  onChange: (value: string) => void;
  copyable?: boolean;
  compactCopyFeedback?: boolean;
  showInformation?: boolean;
  preserveOrder?: boolean;
  iconFor?: (id: string) => LucideIcon;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const infoPanel = useRef<HTMLDivElement>(null);
  const choices = useRef(new Map<string, HTMLButtonElement>());
  const infoButtons = useRef(new Map<string, HTMLButtonElement>());
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const [info, setInfo] = useState<string>();
  const [copied, setCopied] = useState<string>();
  const [copyFeedback, setCopyFeedback] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const searchable = items.length >= 12;
  const filtered = items.filter(item => !query || `${item.name} ${item.secondary ?? ""} ${item.id} ${item.group}`.toLowerCase().includes(query.toLowerCase()));
  const selected = items.find(item => item.id === value);
  const SelectedIcon = selected && iconFor?.(selected.id);
  const sorted = preserveOrder ? filtered : [...filtered].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric:true, sensitivity:"base" }) || a.id.localeCompare(b.id));
  const groups = [...new Set(items.map(item => item.group))].filter(group => sorted.some(item => item.group === group));
  const ordered = groups.flatMap(group => sorted.filter(item => item.group === group));
  const activeId = ordered.some(item => item.id === active) ? active : ordered[0]?.id;
  const close = () => { setOpen(false); setInfo(undefined); trigger.current?.focus(); };
  // Fit to the actual drawer body, not a fraction of the browser height. A
  // nested list must be fully inside the outer scrollport or its last rows can
  // remain clipped even at the list's maximum scroll position.
  useLayoutEffect(() => {
    if (!open) return;
    const body = root.current?.closest<HTMLElement>(".layer-body, .comparison-setup-scroll");
    const menu = popup.current;
    if (!body || !menu) return;
    const fit = () => {
      const style = getComputedStyle(body);
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      const height = body.clientHeight - paddingTop - paddingBottom;
      if (height <= 0) return;
      menu.style.maxHeight = `${Math.min(330, height)}px`;
      const viewport = body.getBoundingClientRect(), bounds = menu.getBoundingClientRect();
      if (bounds.bottom > viewport.bottom - paddingBottom)
        body.scrollTop += bounds.bottom - viewport.bottom + paddingBottom;
      else if (bounds.top < viewport.top + paddingTop)
        body.scrollTop -= viewport.top + paddingTop - bounds.top;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && menu.contains(focused)) revealInResults(focused);
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(fit);
    observer?.observe(body);
    window.addEventListener("resize", fit);
    return () => { observer?.disconnect(); window.removeEventListener("resize", fit); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const selectedButton = choices.current.get(value);
    const initial = selectedButton && !selectedButton.disabled ? selectedButton
      : infoButtons.current.get(value) ?? [...choices.current.values()].find(button => !button.disabled)
      ?? [...infoButtons.current.values()][0];
    if (searchable) search.current?.focus({ preventScroll:true });
    else { initial?.focus({ preventScroll:true }); revealInResults(initial); }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) { setOpen(false); setInfo(undefined); }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, value, searchable]);
  useEffect(() => {
    if (info) revealInResults(infoPanel.current);
  }, [info]);
  const focusItem = (item: SourcePickerItem) => {
    setActive(item.id);
    const button = (item.disabled ? infoButtons.current : choices.current).get(item.id);
    button?.focus({ preventScroll:true });
    revealInResults(button);
  };
  const copyName = async (item: SourcePickerItem) => {
    const name = item.copyText ?? item.name;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(name);
      setCopied(item.id);
      setCopyFeedback(`Copied ${name}.`);
    } catch {
      setCopied(undefined);
      setCopyFeedback("Could not copy the metric name. Please try again.");
    }
  };
  return <div className="source-picker field" ref={root} onBlur={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setInfo(undefined); }
  }}>
    <span id={`${id}-label`}>{label}</span>
    <button ref={trigger} type="button" className="source-picker-trigger" aria-label={label} value={value}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-popup` : undefined}
      onClick={() => { setActive(value); setInfo(undefined); setCopied(undefined); setCopyFeedback(""); setQuery(""); setOpen(!open); }}>
      <span className="source-picker-trigger-value">{SelectedIcon && <SelectedIcon size={18} aria-hidden="true" />}<span>{selected?.name ?? "Choose a source"}{selected?.secondary && <small className="source-picker-distinction">{selected.secondary}</small>}</span></span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div ref={popup} className="source-picker-popup" id={`${id}-popup`} role="dialog" aria-label={`${label} picker`}
      onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault(); event.stopPropagation();
          if (info) {
            const button = infoButtons.current.get(info);
            button?.focus({ preventScroll:true });
            revealInResults(button);
            setInfo(undefined);
          } else close();
          return;
        }
        if (event.target === search.current) {
          if (event.key === "ArrowDown" && ordered.length) { event.preventDefault(); event.stopPropagation(); focusItem(ordered[0]); }
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !ordered.length) return;
        event.preventDefault(); event.stopPropagation();
        const index = ordered.findIndex(item => item.id === activeId);
        const next = event.key === "Home" ? 0 : event.key === "End" ? ordered.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + ordered.length) % ordered.length;
        focusItem(ordered[next]);
      }}>
      <div className="source-picker-heading"><strong>Choose {label.toLowerCase()}</strong><button type="button" aria-label={`Close ${label.toLowerCase()} picker`} onClick={close}><X size={16} /></button></div>
      {searchable && <input ref={search} type="search" className="source-picker-search" aria-label={`Filter ${label.toLowerCase()}`} placeholder="Filter variables…" value={query} onChange={event => { setQuery(event.target.value); setInfo(undefined); }} />}
      {copyable && copyFeedback && <p className={`source-picker-feedback${compactCopyFeedback && copied ? " sr-only" : ""}`} role="status">{copyFeedback}</p>}
      <div className="source-picker-results">
        {!ordered.length && <p className="source-picker-empty">{query ? "No matching variables." : "No items available."}</p>}
        {groups.map(group => <section key={group} aria-label={group}>
          {groups.length > 1 && <h3>{group}</h3>}
          <ul>{ordered.filter(item => item.group === group).map(item => {
            const ItemIcon = iconFor?.(item.id);
            return <li key={item.id}>
            <div className={`source-picker-row ${value === item.id ? "selected" : ""}`}>
              <button type="button" className="source-picker-choice" aria-label={`Select ${item.name}`} aria-pressed={value === item.id}
                disabled={item.disabled} value={item.id} tabIndex={activeId === item.id ? 0 : -1}
                ref={node => { if (node) choices.current.set(item.id, node); else choices.current.delete(item.id); }} onFocus={() => setActive(item.id)}
                onClick={() => { onChange(item.id); close(); }}>
                <span className="source-picker-option-label">{ItemIcon && <ItemIcon size={18} aria-hidden="true" />}<span>{item.name}{item.secondary && <small className="source-picker-distinction">{item.secondary}</small>}{item.unavailable && <small>{item.disabled ? "Unavailable at this resolution" : "No available values"}</small>}</span></span>
                {value === item.id && <Check size={15} aria-hidden="true" />}
              </button>
              {showInformation && <button type="button" className="source-picker-info" aria-label={`About ${item.name}`} aria-expanded={info === item.id}
                aria-controls={info === item.id ? `${id}-info` : undefined} tabIndex={activeId === item.id ? 0 : -1}
                ref={node => { if (node) infoButtons.current.set(item.id, node); else infoButtons.current.delete(item.id); }} onFocus={() => setActive(item.id)}
                onClick={() => setInfo(info === item.id ? undefined : item.id)}><Info size={17} aria-hidden="true" /></button>}
              {copyable && <button type="button" className="source-picker-copy" aria-label={`Copy metric name: ${item.name}`}
                title={copied === item.id ? "Copied" : "Copy metric name"} tabIndex={activeId === item.id ? 0 : -1}
                onFocus={() => setActive(item.id)} onClick={() => { void copyName(item); }}>
                {copied === item.id ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              </button>}
            </div>
            {info === item.id && <div ref={infoPanel} className="source-picker-description" id={`${id}-info`} role="region" aria-label={`About ${item.name}`}>
              <strong>{item.name}</strong><p>{item.summary}</p>
              <dl>{item.details.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
              {item.note && <p className="source-picker-note">{item.note}</p>}
            </div>}
          </li>;
          })}</ul>
        </section>)}
      </div>
    </div>}
  </div>;
}
