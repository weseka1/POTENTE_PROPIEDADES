import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../ui/cn";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string; // tailwind max-w
}

export default function Drawer({ open, onClose, children, width = "max-w-xl" }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-50", open ? "" : "pointer-events-none")}>
      <div
        className={cn(
          "absolute inset-0 bg-graph/70 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col border-l border-graph/[0.07] bg-paper-100 shadow-card transition-transform duration-300 ease-out",
          width,
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg bg-graph/60 p-1.5 text-graph-500 backdrop-blur transition hover:bg-graph/10 hover:text-graph"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
        <div className="h-full overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
