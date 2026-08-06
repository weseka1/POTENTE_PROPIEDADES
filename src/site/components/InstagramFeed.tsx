import { useRef, useState, useEffect } from "react";
import { Instagram, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { INSTAGRAM, REDES } from "@/config/marca";

// ── Potente en Instagram (pedido Mateo 3-ago + feedback Juani 4-ago) ──────────
// Vitrina de reels REALES en tarjetas tipo teléfono, deslizable con flechas
// (nada de pegar el perfil entero: cada reel es su propia tarjeta, iframe
// oficial de Instagram, sin API ni script externo).
export default function InstagramFeed() {
  const pista = useRef<HTMLDivElement>(null);
  const mover = (dir: 1 | -1) => pista.current?.scrollBy({ left: dir * 316, behavior: "smooth" });

  // ── Rotación automática (idea de Juani, 6-ago) ─────────────────────────────
  // Los reels avanzan solos cada 5 segundos y al llegar al final vuelven al
  // principio. Se detiene mientras el visitante tiene el mouse encima o está
  // deslizando: nada peor que una vitrina que se mueve justo cuando la mirás.
  // Tampoco corre si la sección no está a la vista, ni si el sistema pide
  // menos movimiento (accesibilidad).
  const [pausada, setPausada] = useState(false);
  useEffect(() => {
    const pista_ = pista.current;
    if (!pista_ || pausada) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let visible = false;
    const observer = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.3 });
    observer.observe(pista_);

    const id = setInterval(() => {
      if (!visible) return;
      const finDelRecorrido = pista_.scrollLeft + pista_.clientWidth >= pista_.scrollWidth - 8;
      pista_.scrollTo({ left: finDelRecorrido ? 0 : pista_.scrollLeft + 316, behavior: "smooth" });
    }, 5000);

    return () => { clearInterval(id); observer.disconnect(); };
  }, [pausada]);

  return (
    <section className="border-t border-graph/10 bg-paper-200/50 py-24">
      <div className="container-x">
        <div className="reveal mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow flex items-center gap-2"><Instagram size={15} /> @{INSTAGRAM.usuario}</p>
            <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-graph md:text-5xl">
              Las propiedades, en movimiento
            </h2>
            <p className="mt-4 max-w-xl text-lg text-graph-500">
              Recorridos, ingresos nuevos y la vida de la ciudad, directo desde nuestro Instagram.
            </p>
          </div>
          <a href={REDES.instagram} target="_blank" rel="noreferrer" className="btn-primary">
            Seguinos <ArrowRight size={16} />
          </a>
        </div>

        {INSTAGRAM.reels.length > 0 ? (
          <div
            className="reveal relative"
            // Se frena mientras la persona mira o interactúa con la vitrina.
            onMouseEnter={() => setPausada(true)}
            onMouseLeave={() => setPausada(false)}
            onTouchStart={() => setPausada(true)}
          >
            <div
              ref={pista}
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {INSTAGRAM.reels.map((url) => (
                <div
                  key={url}
                  className="h-[540px] w-[270px] shrink-0 snap-center overflow-hidden rounded-[1.75rem] border border-graph/10 bg-white shadow-card md:h-[580px] md:w-[290px]"
                >
                  <iframe
                    src={`${url.replace(/\/?$/, "/")}embed/`}
                    title="Reel de Potente Propiedades"
                    loading="lazy"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                </div>
              ))}
              {/* Cierre de la pista: invitación a ver todo el perfil. */}
              <a
                href={REDES.instagram}
                target="_blank"
                rel="noreferrer"
                className="group grid h-[540px] w-[270px] shrink-0 snap-center place-items-center rounded-[1.75rem] border border-graph/10 bg-navy text-center shadow-card transition hover:bg-brand-950 md:h-[580px] md:w-[290px]"
              >
                <span className="px-8">
                  <Instagram size={34} className="mx-auto text-white/80 transition group-hover:scale-110" />
                  <span className="mt-4 block font-display text-xl font-semibold text-white">Hay mucho más</span>
                  <span className="mt-2 block text-sm text-white/60">@{INSTAGRAM.usuario} en Instagram</span>
                  <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-white group-hover:text-navy">
                    Ver el perfil <ArrowRight size={15} />
                  </span>
                </span>
              </a>
            </div>
            <button
              onClick={() => mover(-1)}
              aria-label="Reels anteriores"
              className="absolute -left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-graph shadow-card ring-1 ring-graph/10 transition hover:bg-brand hover:text-white md:grid"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={() => mover(1)}
              aria-label="Más reels"
              className="absolute -right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-graph shadow-card ring-1 ring-graph/10 transition hover:bg-brand hover:text-white md:grid"
            >
              <ChevronRight size={22} />
            </button>
          </div>
        ) : (
          <div className="reveal overflow-hidden rounded-2xl border border-graph/10 bg-paper-100 shadow-card">
            <iframe
              src={`https://www.instagram.com/${INSTAGRAM.usuario}/embed`}
              title="Instagram de Potente Propiedades"
              loading="lazy"
              className="h-[420px] w-full border-0 md:h-[520px]"
            />
          </div>
        )}
      </div>
    </section>
  );
}
