import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

// ── Select propio (listbox) ───────────────────────────────────────────────────
// Reemplaza al <select> nativo, que en Windows/Mac dibuja el menú del sistema y
// rompe el look del producto. Este se ve igual en todos lados, sigue la marca y
// se maneja con teclado (↑ ↓ Enter Esc, Home/End) como corresponde.

export type Opcion = { value: string; label: string; disabled?: boolean };

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Elegir…",
  disabled,
  className,
  triggerClassName,
  align = "left",
  size = "md",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opcion[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  align?: "left" | "right";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  // El menú se dibuja en un portal con posición fija: así ninguna tabla con scroll
  // ni contenedor con overflow lo recorta (era el bug de la última fila).
  const [pos, setPos] = useState<{ top: number; left: number; right: number; width: number; arriba: boolean } | null>(null);
  const [activo, setActivo] = useState(-1); // índice resaltado por teclado
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const sel = options.find((o) => o.value === value);
  const seleccionables = options.filter((o) => !o.disabled);

  // Calcula dónde va el menú: debajo del disparador, o encima si no entra.
  const ubicar = () => {
    const r = raiz.current?.getBoundingClientRect();
    if (!r) return;
    const altoMenu = Math.min(options.length * 40 + 12, 264); // ~40px por opción, tope 16rem
    const abajo = window.innerHeight - r.bottom;
    const arriba = abajo < altoMenu + 12 && r.top > abajo;
    setPos({
      top: arriba ? r.top - 6 : r.bottom + 6,
      left: r.left,
      right: window.innerWidth - r.right, // distancia desde el borde derecho de la ventana
      width: r.width,
      arriba,
    });
  };

  // Cerrar al clickear afuera; reubicar (o cerrar) al scrollear/resize.
  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (raiz.current?.contains(t) || lista.current?.contains(t)) return;
      setOpen(false);
    };
    const reubicar = () => ubicar();
    document.addEventListener("mousedown", fuera);
    window.addEventListener("resize", reubicar);
    window.addEventListener("scroll", reubicar, true); // captura el scroll de cualquier contenedor
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("resize", reubicar);
      window.removeEventListener("scroll", reubicar, true);
    };
  }, [open, options.length, align]);

  // Al abrir: resaltar la opción actual y posicionar el menú.
  useEffect(() => {
    if (!open) { setPos(null); return; }
    const i = options.findIndex((o) => o.value === value);
    setActivo(i >= 0 ? i : options.findIndex((o) => !o.disabled));
    ubicar();
  }, [open]);

  useEffect(() => {
    if (!open || activo < 0) return;
    const el = lista.current?.children[activo] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activo, open]);

  const elegir = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const mover = (paso: 1 | -1) => {
    if (!seleccionables.length) return;
    let i = activo;
    for (let n = 0; n < options.length; n++) {
      i = (i + paso + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    setActivo(i);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (e.key === "Tab") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); mover(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); return; }
    if (e.key === "Home") { e.preventDefault(); setActivo(options.findIndex((o) => !o.disabled)); return; }
    if (e.key === "End") { e.preventDefault(); for (let i = options.length - 1; i >= 0; i--) if (!options[i].disabled) { setActivo(i); break; } return; }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = options[activo];
      if (o && !o.disabled) elegir(o.value);
    }
  };

  const alto = size === "sm" ? "h-9 text-[13px]" : "h-10 text-sm";

  return (
    <div ref={raiz} className={cx("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cx(
          "flex w-full items-center justify-between gap-2 rounded-xl border bg-paper-100 px-3 text-left transition",
          alto,
          disabled
            ? "cursor-not-allowed border-graph/10 text-graph-400 opacity-60"
            : "border-graph/15 text-graph hover:border-graph/25",
          open && !disabled && "border-brand/60 ring-2 ring-brand/15",
          triggerClassName
        )}
      >
        <span className={cx("truncate", !sel && "text-graph-400")}>{sel?.label ?? placeholder}</span>
        <ChevronDown
          size={15}
          className={cx("shrink-0 text-graph-400 transition-transform duration-200", open && "rotate-180 text-brand")}
        />
      </button>

      {open && pos && createPortal(
        <ul
          ref={lista}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onKey}
          style={{
            position: "fixed",
            top: pos.top,
            left: align === "right" ? undefined : pos.left,
            right: align === "right" ? pos.right : undefined,
            minWidth: pos.width,
            maxWidth: "min(22rem, calc(100vw - 1rem))",
            transform: pos.arriba ? "translateY(-100%)" : undefined,
          }}
          className={cx(
            "z-[100] max-h-64 overflow-y-auto rounded-xl border border-graph/10 bg-paper-100 p-1 shadow-[0_24px_60px_-24px_rgba(13,21,33,0.35)]",
            "animate-[fadeIn_.12s_ease-out]"
          )}
        >
          {options.map((o, i) => {
            const activa = o.value === value;
            return (
              <li key={o.value || `__${i}`} role="option" aria-selected={activa} aria-disabled={o.disabled}>
                <button
                  type="button"
                  disabled={o.disabled}
                  onClick={() => !o.disabled && elegir(o.value)}
                  onMouseEnter={() => !o.disabled && setActivo(i)}
                  className={cx(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition",
                    o.disabled && "cursor-not-allowed text-graph-400 opacity-50",
                    !o.disabled && i === activo && "bg-brand/[0.08]",
                    !o.disabled && activa ? "font-semibold text-brand" : !o.disabled && "text-graph"
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {activa && <Check size={15} className="shrink-0 text-brand" />}
                </button>
              </li>
            );
          })}
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-graph-400">Sin opciones</li>
          )}
        </ul>,
        document.body
      )}
    </div>
  );
}
