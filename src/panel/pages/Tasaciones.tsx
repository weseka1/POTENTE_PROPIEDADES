import { useState } from "react";
import { Plus, Calculator, Clock, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { hoyISO } from "@/lib/fechas";
import { fmtUSD, fmtFecha, fmtNum } from "@/lib/format";
import type { Tasacion } from "@/data/types";
import { PageHeader } from "../components/PageShell";
import { Btn } from "../components/Controls";
import Select from "@/components/Select";
import Badge from "../components/Badge";
import KpiCard from "../components/KpiCard";
import Modal from "../components/Modal";
import { useConfirmar } from "../components/Confirmar";
import { useToast } from "../components/Toast";
import { estadoTasacion } from "../ui/estados";
import { cn } from "../ui/cn";

const inputCls =
  "h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15";

// Estados posibles de una tasación (deriva del tipo, sin inventar campos)
const ESTADOS_TAS: Tasacion["estado"][] = ["solicitada", "en_proceso", "entregada"];

export default function Tasaciones() {
  const { push } = useToast();
  // Las confirmaciones salen por el modal del sistema, cero `window.confirm`
  // (pedido de Juani, 12-ago: el cartel del navegador no es nuestra herramienta).
  const { confirmar, dialogo } = useConfirmar();
  const { tasaciones: allTas, addTasacion, updateTasacion, deleteTasacion } = useData();
  const [open, setOpen] = useState(false);

  // edición inline del valor estimado
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const vacio = { solicitante: "", contacto: "", zona: "", metros: "" };
  const [form, setForm] = useState(vacio);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const registrar = async () => {
    if (!form.solicitante.trim()) { push("Poné al menos el nombre del solicitante", "error"); return; }
    const t: Tasacion = {
      id: "TAS-" + Date.now().toString(36),
      fechaISO: hoyISO(),
      solicitante: form.solicitante.trim(),
      contacto: form.contacto.trim(),
      zona: form.zona.trim() || "—",
      hectareas: Number(form.metros) || 0, // el campo guarda la superficie (m²) para inmuebles urbanos
      aptitud: "mixta", // no aplica a inmuebles urbanos; se conserva por compatibilidad del modelo
      valorEstimadoUSD: null,
      estado: "solicitada",
    };
    // Si la base rechazó, se dice en pantalla y el formulario queda cargado para
    // reintentar — el tilde verde solo sobre un guardado que ocurrió (cicatriz 7-ago).
    const r = await addTasacion(t);
    if (!r.ok) { push(`No se pudo registrar: ${r.error ?? "la base la rechazó"}`, "error"); return; }
    setForm(vacio);
    setOpen(false);
    push("Tasación registrada como “Solicitada” ✓", "success");
  };

  const cambiarEstado = async (id: string, estado: Tasacion["estado"]) => {
    const r = await updateTasacion(id, { estado });
    if (!r.ok) { push(`No se pudo cambiar el estado: ${r.error ?? "la base lo rechazó"}`, "error"); return; }
    push(`Tasación movida a “${estadoTasacion[estado].label}”`, "info");
  };

  // El borrado y el aviso van ADENTRO de onOk: el modal es asíncrono, así que
  // cualquier línea que quede afuera se ejecutaría sin que nadie confirme nada.
  const eliminar = (t: Tasacion) =>
    confirmar({
      titulo: `¿Eliminar la tasación de ${t.solicitante}?`,
      // El alta solo exige el solicitante: sin zona, el detalle no puede
      // arrancar con " · ".
      detalle: `${[t.zona, `pedida el ${fmtFecha(t.fechaISO)}`].filter(Boolean).join(" · ")}. Se borra del sistema con su valuación y no se puede deshacer.`,
      boton: "Eliminar",
      peligro: true,
      onOk: async () => {
        const r = await deleteTasacion(t.id);
        if (!r.ok) { push(`No se pudo eliminar: ${r.error ?? "la base lo rechazó"}`, "error"); return; }
        push("Tasación eliminada", "success");
      },
    });

  const abrirEdicion = (t: Tasacion) => {
    setEditId(t.id);
    setDraft(t.valorEstimadoUSD != null ? String(t.valorEstimadoUSD) : "");
  };
  const guardarValor = async (t: Tasacion) => {
    const raw = draft.replace(/[^\d.]/g, "").trim();
    const nuevo = raw === "" ? null : Number(raw);
    const r = await updateTasacion(t.id, { valorEstimadoUSD: Number.isFinite(nuevo as number) ? nuevo : null });
    // Si la base rechazó, el input sigue abierto con lo tipeado para reintentar.
    if (!r.ok) { push(`No se pudo guardar la valuación: ${r.error ?? "la base la rechazó"}`, "error"); return; }
    setEditId(null);
    push("Valuación actualizada ✓", "success");
  };

  const solicitadas = allTas.filter((t) => t.estado === "solicitada").length;
  const enProceso = allTas.filter((t) => t.estado === "en_proceso").length;
  const entregadas = allTas.filter((t) => t.estado === "entregada").length;

  return (
    <div>
      <PageHeader
        title="Tasaciones"
        subtitle="Servicio de valuación de propiedades de Potente"
        actions={
          <Btn variant="primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Nueva tasación
          </Btn>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Solicitadas" value={`${solicitadas}`} icon={Clock} accent="clay" hint="pendientes de iniciar" />
        <KpiCard label="En proceso" value={`${enProceso}`} icon={Calculator} accent="wheat" hint="valuación en curso" />
        <KpiCard label="Entregadas" value={`${entregadas}`} icon={CheckCircle2} accent="field" hint="este mes" />
      </div>

      <div className="pcard overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-graph/[0.07] bg-graph/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-graph-400">
                <th className="px-5 py-3">Solicitante</th>
                <th className="px-5 py-3">Zona</th>
                <th className="px-5 py-3 text-right">Superficie</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3 text-right">Valor estimado</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graph/[0.07]">
              {allTas.map((t) => {
                const e = estadoTasacion[t.estado];
                const editando = editId === t.id;
                return (
                  <tr key={t.id} className="transition hover:bg-graph/[0.03]">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-graph">{t.solicitante}</p>
                      <p className="text-xs text-graph-400">{t.contacto}</p>
                    </td>
                    <td className="px-5 py-3.5 text-graph-500">{t.zona}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-graph">{t.hectareas ? `${fmtNum(t.hectareas)} m²` : "—"}</td>
                    <td className="px-5 py-3.5 text-graph-400">{fmtFecha(t.fechaISO)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {editando ? (
                        <input
                          type="number"
                          autoFocus
                          value={draft}
                          onChange={(ev) => setDraft(ev.target.value)}
                          onBlur={() => guardarValor(t)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") guardarValor(t);
                            if (ev.key === "Escape") setEditId(null);
                          }}
                          placeholder="U$S"
                          className="h-8 w-28 rounded-lg border border-brand/40 bg-graph/[0.04] px-2 text-right text-sm text-graph outline-none focus:ring-2 focus:ring-brand/15"
                        />
                      ) : (
                        <button
                          onClick={() => abrirEdicion(t)}
                          title="Cargar / editar valuación"
                          className={cn(
                            "group inline-flex items-center justify-end gap-1.5 rounded-lg px-2 py-1 font-display font-semibold transition hover:bg-graph/[0.06]",
                            t.valorEstimadoUSD ? "text-graph" : "text-graph-400"
                          )}
                        >
                          {t.valorEstimadoUSD ? fmtUSD(t.valorEstimadoUSD, { short: true }) : "Pendiente"}
                          <Pencil size={12} className="text-graph-400 opacity-0 transition group-hover:opacity-100" />
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Badge tone={e.tone} dot>{e.label}</Badge>
                        <Select
                          value={t.estado}
                          onChange={(v) => cambiarEstado(t.id, v as Tasacion["estado"])}
                          options={ESTADOS_TAS.map((s) => ({ value: s, label: estadoTasacion[s].label }))}
                          size="sm"
                          align="right"
                          className="w-36"
                          triggerClassName="font-medium text-graph-500"
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => eliminar(t)}
                        title="Eliminar tasación"
                        className="inline-grid h-8 w-8 place-items-center rounded-lg text-graph-400 transition hover:bg-red-500/10 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva tasación"
        subtitle="Cargá un pedido de valuación"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setOpen(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={registrar}>Registrar</Btn>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); registrar(); }}>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Solicitante</span>
            <input className={inputCls} placeholder="Nombre o razón social" value={form.solicitante} onChange={(e) => set("solicitante", e.target.value)} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Contacto</span>
            <input className={inputCls} placeholder="Teléfono o mail" value={form.contacto} onChange={(e) => set("contacto", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Zona</span>
            <input className={inputCls} placeholder="Barrio / dirección" value={form.zona} onChange={(e) => set("zona", e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Superficie (m²)</span>
            <input type="number" className={inputCls} placeholder="120" value={form.metros} onChange={(e) => set("metros", e.target.value)} />
          </label>
        </form>
      </Modal>

      {/* Confirmación de borrado — también del sistema, no del navegador. */}
      {dialogo}
    </div>
  );
}
