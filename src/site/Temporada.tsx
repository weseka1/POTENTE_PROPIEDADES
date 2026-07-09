import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Waves, MapPin, Search, ArrowRight, ShieldCheck, Users, Home as HomeIcon,
  CalendarRange, Phone, Sun, ChevronRight,
} from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { useLenis } from "./lib/useLenis";
import { useSEO } from "./lib/seo";
import { useReveal } from "@/lib/hooks";
import { useData } from "@/lib/DataProvider";
import UISelect from "@/components/Select";
import { TRAMOS, tramoById, tarifaDe } from "@/data/temporada";
import type { TemporadaTramoId, UnidadTemporada } from "@/data/types";
import type { Propiedad } from "@/data/propiedadTypes";
import { fmtARS } from "@/lib/format";

const WA = "5492233029591";
const SITE = "https://potente-propiedades.onrender.com";
const NO_IMG =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='300'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23e7e8e3'/%3E%3C/svg%3E";

// ── Barrios con página propia (SEO local). El orden es el que se muestra. ──
export const BARRIOS_TEMPORADA = [
  "Playa Grande",
  "Varese",
  "Güemes",
  "La Perla",
  "Chauvín",
  "Punta Mogotes",
] as const;

// barrio → slug (Playa Grande → playa-grande, Güemes → guemes) y su inversa.
export function slugBarrio(b: string): string {
  return b
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
}
export function barrioBySlug(slug: string): string | undefined {
  return BARRIOS_TEMPORADA.find((b) => slugBarrio(b) === slug);
}

// Tarifa más baja de una unidad (para el "desde $X la quincena").
export function tarifaDesde(u: UnidadTemporada): number {
  const vals = Object.values(u.tarifas).filter((v): v is number => typeof v === "number");
  return vals.length ? Math.min(...vals) : 0;
}

// Mensaje de WhatsApp pre-armado con la propiedad y (si hay) la quincena elegida.
export function waTemporada(titulo: string, quincenaLabel?: string): string {
  const txt =
    `Hola Potente Propiedades, me interesa alquilar para la temporada "${titulo}"` +
    (quincenaLabel ? ` en la ${quincenaLabel.toLowerCase()}` : "") +
    `. ¿Tienen disponibilidad?`;
  return `https://wa.me/${WA}?text=${encodeURIComponent(txt)}`;
}

