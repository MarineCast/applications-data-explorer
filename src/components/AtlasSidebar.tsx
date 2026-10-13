import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Compass,
  Download,
  GitCompareArrows,
  Layers3,
} from "lucide-react";
import { useState } from "react";
export default function AtlasSidebar({
  layers,
  compare,
  onExplore,
  onLayers,
  onCompare,
  onExport,
  onHelp,
  canExport,
}: {
  layers: boolean;
  compare: boolean;
  onExplore: () => void;
  onLayers: () => void;
  onCompare: () => void;
  onExport: () => void;
  onHelp: () => void;
  canExport: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const items = [
    {
      name: "Explore",
      icon: Compass,
      action: onExplore,
      active: !layers && !compare,
    },
    { name: "Layers", icon: Layers3, action: onLayers, active: layers },
    {
      name: "Compare",
      icon: GitCompareArrows,
      action: onCompare,
      active: compare,
    },
    { name: "Export", icon: Download, action: onExport, disabled: !canExport },
  ];
  return (
    <nav
      className={`atlas-sidebar ${collapsed ? "compact" : ""}`}
      aria-label="Map tools"
    >
      <div className="atlas-sidebar-main">
        {items.map(({ name, icon: Icon, action, active, disabled }) => (
          <button
            key={name}
            aria-label={name}
            title={name}
            aria-pressed={active}
            disabled={disabled}
            onClick={action}
          >
            <Icon size={21} strokeWidth={1.7} />
            <span>{name}</span>
          </button>
        ))}
      </div>
      <div className="atlas-sidebar-bottom">
        <button aria-label="Map help" title="Map help" onClick={onHelp}>
          <CircleHelp size={21} />
          <span>Help</span>
        </button>
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={21} /> : <ChevronLeft size={21} />}
        </button>
      </div>
    </nav>
  );
}
