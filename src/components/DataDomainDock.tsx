import { Mountain, CloudSun, Waves, Droplets, Fish, FishSymbol, Users, Landmark, Ship, ScanEye, AudioLines, Layers3, PanelLeftClose, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { useState } from "react";
import type { RefObject, ReactNode } from "react";

const domains: { id: string; name: string; icon: LucideIcon }[] = [
  { id: "meteorology", name: "Meteorology", icon: CloudSun },
  { id: "hydrology", name: "Hydrology", icon: Droplets },
  { id: "oceanography", name: "Oceanography", icon: Waves },
  { id: "seascape", name: "Seascape", icon: Mountain },
  { id: "salmon", name: "Salmon", icon: Fish },
  { id: "marine-mammals", name: "Marine mammals", icon: FishSymbol },
  { id: "human", name: "Human", icon: Users },
  { id: "governance", name: "Governance", icon: Landmark },
  { id: "ais", name: "AIS", icon: Ship },
  { id: "viewshed", name: "Viewshed", icon: ScanEye },
  { id: "acoustics", name: "Acoustics", icon: AudioLines },
];

export default function DataDomainDock({ active, open, available, names, onSelect, activeButton, children, onCollapse, availabilityStatus }: {
  active: string; open: boolean; available: string[]; names: Record<string, string>;
  availabilityStatus?: "loading" | "error";
  onCollapse: () => void;
  onSelect: (domain: string) => void; activeButton: RefObject<HTMLButtonElement | null>; children: ReactNode;
}) {
  const [labels, setLabels] = useState(false);
  const unavailableLabel = availabilityStatus === "loading" ? "Loading layers" : availabilityStatus === "error" ? "Layer list unavailable" : "No available layers";
  const [hint, setHint] = useState<{ id:string; label:string; unavailable:boolean; top:number; left:number }>();
  const showHint = (target: HTMLButtonElement, id: string, label: string, unavailable: boolean) => {
    const box = target.getBoundingClientRect();
    setHint({id,label,unavailable,top:box.top + box.height / 2,left:box.right + 12});
  };
  const entries = [...domains, ...available.filter(id => !domains.some(domain => domain.id === id))
    .map(id => ({ id, name: names[id] ?? id, icon: Layers3 }))];
  return <>
    <nav id="data-domain-dock" className={`panel data-domain-dock ${labels ? "domain-labels-open" : ""}`} aria-label="Data domains">
      <button className="dock-collapse" aria-label="Collapse product dock" title="Map only" onClick={onCollapse}><PanelLeftClose size={20} /><span className="domain-tooltip">Map only</span></button>
      <button className="dock-label-toggle" aria-label="Show product names" aria-pressed={labels} title="Show product names" onClick={() => setLabels(!labels)}><Tags size={19} /><span className="domain-tooltip">Product names</span></button>
      {entries.map(({ id, name, icon: Icon }) => {
        const enabled = available.includes(id);
        const label = names[id] ?? name;
        return <button key={id} ref={active === id ? activeButton : undefined}
          aria-label={`${label} layers`} title={enabled ? label : `${label} · ${unavailableLabel.toLowerCase()}`}
          aria-pressed={active === id} aria-expanded={enabled && active === id && open}
          aria-controls={enabled && active === id && open ? "domain-layer-panel" : undefined}
          onMouseEnter={event => showHint(event.currentTarget, id, label, !enabled)} onMouseLeave={() => setHint(undefined)}
          onFocus={event => showHint(event.currentTarget, id, label, !enabled)} onBlur={() => setHint(undefined)}
          aria-disabled={!enabled} onClick={() => { if (enabled) { setLabels(false); setHint(undefined); onSelect(id); } }}>
          <Icon size={22} aria-hidden="true" /><span className="domain-visible-name">{label}{!enabled && <small>{unavailableLabel}</small>}</span>{!enabled && !availabilityStatus && <i className="domain-unavailable-dot" aria-hidden="true" />}
        </button>;
      })}
    </nav>
    {hint && !labels && !(open && active === hint.id) && createPortal(<span className="domain-dock-tooltip" role="tooltip" style={{top:hint.top,left:hint.left}}>{hint.label}{hint.unavailable && <small>{unavailableLabel}</small>}</span>, document.body)}
    {children}
  </>;
}