// ── Card de unidad de temporada (reusada en la landing y en las páginas por barrio) ──
export function UnidadTempCard({
  u,
  prop,
  tramoId,
}: {
  u: UnidadTemporada;
  prop?: Propiedad;
  tramoId?: TemporadaTramoId | "";
}) {
  const titulo = prop?.titulo ?? `Alquiler temporario en ${u.barrio}`;
  const foto = prop?.fotos?.[0] || NO_IMG;
  const quincena = tramoId ? tramoById(tramoId) : undefined;
  const precioTramo = tramoId ? tarifaDe(u, tramoId) : undefined;
  const precio = precioTramo ?? tarifaDesde(u);
  const wa = waTemporada(titulo, quincena?.label);
  const barrioSlug = BARRIOS_TEMPORADA.some((b) => b === u.barrio) ? slugBarrio(u.barrio) : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-paper-100 ring-1 ring-graph/10 transition duration-500 hover:ring-brand/40 hover:shadow-card">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={foto}
          onError={(e) => { e.currentTarget.src = NO_IMG; }}
          alt={titulo}
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-graph/70 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-graph backdrop-blur">
            Temporada 2027
          </span>
          {u.frenteAlMar && (
            <span className="flex items-center gap-1 rounded-full bg-sea px-3 py-1 text-[11px] font-semibold text-white">
              <Waves size={12} /> Frente al mar
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug text-graph line-clamp-2">{titulo}</h3>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-graph-500">
          <span className="flex items-center gap-1.5">
            <MapPin size={15} className="text-brand" /> {u.barrio}
          </span>
          <span className="flex items-center gap-1.5">
            <HomeIcon size={15} className="text-brand" /> {u.ambientes} amb.
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={15} className="text-brand" /> hasta {u.capacidad}
          </span>
        </div>

        {u.comodidades.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {u.comodidades.slice(0, 4).map((c) => (
              <span key={c} className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium capitalize text-brand">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-end justify-between border-t border-graph/10 pt-4">
          <div>
            <p className="font-display text-xl font-semibold text-brand">
              {quincena ? fmtARS(precio) : `desde ${fmtARS(precio)}`}
            </p>
            <p className="text-xs text-graph-400">{quincena ? quincena.label : "la quincena"}</p>
          </div>
          {barrioSlug && (
            <Link
              to={`/temporada/${barrioSlug}`}
              className="flex items-center gap-1 text-xs font-medium text-graph-500 transition hover:text-brand"
            >
              Ver {u.barrio} <ChevronRight size={14} />
            </Link>
          )}
        </div>

        <a href={wa} target="_blank" rel="noreferrer" className="btn-primary mt-4 w-full">
          <Phone size={15} /> Ver disponibilidad
        </a>
      </div>
    </article>
  );
}

// ── Select compacto para el buscador ──
function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
  placeholder: string;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-graph-400">{label}</span>
      <UISelect
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        options={[{ value: "", label: placeholder }, ...options.map((o) => ({ value: o.v, label: o.l }))]}
        triggerClassName="h-[46px] rounded-lg"
      />
    </div>
  );
}

export default function Temporada() {
  useLenis();
  useReveal();

  const { unidadesTemporada, propiedades } = useData();
  const activas = useMemo(() => unidadesTemporada.filter((u) => u.activa), [unidadesTemporada]);
  const propById = (id: string) => propiedades.find((p) => p.id === id);

  const barrios = useMemo(() => [...new Set(activas.map((u) => u.barrio))].sort(), [activas]);
  const ambientesOpts = useMemo(
    () => [...new Set(activas.map((u) => u.ambientes))].sort((a, b) => a - b),
    [activas]
  );

  const [quincena, setQuincena] = useState<TemporadaTramoId | "">("");
  const [barrio, setBarrio] = useState("");
  const [amb, setAmb] = useState("");

  const filtradas = useMemo(
    () =>
      activas.filter(
        (u) => (!barrio || u.barrio === barrio) && (!amb || u.ambientes === Number(amb))
      ),
    [activas, barrio, amb]
  );

  const irAResultados = () => document.getElementById("grilla")?.scrollIntoView({ behavior: "smooth" });

  useSEO({
    titulo: "Alquiler de temporada · Verano 2027 en Mar del Plata | Potente Propiedades",
    descripcion:
      "Alquiler temporario en Mar del Plata para el verano 2027. Departamentos y casas por quincena en Playa Grande, Güemes, La Perla, Varese, Chauvín y Punta Mogotes. Reservá con seña por WhatsApp.",
    path: "/temporada",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Alquileres de temporada en Mar del Plata — Verano 2027",
      itemListElement: activas.map((u, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: propById(u.propiedadId)?.titulo ?? `Alquiler temporario en ${u.barrio}`,
        url: `${SITE}/temporada/${slugBarrio(u.barrio)}`,
      })),
    },
  });

  return (
    <div className="min-h-screen bg-paper text-graph">
      <div className="grain" />
      <Navbar variant="solid" />

      {/* ===== HERO + BUSCADOR ===== */}
      <header className="relative overflow-hidden pt-32 pb-16">
        <div className="absolute inset-0">
          <img src="/img/props/depto1.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-brand-950/85" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/50 to-transparent" />
        </div>
        <div className="container-x relative z-10">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest2 text-sea-300">
            <Sun size={15} /> Alquiler de temporada · Verano 2027
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium leading-[1.05] tracking-tight text-white md:text-6xl">
            Alquilá tu verano frente al mar en Mar del Plata
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">
            Departamentos y casas por quincena, en los mejores barrios de la ciudad. Elegí las fechas y
            reservá por WhatsApp con una inmobiliaria de tres generaciones.
          </p>

          {/* Buscador */}
          <div className="mt-9 rounded-2xl border border-white/15 bg-paper-100/95 p-4 shadow-card backdrop-blur md:p-5">
            <div className="grid gap-3 md:grid-cols-[1.4fr_1.2fr_1fr_auto]">
              <Select
                label="Quincena"
                value={quincena}
                onChange={(v) => setQuincena(v as TemporadaTramoId | "")}
                options={TRAMOS.map((t) => ({ v: t.id, l: t.label + (t.pico ? " · más pedida" : "") }))}
                placeholder="Cualquier fecha"
              />
              <Select
                label="Barrio"
                value={barrio}
                onChange={setBarrio}
                options={barrios.map((b) => ({ v: b, l: b }))}
                placeholder="Todos los barrios"
              />
              <Select
                label="Ambientes"
                value={amb}
                onChange={setAmb}
                options={ambientesOpts.map((n) => ({ v: String(n), l: `${n} ambientes` }))}
                placeholder="Cualquiera"
              />
              <button onClick={irAResultados} className="btn-primary h-[46px] self-end whitespace-nowrap">
                <Search size={16} /> Buscar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== GRILLA DE UNIDADES ===== */}
      <section id="grilla" className="py-20">
        <div className="container-x">
          <div className="reveal mb-8 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="eyebrow flex items-center gap-2"><CalendarRange size={15} /> Disponibles esta temporada</p>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-graph md:text-4xl">
                {barrio ? `Alquileres en ${barrio}` : "Elegí dónde pasar el verano"}
              </h2>
            </div>
            <p className="text-sm text-graph-500">
              {filtradas.length} {filtradas.length === 1 ? "propiedad" : "propiedades"}
              {quincena ? ` · ${tramoById(quincena).label}` : ""}
            </p>
          </div>

          {filtradas.length === 0 ? (
            <div className="py-16 text-center text-graph-500">
              <p className="font-display text-2xl text-graph">No hay propiedades con esos filtros</p>
              <button
                onClick={() => { setBarrio(""); setAmb(""); }}
                className="btn-ghost mt-6"
              >
                Ver todas
              </button>
            </div>
          ) : (
            <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {filtradas.map((u) => (
                <div key={u.id} className="reveal">
                  <UnidadTempCard u={u} prop={propById(u.propiedadId)} tramoId={quincena} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== CONFIANZA ===== */}
      <section className="border-y border-graph/10 bg-paper-100 py-20">
        <div className="container-x">
          <div className="reveal mb-12 max-w-2xl">
            <p className="eyebrow">Por qué alquilar con Potente</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-graph md:text-4xl">
              Reservá tranquilo, como se hace en Mar del Plata
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Waves,
                t: "Tres generaciones en la ciudad",
                d: "Más de 50 años alquilando en Mar del Plata. Conocemos cada cuadra, cada edificio y a cada propietario de la cartera.",
              },
              {
                icon: ShieldCheck,
                t: "Seña segura y contrato claro",
                d: "Reservás con el 30% y el saldo lo abonás al ingresar. Contrato de temporada por escrito, sin sorpresas ni intermediarios de dudosa procedencia.",
              },
              {
                icon: MapPin,
                t: "Atención local, cara a cara",
                d: "Dos oficinas en la ciudad, en Punta Mogotes y Chauvín. Ante cualquier consulta durante tu estadía, estamos a la vuelta.",
              },
            ].map((c, i) => (
              <div key={c.t} className="reveal card p-8" data-delay={`${i * 90}ms`}>
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand"><c.icon size={22} /></span>
                <h3 className="mt-6 font-display text-lg font-semibold text-graph">{c.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-graph-500">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BARRIOS ===== */}
      <section className="py-20">
        <div className="container-x">
          <div className="reveal mb-10 max-w-2xl">
            <p className="eyebrow">Explorá por barrio</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-graph md:text-4xl">
              ¿En qué zona querés estar?
            </h2>
            <p className="mt-4 text-graph-500">
              Cada barrio de Mar del Plata tiene su clima. Mirá las propiedades disponibles en cada uno.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BARRIOS_TEMPORADA.map((b, i) => {
              const enBarrio = activas.filter((u) => u.barrio === b);
              const foto = propById(enBarrio[0]?.propiedadId ?? "")?.fotos?.[0] || NO_IMG;
              return (
                <Link
                  key={b}
                  to={`/temporada/${slugBarrio(b)}`}
                  className="reveal group relative h-52 overflow-hidden rounded-2xl"
                  data-delay={`${i * 60}ms`}
                >
                  <img
                    src={foto}
                    onError={(e) => { e.currentTarget.src = NO_IMG; }}
                    alt={`Alquiler temporario en ${b}, Mar del Plata`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-white">{b}</h3>
                      <p className="text-sm text-white/70">
                        {enBarrio.length} {enBarrio.length === 1 ? "propiedad" : "propiedades"}
                      </p>
                    </div>
                    <ArrowRight size={20} className="text-white transition group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="border-t border-graph/10 bg-paper-100 py-16">
        <div className="container-x flex flex-col items-center gap-6 text-center">
          <h2 className="reveal max-w-2xl font-display text-3xl font-medium tracking-tight text-graph md:text-4xl">
            ¿No encontrás lo que buscás? Escribinos y lo resolvemos
          </h2>
          <p className="reveal max-w-xl text-graph-500" data-delay="80ms">
            Contanos las fechas, cuántos son y en qué zona querés estar. Tenemos propiedades que no siempre
            están publicadas.
          </p>
          <a
            href={waTemporada("una propiedad de temporada")}
            target="_blank"
            rel="noreferrer"
            className="btn-primary reveal"
            data-delay="140ms"
          >
            <Phone size={16} /> Consultar por WhatsApp
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
