import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { Plus, MapPin, Maximize, Eye, LayoutGrid, List, BedDouble } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import type { Propiedad } from "@/data/propiedadTypes";
import { CATEGORIAS } from "@/data/propiedadTypes";
import { fmtPrecio, fmtHa } from "@/lib/format";
import { PageHeader, EmptyState } from "../components/PageShell";
import { SearchInput, FilterSelect } from "../components/Controls";
import Badge from "../components/Badge";
import CampoThumb from "../components/CampoThumb";
import CampoDrawer from "../components/CampoDrawer";
import { useToast } from "../components/Toast";
import { estadoCampo, ESTADOS_PROPIEDAD, verEstado } from "../ui/estados";
import { sinTildes } from "@/site/lib/parseBusqueda";
import { cn } from "../ui/cn";

const catLabel = (cat: string) => CATEGORIAS.find((c) => c.key === cat)?.label ?? cat;

// Línea de "specs" según categoría — defensiva: nunca rompe si faltan campos.
function specMeta(c: Propiedad): string {
  if (c.categoria === "campo") {
    const partes: string[] = [];
    if (c.hectareas !== undefined) partes.push(fmtHa(c.hectareas));
    if (c.aptitud) partes.push(c.aptitud);
    return partes.join(" · ");
  }
  const partes: string[] = [];
  if (c.dormitorios !== undefined) partes.push(`${c.dormitorios} dorm.`);
  else if (c.ambientes !== undefined) partes.push(`${c.ambientes} amb.`);
  if (c.m2cubiertos !== undefined) partes.push(`${c.m2cubiertos} m²`);
  else if (c.m2totales !== undefined) partes.push(`${c.m2totales} m²`);
  return partes.join(" · ");
}

