import { useEffect } from "react";
import Lenis from "lenis";

/**
 * La instancia viva del scroll suave, a nivel módulo.
 *
 * 🔴 Existe por un bug que reportó Juani navegando como cliente (11-ago): al
 * pasar de una propiedad a otra desde "Propiedades similares", la página nueva
 * quedaba scrolleada ABAJO — parecía que el click no había tomado. El
 * `ScrollToTop` del router hacía `window.scrollTo(0, 0)`... y Lenis lo pisaba:
 * el scroll suave guarda su posición interna (`animatedScroll`) y en el
 * siguiente frame vuelve a escribir la vieja. Un salto de página hay que
 * pedírselo A LENIS (`scrollTo(0, { immediate })`), no al navegador.
 */
let instancia: Lenis | null = null;

/** Salto INSTANTÁNEO al tope, compatible con el scroll suave. Para cambios de
 *  página: sin animación — una página nueva no "viaja", aparece arriba. */
export function subirYa() {
  if (instancia) instancia.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0); // sin Lenis (prefers-reduced-motion): nativo
}

// Smooth scroll cinematográfico. Se desactiva solo si el usuario prefiere menos movimiento.
export function useLenis() {
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });
    instancia = lenis;

    let raf = 0;
    function loop(time: number) {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      if (instancia === lenis) instancia = null;
    };
  }, []);
}
