import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown, Search, FileSearch, TrendingUp, ArrowRight, Sparkles, SlidersHorizontal,
  ShieldCheck, MapPin, Phone, Clock, Home as HomeIcon, Building2, Store, Trees, KeyRound, Waves,
  Camera, Handshake, Check,
} from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import InstagramFeed from "./components/InstagramFeed";
import PropiedadCard from "./components/PropiedadCard";
import UISelect from "@/components/Select";
import { useLenis } from "./lib/useLenis";
import { useSEO } from "./lib/seo";
import { parseBusqueda, aQueryString, rutaTemporada } from "./lib/parseBusqueda";
import { useReveal } from "@/lib/hooks";
import { useData } from "@/lib/DataProvider";

import { OFICINAS } from "@/config/marca";
import WhatsAppCTA from "./components/WhatsAppCTA";

// El océano 3D se carga en su propio chunk, recién al montar el hero.
const HeroOcean = lazy(() => import("./components/HeroOcean"));

// Fondo del hero: video real de drone (look cine) o el océano interactivo en
// shaders (HeroOcean, con la espuma que sigue al mouse). Cambiar acá y listo.
const HERO_3D = false;

const categoriasHome = [
  { key: "casa", label: "Casas y chalets", icon: HomeIcon, img: "/img/props/casa1.jpg" },
  { key: "departamento", label: "Departamentos", icon: Building2, img: "/img/props/depto1.jpg" },
  { key: "local", label: "Locales", icon: Store, img: "/img/props/local1.jpg" },
  { key: "lote", label: "Lotes y terrenos", icon: Trees, img: "/img/props/lote1.jpg" },
];

const generaciones = [
  {
    epoca: "Los comienzos",
    titulo: "Una oficina frente al mar",
    texto: "La primera generación abre las puertas en Punta Mogotes y construye lo que todavía hoy es la base del negocio: conocer cada cuadra y cumplir la palabra.",
  },
  {
    epoca: "La segunda generación",
    titulo: "Crecer con la ciudad",
    texto: "La familia suma la oficina de Chauvín y consolida la cartera propia: casas, departamentos, locales y lotes en toda Mar del Plata.",
  },
  {
    epoca: "Hoy",
    titulo: "El oficio de siempre, con tecnología nueva",
    texto: "La tercera generación suma plataforma digital propia, asistente con inteligencia artificial y seguimiento online de cada operación.",
  },
];

