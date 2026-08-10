import { useEffect, type RefObject } from "react";

/**
 * DISOLVER EL BLOQUE DE FILTROS AL BAJAR
 * ─────────────────────────────────────────────────────────────────────────────
 * El bloque de filtros NO es `sticky`: se va con la página, a velocidad de
 * scroll. Este hook solo le pinta la salida para que se desvanezca entrando por
 * debajo del riel, en vez de cortarse en seco contra él.
 *
 * 🔴 EL BUG QUE ESTO REEMPLAZA (10-ago, lo reportó Juani dos veces):
 * la barra tenía tres filas y al pasar 220 px de scroll les ponía `hidden`.
 * `hidden` es `display: none`, o sea que esas filas SALEN DEL FLUJO: el documento
 * se acortaba 201 px de golpe y todo lo de abajo pegaba un salto instantáneo de
 * 201 px hacia arriba, con las tarjetas ya en pantalla. Eso era el "choca" que
 * se ve en el video que mandó Mateo — no un fade que faltaba.
 *
 * Y ojo, porque la solución intuitiva es peor: animar `height` o `max-height`
 * también cambia el alto del documento, así que el salto sigue estando, ahora
 * repartido en 300 ms. Se siente como si la lista se deslizara para arriba
 * peleando contra tu scroll.
 *
 * ⚠️ REGLA DE ORO, NO NEGOCIABLE ⚠️
 * Este hook escribe ÚNICAMENTE `opacity`, `transform`, `filter`, `visibility` y
 * `pointer-events`. Ninguna de esas cinco toca el border-box, así que:
 *   · el alto del documento no se mueve nunca → el salto es IMPOSIBLE, no
 *     "improbable";
 *   · el ResizeObserver de abajo no puede entrar en bucle consigo mismo.
 * Si alguien mete acá `height`, `max-height`, `padding`, `gap` o `display: none`,
 * vuelve el salto de 201 px. Está probado en `e2e/catalogo-filtros.mjs`, que mide
 * el desplazamiento de una tarjeta durante el scroll.
 *
 * La otra decisión de fondo: la disolución es función pura de `scrollY`, NO de la
 * dirección del scroll. Es idempotente — al subir vuelve sola, sin estado y sin
 * histéresis — y por construcción no puede parpadear. Un "ocultar al bajar,
 * mostrar al subir" con Lenis es peor de lo que parece: la inercia termina con
 * deltas mínimos que alternan de signo, así que la barra reaparecería sola al
 * soltar la rueda sin que nadie haya subido.
 */

/** Píxeles de scroll ANTES del contacto en los que ya empieza a irse. */
const PREVIO = 24;
/** Cuánto scroll dura la disolución completa. */
const RANGO = 150;
/** Cuánto se mete hacia arriba mientras se va. Negativo a propósito: hacia abajo
 *  se superpondría a las tarjetas, que es exactamente lo que molestaba. */
const SUBE = 18;
const BLUR = 3;

/** smoothstep: sin arranque ni frenada perceptibles en los extremos. */
const suave = (p: number) => p * p * (3 - 2 * p);

/**
 * Distancia al tope del documento, por la cadena de `offsetParent`.
 *
 * ⚠️ A propósito NO se usa `getBoundingClientRect()`: ese rect INCLUYE el
 * `transform` que este mismo hook aplica, así que la medición saldría
 * contaminada, `inicio` derivaría y la disolución arrancaría cada vez más
 * arriba (realimentación positiva).
 */
const topeEnDocumento = (el: HTMLElement) => {
  let y = 0;
  let n: HTMLElement | null = el;
  while (n) {
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return y;
};

export function useDisolverAlBajar(
  bloque: RefObject<HTMLElement | null>,
  riel: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const b = bloque.current;
    const r = riel.current;
    if (!b || !r) return;

    const menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let inicio = 0;
    let activo = false;
    let ultimoE = -1;
    let elevado = false;

    const limpiar = () => {
      ultimoE = -1;
      elevado = false;
      const s = b.style;
      s.opacity = "";
      s.transform = "";
      s.filter = "";
      s.visibility = "";
      s.pointerEvents = "";
      r.dataset.flotando = "false";
    };

    const pintar = () => {
      if (!activo) return;
      const p = Math.min(1, Math.max(0, (window.scrollY - inicio) / RANGO));
      const e = suave(p);
      if (e === ultimoE) return;
      // Por debajo del umbral perceptual no vale la pena escribir estilos.
      if (Math.abs(e - ultimoE) < 0.004 && e !== 0 && e !== 1) return;

      // El menú de los selects se dibuja en un portal `fixed` y se reubica
      // siguiendo a su disparador. Si el select se desvanece con el bloque y el
      // menú queda abierto, queda un panel 100 % opaco colgado de la nada.
      if (ultimoE <= 0 && e > 0) {
        b.querySelectorAll<HTMLElement>('[aria-expanded="true"]').forEach((t) =>
          t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
        );
      }
      ultimoE = e;

      const s = b.style;
      s.opacity = String(1 - e);
      if (!menosMovimiento) {
        // translate3d promueve a capa de GPU sin tener que tocar `will-change`
        // en cada frame (togglearlo produce thrash de capas).
        s.transform = e > 0 ? `translate3d(0,${(-SUBE * e).toFixed(2)}px,0)` : "";
        s.filter = e > 0 && e < 1 ? `blur(${(BLUR * e).toFixed(2)}px)` : "";
      }
      // `visibility`, NUNCA `display: none`: no mueve layout, saca el bloque del
      // orden de tabulación y del árbol de accesibilidad, y el cambio ocurre
      // cuando la opacidad ya llegó a 0, así que no se ve.
      s.visibility = e >= 1 ? "hidden" : "";
      s.pointerEvents = e > 0.6 ? "none" : "";

      // La sombra del riel es el ÚNICO cambio binario que un ojo puede pescar,
      // así que es el único que lleva histéresis.
      if (!elevado && e > 0.55) elevado = true;
      else if (elevado && e < 0.45) elevado = false;
      r.dataset.flotando = elevado ? "true" : "false";
    };

    /**
     * Se mide UNA vez y se recalcula solo cuando algo cambia de tamaño en serio.
     * Medir adentro del handler de scroll (un `getBoundingClientRect` por frame)
     * fuerza layout sincrónico y es lo que hace que el scroll suave se sienta
     * pegajoso.
     */
    const medir = () => {
      // En <lg el bloque es `display:none` (los filtros viven en la hoja), así
      // que el hook se apaga solo sin necesidad de preguntar por el ancho.
      activo = b.offsetHeight > 0;
      if (!activo) {
        limpiar();
        return;
      }
      const tope = parseFloat(getComputedStyle(r).top) || 0;
      inicio = topeEnDocumento(b) - (tope + r.offsetHeight) - PREVIO;
      pintar();
    };

    // Un solo write por frame. El evento `scroll` ya viene agrupado por el
    // navegador y el rAF garantiza escribir justo antes del pintado. No se monta
    // un loop propio: el scroll suave ya tiene uno y dos loops se pelean.
    let pendiente = false;
    const alScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        pintar();
      });
    };

    medir();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", medir);
    const ro = new ResizeObserver(medir);
    ro.observe(b);
    ro.observe(r); // el riel cambia de alto cuando aparece la fila "Buscando:"

    return () => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", medir);
      ro.disconnect();
      limpiar();
    };
  }, [bloque, riel]);
}
