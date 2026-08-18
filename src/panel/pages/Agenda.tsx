import { useMemo, useState } from "react";
import {
  Clock, MapPin, User, Plus, Check, X, CheckCircle2,
  ChevronLeft, ChevronRight, CalendarDays, List, CalendarRange, Trash2,
} from "lucide-react";
import { useData } from "@/lib/DataProvider";
import type { Visita } from "@/data/types";
import { PageHeader } from "../components/PageShell";
import { Btn } from "../components/Controls";
import Select from "@/components/Select";
import Modal from "../components/Modal";
import { useConfirmar } from "../components/Confirmar";
import { useToast } from "../components/Toast";
import { cn } from "../ui/cn";
import { hoyISO } from "@/lib/fechas";

const HOY = hoyISO();
const INP =
  "h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15";

// ── estado → color/estilo (consistente en calendario, chips y leyenda) ──
const EST: Record<Visita["estado"], { label: string; dot: string; chip: string; text: string }> = {
  agendada:   { label: "Agendada",   dot: "bg-amber-500", chip: "border-amber-300/70 bg-amber-50", text: "text-amber-700" },
  confirmada: { label: "Confirmada", dot: "bg-brand",     chip: "border-brand/30 bg-brand/[0.06]",  text: "text-brand" },
  realizada:  { label: "Realizada",  dot: "bg-sky-500",   chip: "border-sky-300/70 bg-sky-50",      text: "text-sky-700" },
  cancelada:  { label: "Cancelada",  dot: "bg-graph/30",  chip: "border-graph/10 bg-graph/[0.03]",  text: "text-graph-400" },
};
const ORDEN: Visita["estado"][] = ["agendada", "confirmada", "realizada", "cancelada"];

