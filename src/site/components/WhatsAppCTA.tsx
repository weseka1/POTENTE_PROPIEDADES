import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, MapPin } from "lucide-react";
import { OFICINAS, waUrl } from "@/config/marca";

// ── CTA de WhatsApp con selector de oficina (pedido Mateo, audios 4-ago) ──────
// Los botones GENERALES de WhatsApp preguntan a qué oficina escribir ("que no
// quede un solo WhatsApp de una sola oficina"). Cuando el contexto ya define la
// oficina (ficha de una propiedad), NO se usa esto: se deriva directo.
export default function WhatsAppCTA({
  mensaje,
  className = "btn-primary",
  children,
}: {
  mensaje?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Escape cierra; sin scroll de fondo mientras el selector está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] grid place-items-center bg-brand-950/40 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-label="Elegí la oficina"
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/40 bg-paper-100/95 p-6 shadow-card backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">WhatsApp</p>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-graph">¿Con qué oficina querés hablar?</h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-graph-400 transition hover:bg-graph/5 hover:text-graph"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {OFICINAS.map((o) => (
                  <a
                    key={o.id}
                    href={waUrl(o.id, mensaje)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-4 rounded-xl border border-graph/10 bg-paper p-4 transition hover:border-brand/50 hover:shadow-soft"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand transition group-hover:bg-brand group-hover:text-white">
                      <MessageCircle size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-base font-semibold text-graph">
                        Oficina {o.numero} · {o.nombre}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-graph-500">
                        <MapPin size={12} className="shrink-0 text-brand" /> {o.direccion} · {o.horario}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
