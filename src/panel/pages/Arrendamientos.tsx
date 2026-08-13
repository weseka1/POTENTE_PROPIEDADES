import { useState } from "react";
import { AlertTriangle, FileSignature, DollarSign, CalendarX, RefreshCw, Trash2 } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { fmtUSD, fmtFecha } from "@/lib/format";
import { PageHeader } from "../components/PageShell";
import { Btn } from "../components/Controls";
import Select from "@/components/Select";
import Badge from "../components/Badge";
import KpiCard from "../components/KpiCard";
import Modal from "../components/Modal";
import { useConfirmar } from "../components/Confirmar";
import { useToast } from "../components/Toast";
import { estadoArrendamiento } from "../ui/estados";
import { cn } from "../ui/cn";
import type { Arrendamiento } from "@/data/types";

const inputCls =
  "h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15";

// Estados posibles de un contrato (deriva del tipo, sin inventar campos)
const ESTADOS_ARR: Arrendamiento["estado"][] = ["vigente", "por_vencer", "vencido"];

// El importe se administra a nivel anual en el modelo; la inmobiliaria urbana razona en mensual.
const mensualDe = (anualUSD: number) => Math.round(anualUSD / 12);

export default function Arrendamientos() {
  const { push } = useToast();
  // Confirmar por modal del sistema, cero `window.confirm` (pedido de Juani, 12-ago).
  const { confirmar, dialogo } = useConfirmar();
  const { arrendamientos: allArr, getProp, propiedades, addArrendamiento, updateArrendamiento, deleteArrendamiento } = useData();
  const [open, setOpen] = useState(false);

  const vacio = { arrendatario: "", campoId: "", metros: "", mensualUSD: "", inicioISO: "", vencimientoISO: "" };
  const [form, setForm] = useState(vacio);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const crear = async () => {
    if (!form.arrendatario.trim()) { push("Poné el nombre del inquilino", "error"); return; }
    const inicio = form.inicioISO || new Date().toISOString().slice(0, 10);
    let venc = form.vencimientoISO;
    if (!venc) { const d = new Date(inicio); d.setFullYear(d.getFullYear() + 1); venc = d.toISOString().slice(0, 10); }
    const a: Arrendamiento = {
      id: "ARR-" + Date.now().toString(36),
      campoId: form.campoId || (propiedades[0]?.id ?? ""),
      arrendatario: form.arrendatario.trim(),
      hectareas: Number(form.metros) || 0, // el campo guarda la superficie (m²) del inmueble urbano
      valorAnualUSD: (Number(form.mensualUSD) || 0) * 12, // se ingresa el alquiler mensual, se guarda anualizado
      inicioISO: inicio,
      vencimientoISO: venc,
      estado: "vigente",
    };
    await addArrendamiento(a);
    setForm(vacio);
    setOpen(false);
    push("Contrato registrado ✓", "success");
  };

  const cambiarEstado = (id: string, estado: Arrendamiento["estado"]) => {
    updateArrendamiento(id, { estado });
    push(`Contrato movido a “${estadoArrendamiento[estado].label}”`, "info");
  };

  // El borrado y el aviso viven DENTRO de onOk: el modal es asíncrono, si algo
  // queda afuera se borraría el contrato sin preguntar.
  const eliminar = (a: Arrendamiento) =>
    confirmar({
      titulo: `¿Eliminar el contrato de ${a.arrendatario}?`,
      detalle: `${fmtUSD(mensualDe(a.valorAnualUSD))}/mes, con vencimiento el ${fmtFecha(a.vencimientoISO)}. Se borra del sistema y no se puede deshacer.`,
      boton: "Eliminar",
      peligro: true,
      onOk: async () => {
        await deleteArrendamiento(a.id);
        push("Contrato eliminado", "success");
      },
    });

  const renovar = async (a: Arrendamiento) => {
    const inicio = new Date();
    const venc = new Date(inicio);
    venc.setFullYear(venc.getFullYear() + 1);
    await updateArrendamiento(a.id, {
      inicioISO: inicio.toISOString().slice(0, 10),
      vencimientoISO: venc.toISOString().slice(0, 10),
      estado: "vigente",
    });
    push(`Contrato de ${a.arrendatario} renovado por 12 meses ✓`, "success");
  };

  const ingresosMensuales = allArr
    .filter((a) => a.estado !== "vencido")
    .reduce((s, a) => s + mensualDe(a.valorAnualUSD), 0);
  const vigentes = allArr.filter((a) => a.estado === "vigente").length;
  const porVencer = allArr.filter((a) => a.estado === "por_vencer").length;
  const vencidos = allArr.filter((a) => a.estado === "vencido").length;

  const alertas = allArr.filter((a) => a.estado !== "vigente");

  return (
    <div>
      <PageHeader
        title="Alquileres y contratos"
        subtitle={`${allArr.length} contratos · ${vigentes} vigentes`}
        actions={
          <Btn variant="primary" onClick={() => setOpen(true)}>
            <FileSignature size={16} /> Nuevo contrato
          </Btn>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Renta mensual" value={fmtUSD(ingresosMensuales, { short: true })} icon={DollarSign} accent="field" hint="contratos activos" />
        <KpiCard label="Por vencer" value={`${porVencer}`} icon={AlertTriangle} accent="wheat" hint="renovar pronto" />
        <KpiCard label="Vencidos" value={`${vencidos}`} icon={CalendarX} accent="clay" hint="requieren acción" />
      </div>

      {/* banda de alerta */}
      {alertas.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand/[0.08] p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-brand" />
          <div className="text-sm">
            <p className="font-semibold text-graph">Atención: {alertas.length} contrato{alertas.length > 1 ? "s" : ""} requiere{alertas.length > 1 ? "n" : ""} gestión</p>
            <p className="mt-0.5 text-graph-400">
              {porVencer > 0 && `${porVencer} por vencer en los próximos meses`}
              {porVencer > 0 && vencidos > 0 && " · "}
              {vencidos > 0 && `${vencidos} vencido${vencidos > 1 ? "s" : ""} a regularizar`}
              .
            </p>
          </div>
        </div>
      )}

      <div className="pcard overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-graph/[0.07] bg-graph/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-graph-400">
                <th className="px-5 py-3">Propiedad / Inquilino</th>
                <th className="px-5 py-3 text-right">Alquiler mensual</th>
                <th className="px-5 py-3">Inicio</th>
                <th className="px-5 py-3">Vencimiento</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graph/[0.07]">
              {allArr.map((a) => {
                const campo = getProp(a.campoId);
                const e = estadoArrendamiento[a.estado];
                const alerta = a.estado !== "vigente";
                return (
                  <tr
                    key={a.id}
                    className={cn("transition hover:bg-graph/[0.03]", a.estado === "vencido" && "bg-red-500/[0.06]")}
                  >
                    <td className="px-5 py-3.5">
                      <p className="flex items-center gap-1.5 font-semibold text-graph">
                        {alerta && <AlertTriangle size={13} className={a.estado === "vencido" ? "text-red-700" : "text-brand"} />}
                        {a.arrendatario}
                      </p>
                      <p className="text-xs text-graph-400">{campo?.zona ?? a.campoId} · {a.id}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-display font-semibold text-graph">
                      {fmtUSD(mensualDe(a.valorAnualUSD))}<span className="text-xs font-normal text-graph-400">/mes</span>
                    </td>
                    <td className="px-5 py-3.5 text-graph-400">{fmtFecha(a.inicioISO)}</td>
                    <td className={cn("px-5 py-3.5 font-medium", a.estado === "vencido" ? "text-red-700" : a.estado === "por_vencer" ? "text-brand" : "text-graph-400")}>
                      {fmtFecha(a.vencimientoISO)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Badge tone={e.tone} dot>{e.label}</Badge>
                        <Select
                          value={a.estado}
                          onChange={(v) => cambiarEstado(a.id, v as Arrendamiento["estado"])}
                          options={ESTADOS_ARR.map((s) => ({ value: s, label: estadoArrendamiento[s].label }))}
                          size="sm"
                          align="right"
                          className="w-36"
                          triggerClassName="font-medium text-graph-500"
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Btn variant="soft" onClick={() => renovar(a)} className="h-9 px-3 text-xs">
                          <RefreshCw size={14} /> Renovar
                        </Btn>
                        <button
                          onClick={() => eliminar(a)}
                          title="Eliminar contrato"
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-graph/10 text-graph-400 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
        title="Nuevo contrato"
        subtitle="Registrá un alquiler"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setOpen(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={crear}>Guardar contrato</Btn>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); crear(); }}>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Inquilino</span>
            <input className={inputCls} placeholder="Nombre o razón social" value={form.arrendatario} onChange={(e) => set("arrendatario", e.target.value)} autoFocus />
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
            <span className="mb-1 block text-xs font-semibold text-graph-400">Superficie (m²)</span>
            <input type="number" className={inputCls} placeholder="80" value={form.metros} onChange={(e) => set("metros", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Alquiler mensual (U$S)</span>
            <input type="number" className={inputCls} placeholder="1200" value={form.mensualUSD} onChange={(e) => set("mensualUSD", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Inicio</span>
            <input type="date" className={inputCls} value={form.inicioISO} onChange={(e) => set("inicioISO", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Vencimiento</span>
            <input type="date" className={inputCls} value={form.vencimientoISO} onChange={(e) => set("vencimientoISO", e.target.value)} />
          </label>
        </form>
      </Modal>

      {/* Confirmación de borrado — también del sistema, no del navegador. */}
      {dialogo}
    </div>
  );
}
