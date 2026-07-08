import { useEffect } from "react";

// Reveal on scroll usando IntersectionObserver.
// ROBUSTO: además de los elementos presentes al montar, observa los que se AGREGAN después
// (ej: cuando los datos reales de Supabase reemplazan a los de ejemplo y se vuelven a crear
// las tarjetas). Antes el observer sólo miraba lo que existía al cargar → las tarjetas nuevas
// quedaban en opacity:0 (invisibles) para siempre. Red de seguridad: nada queda invisible.
export function useReveal() {
  useEffect(() => {
    const revelar = (el: HTMLElement) => {
      el.style.transitionDelay = el.dataset.delay || "0ms";
      el.classList.add("is-in");
    };

    const hasIO = "IntersectionObserver" in window;
    const io = hasIO
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                revelar(e.target as HTMLElement);
                io!.unobserve(e.target);
              }
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
        )
      : null;

    // Observa todo lo que tenga .reveal y aún no se haya mostrado.
    const scan = () => {
      document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)").forEach((el) => {
        if (io) io.observe(el);
        else revelar(el);
      });
    };
    scan();

    // Captura las tarjetas que se crean/reemplazan después del montaje (data async de Supabase).
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });

    // Red de seguridad: a los 1.5s mostrar TODO lo que siga oculto (consulta fresca del DOM).
    const safety = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)").forEach(revelar);
    }, 1500);

    return () => {
      io?.disconnect();
      mo.disconnect();
      clearTimeout(safety);
    };
  }, []);
}
