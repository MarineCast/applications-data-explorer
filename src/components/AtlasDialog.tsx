import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
export default function AtlasDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="atlas-dialog"
      ref={dialog}
      aria-label={title}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
          autoFocus
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
