// ===== FICHAS — módulo INDEPENDIENTE =====
// La versión digital de la ficha de papel de Potente Propiedades (campo / urbano).
// Se llena y se guarda acá, en su propia tabla (potente_fichas). NO tiene relación
// con las propiedades de la web ni con "Cargar propiedad".
import { useState, useEffect } from "react";
import { FileText, Search, Plus, ArrowLeft, Save, Loader2, X, Trash2, ChevronRight, Sprout, Home as HomeIcon, Download, PenTool } from "lucide-react";
import { useToast } from "../components/Toast";
import { PageHeader } from "../components/PageShell";
import { supabase } from "@/lib/supabase";
import { cargarDemo, guardarDemo } from "@/lib/DataProvider";
import { aDataUrlComprimida, dataUrlAchicado } from "@/lib/imagenes";
import type { Ficha } from "@/data/propiedadTypes";
import { Campo, Inp, Sel, FichaSecciones } from "../components/fichaUI";
import { descargarFichaPDF } from "../lib/fichaPDF";
import PlanEditor from "../components/PlanEditor";

type FichaRow = { id: string; tipo: "campo" | "urbano"; titulo: string; zona: string; datos: Ficha; createdAt?: string };

const TIPO_OPTS = [{ v: "campo", l: "Campo" }, { v: "urbano", l: "Urbano / Propiedad" }];

