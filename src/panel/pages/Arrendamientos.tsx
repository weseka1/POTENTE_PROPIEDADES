import { useState } from "react";
import { AlertTriangle, FileSignature, DollarSign, CalendarX } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { fmtUSD, fmtFecha, fmtHa } from "@/lib/format";
import { PageHeader } from "../components/PageShell";
import { Btn } from "../components/Controls";
import Badge from "../components/Badge";
import KpiCard from "../components/KpiCard";
import Modal from "../components/Modal";
import { useToast } from "../components/Toast";
import { estadoArrendamiento } from "../ui/estados";
import { cn } from "../ui/cn";
import type { Arrendamiento } from "@/data/types";

const inputCls =
  "h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15";

export default function Arrendamientos() {
  const { push } = useToast();
  const { arrendamientos: allArr, getProp, propiedades, addArrendamiento } = useData();
  const [open, setOpen] = useState(false);

  const vacio = { arrendatario: "", campoId: "", hectareas: "", valorAnualUSD: "", inicioISO: "", vencimientoISO: "" };
  const [form, setForm] = useState(vacio);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const crear = async () => {
    if (!form.arrendatario.trim()) { push("Poné el nombre del arrendatario", "error"); return; }
    const inicio = form.inicioISO || new Date().toISOString().slice(0, 10);
    let venc = form.vencimientoISO;
    if (!venc) { const d = new Date(inicio); d.setFullYear(d.getFullYear() + 1); venc = d.toISOString().slice(0, 10); }
    const a: Arrendamiento = {
      id: "ARR-" + Date.now().toString(36),
      campoId: form.campoId || (propiedades[0]?.id ?? ""),
      arrendatario: form.arrendatario.trim(),
      hectareas: Number(form.hectareas) || 0,
      valorAnualUSD: Number(form.valorAnualUSD) || 0,
      inicioISO: inicio,
      vencimientoISO: venc,
      estado: "vigente",
    };
    await addArrendamiento(a);
    setForm(vacio);
    setOpen(false);
    push("Contrato registrado ✓", "success");
  };

  const ingresosAnuales = allArr
    .filter((a) => a.estado !== "vencido")
    .reduce((s, a) => s + a.valorAnualUSD, 0);
  const porVencer = allArr.filter((a) => a.estado === "por_vencer").length;
  const vencidos = allArr.filter((a) => a.estado === "vencido").length;
  const haTotal = allArr.reduce((s, a) => s + a.hectareas, 0);

  const alertas = allArr.filter((a) => a.estado !== "vigente");

  return (
    <div>
      <PageHeader
        title="Alquileres y contratos"
        subtitle={`${allArr.length} contratos · ${fmtHa(haTotal)} bajo administración`}
        actions={
          <Btn variant="primary" onClick={() => setOpen(true)}>
            <FileSignature size={16} /> Nuevo contrato
          </Btn>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Ingresos anuales" value={fmtUSD(ingresosAnuales, { short: true })} icon={DollarSign} accent="field" hint="contratos vigentes" delta="+6%" />
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
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-graph/[0.07] bg-graph/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-graph-400">
                <th className="px-5 py-3">Propiedad / Arrendatario</th>
                <th className="px-5 py-3 text-right">Superficie</th>
                <th className="px-5 py-3 text-right">Valor anual</th>
                <th className="px-5 py-3">Inicio</th>
                <th className="px-5 py-3">Vencimiento</th>
                <th className="px-5 py-3">Estado</th>
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
                    <td className="px-5 py-3.5 text-right font-medium text-graph">{fmtHa(a.hectareas)}</td>
                    <td className="px-5 py-3.5 text-right font-display font-semibold text-graph">{fmtUSD(a.valorAnualUSD)}</td>
                    <td className="px-5 py-3.5 text-graph-400">{fmtFecha(a.inicioISO)}</td>
                    <td className={cn("px-5 py-3.5 font-medium", a.estado === "vencido" ? "text-red-700" : a.estado === "por_vencer" ? "text-brand" : "text-graph-400")}>
                      {fmtFecha(a.vencimientoISO)}
                    </td>
                    <td className="px-5 py-3.5"><Badge tone={e.tone} dot>{e.label}</Badge></td>
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
            <span className="mb-1 block text-xs font-semibold text-graph-400">Arrendatario</span>
            <input className={inputCls} placeholder="Nombre o razón social" value={form.arrendatario} onChange={(e) => set("arrendatario", e.target.value)} autoFocus />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Propiedad</span>
            <select className={inputCls} value={form.campoId} onChange={(e) => set("campoId", e.target.value)}>
              <option value="" className="bg-paper-100 text-graph">Elegí una propiedad…</option>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id} className="bg-paper-100 text-graph">{p.titulo} · {p.zona}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Hectáreas</span>
            <input type="number" className={inputCls} placeholder="500" value={form.hectareas} onChange={(e) => set("hectareas", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Valor anual (U$S)</span>
            <input type="number" className={inputCls} placeholder="80000" value={form.valorAnualUSD} onChange={(e) => set("valorAnualUSD", e.target.value)} />
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
    </div>
  );
}
