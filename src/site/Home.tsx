import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown, Search, FileSearch, TrendingUp, ArrowRight, Sparkles, SlidersHorizontal,
  ShieldCheck, MapPin, Phone, Mail, Clock, Home as HomeIcon, Building2, Store, Trees, KeyRound, Waves, BedDouble, Maximize,
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

import { waUrl, OFICINAS, HORARIO } from "@/config/marca";

const WHATSAPP = waUrl();

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
              <source src="/video/hero-loop.mp4" type="video/mp4" />
            </video>
          )}
          {/* velos de legibilidad: el texto respira, el agua manda a la derecha */}
          <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/45 to-transparent md:from-paper/95" />
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-paper/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-paper/60 to-transparent" />
        </div>

        {/* toque real estate: ficha flotante en vidrio con parallax */}
        <FichaFlotante />


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

      {/* ===== TRAYECTORIA ===== */}
      <section className="border-y border-graph/10 bg-paper-100">
        <div className="container-x grid grid-cols-2 gap-8 py-10 md:grid-cols-4">
          {[
            { n: "+50", l: "Años en Mar del Plata" },
            { n: "3", l: "Generaciones" },
            { n: "2", l: "Oficinas en la ciudad" },
            { n: `${propiedades.length}`, l: "Propiedades en cartera" },
          ].map((s, i) => (
            <div key={i} className="reveal text-center md:text-left" data-delay={`${i * 80}ms`}>
              <p className="font-display text-3xl font-semibold tracking-tight text-brand md:text-4xl">{s.n}</p>
              <p className="mt-1 text-sm text-graph-500">{s.l}</p>
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
            {destacados.map((p) => (
              <div key={p.id} className="reveal"><PropiedadCard p={p} /></div>
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
          <div className="grid gap-px overflow-hidden rounded-2xl bg-graph/10 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: HomeIcon, t: "Venta de propiedades", d: "Casas, departamentos, PH, locales y lotes en toda Mar del Plata, con cartera propia." },
              { icon: KeyRound, t: "Alquileres", d: "Anuales y de temporada, con contratos claros, garantías verificadas y seguimiento." },
              { icon: FileSearch, t: "Tasaciones", d: "Valuación profesional para venta, garantía o sucesión, con informe escrito y sin cargo." },
              { icon: TrendingUp, t: "Asesoramiento", d: "Inversión en ladrillo marplatense: renta de temporada, reciclados y pozo. Te ayudamos a elegir." },
            ].map((s, i) => (
              <div key={i} className="reveal group bg-paper-100 p-8 transition hover:bg-paper-200" data-delay={`${i * 80}ms`}>
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand transition group-hover:bg-brand group-hover:text-white"><s.icon size={22} /></span>
                <h3 className="mt-6 font-display text-xl font-semibold text-graph">{s.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-graph-500">{s.d}</p>
              </div>
            ))}
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
        <div className="container-x relative z-10">
          <div className="max-w-2xl">
            <p className="eyebrow reveal flex items-center gap-2 !text-sea-300"><FileSearch size={16} /> Tasación profesional</p>
            <h2 className="reveal mt-4 font-display text-4xl font-medium leading-tight tracking-tight text-white md:text-5xl">¿Cuánto vale tu propiedad hoy?</h2>
            <p className="reveal mt-5 text-lg text-white/75" data-delay="120ms">Te hacemos una tasación profesional, con informe escrito y valor de mercado real. Conocemos la ciudad, los precios y los compradores.</p>
            <div className="reveal mt-8 flex flex-wrap gap-4" data-delay="200ms">
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn-primary !bg-white !text-brand-950 hover:!bg-sea-50"><Phone size={16} /> Pedir tasación</a>
              <a href="#contacto" className="btn-ghost !border-white/30 !text-white hover:!border-white">Dejar mis datos</a>
            </div>
            <div className="reveal mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/70" data-delay="260ms">
              {["Informe escrito", "Valor de mercado real", "Sin cargo ni compromiso"].map((x) => (
                <span key={x} className="flex items-center gap-2"><ShieldCheck size={16} className="text-sea-300" /> {x}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SUCURSALES ===== */}
      <section className="border-t border-graph/10 bg-paper-100 py-24">
        <div className="container-x">
          <div className="reveal mb-12">
            <p className="eyebrow">Dos oficinas, una ciudad</p>
            <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-graph md:text-5xl">Pasá cuando quieras</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {OFICINAS.map((o, i) => (
              <div key={o.nombre} className="reveal card group p-8 transition hover:shadow-card" data-delay={`${i * 100}ms`}>
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

      {/* ===== CONTACTO ===== */}
      <section id="contacto" className="border-t border-graph/10 py-24">
        <div className="container-x grid gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow reveal">Hablemos</p>
            <h2 className="reveal mt-3 font-display text-4xl font-medium tracking-tight text-graph md:text-5xl">Contanos qué estás buscando</h2>
            <p className="reveal mt-5 text-lg text-graph-500" data-delay="100ms">Te respondemos rápido por WhatsApp o teléfono.</p>
            {/* Pedido Mateo (3-ago): acá los datos se repetían → queda SOLO el formulario.
                Direcciones y teléfonos viven en "Pasá cuando quieras" y en el footer. */}
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn-primary reveal mt-9" data-delay="220ms"><Phone size={16} /> Escribinos por WhatsApp</a>
          </div>
          <ContactForm onEnviar={addLead} />
        </div>
      </section>

      <Footer />
    </div>
  );
}

// Ficha de propiedad flotando sobre el mar: vidrio + parallax 3D con el mouse.
function FichaFlotante() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    let raf = 0;
    const cur = { x: 0, y: 0 };
    const tgt = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      tgt.x = e.clientX / window.innerWidth - 0.5;
      tgt.y = e.clientY / window.innerHeight - 0.5;
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      cur.x += (tgt.x - cur.x) * 0.07;
      cur.y += (tgt.y - cur.y) * 0.07;
      if (ref.current) {
        ref.current.style.transform =
          `perspective(900px) rotateX(${(-cur.y * 7).toFixed(2)}deg) rotateY(${(cur.x * 10).toFixed(2)}deg) translateY(${(-cur.y * 10).toFixed(1)}px)`;
      }
    };
    loop();
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <Link
      ref={ref}
      to="/propiedad/POT-153992"
      className="group absolute right-[6%] top-[26%] z-10 hidden w-[290px] overflow-hidden rounded-2xl border border-white/40 bg-white/70 shadow-card backdrop-blur-xl transition-shadow duration-300 will-change-transform hover:shadow-[0_30px_70px_-24px_rgba(2,35,82,0.45)] xl:block"
      aria-label="Ver departamento destacado frente al mar"
    >
      <div className="relative h-36 overflow-hidden">
        <img src="https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/2/74b93e21-f54c-4f78-a268-1689e2878d29.jpeg" alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        <span className="absolute left-3 top-3 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Venta</span>
      </div>
      <div className="p-4">
        <p className="font-display text-[15px] font-semibold leading-snug text-graph">Piso único de 4 dormitorios frente al mar</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-graph-500"><MapPin size={12} className="text-brand" /> Playa Grande, Mar del Plata</p>
        <div className="mt-3 flex items-center gap-4 border-t border-graph/10 pt-3 text-[11px] text-graph-500">
          <span className="flex items-center gap-1"><BedDouble size={13} className="text-brand" /> 4 dorm.</span>
          <span className="flex items-center gap-1"><Maximize size={13} className="text-brand" /> 145 m²</span>
          <span className="ml-auto font-display text-sm font-semibold text-brand">U$S 700.000</span>
        </div>
      </div>
    </Link>
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

function ContactForm({ onEnviar }: { onEnviar: (l: any) => void }) {
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ nombre: "", telefono: "", mensaje: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

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
      notas: f.mensaje,
    });
    setSent(true);
  };

  return (
    <form onSubmit={submit} className="reveal rounded-2xl border border-graph/10 bg-paper-100 p-7 shadow-card">
      {sent ? (
        <div className="flex h-full min-h-[340px] flex-col items-center justify-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand"><ShieldCheck size={30} /></span>
          <h3 className="mt-5 font-display text-2xl text-graph">¡Consulta enviada!</h3>
          <p className="mt-2 max-w-xs text-sm text-graph-500">Te vamos a contactar a la brevedad. Gracias por confiar en Potente Propiedades.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Nombre y apellido" placeholder="Juan Pérez" value={f.nombre} onChange={(v) => set("nombre", v)} />
          <Field label="Teléfono / WhatsApp" placeholder="+54 9 223 ..." value={f.telefono} onChange={(v) => set("telefono", v)} />
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-widest2 text-graph-400">Mensaje</span>
            <textarea rows={4} value={f.mensaje} onChange={(e) => set("mensaje", e.target.value)} placeholder="Busco un depto de 3 ambientes cerca de Güemes, o una casa en Punta Mogotes..." className="w-full rounded-lg border border-graph/15 bg-paper-100 px-4 py-3 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand" />
          </label>
          <button type="submit" className="btn-primary w-full">Enviar consulta <ArrowRight size={16} /></button>
          <p className="text-center text-xs text-graph-400">Respondemos de lunes a viernes de 9 a 16.</p>
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