// ── helpers de fecha (ISO YYYY-MM-DD, semana arranca lunes) ──
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (iso: string) => new Date(iso + "T12:00:00");
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(12, 0, 0, 0); return x; };
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default function Agenda() {
  const { visitas: allVisitas, getProp, propiedades, addVisita, updateVisita, deleteVisita } = useData();
  const { push } = useToast();
  // Eliminar una visita se pregunta con el modal del sistema, no con el cartel del
  // navegador (pedido de Juani, 12-ago: todo tiene que pasar por la herramienta).
  const { confirmar, dialogo } = useConfirmar();

  const [view, setView] = useState<"semana" | "lista">("semana");
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(parseISO(HOY)));
  const [selDay, setSelDay] = useState<string>(HOY);
  const [open, setOpen] = useState(false);

  const vacio = { clienteNombre: "", campoId: "", fechaISO: HOY, hora: "10:00", responsable: "Mateo" };
  const [form, setForm] = useState(vacio);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // visitas por fecha (ordenadas por hora)
  const porFecha = useMemo(() => {
    const map = new Map<string, Visita[]>();
    for (const v of allVisitas) {
      const arr = map.get(v.fechaISO) ?? [];
      arr.push(v);
      map.set(v.fechaISO, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.hora.localeCompare(b.hora));
    return map;
  }, [allVisitas]);

  const semana = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const visitasSemana = semana.flatMap((d) => porFecha.get(toISO(d)) ?? []);

  const total = allVisitas.length;
  const cuenta = (e: Visita["estado"]) => allVisitas.filter((v) => v.estado === e).length;

  const crear = async () => {
    if (!form.clienteNombre.trim()) { push("Poné el nombre del cliente", "error"); return; }
    const v: Visita = {
      id: "VIS-" + Date.now().toString(36),
      fechaISO: form.fechaISO || HOY,
      hora: form.hora || "10:00",
      campoId: form.campoId || (propiedades[0]?.id ?? ""),
      clienteNombre: form.clienteNombre.trim(),
      responsable: form.responsable.trim() || "Sin asignar",
      estado: "agendada",
    };
    // Si la base rechazó, se dice en pantalla y el formulario queda cargado para
    // reintentar — el tilde verde solo sobre un guardado que ocurrió (cicatriz 7-ago).
    const r = await addVisita(v);
    if (!r.ok) { push(`No se pudo agendar: ${r.error ?? "la base la rechazó"}`, "error"); return; }
    setForm(vacio);
    setOpen(false);
    setWeekStart(mondayOf(parseISO(v.fechaISO)));
    setSelDay(v.fechaISO);
    push("Visita agendada ✓", "success");
  };

  const cambiar = async (v: Visita, estado: Visita["estado"], msg: string) => {
    const r = await updateVisita(v.id, { estado });
    if (!r.ok) { push(`No se pudo cambiar el estado: ${r.error ?? "la base lo rechazó"}`, "error"); return; }
    push(msg, "success");
  };
  // Cancelar deja registro; eliminar borra la visita del todo (queda disponible en cualquier estado).
  const eliminar = (v: Visita) => {
    // es-AR mete coma después del día de semana ("jueves, 13 de agosto"): la sacamos
    // y arrancamos en mayúscula porque el detalle abre la oración.
    const f = parseISO(v.fechaISO).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
    const cuando = f.charAt(0).toUpperCase() + f.slice(1);
    const campo = getProp(v.campoId);
    confirmar({
      titulo: `¿Eliminar la visita de ${v.clienteNombre}?`,
      detalle: `${cuando} a las ${v.hora}${campo?.titulo ? ` · ${campo.titulo}` : ""}. Se borra del sistema y no se puede deshacer.`,
      boton: "Eliminar",
      peligro: true,
      // 🔴 El confirm del navegador BLOQUEABA: lo de abajo corría solo con el "sí".
      // El modal no bloquea, así que el borrado y el aviso viven acá adentro; si
      // quedaran afuera, la visita se borraría sin preguntar nada.
      onOk: async () => {
        const r = await deleteVisita(v.id);
        if (!r.ok) { push(`No se pudo eliminar: ${r.error ?? "la base lo rechazó"}`, "error"); return; }
        push("Visita eliminada", "success");
      },
    });
  };

  const rango = `${weekStart.getDate()} ${MESES[weekStart.getMonth()].slice(0, 3)} — ${addDays(weekStart, 6).getDate()} ${MESES[addDays(weekStart, 6).getMonth()].slice(0, 3)}`;

  return (
    <div>
      <PageHeader
        title="Agenda de visitas"
        subtitle={`${total} visitas · ${cuenta("confirmada")} confirmadas · ${cuenta("agendada")} por confirmar`}
        actions={<Btn variant="primary" onClick={() => { setForm({ ...vacio, fechaISO: selDay }); setOpen(true); }}><Plus size={16} /> Nueva visita</Btn>}
      />

      {/* barra: vista + navegación de semana + leyenda */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* flex-wrap: sin esto el selector de vista y la navegación de semana suman
            un ancho mínimo de ~420px y estiran la página en un celular. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-graph/10 bg-graph/[0.03] p-0.5">
            <button onClick={() => setView("semana")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition", view === "semana" ? "bg-white text-graph shadow-sm" : "text-graph-400 hover:text-graph")}><CalendarRange size={14} /> Semana</button>
            <button onClick={() => setView("lista")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition", view === "lista" ? "bg-white text-graph shadow-sm" : "text-graph-400 hover:text-graph")}><List size={14} /> Lista</button>
          </div>
          {view === "semana" && (
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="grid h-8 w-8 place-items-center rounded-lg text-graph-500 transition hover:bg-graph/[0.06]"><ChevronLeft size={16} /></button>
              <span className="min-w-[128px] text-center text-sm font-semibold capitalize text-graph">{rango}</span>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="grid h-8 w-8 place-items-center rounded-lg text-graph-500 transition hover:bg-graph/[0.06]"><ChevronRight size={16} /></button>
              <button onClick={() => { setWeekStart(mondayOf(parseISO(HOY))); setSelDay(HOY); }} className="ml-1 rounded-lg border border-graph/10 px-2.5 py-1.5 text-xs font-semibold text-graph-500 transition hover:border-brand/40 hover:text-brand">Hoy</button>
            </div>
          )}
        </div>
        {/* leyenda de colores */}
        <div className="flex flex-wrap items-center gap-3">
          {ORDEN.map((e) => (
            <span key={e} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-graph-500">
              <span className={cn("h-2.5 w-2.5 rounded-full", EST[e].dot)} /> {EST[e].label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {view === "semana" ? (
            <div className="overflow-x-auto pb-1">
              <div className="grid min-w-[900px] grid-cols-7 gap-2">
                {semana.map((d) => {
                  const iso = toISO(d);
                  const vs = porFecha.get(iso) ?? [];
                  const esHoy = iso === HOY;
                  const sel = iso === selDay;
                  return (
                    <div key={iso} className={cn("flex flex-col rounded-2xl border p-2 transition", sel ? "border-brand/50 bg-brand/[0.03]" : "border-graph/[0.08] bg-paper-100")}>
                      <button onClick={() => setSelDay(iso)} className="mb-2 flex items-center justify-between rounded-lg px-1.5 py-1 text-left transition hover:bg-graph/[0.04]">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-graph-400">{DIAS[(d.getDay() + 6) % 7]}</span>
                        <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs font-bold", esHoy ? "bg-brand text-white" : "text-graph")}>{d.getDate()}</span>
                      </button>
                      <div className="flex flex-1 flex-col gap-1.5">
                        {vs.length === 0 && <span className="px-1 py-3 text-center text-[10px] text-graph-300">—</span>}
                        {vs.map((v) => {
                          const st = EST[v.estado];
                          const campo = getProp(v.campoId);
                          return (
                            <div key={v.id} className={cn("group rounded-lg border p-1.5 transition", st.chip)}>
                              <div className="flex items-center justify-between">
                                <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold", st.text)}><Clock size={10} /> {v.hora}</span>
                                <span className={cn("h-2 w-2 rounded-full", st.dot)} />
                              </div>
                              <p className="mt-0.5 truncate text-xs font-semibold leading-tight text-graph">{v.clienteNombre}</p>
                              <p className="truncate text-[10px] text-graph-400">{campo?.titulo ?? v.campoId}</p>
                              <Acciones v={v} cambiar={cambiar} eliminar={eliminar} compact />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {visitasSemana.length === 0 && (
                <p className="mt-4 text-center text-sm text-graph-400">No hay visitas esta semana. Usá <b>“Nueva visita”</b> para agendar una.</p>
              )}
            </div>
          ) : (
            <ListaView porFecha={porFecha} getProp={getProp} cambiar={cambiar} eliminar={eliminar} />
          )}
        </div>

        {/* calendario del mes (coloreado + clickeable) */}
        <aside className="space-y-4">
          <MesCalendario porFecha={porFecha} weekStart={weekStart}
            onPick={(iso) => { setWeekStart(mondayOf(parseISO(iso))); setSelDay(iso); setView("semana"); }} />
          <div className="pcard p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-graph-400"><CalendarDays size={13} /> Resumen</p>
            <div className="space-y-2.5 text-sm">
              {ORDEN.map((e) => (
                <div key={e} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-graph-500"><span className={cn("h-2 w-2 rounded-full", EST[e].dot)} /> {EST[e].label}</span>
                  <span className="font-display font-semibold text-graph">{cuenta(e)}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={open} onClose={() => setOpen(false)} title="Nueva visita" subtitle="Agendá una visita a una propiedad"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={crear}>Agendar</Btn></>}
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); crear(); }}>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Cliente</span>
            <input className={INP} placeholder="Nombre del cliente" value={form.clienteNombre} onChange={(e) => set("clienteNombre", e.target.value)} autoFocus />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Propiedad</span>
            <Select
              value={form.campoId}
              onChange={(v) => set("campoId", v)}
              placeholder="Elegí una propiedad…"
              options={[
                { value: "", label: "Elegí una propiedad…" },
                ...propiedades.map((p) => ({ value: p.id, label: `${p.titulo} · ${p.zona}` })),
              ]}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Fecha</span>
            <input type="date" className={INP} value={form.fechaISO} onChange={(e) => set("fechaISO", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Hora</span>
            <input type="time" className={INP} value={form.hora} onChange={(e) => set("hora", e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Responsable</span>
            <input className={INP} placeholder="Quién la atiende" value={form.responsable} onChange={(e) => set("responsable", e.target.value)} />
          </label>
        </form>
      </Modal>

      {/* Confirmación de eliminar visita — también del sistema. */}
      {dialogo}
    </div>
  );
}

// ── acciones de una visita (confirmar / realizar / cancelar / eliminar) ──
function Acciones({ v, cambiar, eliminar, compact }: { v: Visita; cambiar: (v: Visita, e: Visita["estado"], m: string) => void; eliminar: (v: Visita) => void; compact?: boolean }) {
  // Una visita realizada o cancelada ya no cambia de estado, pero siempre se puede eliminar.
  const terminal = v.estado === "realizada" || v.estado === "cancelada";
  const s = compact ? "grid h-6 w-6 place-items-center rounded-md" : "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold";
  return (
    <div className={cn("mt-1.5 flex items-center gap-1", compact && "opacity-0 transition group-hover:opacity-100")}>
      {!terminal && v.estado === "agendada" && (
        <button title="Confirmar" onClick={() => cambiar(v, "confirmada", "Visita confirmada ✓")} className={cn(s, "bg-brand/10 text-brand hover:bg-brand/20")}>
          <Check size={12} />{!compact && " Confirmar"}
        </button>
      )}
      {!terminal && v.estado === "confirmada" && (
        <button title="Marcar realizada" onClick={() => cambiar(v, "realizada", "Marcada como realizada ✓")} className={cn(s, "bg-sky-500/10 text-sky-700 hover:bg-sky-500/20")}>
          <CheckCircle2 size={12} />{!compact && " Realizada"}
        </button>
      )}
      {!terminal && (
        <button title="Cancelar" onClick={() => cambiar(v, "cancelada", "Visita cancelada")} className={cn(s, "text-graph-400 hover:bg-amber-500/10 hover:text-amber-600")}>
          <X size={12} />{!compact && " Cancelar"}
        </button>
      )}
      <button title="Eliminar" onClick={() => eliminar(v)} className={cn(s, "text-graph-400 hover:bg-red-500/10 hover:text-red-600")}>
        <Trash2 size={12} />{!compact && " Eliminar"}
      </button>
    </div>
  );
}

// ── vista lista (timeline agrupado por día) ──
function ListaView({ porFecha, getProp, cambiar, eliminar }: {
  porFecha: Map<string, Visita[]>; getProp: (id: string) => any; cambiar: (v: Visita, e: Visita["estado"], m: string) => void; eliminar: (v: Visita) => void;
}) {
  const dias = Array.from(porFecha.keys()).sort();
  return (
    <div className="space-y-7">
      {dias.map((fecha) => {
        const vs = porFecha.get(fecha)!;
        const d = parseISO(fecha);
        const esHoy = fecha === HOY;
        return (
          <div key={fecha}>
            <div className="mb-3 flex items-center gap-2">
              <h3 className={cn("font-display text-sm font-semibold capitalize", esHoy ? "text-brand" : "text-graph-500")}>
                {d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              {esHoy && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">Hoy</span>}
              <span className="text-xs text-graph-400">· {vs.length} visita{vs.length > 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-2.5">
              {vs.map((v) => {
                const campo = getProp(v.campoId);
                const st = EST[v.estado];
                return (
                  <div key={v.id} className={cn("pcard flex items-center gap-4 p-4", esHoy && "border-brand/30")}>
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-graph/[0.06] text-graph ring-1 ring-inset ring-graph/10">
                      <Clock size={14} className="text-brand" />
                      <span className="mt-0.5 text-sm font-semibold leading-none">{v.hora}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-graph">{v.clienteNombre}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-graph-400">
                        <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-brand" /> {campo?.titulo ?? v.campoId}</span>
                        <span className="inline-flex items-center gap-1"><User size={12} /> {v.responsable}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", st.chip, st.text)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} /> {st.label}
                      </span>
                      <Acciones v={v} cambiar={cambiar} eliminar={eliminar} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── calendario del mes: días coloreados por estado + clickeables ──
function MesCalendario({ porFecha, weekStart, onPick }: {
  porFecha: Map<string, Visita[]>; weekStart: Date; onPick: (iso: string) => void;
}) {
  const [cursor, setCursor] = useState<Date>(() => new Date(weekStart.getFullYear(), weekStart.getMonth(), 1, 12));
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const semDesde = toISO(weekStart), semHasta = toISO(addDays(weekStart, 6));

  return (
    <div className="pcard p-4">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setCursor(new Date(year, month - 1, 1, 12))} className="grid h-7 w-7 place-items-center rounded-lg text-graph-400 transition hover:bg-graph/[0.06]"><ChevronLeft size={15} /></button>
        <p className="font-display text-sm font-semibold capitalize text-graph">{MESES[month]} {year}</p>
        <button onClick={() => setCursor(new Date(year, month + 1, 1, 12))} className="grid h-7 w-7 place-items-center rounded-lg text-graph-400 transition hover:bg-graph/[0.06]"><ChevronRight size={15} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-graph-400">
        {DIAS.map((d, i) => <span key={i}>{d[0]}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((n) => {
          const iso = toISO(new Date(year, month, n));
          const vs = porFecha.get(iso) ?? [];
          const esHoy = iso === HOY;
          const enSemana = iso >= semDesde && iso <= semHasta;
          const estados = ORDEN.filter((e) => vs.some((v) => v.estado === e));
          return (
            <button key={n} onClick={() => onPick(iso)}
              className={cn("relative flex h-9 flex-col items-center justify-center rounded-lg text-xs font-medium transition",
                esHoy ? "bg-brand text-white" : enSemana ? "bg-brand/10 text-graph ring-1 ring-inset ring-brand/25" : "text-graph-500 hover:bg-graph/5")}>
              {n}
              {estados.length > 0 && (
                <span className="mt-0.5 flex items-center gap-0.5">
                  {estados.slice(0, 4).map((e) => <span key={e} className={cn("h-1 w-1 rounded-full", esHoy ? "bg-white/80" : EST[e].dot)} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[10px] text-graph-400">Tocá un día para ver esa semana en detalle</p>
    </div>
  );
}
