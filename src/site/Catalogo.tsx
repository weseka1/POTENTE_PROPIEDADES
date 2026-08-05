import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, SlidersHorizontal } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PropiedadCard from "./components/PropiedadCard";
import { useLenis } from "./lib/useLenis";
import { useSEO } from "./lib/seo";
import UISelect from "@/components/Select";
import { fmtUSD } from "@/lib/format";

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
      return (
        (!f.cat || p.categoria === f.cat) &&
        (!f.operacion || p.operacion === f.operacion) &&
        (!f.zona || p.zona === f.zona) &&
        cumpleNum(p.ambientes, f.amb) &&
        cumpleNum(p.dormitorios, f.dorm) &&
        cumpleNum(p.banos, f.banos) &&
        (!min || (p.precioUSD != null && p.precioUSD >= min)) &&
        (!max || (p.precioUSD != null && p.precioUSD <= max)) &&
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
    ...(f.min ? [{ k: "min" as const, label: `desde ${fmtUSD(Number(f.min), { short: true })}` }] : []),
    ...(f.max ? [{ k: "max" as const, label: `hasta ${fmtUSD(Number(f.max), { short: true })}` }] : []),
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

      {/* Tabs de categoría */}
      <div className="sticky top-[64px] z-30 border-y border-graph/10 bg-paper/95 backdrop-blur">
        <div className="container-x flex flex-col gap-3 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setCat(t.key)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  f.cat === t.key ? "bg-brand text-white" : "bg-paper-200 text-graph-500 hover:bg-graph/5"
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
            <FSelect value={f.min} onChange={(v) => set("min", v)} options={[50000, 80000, 100000, 150000, 200000, 300000].map((n) => ({ v: String(n), l: `Desde ${fmtUSD(n, { short: true })}` }))} ph="Precio desde" />
            <FSelect value={f.max} onChange={(v) => set("max", v)} options={[80000, 100000, 150000, 200000, 300000, 500000].map((n) => ({ v: String(n), l: `Hasta ${fmtUSD(n, { short: true })}` }))} ph="Precio hasta" />
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
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
                      activa
                        ? "border-brand bg-brand text-white"
                        : "border-graph/15 bg-paper-100 text-graph-500 hover:border-brand/50 hover:text-brand"
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

      <section className="py-12">
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
              {resultados.map((p) => (
                <div key={p.id} className="reveal">
                  <PropiedadCard p={p} />
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
      triggerClassName="capitalize rounded-lg"
    />
  );
}
