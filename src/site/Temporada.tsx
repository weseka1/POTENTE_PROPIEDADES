import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Waves, MapPin, ShieldCheck, Users, Home as HomeIcon,
  CalendarRange, Phone, Sun, ChevronRight,
} from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { useLenis } from "./lib/useLenis";
import { useSEO } from "./lib/seo";
import { useReveal } from "@/lib/hooks";
import { useData } from "@/lib/DataProvider";
import UISelect from "@/components/Select";
import { tramoById, tarifaDe, tarifaDesde, waTemporada } from "@/data/temporada";
// `tarifaDesde` y `waTemporada` se mudaron a data/temporada.ts: son helpers puros
// y los usa tambien la ficha publica. Se reexportan para no romper importadores.
export { tarifaDesde, waTemporada };
import type { TemporadaTramoId, UnidadTemporada } from "@/data/types";
import type { Propiedad } from "@/data/propiedadTypes";

import { waDigits, SITIO } from "@/config/marca";
import WhatsAppCTA from "./components/WhatsAppCTA";
// El dominio sale de marca.ts (una sola fuente, pisable con VITE_SITE_URL).
const SITE = SITIO;
const NO_IMG =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='300'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23e7e8e3'/%3E%3C/svg%3E";

// Dónde hacemos temporada sale de config/temporada.js — la MISMA lista que usa
// el generador del sitemap. Desde el 13-ago es solo Punta Mogotes (Mateo).
// Se reexporta para no romper a quien ya importaba desde acá.
import { BARRIOS_TEMPORADA, BARRIO_TEMPORADA, slugBarrio, barrioBySlug } from "@/config/temporada";
export { BARRIOS_TEMPORADA, BARRIO_TEMPORADA, slugBarrio, barrioBySlug };

/**
 * La foto de la card. Es un link a la ficha cuando la propiedad existe, y un
 * div cuando no — mismo alto y mismo recorte en los dos casos, para que la
 * grilla no cambie de forma según haya o no ficha.
 */
