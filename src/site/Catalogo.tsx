import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, SlidersHorizontal } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PropiedadCard from "./components/PropiedadCard";
import { useLenis } from "./lib/useLenis";
import { useSEO } from "./lib/seo";
import UISelect from "@/components/Select";
import { fmtUSD, fmtARS } from "@/lib/format";

import WhatsAppCTA from "./components/WhatsAppCTA";
import { useReveal } from "@/lib/hooks";
import { useData } from "@/lib/DataProvider";
import { CATEGORIAS } from "@/data/propiedadTypes";

export default function Catalogo() {
  useLenis();
  useSEO({
    titulo: "Propiedades en venta y alquiler en Mar del Plata · Potente Propiedades",
    descripcion:
      "Catálogo completo de Potente Propiedades: casas, departamentos, PH, locales y lotes en Mar del Plata. Filtrá por zona, tipo y operación.",
    path: "/propiedades",
  });
  const { propiedades } = useData();
  const zonas = [...new Set(propiedades.map((p) => p.zona))].sort();
  const cuenta = (cat: string) => propiedades.filter((p) => p.categoria === cat).length;
  const tabs = [
    { key: "", label: "Todas", n: propiedades.length },
    ...CATEGORIAS.map((c) => ({ key: c.key, label: c.plural, n: cuenta(c.key) })).filter((t) => t.n > 0),
  ];
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState({
    cat: params.get("cat") || "",
    operacion: params.get("operacion") || "",
    zona: params.get("zona") || "",
    amb: params.get("amb") || "",
    dorm: params.get("dorm") || "",
    banos: params.get("banos") || "",
    min: params.get("min") || "",
    max: params.get("max") || "",
    q: params.get("q") || "",
    caract: (params.get("caract") || "").split(",").filter(Boolean),
    orden: "destacados",
  });

  // Sincronizar con la URL: el buscador del inicio llega con todo puesto acá.
  useEffect(() => {
    setF((p) => ({
      ...p,
      cat: params.get("cat") || "",
      operacion: params.get("operacion") || p.operacion,
      zona: params.get("zona") || p.zona,
      amb: params.get("amb") || "",
      max: params.get("max") || "",
      q: params.get("q") || p.q,
    }));
  }, [params]);

  // ── Búsqueda por palabras clave (pedido Mateo 5-ago, estilo Bochile) ─────────
  // "pileta" tiene que encontrar la casa con pileta: el buscador mira título, zona,
  // dirección, descripción, características, mejoras y servicios de la ficha.
  // Sin acentos y por palabras: "guemes pileta" = las dos cosas a la vez.
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const blobs = useMemo(
    () =>
      new Map(
        propiedades.map((p) => [
          p.id,
          norm(
            [
              p.titulo, p.zona, p.direccion || "", p.descripcion, p.categoria, p.id,
              ...(p.caracteristicas || []),
              ...(p.ficha?.mejorasUrbanas || []),
              ...(p.ficha?.servicios || []),
              p.ficha?.barrio || "",
            ].join(" · ")
          ),
        ])
      ),
    [propiedades]
  );

  // Sinónimos criollos: el cliente escribe "pileta", los datos dicen "piscina".
  // Un token matchea si CUALQUIER sinónimo de su grupo aparece en la propiedad.
  const SINONIMOS: string[][] = [
    ["pileta", "piscina"],
    ["cochera", "garage", "garaje"],
    ["depto", "departamento"],
    ["balcon", "terraza"],
    ["quincho", "parrilla"],
  ];
  const variantes = (token: string): string[] => {
    const grupo = SINONIMOS.find((g) => g.some((s) => token.startsWith(s.slice(0, 5)) || s.startsWith(token)));
    return grupo ? [...new Set([token, ...grupo])] : [token];
  };

  // Chips de UN TOQUE: lo que un comprador pide de verdad (curado, no "Luz" ni
  // "Agua corriente"). Solo se muestran los que existen en la cartera.
  const CHIPS_CARACT = [
    { label: "Pileta", term: "piscina" },
    { label: "Cochera", term: "cochera" },
    { label: "Quincho", term: "quincho" },
    { label: "Parrilla", term: "parrilla" },
    { label: "Patio", term: "patio" },
    { label: "Jardín", term: "jardin" },
    { label: "Balcón", term: "balcon" },
    { label: "Vista al mar", term: "vista al mar" },
    { label: "Apto crédito", term: "apto credito" },
    { label: "Frente al mar", term: "frente al mar" },
  ];
  const caractsTop = useMemo(() => {
    const cuantas = (term: string) => {
      let n = 0;
      for (const blob of blobs.values()) if (blob.includes(norm(term))) n++;
      return n;
    };
    return CHIPS_CARACT.map((c) => ({ ...c, n: cuantas(c.term) })).filter((c) => c.n >= 2);
  }, [blobs]);

  // ── Precio como slider doble (pedido Mateo 5-ago, tipo Airbnb/Bochile) ──────
  // Tope = la propiedad MÁS CARA de la cartera + ~10% de aire "por si les
  // ingresa algo" (Juani 5-ago), redondeado a un número lindo. Más allá del
  // tope el rango queda abierto ("Cualquiera"). Alquileres en PESOS.
  const moneda: "USD" | "ARS" = f.operacion === "alquiler" ? "ARS" : "USD";
  const pasoPrecio = moneda === "USD" ? 10_000 : 50_000;
  const precioDe = (p: (typeof propiedades)[number]) => (moneda === "ARS" ? p.precioARS ?? null : p.precioUSD ?? null);
  // Piso del tope: aunque hoy la cartera sea chica, la barra tiene que dar aire
  // (Juani 5-ago: en alquiler tiene que pasar holgado del millón de pesos).
  const TOPE_MINIMO = { USD: 500_000, ARS: 2_000_000 } as const;
  const topePrecio = useMemo(() => {
    const vals = propiedades
      .filter((p) => (f.operacion ? p.operacion === f.operacion : p.operacion === "venta"))
      .map((p) => (moneda === "ARS" ? p.precioARS : p.precioUSD))
      .filter((n): n is number => typeof n === "number" && n > 0);
    const redondeo = moneda === "USD" ? 50_000 : 100_000;
    const conAire = vals.length ? Math.ceil((Math.max(...vals) * 1.1) / redondeo) * redondeo : 0;
    return Math.max(TOPE_MINIMO[moneda], conAire);
  }, [propiedades, f.operacion, moneda]);

  // Cambió la operación → cambia la moneda/escala: el rango vuelve a cero.
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return; }
    setF((p) => ({ ...p, min: "", max: "" }));
  }, [f.operacion]);

  const resultados = useMemo(() => {
    // "4+" en ambientes/dormitorios/baños significa "o más".
    const cumpleNum = (valor: number | undefined, filtro: string) => {
      if (!filtro) return true;
      const n = valor || 0;
      return filtro.endsWith("+") ? n >= Number(filtro.slice(0, -1)) : n === Number(filtro);
    };
    const min = Number(f.min) || 0;
    const max = Number(f.max) || 0;
    const tokens = norm(f.q).split(/\s+/).filter(Boolean);
    let r = propiedades.filter((p) => {
      const blob = blobs.get(p.id) || "";
      const precio = precioDe(p);
      return (
        (!f.cat || p.categoria === f.cat) &&
        (!f.operacion || p.operacion === f.operacion) &&
        (!f.zona || p.zona === f.zona) &&
        cumpleNum(p.ambientes, f.amb) &&
        cumpleNum(p.dormitorios, f.dorm) &&
        cumpleNum(p.banos, f.banos) &&
        (!min || (precio != null && precio >= min)) &&
        (!max || (precio != null && precio <= max)) &&
        f.caract.every((c) => blob.includes(norm(c))) &&
        tokens.every((t) => variantes(t).some((v) => blob.includes(norm(v))))
      );
    });
    if (f.orden === "destacados") r = [...r].sort((a, b) => Number(b.destacado) - Number(a.destacado));
    if (f.orden === "precio_asc") r = [...r].sort((a, b) => (a.precioUSD || 9e15) - (b.precioUSD || 9e15));
    if (f.orden === "precio_desc") r = [...r].sort((a, b) => (b.precioUSD || 0) - (a.precioUSD || 0));
    return r;
  }, [f, propiedades, blobs]);

  useReveal();
  useEffect(() => {}, [resultados.length]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const toggleCaract = (c: string) =>
    setF((p) => ({ ...p, caract: p.caract.includes(c) ? p.caract.filter((x) => x !== c) : [...p.caract, c] }));
  const setCat = (cat: string) => {
    setF((p) => ({ ...p, cat }));
    const np = new URLSearchParams(params);
    if (cat) np.set("cat", cat);
    else np.delete("cat");
    setParams(np, { replace: true });
  };
  const limpiar = () => {
    setF({ cat: f.cat, operacion: "", zona: "", amb: "", dorm: "", banos: "", min: "", max: "", q: "", caract: [], orden: "destacados" });
    const np = new URLSearchParams();
    if (f.cat) np.set("cat", f.cat);
    setParams(np, { replace: true });
  };
  const hayFiltros = Boolean(f.operacion || f.zona || f.q || f.amb || f.dorm || f.banos || f.min || f.max || f.caract.length);

  // Lo que se está aplicando, a la vista y removible de a uno.
  const precioChip = (n: number) =>
    moneda === "ARS" ? `${fmtARS(n, { short: true })} ARS` : fmtUSD(n, { short: true });
  type FiltroKey = "operacion" | "zona" | "amb" | "dorm" | "banos" | "min" | "max" | "q";
  const quitar = (k: FiltroKey) => {
    setF((p) => ({ ...p, [k]: "" }));
    const np = new URLSearchParams(params);
    np.delete(k);
    setParams(np, { replace: true });
  };
  const chips: { k: FiltroKey | `c:${string}`; label: string }[] = [
    ...(f.operacion ? [{ k: "operacion" as const, label: f.operacion === "venta" ? "En venta" : "En alquiler" }] : []),
    ...(f.zona ? [{ k: "zona" as const, label: f.zona }] : []),
    ...(f.amb ? [{ k: "amb" as const, label: `${f.amb} amb` }] : []),
    ...(f.dorm ? [{ k: "dorm" as const, label: `${f.dorm} dorm` }] : []),
    ...(f.banos ? [{ k: "banos" as const, label: `${f.banos} baño${f.banos === "1" ? "" : "s"}` }] : []),
    // Con moneda explícita: "$500k ARS" nunca se confunde con "U$S 500K".
    ...(f.min ? [{ k: "min" as const, label: `desde ${precioChip(Number(f.min))}` }] : []),
    ...(f.max ? [{ k: "max" as const, label: `hasta ${precioChip(Number(f.max))}` }] : []),
    ...f.caract.map((c) => ({ k: `c:${c}` as const, label: CHIPS_CARACT.find((x) => x.term === c)?.label ?? c })),
    ...(f.q ? [{ k: "q" as const, label: `“${f.q}”` }] : []),
  ];
  const quitarChip = (k: string) => (k.startsWith("c:") ? toggleCaract(k.slice(2)) : quitar(k as FiltroKey));

  return (
    <div className="min-h-screen bg-paper text-graph">
      <div className="grain" />
      <Navbar variant="solid" />

      <header className="relative overflow-hidden pt-32 pb-10">
        <div className="absolute inset-0">
          <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: "url(/img/props/depto2.jpg)" }} />
          <div className="absolute inset-0 bg-brand-950/85" />
        </div>
        <div className="container-x relative z-10">
          <p className="eyebrow">Catálogo de propiedades</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-white md:text-6xl">
            Encontrá tu próxima propiedad
          </h1>
          <p className="mt-4 max-w-xl text-white/70">
            Casas, departamentos, PH, locales y lotes en toda Mar del Plata.
          </p>

          {/* Buscador */}
          <div className="mt-7 flex max-w-xl items-center gap-3 rounded-xl border border-white/15 bg-graph/40 px-4 backdrop-blur">
            <Search size={18} className="text-white/50" />
            <input
              id="buscador-catalogo"
              value={f.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Buscá lo que quieras: pileta, Güemes, esquina, quincho…"
              className="h-12 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
            {f.q && (
              <button onClick={() => set("q", "")} className="text-white/50 hover:text-white">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Tabs de categoría — panel glass sobre gris (Mateo 5-ago: "muy blanca") */}
      <div className="sticky top-[64px] z-30 border-y border-graph/10 bg-gradient-to-b from-paper-200/95 to-paper-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl">
        <div className="container-x flex flex-col gap-3 py-3.5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setCat(t.key)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  f.cat === t.key
                    ? "bg-brand text-white shadow-[0_6px_16px_-6px_rgba(12,77,162,0.55)]"
                    : "bg-white/75 text-graph-500 ring-1 ring-graph/10 hover:bg-white hover:text-graph"
                }`}
              >
                {t.label} <span className="opacity-60">({t.n})</span>
              </button>
            ))}
          </div>
          {/* Mateo 5-ago: "la mayor cantidad de filtros posible" — que el cliente
              escupa lo que quiere y lo encuentre enseguida. */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-medium text-graph-400">
              <SlidersHorizontal size={14} /> Filtros
            </span>
            <FSelect value={f.operacion} onChange={(v) => set("operacion", v)} options={["venta", "alquiler", "arrendamiento"]} ph="Operación" />
            <FSelect value={f.zona} onChange={(v) => set("zona", v)} options={zonas} ph="Zona" />
            <FSelect value={f.amb} onChange={(v) => set("amb", v)} options={[{ v: "1", l: "1 ambiente" }, { v: "2", l: "2 ambientes" }, { v: "3", l: "3 ambientes" }, { v: "4", l: "4 ambientes" }, { v: "5+", l: "5 o más" }]} ph="Ambientes" />
            <FSelect value={f.dorm} onChange={(v) => set("dorm", v)} options={[{ v: "1", l: "1 dormitorio" }, { v: "2", l: "2 dormitorios" }, { v: "3", l: "3 dormitorios" }, { v: "4+", l: "4 o más" }]} ph="Dormitorios" />
            <FSelect value={f.banos} onChange={(v) => set("banos", v)} options={[{ v: "1", l: "1 baño" }, { v: "2", l: "2 baños" }, { v: "3+", l: "3 o más" }]} ph="Baños" />
            <RangoPrecio
              min={Number(f.min) || 0}
              max={Number(f.max) || 0}
              tope={topePrecio}
              paso={pasoPrecio}
              moneda={moneda}
              // Sin operación elegida el precio se lee en dólares (las ventas): decirlo.
              nota={moneda === "ARS" ? "por mes" : f.operacion ? "" : "en venta"}
              onChange={(lo, hi) =>
                setF((p) => ({ ...p, min: lo <= 0 ? "" : String(lo), max: hi >= topePrecio ? "" : String(hi) }))
              }
            />
            <div className="ml-auto flex items-center gap-3">
              {hayFiltros && (
                <button onClick={limpiar} className="flex items-center gap-1 text-xs text-graph-500 hover:text-brand">
                  <X size={14} /> Limpiar
                </button>
              )}
              <FSelect
                value={f.orden}
                onChange={(v) => set("orden", v)}
                options={[
                  { v: "destacados", l: "Destacados" },
                  { v: "precio_desc", l: "Mayor precio" },
                  { v: "precio_asc", l: "Menor precio" },
                ]}
                ph="Ordenar"
                noEmpty
              />
            </div>
          </div>

          {/* Características de un toque: pileta, cochera, parrilla… (las más comunes de la cartera). */}
          {caractsTop.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {caractsTop.map((c) => {
                const activa = f.caract.includes(c.term);
                return (
                  <button
                    key={c.term}
                    onClick={() => toggleCaract(c.term)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ring-1 transition ${
                      activa
                        ? "bg-brand text-white ring-brand"
                        : "bg-white/75 text-graph-500 ring-graph/10 hover:bg-white hover:text-brand hover:ring-brand/40"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Lo que se está aplicando: el visitante ve por qué salen esos resultados. */}
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pb-3">
              <span className="text-xs text-graph-400">Buscando:</span>
              {chips.map((c) => (
                <button
                  key={c.k}
                  onClick={() => quitarChip(c.k)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/[0.07] py-1 pl-3 pr-2 text-xs font-medium capitalize text-brand-700 transition hover:border-brand/50 hover:bg-brand/[0.12]"
                  title="Quitar este filtro"
                >
                  {c.label}
                  <X size={13} className="text-brand/50 transition group-hover:text-brand" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fondo gris suave: las tarjetas blancas ganan relieve (nada de blanco sobre blanco). */}
      <section className="bg-paper-200/60 py-12">
        <div className="container-x">
          <p className="mb-6 text-sm text-graph-500">
            {resultados.length} {resultados.length === 1 ? "propiedad" : "propiedades"}
          </p>
          {resultados.length === 0 ? (
            <div className="mx-auto max-w-lg py-20 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand">
                <Search size={28} />
              </span>
              <p className="mt-5 font-display text-2xl text-graph">No encontramos nada con esa búsqueda</p>
              <p className="mt-2 text-graph-500">
                Probá sacando algún filtro, o escribinos y te buscamos nosotros: conocemos propiedades que todavía no están publicadas.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <button onClick={limpiar} className="btn-ghost">Ver todas las propiedades</button>
                <WhatsAppCTA mensaje="Hola Potente Propiedades, no encuentro lo que busco en el catálogo y quiero que me ayuden.">
                  Consultar por WhatsApp
                </WhatsAppCTA>
              </div>
            </div>
          ) : (
            <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {resultados.map((p, i) => (
                <div key={p.id} className="reveal">
                  {/* Las 3 primeras entran en pantalla sin scrollear: cargan con
                      prioridad. Las demás, recién cuando el visitante se acerca. */}
                  <PropiedadCard p={p} prioritaria={i < 3} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

type Opt = string | { v: string; l: string };
function FSelect({ value, onChange, options, ph, noEmpty }: { value: string; onChange: (v: string) => void; options: Opt[]; ph: string; noEmpty?: boolean }) {
  const opciones = [
    ...(noEmpty ? [] : [{ value: "", label: ph }]),
    ...options.map((o) => (typeof o === "string" ? { value: o, label: o } : { value: o.v, label: o.l })),
  ];
  return (
    <UISelect
      value={value}
      onChange={onChange}
      options={opciones}
      placeholder={ph}
      size="sm"
      className="min-w-[9.5rem]"
      triggerClassName="capitalize rounded-lg !bg-white/80"
    />
  );
}

// ── Slider de precio doble (pedido Mateo 5-ago: "una línea con un puntito", tipo
// Airbnb/Bochile). Dos ranges nativos superpuestos; el CSS .rango deja los eventos
// SOLO en los thumbs. En el tope, el rango queda abierto ("300k+").
function RangoPrecio({
  min, max, tope, paso, moneda, nota, onChange,
}: {
  min: number;
  max: number;
  tope: number;
  paso: number;
  moneda: "USD" | "ARS";
  nota?: string;
  onChange: (lo: number, hi: number) => void;
}) {
  const fmt = (n: number) => (moneda === "ARS" ? fmtARS(n, { short: true }) : fmtUSD(n, { short: true }));
  const lo = Math.min(min, tope - paso);
  const hi = max > 0 ? Math.min(max, tope) : tope;
  const abierto = lo <= 0 && hi >= tope;
  // Sin símbolos repetidos: la moneda la canta el badge, el rango va en números.
  const desnudo = (n: number) => fmt(n).replace(/^(U\$S|\$)\s?/, "");
  const etiqueta = abierto
    ? "Cualquiera"
    : `${desnudo(lo)} – ${hi >= tope ? `${desnudo(tope)}+` : desnudo(hi)}`;
  return (
    <div className="rango w-full sm:w-64">
      <div className="mb-0.5 flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-1.5 text-[10px] font-semibold uppercase tracking-widest2 text-graph-400">
          Precio
          {/* Moneda SIEMPRE cantada: dólares en azul de marca, pesos en terracota. */}
          <span
            className={`rounded px-1.5 py-px text-[10px] font-bold tracking-normal ${
              moneda === "USD" ? "bg-brand/10 text-brand-700" : "bg-clay/15 text-clay"
            }`}
          >
            {moneda === "USD" ? "U$S" : "$ ARS"}
          </span>
          {nota && <span className="text-[9px] font-medium normal-case tracking-normal text-graph-400">{nota}</span>}
        </span>
        <span className={`text-xs font-semibold ${abierto ? "text-graph-400" : "text-brand-700"}`}>{etiqueta}</span>
      </div>
      <div className="relative h-5">
        <div className="absolute top-1/2 h-[3px] w-full -translate-y-1/2 rounded-full bg-graph/15" />
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-brand"
          style={{ left: `${(lo / tope) * 100}%`, right: `${100 - (hi / tope) * 100}%` }}
        />
        <input
          type="range" min={0} max={tope} step={paso} value={lo}
          aria-label="Precio desde"
          onChange={(e) => onChange(Math.min(Number(e.target.value), hi - paso), hi)}
          className="absolute inset-0 w-full appearance-none bg-transparent"
        />
        <input
          type="range" min={0} max={tope} step={paso} value={hi}
          aria-label="Precio hasta"
          onChange={(e) => onChange(lo, Math.max(Number(e.target.value), lo + paso))}
          className="absolute inset-0 w-full appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}
