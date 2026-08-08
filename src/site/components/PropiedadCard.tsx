import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Maximize, ArrowUpRight, Heart, BedDouble, Bath, Car, Ruler, ChevronLeft, ChevronRight } from "lucide-react";
import type { Propiedad } from "@/data/propiedadTypes";
import { fmtPrecio, fmtHa, fmtARS } from "@/lib/format";
import { useFavorites } from "../context/FavoritesContext";
import { ESTADO_LABEL, type EstadoPropiedad } from "@/data/propiedadTypes";

// Los 5 estados. Record COMPLETO tipado: si mañana entra un sexto, no compila
// hasta que alguien le dé color (con Record<string,…> quedaba undefined y la
// chapita salía sin estilo).
const estadoStyle: Record<EstadoPropiedad, string> = {
  activa: "bg-brand-50 text-brand",
  reservada: "bg-amber-50 text-amber-700",
  vendida: "bg-graph/5 text-graph-500",
  alquilada: "bg-sky-50 text-sky-700",
  suspendida: "bg-graph/5 text-graph-400",
};

const opLabel: Record<string, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  arrendamiento: "Arrendamiento",
};


// Placeholder gris si una propiedad (de la DB real) no tiene foto → nunca rompe la card ni muestra el ícono de imagen rota.
const NO_IMG = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='300'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23e7e8e3'/%3E%3C/svg%3E";

