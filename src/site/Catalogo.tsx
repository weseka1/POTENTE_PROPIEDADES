import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, SlidersHorizontal } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PropiedadCard from "./components/PropiedadCard";
import { useLenis } from "./lib/useLenis";
import { useSEO } from "./lib/seo";
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
    q: params.get("q") || "",
    orden: "destacados",
  });

  // sincronizar categoría si cambia el query param (al clickear nav)
  useEffect(() => {
    const cat = params.get("cat") || "";
    const q = params.get("q") || "";
    setF((p) => ({ ...p, cat, q: q || p.q }));
  }, [params]);

  const resultados = useMemo(() => {
    let r = propiedades.filter(
      (p) =>
        (!f.cat || p.categoria === f.cat) &&
        (!f.operacion || p.operacion === f.operacion) &&
        (!f.zona || p.zona === f.zona) &&
        (!f.q ||
          p.titulo.toLowerCase().includes(f.q.toLowerCase()) ||
          p.zona.toLowerCase().includes(f.q.toLowerCase()))
    );
    if (f.orden === "destacados") r = [...r].sort((a, b) => Number(b.destacado) - Number(a.destacado));
    if (f.orden === "precio_asc") r = [...r].sort((a, b) => (a.precioUSD || 9e15) - (b.precioUSD || 9e15));
    if (f.orden === "precio_desc") r = [...r].sort((a, b) => (b.precioUSD || 0) - (a.precioUSD || 0));
    return r;
  }, [f, propiedades]);

  useReveal();
  useEffect(() => {}, [resultados.length]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setCat = (cat: string) => {
    setF((p) => ({ ...p, cat }));
    const np = new URLSearchParams(params);
    if (cat) np.set("cat", cat);
    else np.delete("cat");
    setParams(np, { replace: true });
  };
  const limpiar = () => setF({ cat: f.cat, operacion: "", zona: "", q: "", orden: "destacados" });
  const hayFiltros = f.operacion || f.zona || f.q;

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
              value={f.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Buscá por título o zona…"
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
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-medium text-graph-400">
              <SlidersHorizontal size={14} /> Filtros
            </span>
            <FSelect value={f.operacion} onChange={(v) => set("operacion", v)} options={["venta", "alquiler", "arrendamiento"]} ph="Operación" />
            <FSelect value={f.zona} onChange={(v) => set("zona", v)} options={zonas} ph="Zona" />
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
        </div>
      </div>

      <section className="py-12">
        <div className="container-x">
          <p className="mb-6 text-sm text-graph-500">
            {resultados.length} {resultados.length === 1 ? "propiedad" : "propiedades"}
          </p>
          {resultados.length === 0 ? (
            <div className="py-24 text-center text-graph-500">
              <p className="font-display text-2xl text-graph">No encontramos propiedades con esos filtros</p>
              <button onClick={limpiar} className="btn-ghost mt-6">Limpiar filtros</button>
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
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-graph/15 bg-paper-100 px-3 text-sm capitalize text-graph outline-none transition focus:border-brand focus:ring-brand/15"
    >
      {!noEmpty && <option value="">{ph}</option>}
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.v;
        const l = typeof o === "string" ? o : o.l;
        return <option key={v} value={v} className="capitalize">{l}</option>;
      })}
    </select>
  );
}