function FotoDeLaCard({ to, children }: { to: string | null; children: ReactNode }) {
  const cls = "relative block aspect-[4/3] overflow-hidden";
  return to ? <Link to={to} className={cls}>{children}</Link> : <div className={cls}>{children}</div>;
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
  const wa = waTemporada(titulo, quincena?.label, u.oficina);
  // 🔴 13-ago, Mateo: «que me mande directamente a la ficha que yo cargué en
  // temporada, con las fotos y la descripción». Antes la tarjeta llevaba a la
  // página del barrio, donde no se veía ni una foto ni el texto de la propiedad.
  // La unidad de temporada SIEMPRE se apoya en una propiedad de la cartera
  // (`propiedadId`), así que la ficha ya existe: se apunta ahí.
  const fichaUrl = prop ? `/propiedad/${prop.id}` : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-paper-100 ring-1 ring-graph/10 transition duration-500 hover:ring-brand/40 hover:shadow-card">
      <FotoDeLaCard to={fichaUrl}>
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
      </FotoDeLaCard>

      <div className="flex flex-1 flex-col p-5">
        {fichaUrl ? (
          <Link to={fichaUrl} className="font-display text-lg font-semibold leading-snug text-graph line-clamp-2 transition hover:text-brand">
            {titulo}
          </Link>
        ) : (
          <h3 className="font-display text-lg font-semibold leading-snug text-graph line-clamp-2">{titulo}</h3>
        )}
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
            {/* 🔴 13-ago, Mateo: «los precios de temporada deben decir todos "a
                consultar", no "desde". No debemos dar referencia de precios».
                La tarifa existe en el panel para cotizar; a la web no sale ni
                como referencia — y tampoco viaja al navegador (ver
                `columnasTemporada` en DataProvider). */}
            <p className="font-display text-xl font-semibold text-brand">A consultar</p>
            <p className="text-xs text-graph-400">por WhatsApp, según tus fechas</p>
          </div>
          {fichaUrl && (
            <Link
              to={fichaUrl}
              className="flex items-center gap-1 text-xs font-medium text-graph-500 transition hover:text-brand"
            >
              Ver fotos y detalle <ChevronRight size={14} />
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
  // Temporada se hace SOLO en Punta Mogotes (Mateo, 13-ago). El filtro es por la
  // lista de config, no por un string suelto: sumar un barrio es tocar un lugar.
  const activas = useMemo(
    () => unidadesTemporada.filter((u) => u.activa && (BARRIOS_TEMPORADA as readonly string[]).includes(u.barrio)),
    [unidadesTemporada],
  );
  const propById = (id: string) => propiedades.find((p) => p.id === id);

  // 🔴 13-ago, Mateo: «el buscador eliminarlo y poner únicamente cantidad de
  // personas». Con un solo barrio, filtrar por barrio no tenía sentido; y la
  // quincena la resuelve la consulta por WhatsApp, que es como reserva él.
  // Queda UN control: cuántos son. Se muestran las que entran esa cantidad.
  const capacidades = useMemo(
    () => [...new Set(activas.map((u) => u.capacidad))].sort((a, b) => a - b),
    [activas],
  );
  const [personas, setPersonas] = useState("");

  const filtradas = useMemo(
    () => activas.filter((u) => !personas || u.capacidad >= Number(personas)),
    [activas, personas],
  );

  useSEO({
    titulo: `Alquiler de temporada en ${BARRIO_TEMPORADA} · Verano 2027 | Potente Propiedades`,
    descripcion:
      `Alquiler temporario en ${BARRIO_TEMPORADA}, Mar del Plata, para el verano 2027. ` +
      "Departamentos y casas por quincena. Consultá las fechas disponibles y reservá por " +
      "WhatsApp con una inmobiliaria de más de 50 años en el rubro.",
    path: "/temporada",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Alquileres de temporada en ${BARRIO_TEMPORADA}, Mar del Plata — Verano 2027`,
      // Cada ítem apunta a SU ficha, no al barrio: es la página que de verdad
      // describe la propiedad (fotos + descripción), y es a donde ahora lleva
      // la tarjeta. Que el dato estructurado y el link coincidan es la mitad
      // del SEO.
      itemListElement: activas.map((u, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: propById(u.propiedadId)?.titulo ?? `Alquiler temporario en ${u.barrio}`,
        url: `${SITE}/propiedad/${u.propiedadId}`,
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
            Alquilá tu verano frente al mar en {BARRIO_TEMPORADA}
          </h1>
          {/* Copy textual de Mateo (13-ago). */}
          <p className="mt-5 max-w-xl text-lg text-white/75">
            Propiedades en {BARRIO_TEMPORADA} para disfrutar el verano. Consultá por las fechas
            disponibles y reservá por WhatsApp con una inmobiliaria de más de 50 años en el rubro.
          </p>

          {/* Un solo filtro: cuántos son. */}
          <div className="mt-9 max-w-sm rounded-2xl border border-white/15 bg-paper-100/95 p-4 shadow-card backdrop-blur md:p-5">
            <Select
              label="¿Cuántos son?"
              value={personas}
              onChange={setPersonas}
              options={capacidades.map((n) => ({ v: String(n), l: `${n} ${n === 1 ? "persona" : "personas"}` }))}
              placeholder="Cualquier cantidad"
            />
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
                Alquileres en {BARRIO_TEMPORADA}
              </h2>
            </div>
            <p className="text-sm text-graph-500">
              {filtradas.length} {filtradas.length === 1 ? "propiedad" : "propiedades"}
              {personas ? ` · para ${personas} o más` : ""}
            </p>
          </div>

          {filtradas.length === 0 ? (
            <div className="py-16 text-center text-graph-500">
              <p className="font-display text-2xl text-graph">
                {personas ? `No hay propiedades para ${personas} personas` : "Todavía no hay propiedades cargadas"}
              </p>
              {personas && (
                <button onClick={() => setPersonas("")} className="btn-ghost mt-6">
                  Ver todas
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {filtradas.map((u) => (
                <div key={u.id} className="reveal">
                  <UnidadTempCard u={u} prop={propById(u.propiedadId)} />
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
                // Mateo, 13-ago: «en vez de 30% pone "reservas con un
                // porcentaje"» — el porcentaje se acuerda en cada caso, así que
                // publicar un número fijo era comprometer algo que no es fijo.
                d: "Reservás con un porcentaje y el saldo lo abonás al ingresar. Contrato de temporada por escrito, sin sorpresas ni intermediarios de dudosa procedencia.",
              },
              {
                icon: MapPin,
                t: "Atención local, cara a cara",
                // Temporada la atiende SOLO la oficina de Punta Mogotes.
                d: "Oficina sobre la costa, cerca de todo. Ante cualquier consulta durante tu estadía, estamos a la vuelta.",
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

      {/* La grilla "Explorá por barrio" se sacó el 13-ago: con temporada en un
          solo barrio era una sección de una tarjeta que repetía lo de arriba.
          La página del barrio (/temporada/punta-mogotes) sigue viva por SEO. */}

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
          <WhatsAppCTA
            mensaje="Hola Potente Propiedades, busco una propiedad de temporada. ¿Me ayudan?"
            className="btn-primary reveal"
          >
            <Phone size={16} /> Consultar por WhatsApp
          </WhatsAppCTA>
        </div>
      </section>

      <Footer />
    </div>
  );
}
