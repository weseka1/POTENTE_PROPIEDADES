import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../ui/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}

export default function Modal({ open, onClose, title, subtitle, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-graph/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "pcard relative z-10 w-full overflow-hidden",
          "animate-[fadeIn_.18s_ease-out]",
          size === "lg" ? "max-w-2xl" : "max-w-lg"
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 border-b border-graph/[0.07] px-6 py-4">
            <div>
              {title && <h3 className="font-display text-lg font-semibold text-graph">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-sm text-graph-400">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-graph-400 transition hover:bg-graph/5 hover:text-graph"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-graph/[0.07] bg-graph/[0.03] px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}