/** `prioritaria` = está arriba de todo y se ve sin scrollear: su foto carga ya. */
export default function PropiedadCard({ p, prioritaria = false }: { p: Propiedad; prioritaria?: boolean }) {
  const { esFavorito, toggle } = useFavorites();
  const fav = esFavorito(p.id);

  // Hasta 5 fotos hojeables desde la tarjeta: alcanza para enganchar sin
  // convertir el catálogo en una descarga de cientos de imágenes.
  const galeria = (p.fotos?.length ? p.fotos : [NO_IMG]).slice(0, 5);
  const [foto, setFoto] = useState(0);
  const gesto = useRef<{ x: number; movio: boolean } | null>(null);

  const specs: { icon: any; label: string }[] = [];
  if (p.categoria === "campo") {
    if (p.hectareas) specs.push({ icon: Maximize, label: fmtHa(p.hectareas) });
    if (p.aptitud) specs.push({ icon: Ruler, label: p.aptitud });
  } else {
    if (p.dormitorios) specs.push({ icon: BedDouble, label: `${p.dormitorios} dorm.` });
    if (p.banos) specs.push({ icon: Bath, label: `${p.banos} baño${p.banos > 1 ? "s" : ""}` });
    if (p.cocheras) specs.push({ icon: Car, label: `${p.cocheras} coch.` });
    if (p.m2cubiertos) specs.push({ icon: Ruler, label: `${p.m2cubiertos} m²` });
  }

  return (
    <Link
      to={`/propiedad/${p.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-paper-100 ring-1 ring-graph/10 transition duration-500 hover:ring-brand/40 hover:shadow-card"
    >
      <div
        className="relative aspect-[4/3] overflow-hidden"
        // Deslizar con el dedo cambia de foto; si hubo deslizamiento, no se
        // entra a la propiedad (si no, cada swipe navegaría sin querer).
        onPointerDown={(e) => { gesto.current = { x: e.clientX, movio: false }; }}
        onPointerMove={(e) => {
          const g = gesto.current;
          if (!g || g.movio) return;
          const dx = e.clientX - g.x;
          if (Math.abs(dx) > 40) {
            g.movio = true;
            setFoto((n) => Math.max(0, Math.min(galeria.length - 1, n + (dx < 0 ? 1 : -1))));
          }
        }}
        onClickCapture={(e) => { if (gesto.current?.movio) { e.preventDefault(); e.stopPropagation(); } }}
        onPointerUp={() => { setTimeout(() => (gesto.current = null), 0); }}
        style={{ touchAction: "pan-y" }}
      >
        {/* Se pueden hojear las fotos SIN entrar a la propiedad: las de al lado
            se precargan y el cambio va con la curva de siempre. */}
        <div
          className="flex h-full w-full"
          style={{ transform: `translate3d(${-foto * 100}%, 0, 0)`, transition: "transform 620ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          {galeria.map((src, n) => (
            // Mismo gesto que en la ficha: la que sale se achica apenas y la que
            // entra crece. En la tarjeta el efecto va más sutil (0,06) para no
            // marear en una grilla de veinte.
            <div
              key={`${src}-${n}`}
              className="h-full w-full shrink-0 grow-0 basis-full"
              style={{
                transform: `scale(${n === foto ? 1 : 0.94})`,
                opacity: n === foto ? 1 : 0.7,
                transition: "transform 620ms cubic-bezier(0.16,1,0.3,1), opacity 620ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <img
                src={src}
                onError={(e) => { e.currentTarget.src = NO_IMG; }}
                alt={n === 0 ? p.titulo : ""}
                // La primera tarjeta se ve sin scrollear: carga ya y con prioridad
                // (es la imagen grande que mide Google). El resto, al acercarse.
                loading={prioritaria && n === 0 ? "eager" : "lazy"}
                fetchPriority={prioritaria && n === 0 ? "high" : "auto"}
                decoding="async"
                draggable={false}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-graph/80 via-transparent to-transparent" />

        {/* Hojear con el mouse (aparecen al acercarse) o con el dedo. */}
        {galeria.length > 1 && (
          <>
            <button
              onClick={(e) => { e.preventDefault(); setFoto((n) => Math.max(0, n - 1)); }}
              aria-label="Foto anterior"
              className={`absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-graph shadow backdrop-blur transition duration-300 hover:scale-110 ${
                foto === 0 ? "pointer-events-none opacity-0" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setFoto((n) => Math.min(galeria.length - 1, n + 1)); }}
              aria-label="Foto siguiente"
              className={`absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-graph shadow backdrop-blur transition duration-300 hover:scale-110 ${
                foto === galeria.length - 1 ? "pointer-events-none opacity-0" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <ChevronRight size={16} />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center gap-1">
              {galeria.map((_, n) => (
                <span
                  key={n}
                  className={`h-1 rounded-full bg-white transition-all duration-500 ${n === foto ? "w-4 opacity-95" : "w-1 opacity-50"}`}
                />
              ))}
            </div>
          </>
        )}

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-graph backdrop-blur">
            {opLabel[p.operacion]}
          </span>
          {p.estado !== "activa" && (
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${estadoStyle[p.estado]}`}>
              {ESTADO_LABEL[p.estado]}
            </span>
          )}
          {p.esNuevo && (
            <span className="rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase text-white">Nuevo</span>
          )}
          {p.esOportunidad && (
            <span className="rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase text-white">Oportunidad</span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            toggle(p.id);
          }}
          aria-label="Favorito"
          className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full backdrop-blur transition ${
            fav ? "bg-brand text-white" : "bg-graph/60 text-white hover:bg-graph/80"
          }`}
        >
          <Heart size={17} fill={fav ? "currentColor" : "none"} />
        </button>

        <span className="absolute bottom-4 left-4 rounded-full bg-graph/70 px-3 py-1 text-[11px] font-medium capitalize text-white/90 backdrop-blur">
          {p.categoria}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug text-graph line-clamp-2">{p.titulo}</h3>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-graph-500">
          <span className="flex items-center gap-1.5">
            <MapPin size={15} className="text-brand" /> {p.zona}
          </span>
          {specs.map((s, i) => (
            <span key={i} className="flex items-center gap-1.5 capitalize">
              <s.icon size={15} className="text-brand" /> {s.label}
            </span>
          ))}
        </div>

        <div className="mt-5 flex items-end justify-between border-t border-graph/10 pt-4">
          <div>
            <p className="font-display text-xl font-semibold text-brand">
              {fmtPrecio(p)}
            </p>
            {/* Las expensas, abajo del precio y en formato corto: en una tarjeta
                no hay lugar para "+ $85.000 de expensas". Nunca sumadas al precio. */}
            {Boolean(p.expensasARS) && (
              <p className="mt-0.5 text-xs font-medium text-graph-400">
                + {fmtARS(p.expensasARS as number, { short: true })} exp.
              </p>
            )}
          </div>
          <span className="flex items-center gap-1 text-sm font-medium text-graph-500 transition group-hover:text-brand">
            Ver <ArrowUpRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}