export default function Home() {
  useLenis();
  useReveal();
  useSEO({
    titulo: "Potente Propiedades · Inmobiliaria en Mar del Plata | Venta y alquiler",
    descripcion:
      "Inmobiliaria en Mar del Plata con más de 50 años y 3 generaciones. Casas, departamentos, PH, locales y lotes en venta y alquiler. Tasaciones sin cargo.",
    path: "/",
  });
  const navigate = useNavigate();
  const { propiedades, addLead } = useData();

  // WhatsApp Mateo 5-ago: "Quiero vender" y "Quiero comprar" mandan AL FORMULARIO
  // (todo entra al embudo → le llega a Mateo → él deriva a la oficina).
  const [motivoContacto, setMotivoContacto] = useState<"" | "comprar" | "vender">("");
  const irAlFormulario = (m: "comprar" | "vender") => {
    setMotivoContacto(m);
    document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const zonas = [...new Set(propiedades.map((c) => c.zona))].sort();
  const destacados = propiedades.filter((p) => p.destacado).slice(0, 6);
  const countByCat = (cat: string) => propiedades.filter((p) => p.categoria === cat).length;
  const [q, setQ] = useState({ cat: "", zona: "", operacion: "" });
  const [qIA, setQIA] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  // El buscador BUSCA: entiende lo que se escribe en castellano y lleva a los
  // resultados filtrados al instante. La IA vive en la burbuja, es otra cosa.
  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const b = parseBusqueda(qIA, zonas);
    // Si el visitante además tocó un filtro, ese manda.
    if (q.cat) b.cat = q.cat;
    if (q.zona) b.zona = q.zona;
    if (q.operacion) b.operacion = q.operacion;
    // Habló de verano/quincena → esa es otra sección (y si el barrio tiene página, va ahí).
    if (b.temporada) {
      navigate(rutaTemporada(b.zona));
      return;
    }
    const qs = aQueryString(b);
    navigate(qs ? `/propiedades?${qs}` : "/propiedades");
  };

  return (
    <div className="bg-paper text-graph">
      <div className="grain" />
      <Navbar />

      {/* ===== HERO — el Atlántico en vivo (Gerstner + espuma que sigue al mouse) ===== */}
      <section className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-paper md:block md:items-center">
        <div className="absolute inset-0" aria-hidden>
          {/* fallback estático mientras carga el mar (o si no hay WebGL) */}
          <div className="absolute -left-40 top-[-20%] h-[70vh] w-[70vh] animate-drift rounded-full bg-brand-50 blur-3xl" />
          <div className="absolute -right-52 bottom-[-30%] h-[80vh] w-[80vh] animate-drift rounded-full bg-sea-50 blur-3xl [animation-delay:-9s]" />
          {/* el mar */}
          {HERO_3D ? (
            <Suspense fallback={null}>
              <HeroOcean />
            </Suspense>
          ) : (
            // Video "boomerang" (adelante + reversa): al dar la vuelta en el mismo
            // frame, el loop no tiene corte. El agua fluye y refluye, sin reiniciarse.
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/video/hero-poster.jpg"
              className="h-full w-full object-cover"
            >
              {/* El video que eligió Mateo: el boomerang del mar (loop sin corte).
                  El 5-ago probamos uno de dron sobre playa urbana y lo descartó:
                  prefiere este. El de dron quedó en el historial de git por si
                  alguna vez se quiere volver (commit 6a07eaf). */}
              <source src="/video/hero-loop.mp4" type="video/mp4" />
            </video>
          )}
          {/* velos de legibilidad: el texto respira, el agua manda a la derecha */}
          <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/45 to-transparent md:from-paper/95" />
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-paper/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-paper/60 to-transparent" />
        </div>

        {/* ⚠️ Acá NO va ninguna ficha flotante. Hubo una tarjeta de propiedad en
            vidrio con parallax flotando sobre el mar y se SACÓ el 10-ago a pedido
            del cliente: "a Mateo no le gusta lo que flota entre el hero". Además
            tenía datos hardcodeados (precio, dorm, m²) que iban a quedar viejos.
            Si alguien la quiere de vuelta, está en el historial de git — pero
            primero preguntarle a Mateo. */}

        <div className="container-x relative z-10 pt-28 md:pb-64 md:pt-52">
          <div className="max-w-3xl">
            <p className="eyebrow reveal flex items-center gap-2">
              <span className="h-px w-8 bg-brand" /> Mar del Plata · Punta Mogotes y Chauvín
            </p>
            <h1 className="reveal mt-6 font-display text-5xl font-medium leading-[1.02] tracking-tight text-graph sm:text-6xl md:text-7xl">
              Tres generaciones <br />
              encontrando <span className="text-brand">tu lugar</span> <br />
              frente al mar.
            </h1>
            <p className="reveal mt-7 max-w-xl text-lg leading-relaxed text-graph-700" data-delay="120ms">
              Más de 50 años comprando, vendiendo y alquilando propiedades marplatenses.{" "}
              <span className="font-medium text-graph">Cartera propia, tasaciones con informe y dos oficinas en la ciudad.</span>
            </p>
            <div className="reveal mt-9 flex flex-wrap gap-4" data-delay="220ms">
              <Link to="/propiedades" className="btn-primary">Ver propiedades <ArrowRight size={16} /></Link>
              <a href="#tasaciones" className="btn-ghost">Tasá tu propiedad</a>
            </div>
          </div>
        </div>

        {/* Un solo buscador, un solo botón. En el celular vive en el flujo (no tapa el hero);
            en escritorio flota sobre el video. Los filtros se despliegan si el visitante quiere. */}
        <div className="container-x relative z-10 mt-10 pb-12 md:absolute md:inset-x-0 md:bottom-8 md:mt-0 md:pb-0">
          <form
            onSubmit={buscar}
            className="reveal rounded-2xl border border-graph/10 bg-paper-100/90 p-4 shadow-card backdrop-blur-md md:bg-paper-100/80 md:p-5"
            data-delay="320ms"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="relative block flex-1">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand" />
                <input
                  value={qIA}
                  onChange={(e) => setQIA(e.target.value)}
                  placeholder="¿Qué buscás? Ej: “depto 3 ambientes en Playa Grande”"
                  className="h-[54px] w-full rounded-xl border border-graph/15 bg-paper-100 pl-11 pr-4 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand focus:ring-2 focus:ring-brand/15"
                  aria-label="Buscar propiedades"
                />
              </label>
              <button type="submit" className="btn-primary h-[54px] whitespace-nowrap md:hidden">
                <Search size={16} /> Buscar
              </button>
            </div>

            {/* En el celular los filtros están plegados: el visitante ve una sola cosa. */}
            <button
              type="button"
              onClick={() => setFiltrosAbiertos((v) => !v)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-graph-500 transition hover:text-brand md:hidden"
              aria-expanded={filtrosAbiertos}
            >
              <SlidersHorizontal size={13} /> {filtrosAbiertos ? "Ocultar filtros" : "Más filtros"}
            </button>

            <div
              className={`${filtrosAbiertos ? "grid" : "hidden"} mt-3 gap-3 border-t border-graph/10 pt-3 md:grid md:grid-cols-[1.2fr_1.3fr_1fr_auto]`}
            >
              <Select label="Tipo" value={q.cat} onChange={(v) => setQ({ ...q, cat: v })}
                options={[{ v: "casa", l: "Casas" }, { v: "departamento", l: "Departamentos" }, { v: "local", l: "Locales" }, { v: "lote", l: "Lotes" }]} placeholder="Todos" />
              <Select label="Zona" value={q.zona} onChange={(v) => setQ({ ...q, zona: v })} options={zonas.map((z) => ({ v: z, l: z }))} placeholder="Todas las zonas" />
              <Select label="Operación" value={q.operacion} onChange={(v) => setQ({ ...q, operacion: v })}
                options={[{ v: "venta", l: "Venta" }, { v: "alquiler", l: "Alquiler" }]} placeholder="Todas" />
              <button type="submit" className="btn-primary hidden h-[58px] self-end whitespace-nowrap md:inline-flex">
                <Search size={16} /> Buscar
              </button>
            </div>
          </form>
        </div>

        <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 animate-bounce text-white/70"><ChevronDown /></div>
      </section>

      {/* ===== TRAYECTORIA ===== · FONDO CLARO, el contraste lo hacen las cards.
          Veredicto de Juani sobre la banda navy (11-ago): "la línea recta en
          azul me parece vieja, no vende... que quede fondo blanco y generamos
          el contraste con efecto en las cards". Entonces:
          · La banda de color, AFUERA. Fondo claro, sin bordes duros.
          · Cada cifra es una placa liquid glass (el squircle iPhone de la casa)
            con el reflejo arriba.
          · Al tocarla: una FRANJA AZUL la barre en diagonal (el brillo que pasa
            por el vidrio), se enciende el filo de abajo en degradé azul→celeste
            y la placa se levanta. Efecto, no pintura — un solo azul. */}
      <section className="bg-paper-100 py-14">
        <div className="container-x grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {[
            { n: "+50", l: "Años en Mar del Plata" },
            { n: "3", l: "Generaciones" },
            { n: "2", l: "Oficinas en la ciudad" },
            { n: `${propiedades.length}`, l: "Propiedades en cartera" },
          ].map((s, i) => (
            <div
              key={i}
              data-delay={`${i * 80}ms`}
              className="reveal group relative overflow-hidden rounded-[1.75rem] bg-white/80 p-5 text-center shadow-[0_18px_44px_-26px_rgba(2,35,82,0.35)] ring-1 ring-graph/10 backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:shadow-[0_30px_70px_-28px_rgba(12,77,162,0.4)] hover:ring-brand/25 md:p-6 md:text-left"
            >
              {/* El reflejo de vidrio de la casa. */}
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-gradient-to-b from-white/60 via-transparent to-transparent" />
              {/* La franja azul que BARRE la placa al hover: nace fuera del borde
                  izquierdo, inclinada, y cruza entera como un brillo. */}
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-[-70%] w-[50%] -skew-x-12 bg-gradient-to-r from-transparent via-brand/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[340%]" />
              {/* El filo de abajo se enciende de izquierda a derecha. */}
              <span aria-hidden className="pointer-events-none absolute inset-x-5 bottom-2.5 h-[3px] origin-left scale-x-0 rounded-full bg-gradient-to-r from-brand to-sea transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
              <p className="relative font-display text-3xl font-semibold tracking-tight text-brand-950 md:text-4xl">{s.n}</p>
              <p className="relative mt-1 text-sm text-graph-500">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CATEGORÍAS ===== */}
      <section className="py-24">
        <div className="container-x">
          <div className="reveal mb-12">
            <p className="eyebrow">Explorá por tipo</p>
            <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-graph md:text-5xl">¿Qué estás buscando?</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categoriasHome.map((c, i) => (
              <Link key={c.key} to={`/propiedades?cat=${c.key}`} className="reveal group relative h-56 overflow-hidden rounded-2xl" data-delay={`${i * 70}ms`}>
                <img src={c.img} alt={`${c.label} en Mar del Plata`} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <c.icon size={22} className="text-white" />
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">{c.label}</h3>
                  <p className="text-sm text-white/70">{countByCat(c.key)} propiedades</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DESTACADOS ===== */}
      <section className="border-t border-graph/10 bg-paper-100 py-24">
        <div className="container-x">
          <div className="reveal mb-12 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Oportunidades</p>
              <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-graph md:text-5xl">Propiedades destacadas</h2>
            </div>
            <Link to="/propiedades" className="group flex items-center gap-2 text-sm font-semibold text-brand">
              Ver todo el catálogo <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {destacados.map((p, i) => (
              <div key={p.id} className="reveal"><PropiedadCard p={p} prioritaria={i < 3} /></div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRES GENERACIONES — la firma de la casa ===== */}
      <section id="nosotros" className="relative overflow-hidden border-t border-graph/10 py-24">
        <div className="container-x">
          <div className="reveal mb-14 max-w-2xl">
            <p className="eyebrow flex items-center gap-2"><Waves size={15} /> Desde hace más de 50 años</p>
            <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-graph md:text-5xl">Una familia, tres generaciones, una ciudad</h2>
          </div>
          <div className="relative grid gap-10 md:grid-cols-3">
            {/* línea de tiempo hairline que une las tres etapas */}
            <div className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-brand/10 via-brand/40 to-sea/40 md:block" aria-hidden />
            {generaciones.map((g, i) => (
              <div key={g.epoca} className="reveal relative" data-delay={`${i * 120}ms`}>
                <span className="relative z-10 inline-grid h-10 w-10 place-items-center rounded-full border border-brand/25 bg-paper-100 font-display text-sm font-semibold text-brand">
                  {i + 1}
                </span>
                <p className="mt-5 text-xs uppercase tracking-widest2 text-graph-400">{g.epoca}</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-graph">{g.titulo}</h3>
                <p className="mt-3 text-sm leading-relaxed text-graph-500">{g.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SERVICIOS ===== */}
      <section id="servicios" className="border-t border-graph/10 bg-paper-100 py-24">
        <div className="container-x">
          <div className="reveal mb-14 max-w-2xl">
            <p className="eyebrow">Lo que hacemos</p>
            <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-graph md:text-5xl">Todo el negocio inmobiliario, en un solo lugar</h2>
            <p className="mt-5 text-lg text-graph-500">Acompañamos cada operación de principio a fin, con el conocimiento de la ciudad y el respaldo de tres generaciones.</p>
          </div>
          {/* Audio Mateo 5-ago: vendedores y compradores, protagonistas de la sección.
              Dos paneles con materia distinta (navy fotográfico vs. papel con hairlines)
              y los cuatro servicios de siempre en tira editorial abajo. */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Los dos paneles son columnas flex y el botón va con mt-auto: quedan
                alineados aunque uno tenga más texto que el otro (pedido Mateo 6-ago). */}
            <div className="reveal relative flex overflow-hidden rounded-2xl p-8 md:p-10">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/img/props/casa3.jpg)" }} aria-hidden />
              <div className="absolute inset-0 bg-gradient-to-br from-brand-950/[0.96] via-brand-950/[0.88] to-brand/70" aria-hidden />
              <div className="relative flex w-full flex-col">
                <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-widest2 text-sea">
                  <Camera size={15} /> 01 · Para quien vende
                </p>
                <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Tu propiedad, presentada como se debe
                </h3>
                {/* Juani 5-ago: que se note que se INVIERTE en cada propiedad. */}
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  No publicamos y esperamos: invertimos en cada propiedad para que se venda mejor y más rápido.
                </p>
                <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
                  {[
                    "Equipo profesional propio de fotografía y video",
                    "Publicación en nuestra web y en los principales portales del país",
                    "Inversión en publicidad para llegar a más compradores",
                    "Difusión en redes y cartera de compradores propia",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 py-3.5 text-sm leading-relaxed text-white/85">
                      <Check size={15} className="mt-0.5 shrink-0 text-sea" /> {t}
                    </li>
                  ))}
                </ul>
                {/* Mateo 5-ago: solo el botón, y manda al formulario (embudo → Mateo deriva). */}
                <div className="mt-8 pt-2 md:mt-auto">
                  <button onClick={() => irAlFormulario("vender")} className="btn-primary !bg-white !text-brand-950 hover:!bg-sea-50">
                    Quiero vender <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="reveal flex flex-col rounded-2xl border border-graph/10 bg-paper p-8 shadow-card md:p-10" data-delay="120ms">
              <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-widest2 text-brand">
                <Handshake size={15} /> 02 · Para quien compra
              </p>
              <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight text-graph md:text-3xl">
                Comprá acompañado, no solo
              </h3>
              <ul className="mt-7 divide-y divide-graph/10 border-y border-graph/10">
                {[
                  "Búsqueda guiada según lo que necesitás y tu presupuesto",
                  "Visitas coordinadas y asesoramiento en la negociación",
                  "Te acompañamos en todo el proceso: cada consulta, respondida",
                  "Seguimiento hasta el final, de la reserva a la escritura",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 py-3.5 text-sm leading-relaxed text-graph-500">
                    <Check size={15} className="mt-0.5 shrink-0 text-brand" /> {t}
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-2 md:mt-auto">
                <button onClick={() => irAlFormulario("comprar")} className="btn-primary">
                  Quiero comprar <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Los cuatro servicios, en PLACAS SEPARADAS — el gesto central de la
              referencia de Juani (11-ago): tarjetas blancas con el disco de
              ícono grande, y al pasar por encima la placa entera se pinta de
              azul con el reflejo de vidrio. Antes era una tira pegada con
              hairlines ("parece Win 98"). Y ahora son LINKS: cada una lleva a
              donde dice — una tarjeta linda que no va a ningún lado es decorado. */}
          <div className="reveal mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5" data-delay="200ms">
            {[
              { icon: HomeIcon, t: "Venta de propiedades", d: "Casas, departamentos, PH, locales y lotes, con cartera propia.", to: "/propiedades?operacion=venta" },
              { icon: KeyRound, t: "Alquileres", d: "Anuales y de temporada, contratos claros y garantías verificadas.", to: "/propiedades?operacion=alquiler" },
              { icon: FileSearch, t: "Tasaciones", d: "Valuación profesional con informe escrito, sin cargo.", to: "/#tasaciones" },
              { icon: TrendingUp, t: "Asesoramiento", d: "Inversión en ladrillo marplatense: renta, reciclados y pozo.", to: "/#contacto" },
            ].map((s) =>
              s.to.includes("#") ? (
                <a key={s.t} href={s.to} className="group relative overflow-hidden rounded-[1.75rem] border border-graph/10 bg-paper-100 p-6 shadow-[0_18px_44px_-24px_rgba(2,35,82,0.35)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:border-transparent hover:bg-brand">
                  <ServicioPlaca s={s} />
                </a>
              ) : (
                <Link key={s.t} to={s.to} className="group relative overflow-hidden rounded-[1.75rem] border border-graph/10 bg-paper-100 p-6 shadow-[0_18px_44px_-24px_rgba(2,35,82,0.35)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:border-transparent hover:bg-brand">
                  <ServicioPlaca s={s} />
                </Link>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ===== TASACIONES ===== */}
      {/* Pedido de Mateo (3-ago): esta sección estaba "muy blanca" → va AZUL. */}
      <section id="tasaciones" className="relative overflow-hidden py-28">
        <div className="absolute inset-0">
          <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: "url(/img/props/casa2.jpg)" }} />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-950/[0.97] via-brand-950/90 to-brand/80" />
        </div>
        <Horizonte />
        <div className="container-x relative z-10">
          <div className="max-w-2xl">
            <p className="eyebrow reveal flex items-center gap-2 !text-sea-300"><FileSearch size={16} /> Tasación profesional</p>
            <h2 className="reveal mt-4 font-display text-4xl font-medium leading-tight tracking-tight text-white md:text-5xl">¿Cuánto vale tu propiedad hoy?</h2>
            <p className="reveal mt-5 text-lg text-white/75" data-delay="120ms">Te hacemos una tasación profesional, con informe escrito y valor de mercado real. Conocemos la ciudad, los precios y los compradores.</p>
            <div className="reveal mt-8 flex flex-wrap gap-4" data-delay="200ms">
              <WhatsAppCTA mensaje="Hola Potente Propiedades, quiero pedir una tasación de mi propiedad." className="btn-primary !bg-white !text-brand-950 hover:!bg-sea-50"><Phone size={16} /> Pedir tasación</WhatsAppCTA>
              <button onClick={() => irAlFormulario("vender")} className="btn-ghost !border-white/30 !text-white hover:!border-white">Dejar mis datos</button>
            </div>
            <div className="reveal mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/70" data-delay="260ms">
              {["Informe escrito", "Valor de mercado real", "Sin cargo ni compromiso"].map((x) => (
                <span key={x} className="flex items-center gap-2"><ShieldCheck size={16} className="text-sea-300" /> {x}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SUCURSALES ===== · tarjetas blancas que FLOTAN.
          Antes la banda era paper-100 y las tarjetas .card también paper-100:
          blanco sobre blanco, no flotaba nada. Con el fondo paper (un tono más
          profundo) las tarjetas contrastan — que era el punto. */}
      <section className="border-t border-graph/10 bg-paper py-24">
        <div className="container-x">
          <div className="reveal mb-12">
            <p className="eyebrow">Dos oficinas, una ciudad</p>
            <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-graph md:text-5xl">Pasá cuando quieras</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {OFICINAS.map((o, i) => (
              <div key={o.nombre} className="reveal card group p-8 transition duration-300 hover:-translate-y-0.5 hover:shadow-card" data-delay={`${i * 100}ms`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">{o.nombre}</p>
                    <h3 className="mt-2 font-display text-2xl font-semibold text-graph">{o.direccion}</h3>
                    <p className="mt-2 text-sm text-graph-500">{o.nota}</p>
                  </div>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand"><MapPin size={22} /></span>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-graph-500">
                  <span className="flex items-center gap-2"><Phone size={15} className="text-brand" /> {o.telefono}</span>
                  <span className="flex items-center gap-2"><Clock size={15} className="text-brand" /> {o.horario}</span>
                  <a href={o.maps} target="_blank" rel="noreferrer" className="link-underline flex items-center gap-1 font-semibold text-brand">
                    Cómo llegar <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <InstagramFeed />

      {/* ===== CONTACTO ===== · el gesto grande de la referencia:
          la tarjeta blanca del formulario flotando sobre la banda navy plena.
          Todo el embudo de la home desemboca acá (irAlFormulario) — el destino
          se tiene que ver desde lejos. El botón va BLANCO: el azul de siempre
          sería invisible sobre navy (mismo patrón que ya usa Tasaciones). */}
      <section id="contacto" className="relative overflow-hidden bg-brand-950 py-24">
        <Horizonte />
        {/* El año fundacional, gigante y fantasma: ancla la historia y llena el
            azul sin meter datos repetidos (Mateo pidió que acá quede SOLO el
            formulario — direcciones y teléfonos viven en Sucursales y el footer). */}
        <span aria-hidden className="pointer-events-none absolute -bottom-10 left-0 select-none font-display text-[11rem] font-semibold leading-none text-white/[0.045] md:text-[15rem]">
          1974
        </span>
        <div className="container-x relative grid gap-14 lg:grid-cols-2">
          <div className="flex flex-col">
            <p className="eyebrow reveal !text-sea-300">Hablemos</p>
            <h2 className="reveal mt-3 font-display text-4xl font-medium tracking-tight text-white md:text-5xl">Contanos qué estás buscando</h2>
            <p className="reveal mt-5 text-lg text-white/70" data-delay="100ms">Te respondemos rápido por WhatsApp o teléfono.</p>
            {/* Confianza, no datos: lo que el que consulta quiere saber antes de
                dejar el teléfono. */}
            <ul className="reveal mt-8 space-y-3.5 text-white/75" data-delay="160ms">
              {[
                "Te respondemos en el día",
                "Sin cargo ni compromiso",
                "Te atiende el equipo de la oficina que corresponde",
              ].map((x) => (
                <li key={x} className="flex items-center gap-3 text-[15px]">
                  <ShieldCheck size={17} className="shrink-0 text-sea-300" /> {x}
                </li>
              ))}
            </ul>
            <WhatsAppCTA mensaje="Hola Potente Propiedades, quiero hacer una consulta." className="btn-primary reveal mt-9 self-start !bg-white !text-brand-950 hover:!bg-sea-50"><Phone size={16} /> Escribinos por WhatsApp</WhatsAppCTA>
          </div>
          <ContactForm onEnviar={addLead} motivo={motivoContacto} enBandaOscura />
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ── La placa de servicio ─────────────────────────────────────────────────────
   El interior de las cuatro tarjetas de servicios: disco de ícono grande (como
   la referencia), título y bajada, más el reflejo de vidrio de la casa. Al
   hover, el padre (.group) se pinta de azul y todo el contenido pasa a blanco. */
function ServicioPlaca({ s }: { s: { icon: any; t: string; d: string } }) {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-gradient-to-b from-white/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand transition-colors duration-500 group-hover:bg-white/15 group-hover:text-white">
        <s.icon size={24} strokeWidth={1.8} />
      </span>
      <h3 className="relative mt-4 font-display text-base font-semibold text-graph transition-colors duration-500 group-hover:text-white">{s.t}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-graph-500 transition-colors duration-500 group-hover:text-white/85">{s.d}</p>
      <span className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand opacity-0 transition-all duration-500 group-hover:translate-x-1 group-hover:text-white group-hover:opacity-100">
        Ver más <ArrowRight size={15} />
      </span>
    </>
  );
}

/* ── El horizonte Potente ─────────────────────────────────────────────────────
   La firma de las bandas navy: la línea del mar cruzando el borde superior, con
   un resplandor de amanecer arriba del agua. Un solo detalle, repetido con la
   misma forma en las tres bandas (Trayectoria, Tasaciones, Contacto) = sistema,
   no ruido. Va absolutamente posicionado y el section lleva overflow-hidden:
   el blur no ensancha nada. */
function Horizonte() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0">
      <div className="h-px bg-gradient-to-r from-transparent via-sea/70 to-transparent" />
      <div className="mx-auto -mt-px h-20 max-w-2xl rounded-full bg-sea/15 blur-3xl" />
    </div>
  );
}

function Select({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; placeholder: string }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-graph-400">{label}</span>
      <UISelect
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        options={[{ value: "", label: placeholder }, ...options.map((o) => ({ value: o.v, label: o.l }))]}
      />
    </div>
  );
}

// El formulario del embudo: motivo (comprar/vender/otra) + datos. El lead entra
// etiquetado a la bandeja central de Mateo y él deriva a la oficina (C2, 5-ago).
const MOTIVOS = [
  { id: "comprar", label: "Quiero comprar", tag: "COMPRA", ph: "Busco un depto de 3 ambientes cerca de Güemes, o una casa en Punta Mogotes..." },
  { id: "vender", label: "Quiero vender / tasar", tag: "VENDE · pide tasación", ph: "Quiero vender mi depto de 2 ambientes en el centro. Me gustaría saber cuánto vale hoy..." },
  { id: "consulta", label: "Otra consulta", tag: "CONSULTA", ph: "Contanos en qué te podemos ayudar..." },
] as const;

function ContactForm({ onEnviar, motivo, enBandaOscura }: { onEnviar: (l: any) => void; motivo?: "" | "comprar" | "vender"; enBandaOscura?: boolean }) {
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ nombre: "", telefono: "", mensaje: "", motivo: "" as string });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Si vienen de "Quiero vender/comprar", el motivo llega pre-elegido.
  useEffect(() => {
    if (motivo) {
      setF((p) => ({ ...p, motivo }));
      setSent(false);
    }
  }, [motivo]);

  const m = MOTIVOS.find((x) => x.id === f.motivo);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onEnviar({
      id: "LEAD-" + Date.now(),
      fechaISO: new Date().toISOString(),
      nombre: f.nombre || "Consulta web",
      contacto: f.telefono || "—",
      campoId: null,
      canal: "web",
      estado: "nueva",
      asignado: "Sin asignar",
      notas: `${m ? `[${m.tag}] ` : ""}${f.mensaje}`,
    });
    setSent(true);
  };

  return (
    // Sobre la banda navy, el borde gris muere y la sombra necesita más caída:
    // anillo de luz + sombra profunda (la receta "tarjeta blanca sobre navy").
    <form
      onSubmit={submit}
      className={`reveal rounded-2xl bg-paper-100 p-7 ${
        enBandaOscura
          ? "ring-1 ring-white/10 shadow-[0_30px_80px_-32px_rgba(2,10,30,0.55)]"
          : "border border-graph/10 shadow-card"
      }`}
    >
      {sent ? (
        <div className="flex h-full min-h-[340px] flex-col items-center justify-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand"><ShieldCheck size={30} /></span>
          <h3 className="mt-5 font-display text-2xl text-graph">¡Consulta enviada!</h3>
          <p className="mt-2 max-w-xs text-sm text-graph-500">Te vamos a contactar a la brevedad. Gracias por confiar en Potente Propiedades.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-graph-400">¿Qué querés hacer?</span>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => set("motivo", x.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    f.motivo === x.id
                      ? "border-brand bg-brand text-white"
                      : "border-graph/15 text-graph-500 hover:border-brand/50 hover:text-brand"
                  }`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Nombre y apellido" placeholder="Juan Pérez" value={f.nombre} onChange={(v) => set("nombre", v)} />
          <Field label="Teléfono / WhatsApp" placeholder="+54 9 223 ..." value={f.telefono} onChange={(v) => set("telefono", v)} />
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-graph-400">Mensaje</span>
            <textarea rows={4} value={f.mensaje} onChange={(e) => set("mensaje", e.target.value)} placeholder={m?.ph ?? "Contanos en qué te podemos ayudar..."} className="w-full rounded-lg border border-graph/15 bg-paper-100 px-4 py-3 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand" />
          </label>
          <button type="submit" className="btn-primary w-full">Enviar consulta <ArrowRight size={16} /></button>
          <p className="text-center text-xs text-graph-400">Respondemos de lunes a viernes de 9 a 18 y sábados a la mañana.</p>
        </div>
      )}
    </form>
  );
}

function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-graph-400">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-[46px] w-full rounded-lg border border-graph/15 bg-paper-100 px-4 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand" />
    </label>
  );
}
