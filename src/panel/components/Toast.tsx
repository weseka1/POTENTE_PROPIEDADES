import { createContext, useContext, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { cn } from "../ui/cn";

type ToastKind = "success" | "info" | "loading" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  msg: string;
}

interface ToastCtx {
  push: (msg: string, kind?: ToastKind, ms?: number) => void;
}

const Ctx = createContext<ToastCtx>({ push: () => {} });
export const useToast = () => useContext(Ctx);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => setItems((p) => p.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (msg: string, kind: ToastKind = "success", ms = 3200) => {
      const id = ++counter;
      setItems((p) => [...p, { id, kind, msg }]);
      if (kind !== "loading") setTimeout(() => remove(id), ms);
    },
    [remove]
  );

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div
        data-toasts
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-80 flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border bg-paper-100 p-3.5 shadow-card",
              "animate-[slideUp_.22s_ease-out]",
              t.kind === "success" && "border-brand/40",
              t.kind === "info" && "border-sky-400/30",
              t.kind === "loading" && "border-brand/40",
              t.kind === "error" && "border-red-400/40"
            )}
          >
            <span className="mt-0.5">
              {t.kind === "success" && <CheckCircle2 size={18} className="text-brand-400" />}
              {t.kind === "info" && <Info size={18} className="text-sky-700" />}
              {t.kind === "loading" && <Loader2 size={18} className="animate-spin text-brand" />}
              {t.kind === "error" && <AlertTriangle size={18} className="text-red-600" />}
            </span>
            <p className="flex-1 text-sm font-medium text-graph">{t.msg}</p>
            <button onClick={() => remove(t.id)} className="text-graph-400 transition hover:text-graph">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
