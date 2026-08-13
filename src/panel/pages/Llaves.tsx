// ═════════════════════════════════════════════════════════════════════════════
// REGISTRO DE LLAVES — el llavero físico de la oficina
// ─────────────────────────────────────────────────────────────────────────────
// Audios de Mateo del 12-ago-2026. El caso que lo motivó, textual: «nos habían
// dado unas llaves… el dueño se las llevó, se olvidó, nosotros también nos
// olvidamos… las tenía el dueño, se las había entregado a un albañil» — un año
// sin saber dónde estaba un juego.
//
// Lo que pidió, y dónde está resuelto acá:
//   · «300 números y a cada número le asigno una llave» → columna Nº, editable,
//     única por oficina (lo garantiza la base).
//   · «guardarlo con el apellido del dueño y la dirección del inmueble» → las
//     dos columnas que mandan en la lista y en el buscador.
//   · «si las tenemos nosotros o si las entregamos y a quién» → la chapita de
//     estado + "en poder de" en la misma fila: el vistazo rápido que pidió.
//   · «anotaciones: si se las llevaron, si las ingresamos, si nos la
//     devolvieron» → historial por llave, en el panel lateral.
//   · «ordenarlo por número o por apellido» → el selector de orden.
//   · «cada oficina su registro» → lo hace el RLS de la base + DataScope.
//
// 🔴 NO depende de las propiedades cargadas: «va a haber propiedades cargadas y
// propiedades que NO están cargadas que igualmente administramos». Por eso una
// llave se carga con texto libre y el vínculo a una propiedad es opcional.
//
// ⚠️ El estado de la llave y su movimiento se escriben SIEMPRE juntos: entregar
// es un solo botón que crea el movimiento y mueve la llave. Si se separan, la
// lista miente — y la lista es todo el valor de esta pantalla.
// ═════════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { KeyRound, Plus, Trash2, ArrowRightLeft, Undo2, StickyNote, X, MapPin } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { hoyISO } from "@/lib/fechas";
import { fmtFechaCorta } from "@/lib/format";
import type { Llave, MovimientoLlave, EstadoLlave, TipoMovimientoLlave } from "@/data/types";
import { PageHeader, EmptyState } from "../components/PageShell";
import { SearchInput, FilterSelect, Btn } from "../components/Controls";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useToast } from "../components/Toast";
import { ESTADOS_LLAVE, verEstadoLlave, verMovimientoLlave } from "../ui/estados";
import { sinTildes } from "@/site/lib/parseBusqueda";
import { cn } from "../ui/cn";

const inputCls =
  "h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15";

const BLANCO = { numero: "", propietario: "", direccion: "", notas: "" };
type FormLlave = typeof BLANCO;

