import { Link } from "react-router-dom";
import { MapPin, Maximize, ArrowUpRight, Heart, BedDouble, Bath, Car, Ruler } from "lucide-react";
import type { Propiedad } from "@/data/propiedadTypes";
import { fmtPrecio, fmtHa } from "@/lib/format";
import { useFavorites } from "../context/FavoritesContext";

const estadoStyle: Record<string, string> = {
  disponible: "bg-brand-50 text-brand",
  reservado: "bg-amber-50 text-amber-700",
  vendido: "bg-graph/5 text-graph-500",
};

const opLabel: Record<string, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  arrendamiento: "Arrendamiento",
};

const estadoLabel: Record<string, string> = { reservado: "Reservado", vendido: "Vendido" };

// Placeholder gris si una propiedad (de la DB real) no tiene foto → nunca rompe la card ni muestra el ícono de imagen rota.
const NO_IMG = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='300'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23e7e8e3'/%3E%3C/svg%3E";

export default function PropiedadCard({ p }: { p: Propiedad }) {
  const { esFavorito, toggle } = useFavorites();
  const fav = esFavorito(p.id);

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
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={p.fotos?.[0] || NO_IMG}
          onError={(e) => { e.currentTarget.src = NO_IMG; }}
          alt={p.titulo}
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-graph/80 via-transparent to-transparent" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-graph backdrop-blur">
            {opLabel[p.operacion]}
          </span>
          {p.estado !== "disponible" && (
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${estadoStyle[p.estado]}`}>
              {estadoLabel[p.estado]}
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
          </div>
          <span className="flex items-center gap-1 text-sm font-medium text-graph-500 transition group-hover:text-brand">
            Ver <ArrowUpRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}
