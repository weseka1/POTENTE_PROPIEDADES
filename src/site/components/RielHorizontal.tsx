/**
 * RIEL HORIZONTAL — un scroller de fila única que NO esconde que hay más.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Los bugs que esto arregla (los reportó Juani probando el catálogo):
 *
 * 1. "Hay muchas opciones que se cortan" — el riel de categorías desbordaba y
 *    la última pill quedaba cortada A SECAS: sin sombra, sin flecha, sin nada
 *    que dijera "esto sigue". Oficinas (1) parecía la última categoría cuando
 *    atrás había tres más. Ahora, cuando desborda, aparece un degradé en el
 *    borde: se VE que hay más.
 *
 * 2. "Cuando apoyo el mouse debe bajar el menú, no la página" — la rueda del
 *    mouse sobre el riel scrolleaba la página (el scroll suave la captura para
 *    sí). Ahora la rueda sobre el riel lo desplaza HORIZONTALMENTE, que es lo
 *    único que tiene sentido en una fila. `data-lenis-prevent` le dice a Lenis
 *    que acá no se meta.
 *
 * 3. 🔴 17-ago, Juani otra vez: "se cortan las etiquetas de galpones, oficinas".
 *    Dos causas que el degradé solo no cubría:
 *    · El chip ACTIVO no se traía a la vista: entrar por link a ?cat=galpon
 *      dejaba a "Galpones" —el elegido— medio cortado a la derecha. El riel
 *      ahora centra al hijo con `data-activo="true"` al montar y al cambiar.
 *    · En escritorio no había puerta visible: la rueda sobre el riel anda pero
 *      nadie la descubre, y el mouse no puede arrastrar como un dedo. Van las
 *      flechas ‹ › (la regla de la casa: deslizable + flechas), solo cuando
 *      hay contenido tapado de ese lado, montadas sobre el degradé.
 *
 * ⚠️ El listener de rueda va NATIVO y con `passive: false`, no como onWheel de
 * React: React registra la rueda como pasiva en la raíz, así que su
 * preventDefault NO funciona — y sin preventDefault la página scrollea IGUAL
 * después de mover el riel (los dos a la vez, peor que antes).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function RielHorizontal({
  children,
  className = "gap-2",
  /** El color del degradé de "hay más": el del fondo sobre el que vive el riel. */
  fondo = "from-paper-200/95",
}: {
  children: ReactNode;
  className?: string;
  fondo?: string;
}) {
  const riel = useRef<HTMLDivElement>(null);
  const [sombras, setSombras] = useState({ izq: false, der: false });

  useEffect(() => {
    const el = riel.current;
    if (!el) return;

    const medir = () => {
      const puede = el.scrollWidth > el.clientWidth + 2;
      setSombras({
        izq: puede && el.scrollLeft > 4,
        der: puede && el.scrollLeft < el.scrollWidth - el.clientWidth - 4,
      });
    };

    const alRodar = (e: WheelEvent) => {
      // Solo si de verdad hay para dónde ir; si no, que la página siga normal.
      if (el.scrollWidth <= el.clientWidth + 2) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!delta) return;
      e.preventDefault();
      el.scrollLeft += delta;
      medir();
    };

    medir();
    el.addEventListener("wheel", alRodar, { passive: false });
    el.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      el.removeEventListener("wheel", alRodar);
      el.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, []);

  /* El hijo ACTIVO se trae a la vista solo (17-ago). El caso que lo pidió:
   * entrar por link a /propiedades?cat=galpon dejaba a "Galpones" — el chip
   * ELEGIDO — medio cortado a la derecha del riel. A mano y no con
   * scrollIntoView: ese también scrollea la PÁGINA hasta el riel, que acá es
   * un salto que nadie pidió. Se centra solo si está tapado. */
  useEffect(() => {
    const el = riel.current;
    if (!el) return;
    const act = el.querySelector<HTMLElement>('[data-activo="true"]');
    if (!act) return;
    const borde = act.offsetLeft + act.offsetWidth;
    if (act.offsetLeft < el.scrollLeft || borde > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = act.offsetLeft - (el.clientWidth - act.offsetWidth) / 2;
    }
  }, [children]);

  const empujar = (dir: 1 | -1) => {
    const el = riel.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={riel}
        data-lenis-prevent
        className={`flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      >
        {children}
      </div>
      {/* Los degradés de "hay más": solo cuando de verdad hay contenido tapado
          de ese lado, y con el color del fondo sobre el que vive el riel. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r ${fondo} to-transparent transition-opacity duration-300 ${sombras.izq ? "opacity-100" : "opacity-0"}`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l ${fondo} to-transparent transition-opacity duration-300 ${sombras.der ? "opacity-100" : "opacity-0"}`}
      />
      {/* Las flechas ‹ › — la regla de la casa para todo lo deslizable. Solo en
          pantallas con puntero (sm:) y solo del lado donde hay contenido tapado:
          en el teléfono el dedo ya arrastra y la flecha taparía chips. */}
      {sombras.izq && (
        <button
          type="button"
          aria-label="Ver anteriores"
          onClick={() => empujar(-1)}
          className="absolute left-0 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-graph shadow-[0_4px_14px_-4px_rgba(2,35,82,0.35)] ring-1 ring-graph/10 transition hover:text-brand sm:grid"
        >
          <ChevronLeft size={17} />
        </button>
      )}
      {sombras.der && (
        <button
          type="button"
          aria-label="Ver más"
          onClick={() => empujar(1)}
          className="absolute right-0 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-graph shadow-[0_4px_14px_-4px_rgba(2,35,82,0.35)] ring-1 ring-graph/10 transition hover:text-brand sm:grid"
        >
          <ChevronRight size={17} />
        </button>
      )}
    </div>
  );
}