export default function Cartera() {
  const { propiedades, getProp, updatePropiedad, deletePropiedad } = useData();
  const { push } = useToast();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  useEffect(() => { const p = params.get("q"); if (p !== null) setQ(p); }, [params]);
  const [cat, setCat] = useState("todas");
  const [op, setOp] = useState("todas");
  const [est, setEst] = useState("todos");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selId, setSelId] = useState<string | null>(null);

  // El drawer resuelve la propiedad EN VIVO desde el contexto -> refleja ediciones al instante.
  const sel = selId ? getProp(selId) ?? null : null;

  // Cuántas hay de cada estado, para mostrarlo en el desplegable del filtro.
  const porEstado = useMemo(
    () => propiedades.reduce<Record<string, number>>((a, c) => ({ ...a, [c.estado]: (a[c.estado] ?? 0) + 1 }), {}),
    [propiedades],
  );

  const filtrados = useMemo(() => {
    // Lo NUEVO primero, acá también (pedido Mateo 12-ago): el equipo carga una
    // propiedad y la ve arriba de todo, no la tiene que buscar. En el modo demo
    // los seeds no traen created_at → empatan todas y el sort estable respeta
    // el orden del archivo.
    const porFecha = [...propiedades].sort(
      (a, b) => (b.created_at ? Date.parse(b.created_at) : 0) - (a.created_at ? Date.parse(a.created_at) : 0),
    );
    return porFecha.filter((c) => {
      // La DIRECCIÓN entra en la búsqueda (pedido de Mateo por WhatsApp, 11-ago:
      // "me toma TODO menos la dirección"). Y sin tildes en las dos puntas:
      // él tipea "colon 3537" y la ficha dice "Av. Colón 3537".
      if (q && !sinTildes(`${c.titulo} ${c.zona} ${c.direccion ?? ""} ${c.id}`).includes(sinTildes(q))) return false;
      if (cat !== "todas" && c.categoria !== cat) return false;
      if (op !== "todas" && c.operacion !== op) return false;
      if (est !== "todos" && c.estado !== est) return false;
      return true;
    });
  }, [propiedades, q, cat, op, est]);

  const handleUpdate = (id: string, patch: Partial<Propiedad>) => {
    updatePropiedad(id, patch);
    push("Propiedad actualizada ✓", "success");
  };
  const handleDelete = (id: string) => {
    deletePropiedad(id);
    setSelId(null);
    push("Propiedad eliminada de la cartera", "info");
  };

  return (
    <div>
      <PageHeader
        title="Cartera de propiedades"
        subtitle={`${propiedades.length} propiedades · ${filtrados.length} en vista`}
        actions={
          <>
            <Link
              to="/panel/cargar"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-600 hover:shadow-soft"
            >
              <Plus size={16} /> Nueva propiedad
            </Link>
          </>
        }
      />

      {/* toolbar */}
      <div className="pcard mb-5 flex flex-wrap items-center gap-2.5 p-3">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por título, dirección, zona o ID…" className="min-w-[220px] flex-1" />
        <FilterSelect
          value={cat}
          onChange={setCat}
          options={[
            { value: "todas", label: "Categoría: todas" },
            ...CATEGORIAS.map((c) => ({ value: c.key, label: c.plural })),
          ]}
        />
        <FilterSelect
          value={op}
          onChange={setOp}
          options={[
            { value: "todas", label: "Operación: todas" },
            { value: "venta", label: "Venta" },
            { value: "alquiler", label: "Alquiler" },
            { value: "arrendamiento", label: "Arrendamiento" },
          ]}
        />
        <FilterSelect
          value={est}
          onChange={setEst}
          // Los 5 que pidió Mateo: "que me deje filtrar por reservado, activo,
          // vendido o alquilado". Con el contador al lado, así ve de un vistazo
          // cuántas tiene de cada una sin filtrar.
          options={[
            { value: "todos", label: `Estado: todas (${propiedades.length})` },
            ...ESTADOS_PROPIEDAD.map((e) => ({
              value: e,
              label: `${estadoCampo[e].label} (${porEstado[e] ?? 0})`,
            })),
          ]}
        />
        <div className="ml-auto flex items-center gap-1 rounded-xl border border-graph/10 p-1">
          <button
            onClick={() => setView("grid")}
            className={cn("rounded-lg p-1.5 transition", view === "grid" ? "bg-brand text-white" : "text-graph-400 hover:text-graph")}
            aria-label="Grilla"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn("rounded-lg p-1.5 transition", view === "list" ? "bg-brand text-white" : "text-graph-400 hover:text-graph")}
            aria-label="Lista"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState msg="No hay propiedades que coincidan con los filtros." />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((c) => {
            const e = verEstado(c.estado);
            const esCampo = c.categoria === "campo";
            const meta = specMeta(c);
            return (
              <button
                key={c.id}
                onClick={() => setSelId(c.id)}
                className="group pcard pcard-hover overflow-hidden text-left"
              >
                <div className="relative">
                  <CampoThumb src={c.fotos?.[0]} alt={c.titulo} rounded="rounded-none" className="h-44 w-full" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <Badge tone={e.tone} dot className="bg-white/90 backdrop-blur">{e.label}</Badge>
                    <Badge tone="neutral" className="bg-white/90 capitalize backdrop-blur">{catLabel(c.categoria)}</Badge>
                    {c.destacado && <Badge tone="wheat" className="bg-white/90 backdrop-blur">★ Destacado</Badge>}
                  </div>
                  <div className="absolute bottom-3 right-3">
                    {/* El precio estaba en texto oscuro sobre chapa oscura: no se leía
                        (lo marcó Mateo, 6-ago). Va blanco sobre la chapa. */}
                    <span className="rounded-lg bg-graph/85 px-2.5 py-1 font-display text-sm font-semibold text-white shadow-sm backdrop-blur">
                      {fmtPrecio(c, { short: true })}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-1 font-display text-base font-semibold text-graph">{c.titulo}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-graph-400">
                    <MapPin size={12} className="text-brand" /> {c.zona}
                    {meta && <> · <span className="capitalize">{meta}</span></>}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-graph/[0.07] pt-3 text-xs text-graph-400">
                    {esCampo ? (
                      <span className="inline-flex items-center gap-1">
                        <Maximize size={13} /> {c.hectareas !== undefined ? fmtHa(c.hectareas) : "—"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <BedDouble size={13} /> {c.dormitorios !== undefined ? `${c.dormitorios} dorm.` : c.ambientes !== undefined ? `${c.ambientes} amb.` : "—"}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 capitalize"><Eye size={13} /> {c.operacion}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="pcard overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graph/[0.07] bg-graph/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-graph-400">
                <th className="px-4 py-3">Propiedad</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3 text-right">Specs</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graph/[0.07]">
              {filtrados.map((c) => {
                const e = verEstado(c.estado);
                const meta = specMeta(c) || "—";
                return (
                  <tr key={c.id} onClick={() => setSelId(c.id)} className="cursor-pointer transition hover:bg-graph/[0.03]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CampoThumb src={c.fotos?.[0]} alt="" className="h-10 w-14 shrink-0 ring-1 ring-graph/10" />
                        <div className="min-w-0">
                          <p className="line-clamp-1 font-semibold text-graph">{c.titulo}</p>
                          <p className="text-xs text-graph-400">{c.id} · <span className="capitalize">{c.operacion}</span></p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-graph-500">{catLabel(c.categoria)}</td>
                    <td className="px-4 py-3 text-graph-500">{c.zona}</td>
                    <td className="px-4 py-3 text-right capitalize text-graph">{meta}</td>
                    <td className="px-4 py-3 text-right font-display font-semibold text-graph">{fmtPrecio(c, { short: true })}</td>
                    <td className="px-4 py-3"><Badge tone={e.tone} dot>{e.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CampoDrawer prop={sel} onClose={() => setSelId(null)} onUpdate={handleUpdate} onDelete={handleDelete} />
    </div>
  );
}
