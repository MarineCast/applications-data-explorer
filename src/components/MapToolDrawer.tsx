import { useEffect, useId, useRef } from "react";
import type { RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CircleHelp,
  Download,
  GitCompareArrows,
  SlidersHorizontal,
} from "lucide-react";

type ToolAction = {
  label: string;
  text?: string;
  icon: LucideIcon;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  compactLabel?: boolean;
};
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
} & ({ actions: ToolAction[] } | {
  compare: boolean;
  canExport: boolean;
  onCompare: () => void;
  onExport: () => void;
  onHelp: () => void;
});

export default function MapToolDrawer(props: Props) {
  const { open, onOpenChange, triggerRef } = props;
  const root = useRef<HTMLDivElement>(null);
  const localTrigger = useRef<HTMLButtonElement>(null);
  const trigger = triggerRef ?? localTrigger;
  const actionsId = useId();
  const actions: ToolAction[] = "actions" in props ? props.actions : [
    { label: "Compare", icon: GitCompareArrows, pressed: props.compare, onClick: props.onCompare },
    { label: "Export", icon: Download, disabled: !props.canExport, onClick: props.onExport },
    { label: "Map help", text: "Help", icon: CircleHelp, compactLabel: true, onClick: props.onHelp },
  ];
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange, trigger]);
  return (
    <div className="map-tool-drawer" ref={root}>
      <button
        className="panel tool-drawer-trigger"
        ref={trigger}
        aria-label="Map tools"
        title="Map tools"
        aria-expanded={open}
        aria-controls={actionsId}
        onClick={() => onOpenChange(!open)}
      >
        <SlidersHorizontal size={20} />
      </button>
      {open && (
        <nav className="panel tool-drawer-actions" id={actionsId} aria-label="Map tools">
          {actions.map(({ label, text, icon: Icon, onClick, pressed, disabled, compactLabel }) => (
            <button key={label} aria-label={label} title={label} aria-pressed={pressed} disabled={disabled}
              onClick={() => { onOpenChange(false); trigger.current?.focus(); onClick(); }}>
              <Icon size={19} /><span className={compactLabel ? "tool-help-label" : undefined}>{text ?? label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