export default function Fichas() {
  const { push } = useToast();
  // Sin base de datos las fichas viven en el navegador, igual que el resto del panel.
  // Antes solo existían en memoria: se creaba una, se refrescaba y desaparecía.
  const [fichas, setFichas] = useState<FichaRow[]>(() => cargarDemo<FichaRow[]>("fichas", []));
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<FichaRow | null>(null);

  useEffect(() => { guardarDemo("fichas", fichas); }, [fichas]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!supabase) { setLoading(false); return; }
      try {
        // La tabla guarda { id, data, createdAt }: el contenido de la ficha vive
        // adentro de `data`. Acá se vuelve a armar la forma que usa la pantalla.
        const { data, error } = await supabase
          .from("potente_fichas")
          .select("*")
          .order("createdAt", { ascending: false });
        if (error) console.error("No se pudieron traer las fichas:", error.message);
        if (!cancel && data) {
          setFichas(
            data.map((row: any) => ({
              id: row.id,
              createdAt: row.createdAt,
              ...(row.data ?? {}),
            })) as FichaRow[]
          );
        }
      } catch (e) { console.error("Fichas sin conexión:", e); }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const guardar = async (row: FichaRow) => {
    setFichas((prev) => {
      const i = prev.findIndex((x) => x.id === row.id);
      if (i >= 0) { const c = [...prev]; c[i] = row; return c; }
      return [row, ...prev];
    });
    if (supabase) {
      // La tabla tiene 3 columnas (id, data, createdAt): el resto de la ficha va
      // adentro de `data`. Mandar el objeto entero fallaba — esas columnas no existen.
      const { id, createdAt, ...contenido } = row;
      const { error } = await supabase
        .from("potente_fichas")
        .upsert({ id, createdAt, data: contenido });
      if (error) {
        console.error("No se pudo guardar la ficha:", error.message, error.code);
        push("No se pudo guardar la ficha", "error");
        return;
      }
    }
    push("Ficha guardada ✓", "success");
    setSel(null);
  };
  const borrar = async (id: string) => {
    if (!window.confirm("¿Eliminar esta ficha?")) return;
    setFichas((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await supabase.from("potente_fichas").delete().eq("id", id).then(() => {}, () => {});
    setSel(null);
  };

  if (sel) return <FichaEditor row={sel} onBack={() => setSel(null)} onSave={guardar} onDelete={borrar} />;

  const lista = fichas.filter((f) => (`${f.titulo} ${f.zona} ${f.id}`).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Fichas"
        subtitle="Tu fichero digital — la ficha de papel de Potente, ahora acá. Cargá y guardá toda la info de tus propiedades."
        actions={
          <button onClick={() => setSel({ id: "FICHA-" + Date.now(), tipo: "campo", titulo: "", zona: "", datos: {} })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-600">
            <Plus size={16} /> Nueva ficha
          </button>
        }
      />

      <div className="mb-5 flex items-center gap-2 rounded-xl border border-graph/10 bg-graph/[0.03] px-3">
        <Search size={16} className="text-graph-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por referencia, zona o ID…" className="h-11 flex-1 bg-transparent text-sm text-graph outline-none placeholder:text-graph-400" />
        <span className="text-xs text-graph-400">{lista.length} ficha{lista.length === 1 ? "" : "s"}</span>
      </div>

      <div className="space-y-2">
        {loading && <div className="pcard grid place-items-center p-10"><Loader2 size={24} className="animate-spin text-brand" /></div>}
        {!loading && lista.map((f) => (
          <button key={f.id} onClick={() => setSel(f)} className="pcard flex w-full items-center gap-4 p-3.5 text-left transition hover:border-brand/40 hover:shadow-md">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              {f.tipo === "campo" ? <Sprout size={20} /> : <HomeIcon size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold text-graph">{f.titulo || "(sin referencia)"}</p>
              <p className="mt-0.5 truncate text-xs text-graph-400">
                <span className="capitalize">{f.tipo === "campo" ? "Campo" : "Urbano"}</span>
                {f.zona ? ` · ${f.zona}` : ""} · <span className="text-graph-400">{f.id}</span>
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-graph-300" />
          </button>
        ))}
        {!loading && lista.length === 0 && (
          <div className="pcard grid place-items-center gap-3 p-12 text-center">
            <FileText size={32} className="text-graph-300" />
            <p className="text-sm text-graph-400">No hay fichas todavía. Creá la primera.</p>
            <button onClick={() => setSel({ id: "FICHA-" + Date.now(), tipo: "campo", titulo: "", zona: "", datos: {} })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-600"><Plus size={16} /> Nueva ficha</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Editor de una ficha (la del papel) =====
function FichaEditor({ row, onBack, onSave, onDelete }: { row: FichaRow; onBack: () => void; onSave: (row: FichaRow) => void; onDelete: (id: string) => void }) {
  const { push } = useToast();
  const [tipo, setTipo] = useState<"campo" | "urbano">(row.tipo);
  const [titulo, setTitulo] = useState(row.titulo);
  const [zona, setZona] = useState(row.zona);
  const [datos, setDatos] = useState<Ficha>({ ...(row.datos || {}) });
  const [planos, setPlanos] = useState<string[]>(row.datos?.planos || []);
  const [subiendo, setSubiendo] = useState(false);
  const [verPlano, setVerPlano] = useState<string | null>(null);
  const [dibujando, setDibujando] = useState(false);

  const esCampo = tipo === "campo";
  const num = (v: any) => (v === "" || v == null ? undefined : Number(v));
  const setFicha = (k: keyof Ficha, v: any) => setDatos((d) => ({ ...d, [k]: v }));
  const toggleFicha = (k: keyof Ficha, item: string) =>
    setDatos((d) => {
      const arr: string[] = (d as any)[k] || [];
      return { ...d, [k]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] };
    });

  const subirPlanos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setSubiendo(true);
    for (const file of Array.from(files)) {
      try {
        if (supabase) {
          const path = `planos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
          const { error } = await supabase.storage.from("potente").upload(path, file, { upsert: true });
          if (!error) { setPlanos((p) => [...p, supabase.storage.from("potente").getPublicUrl(path).data.publicUrl]); continue; }
        }
        // Sin Storage: achicado y guardado en el navegador, para que sobreviva al cierre.
        const dataUrl = await aDataUrlComprimida(file);
        setPlanos((p) => [...p, dataUrl]);
      } catch { setPlanos((p) => [...p, URL.createObjectURL(file)]); }
    }
    setSubiendo(false);
    push("Plano subido ✓", "success");
  };

  // Recibe el dibujo del editor (PNG) y lo guarda como plano de la ficha.
  const handleUsarPlano = async (dataUrl: string) => {
    try {
      if (supabase && dataUrl.startsWith("data:")) {
        const blob = await (await fetch(dataUrl)).blob();
        const path = `planos/${Date.now()}-dibujo.png`;
        const { error } = await supabase.storage.from("potente").upload(path, blob, { upsert: true, contentType: "image/png" });
        if (!error) { setPlanos((p) => [...p, supabase.storage.from("potente").getPublicUrl(path).data.publicUrl]); setDibujando(false); push("Plano dibujado agregado a la ficha ✓", "success"); return; }
      }
      // El PNG del editor pesa varios MB: lo achicamos antes de meterlo al navegador.
      const liviano = await dataUrlAchicado(dataUrl);
      setPlanos((p) => [...p, liviano]); setDibujando(false); push("Plano dibujado agregado a la ficha ✓", "success");
    } catch { setPlanos((p) => [...p, dataUrl]); setDibujando(false); }
  };

  const guardar = () => {
    if (!titulo.trim()) { push("Ponele una referencia a la ficha (ej: Depto 3 amb — Playa Grande)", "info"); return; }
    const datosFinal: Ficha = { ...datos, planos: planos.length ? planos : undefined };
    onSave({ ...row, tipo, titulo: titulo.trim(), zona, datos: datosFinal });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-graph-500 transition hover:text-graph"><ArrowLeft size={16} /> Volver a Fichas</button>
        <div className="flex items-center gap-2">
          <button onClick={() => descargarFichaPDF({ id: row.id, tipo, titulo, zona, datos: { ...datos, planos } })} className="inline-flex h-10 items-center gap-2 rounded-xl border border-graph/10 px-4 text-sm font-medium text-graph-600 transition hover:border-brand/40 hover:text-brand"><Download size={15} /> Descargar PDF</button>
          <button onClick={() => onDelete(row.id)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-graph/10 px-4 text-sm font-medium text-red-700 transition hover:border-red-400/40"><Trash2 size={15} /> Eliminar</button>
          <button onClick={guardar} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-600"><Save size={16} /> Guardar ficha</button>
        </div>
      </div>

      <PageHeader title={titulo || "Nueva ficha"} subtitle="La ficha de papel de Potente, digital." />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Cabecera de la ficha */}
          <section className="pcard p-5">
            <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-graph"><FileText size={16} className="text-brand" /> Ficha</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Tipo de ficha"><Sel value={tipo} onChange={(v) => setTipo(v as "campo" | "urbano")} opts={TIPO_OPTS} /></Campo>
              <Campo label="Zona / Ubicación"><Inp value={zona} onChange={setZona} ph="Punta Mogotes" /></Campo>
              <Campo label="Referencia" full><Inp value={titulo} onChange={setTitulo} ph="Ej: Departamento 3 ambientes — Playa Grande" /></Campo>
            </div>
          </section>

          {/* Secciones del papel (campo/urbano + autorización + interno) */}
          <FichaSecciones ficha={datos} esCampo={esCampo} setFicha={setFicha} toggleFicha={toggleFicha} num={num} />
        </div>

        {/* Plano */}
        <div className="space-y-6">
          <section className="pcard p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-graph"><FileText size={16} className="text-brand" /> Plano</h3>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-graph/15 bg-graph/[0.02] py-6 text-center transition hover:border-brand/50 hover:bg-graph/[0.04]">
              <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => subirPlanos(e.target.files)} />
              {subiendo ? <Loader2 size={22} className="animate-spin text-brand" /> : <FileText size={22} className="text-graph-400" />}
              <span className="text-sm font-medium text-graph-500">{subiendo ? "Subiendo…" : "Subí el plano (imagen o PDF)"}</span>
            </label>
            <button type="button" onClick={() => setDibujando(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/[0.06] py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/10"><PenTool size={15} /> Dibujar plano</button>
            {planos.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {planos.map((src, i) => {
                  const esPdf = /\.pdf($|\?)/i.test(src);
                  return (
                    <div key={i} className="group relative overflow-hidden rounded-lg ring-1 ring-graph/10">
                      {esPdf ? (
                        <button type="button" onClick={() => setVerPlano(src)} className="flex aspect-video w-full flex-col items-center justify-center gap-1 bg-graph/[0.05] text-graph-500 transition hover:bg-graph/[0.08]">
                          <FileText size={22} className="text-brand" />
                          <span className="text-[11px] font-medium">Ver PDF</span>
                        </button>
                      ) : (
                        <button type="button" onClick={() => setVerPlano(src)} className="block w-full">
                          <img src={src} alt={`Plano ${i + 1}`} className="aspect-video w-full cursor-zoom-in object-cover transition group-hover:opacity-90" />
                        </button>
                      )}
                      <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-graph/70 px-1.5 py-0.5 text-[10px] font-medium text-white">Plano {i + 1}</span>
                      <button type="button" onClick={() => setPlanos((p) => p.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-graph/80 text-white opacity-0 transition group-hover:opacity-100"><X size={13} /></button>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[11px] text-graph-400">Tocá un plano para verlo grande.</p>
          </section>

          <button onClick={guardar} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white transition hover:bg-brand-600"><Save size={16} /> Guardar ficha</button>
        </div>
      </div>

      {/* Lightbox del plano — se abre grande al tocar */}
      {verPlano && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-graph/80 p-4 backdrop-blur-sm" onClick={() => setVerPlano(null)}>
          <button type="button" onClick={() => setVerPlano(null)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"><X size={20} /></button>
          {/\.pdf($|\?)/i.test(verPlano) ? (
            <iframe src={verPlano} title="Plano" className="h-[86vh] w-[min(900px,95vw)] rounded-xl bg-white" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={verPlano} alt="Plano" className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

      {/* Editor de planos embebido — dibujar el plano dentro de la ficha */}
      {dibujando && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-paper-100">
          <div className="flex items-center justify-between border-b border-graph/10 px-4 py-2.5">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-graph"><PenTool size={16} className="text-brand" /> Dibujar plano · {titulo || "ficha"}</h3>
            <button type="button" onClick={() => setDibujando(false)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-graph/10 px-3 text-sm font-medium text-graph-500 transition hover:text-graph"><X size={15} /> Cerrar</button>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <PlanEditor propId={row.id} propName={titulo || row.id} onUsar={handleUsarPlano} />
          </div>
        </div>
      )}
    </div>
  );
}
