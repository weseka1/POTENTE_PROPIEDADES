import { useState } from "react";
import { Plus, Calculator, Clock, CheckCircle2 } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { hoyISO } from "@/lib/fechas";
import { fmtUSD, fmtFecha, fmtHa } from "@/lib/format";
import type { Aptitud, Tasacion } from "@/data/types";
import { PageHeader } from "../components/PageShell";
import { Btn } from "../components/Controls";
import Badge from "../components/Badge";
import KpiCard from "../components/KpiCard";
import Modal from "../components/Modal";
import { useToast } from "../components/Toast";
import { estadoTasacion } from "../ui/estados";
import { cn } from "../ui/cn";

const inputCls =
  "h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15";

export default function Tasaciones() {
  const { push } = useToast();
  const { tasaciones: allTas, addTasacion } = useData();
  const [open, setOpen] = useState(false);

  const vacio = { solicitante: "", contacto: "", zona: "", hectareas: "", aptitud: "agrícola" as Aptitud };
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
      hectareas: Number(form.hectareas) || 0,
      aptitud: form.aptitud,
      valorEstimadoUSD: null,
      estado: "solicitada",
    };
    await addTasacion(t);
    setForm(vacio);
    setOpen(false);
    push("Tasación registrada como “Solicitada” ✓", "success");
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
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-graph/[0.07] bg-graph/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-graph-400">
                <th className="px-5 py-3">Solicitante</th>
                <th className="px-5 py-3">Zona</th>
                <th className="px-5 py-3 text-right">Superficie</th>
                <th className="px-5 py-3">Aptitud</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3 text-right">Valor estimado</th>
                <th className="px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graph/[0.07]">
              {allTas.map((t) => {
                const e = estadoTasacion[t.estado];
                return (
                  <tr key={t.id} className="transition hover:bg-graph/[0.03]">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-graph">{t.solicitante}</p>
                      <p className="text-xs text-graph-400">{t.contacto}</p>
                    </td>
                    <td className="px-5 py-3.5 text-graph-500">{t.zona}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-graph">{fmtHa(t.hectareas)}</td>
                    <td className="px-5 py-3.5 capitalize text-graph-500">{t.aptitud}</td>
                    <td className="px-5 py-3.5 text-graph-400">{fmtFecha(t.fechaISO)}</td>
                    <td className={cn("px-5 py-3.5 text-right font-display font-semibold", t.valorEstimadoUSD ? "text-graph" : "text-graph-400")}>
                      {t.valorEstimadoUSD ? fmtUSD(t.valorEstimadoUSD, { short: true }) : "Pendiente"}
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
            <input className={inputCls} placeholder="Partido / localidad" value={form.zona} onChange={(e) => set("zona", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Hectáreas</span>
            <input type="number" className={inputCls} placeholder="500" value={form.hectareas} onChange={(e) => set("hectareas", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Aptitud</span>
            <select className={inputCls} value={form.aptitud} onChange={(e) => set("aptitud", e.target.value)}>
              <option value="agrícola" className="bg-paper-100 text-graph">Agrícola</option>
              <option value="ganadera" className="bg-paper-100 text-graph">Ganadera</option>
              <option value="mixta" className="bg-paper-100 text-graph">Mixta</option>
            </select>
          </label>
        </form>
      </Modal>
    </div>
  );
}
