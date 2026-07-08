import { useEffect, useRef } from "react";

/**
 * Arrastre con el mouse para deslizar horizontalmente (estilo kanban / Apple).
 * En touch/pen usa el scroll nativo del navegador (celular / tablet andan solos).
 * No arranca el arrastre si el click cae sobre un control (botón, link, input).
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let down = false, startX = 0, startScroll = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== "mouse") return; // táctil → nativo
      const t = e.target as HTMLElement;
      if (t.closest("button, a, input, textarea, select")) return; // no pisar controles
      down = true; startX = e.clientX; startScroll = el.scrollLeft; el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => { if (down) el.scrollLeft = startScroll - (e.clientX - startX); };
    const onUp = () => { down = false; el.style.cursor = ""; };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);
  return ref;
}