export default function Llaves() {
  const { push } = useToast();
  const { llaves, movimientosLlave, addLlave, updateLlave, deleteLlave, addMovimientoLlave } = useData();

  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"todos" | EstadoLlave>("todos");
  const [orden, setOrden] = useState<"numero" | "apellido">("numero");
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState<FormLlave>(BLANCO);
  const set = (k: keyof FormLlave, v: string) => setForm((f) => ({ ...f, [k]: v }));
  // La llave abierta en el panel lateral. Se guarda el ID y se resuelve EN VIVO
  // del contexto, así el historial refleja cada movimiento al instante.
  const [selId, setSelId] = useState<string | null>(null);
  const sel = selId ? llaves.find((l) => l.id === selId) ?? null : null;

  const porEstado = useMemo(
    () => llaves.reduce<Record<string, number>>((a, l) => ({ ...a, [l.estado]: (a[l.estado] ?? 0) + 1 }), {}),
    [llaves],
  );
  const afuera = porEstado.entregada ?? 0;

  const lista = useMemo(() => {
    const filtradas = llaves.filter((l) => {
      if (estado !== "todos" && l.estado !== estado) return false;
      if (!q) return true;
      // Se busca por número, apellido y dirección: las tres formas en que el
      // equipo nombra una llave. Sin tildes, como en toda la app.
      return sinTildes(`${l.numero ?? ""} ${l.propietario ?? ""} ${l.direccion ?? ""} ${l.enPoderDe ?? ""}`).includes(sinTildes(q));
    });
    return [...filtradas].sort((a, b) =>
      orden === "numero"
        // Sin número van al final: no compiten con el llavero numerado.
        ? (a.numero ?? 1e9) - (b.numero ?? 1e9)
        : (a.propietario ?? "").localeCompare(b.propietario ?? "", "es", { sensitivity: "base" }),
    );
  }, [llaves, q, estado, orden]);

  const movimientosDe = (llaveId: string) =>
    movimientosLlave
      .filter((m) => m.llaveId === llaveId)
      .sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || "") || (b.id > a.id ? 1 : -1));

  /* ── Alta ──────────────────────────────────────────────────────────────── */
  const registrar = async () => {
    if (!form.propietario.trim() && !form.direccion.trim()) {
      push("Poné al menos el apellido del dueño o la dirección", "error");
      return;
    }
    const numero = form.numero.trim() ? Number(form.numero) : undefined;
    if (numero !== undefined && (!Number.isInteger(numero) || numero <= 0)) {
      push("El número de llave tiene que ser un entero mayor a cero", "error");
      return;
    }
    if (numero !== undefined && llaves.some((l) => l.numero === numero)) {
      push(`El número ${numero} ya está usado en este llavero`, "error");
      return;
    }
    const id = "LLV-" + Date.now().toString(36);
    const nueva: Llave = {
      id,
      numero,
      propietario: form.propietario.trim() || undefined,
      direccion: form.direccion.trim() || undefined,
      notas: form.notas.trim() || undefined,
      estado: "en_oficina",
    };
    // La base es la que manda: si rechaza, se avisa y no se finge un éxito.
    const r = await addLlave(nueva);
    if (!r.ok) {
      push(`No se pudo guardar: ${r.error ?? "la base rechazó el cambio"}`, "error");
      return;
    }
    // Toda llave nace con su primer movimiento: así el historial nunca arranca
    // vacío y se sabe desde cuándo está en el llavero.
    await addMovimientoLlave({
      id: "MOV-" + Date.now().toString(36),
      llaveId: id,
      tipo: "ingreso",
      fechaISO: hoyISO(),
      nota: "Ingresó al llavero",
    });
    setForm(BLANCO);
    setAlta(false);
    push(`Llave ${numero ? `Nº ${numero} ` : ""}registrada ✓`, "success");
  };

  /* ── Movimientos: el estado y su explicación viajan juntos ─────────────── */
  const entregar = async (l: Llave) => {
    const persona = window.prompt(`¿A quién le entregás la llave ${l.numero ? `Nº ${l.numero}` : ""}?\n(propietario, albañil, inquilino…)`);
    if (persona === null) return;
    if (!persona.trim()) { push("Hace falta el nombre de quien se la lleva", "error"); return; }
    const r = await updateLlave(l.id, { estado: "entregada", enPoderDe: persona.trim(), entregadaISO: hoyISO() });
    if (!r.ok) { push(`No se pudo guardar: ${r.error ?? "la base rechazó el cambio"}`, "error"); return; }
    await addMovimientoLlave({ id: "MOV-" + Date.now().toString(36), llaveId: l.id, tipo: "entrega", fechaISO: hoyISO(), persona: persona.trim() });
    push(`Anotado: se la llevó ${persona.trim()}`, "success");
  };

  const devolver = async (l: Llave) => {
    const quien = l.enPoderDe;
    const r = await updateLlave(l.id, { estado: "en_oficina", enPoderDe: undefined, entregadaISO: undefined });
    if (!r.ok) { push(`No se pudo guardar: ${r.error ?? "la base rechazó el cambio"}`, "error"); return; }
    await addMovimientoLlave({ id: "MOV-" + Date.now().toString(36), llaveId: l.id, tipo: "devolucion", fechaISO: hoyISO(), persona: quien });
    push("Anotado: volvió al llavero ✓", "success");
  };

  const marcarSinUbicar = async (l: Llave) => {
    if (!window.confirm(`¿Marcar la llave ${l.numero ? `Nº ${l.numero}` : ""} como SIN UBICAR?`)) return;
    const r = await updateLlave(l.id, { estado: "perdida" });
    if (!r.ok) { push(`No se pudo guardar: ${r.error ?? "la base rechazó el cambio"}`, "error"); return; }
    await addMovimientoLlave({ id: "MOV-" + Date.now().toString(36), llaveId: l.id, tipo: "nota", fechaISO: hoyISO(), nota: "Marcada como sin ubicar" });
    push("Marcada como sin ubicar", "info");
  };

  const anotar = async (l: Llave) => {
    const nota = window.prompt("Anotación (queda en el historial de esta llave):");
    if (nota === null || !nota.trim()) return;
    const r = await addMovimientoLlave({ id: "MOV-" + Date.now().toString(36), llaveId: l.id, tipo: "nota", fechaISO: hoyISO(), nota: nota.trim() });
    if (!r.ok) { push(`No se pudo guardar: ${r.error ?? "la base rechazó el cambio"}`, "error"); return; }
    push("Anotación guardada ✓", "success");
  };

  const borrar = async (l: Llave) => {
    if (!window.confirm(`¿Borrar la llave ${l.numero ? `Nº ${l.numero} ` : ""}de ${l.propietario || l.direccion || "—"}?\nSe borra también su historial. No se puede deshacer.`)) return;
    const r = await deleteLlave(l.id);
    if (!r.ok) { push(`No se pudo borrar: ${r.error ?? "la base rechazó el cambio"}`, "error"); return; }
    if (selId === l.id) setSelId(null);
    push("Llave borrada", "success");
  };

  return (
    <div>
      <PageHeader
        title="Registro de llaves"
        subtitle={
          llaves.length === 0
            ? "El llavero de la oficina, con su historial"
            : `${llaves.length} en el llavero · ${afuera === 0 ? "todas en la oficina" : `${afuera} afuera`}`
        }
        actions={
          <Btn variant="primary" onClick={() => setAlta(true)}>
            <Plus size={16} /> Nueva llave
          </Btn>
        }
      />

      {/* Barra: buscar por número/apellido/dirección + estado + orden. */}
      <div className="pcard mb-5 flex flex-wrap items-center gap-2.5 p-3">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por número, apellido o dirección…" className="min-w-[220px] flex-1" />
        <FilterSelect
          value={estado}
          onChange={(v) => setEstado(v as "todos" | EstadoLlave)}
          options={[
            { value: "todos", label: `Estado: todas (${llaves.length})` },
            ...ESTADOS_LLAVE.map((e) => ({ value: e, label: `${verEstadoLlave(e).label} (${porEstado[e] ?? 0})` })),
          ]}
        />
        {/* «que exista la posibilidad de ordenarlo por número o por orden
            alfabético del apellido del dueño» — textual del audio 3. */}
        <FilterSelect
          value={orden}
          onChange={(v) => setOrden(v as "numero" | "apellido")}
          options={[
            { value: "numero", label: "Orden: por número" },
            { value: "apellido", label: "Orden: por apellido" },
          ]}
        />
      </div>

      {lista.length === 0 ? (
        <EmptyState
          msg={
            llaves.length === 0
              ? "Todavía no hay llaves en el registro. Tocá “Nueva llave” y cargá la primera."
              : "Ninguna llave coincide con la búsqueda."
          }
        />
      ) : (
        <div className="pcard overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-graph/[0.07] bg-graph/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-graph-400">
                  <th className="px-5 py-3">Nº</th>
                  <th className="px-5 py-3">Propietario</th>
                  <th className="px-5 py-3">Dirección</th>
                  <th className="px-5 py-3">Dónde está</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graph/[0.07]">
                {lista.map((l) => {
                  const e = verEstadoLlave(l.estado);
                  const historial = movimientosDe(l.id);
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setSelId(l.id)}
                      className={cn("cursor-pointer transition hover:bg-graph/[0.03]", selId === l.id && "bg-brand/[0.04]")}
                    >
                      <td className="px-5 py-3.5">
                        <span className="inline-grid h-9 min-w-9 place-items-center rounded-xl bg-brand/10 px-2 font-display text-sm font-semibold text-brand-700">
                          {l.numero ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-graph">{l.propietario || "—"}</td>
                      <td className="px-5 py-3.5 text-graph-500">
                        {l.direccion ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={14} className="shrink-0 text-graph-400" /> {l.direccion}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={e.tone} dot>{e.label}</Badge>
                        {l.estado === "entregada" && l.enPoderDe && (
                          <span className="mt-1 block text-[12px] text-graph-400">
                            {l.enPoderDe}
                            {l.entregadaISO ? ` · desde el ${fmtFechaCorta(l.entregadaISO)}` : ""}
                          </span>
                        )}
                        {historial.length > 0 && (
                          <span className="mt-0.5 block text-[11px] text-graph-400">
                            {historial.length} {historial.length === 1 ? "movimiento" : "movimientos"}
                          </span>
                        )}
                      </td>
                      {/* stopPropagation: los botones actúan sin abrir el panel. */}
                      <td className="px-5 py-3.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          {l.estado === "en_oficina" ? (
                            <IconBtn title="Se la lleva alguien" onClick={() => entregar(l)}>
                              <ArrowRightLeft size={15} />
                            </IconBtn>
                          ) : (
                            <IconBtn title="Volvió al llavero" onClick={() => devolver(l)}>
                              <Undo2 size={15} />
                            </IconBtn>
                          )}
                          <IconBtn title="Anotar algo" onClick={() => anotar(l)}>
                            <StickyNote size={15} />
                          </IconBtn>
                          <IconBtn title="Borrar la llave y su historial" peligro onClick={() => borrar(l)}>
                            <Trash2 size={15} />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── El historial de UNA llave ──────────────────────────────────────── */}
      {sel && (
        <PanelHistorial
          llave={sel}
          movimientos={movimientosDe(sel.id)}
          onCerrar={() => setSelId(null)}
          onEntregar={() => entregar(sel)}
          onDevolver={() => devolver(sel)}
          onAnotar={() => anotar(sel)}
          onSinUbicar={() => marcarSinUbicar(sel)}
        />
      )}

      {/* ── Alta ──────────────────────────────────────────────────────────── */}
      <Modal
        open={alta}
        onClose={() => setAlta(false)}
        title="Nueva llave"
        subtitle="El número del llavero, de quién es y de qué inmueble"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAlta(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={registrar}>Registrar</Btn>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(ev) => { ev.preventDefault(); void registrar(); }}>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Número del llavero</span>
            <input className={inputCls} inputMode="numeric" placeholder="12" value={form.numero} onChange={(ev) => set("numero", ev.target.value.replace(/[^\d]/g, ""))} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Apellido del dueño</span>
            <input className={inputCls} placeholder="Gutiérrez" value={form.propietario} onChange={(ev) => set("propietario", ev.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Dirección del inmueble</span>
            <input className={inputCls} placeholder="Córdoba 3712, Chauvín" value={form.direccion} onChange={(ev) => set("direccion", ev.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Notas (opcional)</span>
            <textarea className={cn(inputCls, "h-auto resize-y py-2.5")} rows={2} placeholder="Juego completo: portón, puerta y reja…" value={form.notas} onChange={(ev) => set("notas", ev.target.value)} />
          </label>
          <p className="text-[12px] text-graph-400 sm:col-span-2">
            La llave entra al llavero como <b className="text-graph-500">en la oficina</b>. No hace falta que el inmueble esté cargado en el sistema.
          </p>
        </form>
      </Modal>
    </div>
  );
}

/* ── Piezas ───────────────────────────────────────────────────────────────── */

function IconBtn({ children, title, onClick, peligro }: { children: React.ReactNode; title: string; onClick: () => void; peligro?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "inline-grid h-8 w-8 place-items-center rounded-lg text-graph-400 transition",
        peligro ? "hover:bg-red-500/10 hover:text-red-600" : "hover:bg-brand/10 hover:text-brand",
      )}
    >
      {children}
    </button>
  );
}

function PanelHistorial({
  llave, movimientos, onCerrar, onEntregar, onDevolver, onAnotar, onSinUbicar,
}: {
  llave: Llave;
  movimientos: MovimientoLlave[];
  onCerrar: () => void;
  onEntregar: () => void;
  onDevolver: () => void;
  onAnotar: () => void;
  onSinUbicar: () => void;
}) {
  const e = verEstadoLlave(llave.estado);
  return (
    <div className="pcard mt-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-graph-400">
            <KeyRound size={14} className="text-brand" /> Historial de la llave
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-graph">
            {llave.numero ? `Nº ${llave.numero} · ` : ""}{llave.propietario || "Sin propietario"}
          </h2>
          {llave.direccion && <p className="mt-0.5 text-sm text-graph-500">{llave.direccion}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={e.tone} dot>{e.label}</Badge>
            {llave.estado === "entregada" && llave.enPoderDe && <span className="text-[13px] text-graph-500">en poder de <b className="text-graph">{llave.enPoderDe}</b></span>}
          </div>
          {llave.notas && <p className="mt-3 max-w-prose rounded-xl bg-graph/[0.04] px-3 py-2 text-[13px] text-graph-500">{llave.notas}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {llave.estado === "en_oficina" ? (
            <Btn variant="soft" onClick={onEntregar}><ArrowRightLeft size={15} /> Se la lleva alguien</Btn>
          ) : (
            <Btn variant="soft" onClick={onDevolver}><Undo2 size={15} /> Volvió al llavero</Btn>
          )}
          <Btn variant="ghost" onClick={onAnotar}><StickyNote size={15} /> Anotar</Btn>
          {llave.estado !== "perdida" && <Btn variant="ghost" onClick={onSinUbicar}>Sin ubicar</Btn>}
          <IconBtn title="Cerrar el historial" onClick={onCerrar}><X size={16} /></IconBtn>
        </div>
      </div>

      <ol className="mt-6 space-y-3">
        {movimientos.length === 0 && <li className="text-sm text-graph-400">Todavía no hay movimientos anotados.</li>}
        {movimientos.map((m) => {
          const t = verMovimientoLlave(m.tipo);
          return (
            <li key={m.id} className="flex gap-3 border-l-2 border-graph/10 pl-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={t.tone}>{t.label}</Badge>
                  {m.persona && <span className="font-medium text-graph">{m.persona}</span>}
                  <span className="text-[12px] text-graph-400">{m.fechaISO ? fmtFechaCorta(m.fechaISO) : ""}</span>
                </p>
                {/* La nota solo si dice algo MÁS que la chapita: el alta escribe
                    "Ingresó al llavero", que ya es el label del tipo. */}
                {m.nota && m.nota !== t.label && <p className="mt-1 text-[13px] text-graph-500">{m.nota}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// El tipo se usa arriba en la firma del prompt de movimientos; queda explícito
// para que el compilador avise si mañana se agrega un tipo de movimiento nuevo.
export type { TipoMovimientoLlave };
