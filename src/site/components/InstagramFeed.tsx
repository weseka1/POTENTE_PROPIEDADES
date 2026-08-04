import { Instagram, ArrowRight } from "lucide-react";
import { INSTAGRAM, REDES } from "@/config/marca";

// ── Potente en Instagram (pedido Mateo 3-ago: reels embebidos en la web) ──────
// Dos modos, sin API ni script externo (iframes oficiales de Instagram):
// · Con reels cargados en marca.ts → grilla de esos reels/posts puntuales.
// · Sin reels aún → el feed del perfil embebido (se actualiza solo al publicar).
export default function InstagramFeed() {
  const hayReels = INSTAGRAM.reels.length > 0;

  return (
    <section className="border-t border-graph/10 bg-paper-200/50 py-24">
      <div className="container-x">
        <div className="reveal mb-10 flex flex-wrap items-end justify-between gap-6">
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

        {hayReels ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {INSTAGRAM.reels.slice(0, 3).map((url) => (
              <div key={url} className="reveal overflow-hidden rounded-2xl border border-graph/10 bg-paper-100 shadow-card">
                <iframe
                  src={`${url.replace(/\/?$/, "/")}embed`}
                  title="Reel de Potente Propiedades"
                  loading="lazy"
                  allowFullScreen
                  className="h-[480px] w-full border-0"
                />
              </div>
            ))}
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
