import { useState, useMemo } from "react";
import { AlertCircle, UserPlus, MapPin, Trash2 } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import type { EstadoLead, Lead } from "@/data/types";
import { desde } from "@/lib/format";
import { PageHeader, EmptyState } from "../components/PageShell";
import { FilterSelect, Segmented } from "../components/Controls";
import Badge from "../components/Badge";
import ChannelIcon from "../components/ChannelIcon";
import { useToast } from "../components/Toast";
import { estadoLead, ESTADOS_LEAD, canalLabel } from "../ui/estados";
import { cn } from "../ui/cn";

const RESPONSABLES = ["Sin asignar", "Mateo", "Punta Mogotes", "Chauvín"];

export default function Leads() {
  const { push } = useToast();
  const { leads, getProp, updateLead, deleteLead } = useData();
  const [estado, setEstado] = useState("todos");
  const [canal, setCanal] = useState("todos");

  const setEstadoLead_ = (id: string, nuevo: EstadoLead) => {
    updateLead(id, { estado: nuevo });
    push(`Consulta movida a “${estadoLead[nuevo].label}”`, "info");
  };
  const setAsignado = (id: string, asignado: string) => {
    updateLead(id, { asignado });
    push(`Consulta asignada a ${asignado}`, "success");
  };
  const eliminar = (l: Lead) => {
    if (window.confirm(`¿Eliminar la consulta de ${l.nombre}? No se puede deshacer.`)) {
      deleteLead(l.id);
      push("Consulta eliminada", "success");
    }
  };

  const filtrados = useMemo(
    () =>
      leads
        .filter((l) => (estado === "todos" ? true : l.estado === estado))
        .filter((l) => (canal === "todos" ? true : l.canal === canal))
        .sort((a, b) => +new Date(b.fechaISO) - +new Date(a.fechaISO)),
    [leads, estado, canal]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: leads.length };
    ESTADOS_LEAD.forEach((e) => (c[e] = leads.filter((l) => l.estado === e).length));
    return c;
  }, [leads]);

  return (
    <div>
      <PageHeader
        title="Bandeja IA · Consultas"
        subtitle="La IA intercepta y unifica las conversaciones de todos los canales (WhatsApp, web, mail, teléfono, portales)."
        actions={
          <FilterSelect
            value={canal}
            onChange={setCanal}
            options={[
              { value: "todos", label: "Canal: todos" },
              { value: "web", label: "Web propia" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "mail", label: "Mail" },
              { value: "telefono", label: "Teléfono" },
              { value: "portal", label: "Portales" },
            ]}
          />
        }
      />

      <div className="mb-5">
        <Segmented
          value={estado}
          onChange={setEstado}
          options={[
            { value: "todos", label: "Todas", count: counts.todos },
            ...ESTADOS_LEAD.map((e) => ({ value: e, label: estadoLead[e].label, count: counts[e] })),
          ]}
        />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState msg="No hay consultas con esos filtros." />
      ) : (
        <div className="space-y-3">
          {filtrados.map((l) => {
            const campo = l.campoId ? getProp(l.campoId) : null;
            const e = estadoLead[l.estado];
            const urgente = l.estado === "nueva" && l.asignado === "Sin asignar";
            return (
              <div
                key={l.id}
                className={cn(
                  "pcard p-4 transition",
                  urgente && "border-brand/40 ring-1 ring-inset ring-brand/20"
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex flex-1 items-start gap-3">
                    <ChannelIcon canal={l.canal} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-graph">{l.nombre}</p>
                        {urgente && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand">
                            <AlertCircle size={11} /> Sin asignar
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-graph-400">
                        {l.contacto} · {canalLabel[l.canal]} · {desde(l.fechaISO)}
                      </p>
                      <p className="mt-1.5 text-sm text-graph-500">{l.notas}</p>
                      {campo && (
                        <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-graph/[0.06] px-2 py-0.5 text-xs font-medium text-graph-500">
                          <MapPin size={11} className="text-brand" /> {campo.titulo}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* controles */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge tone={e.tone} dot>{e.label}</Badge>
                    <select
                      value={l.estado}
                      onChange={(ev) => setEstadoLead_(l.id, ev.target.value as EstadoLead)}
                      className="h-9 rounded-lg border border-graph/10 bg-graph/[0.04] px-2.5 text-xs font-medium text-graph-500 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
                    >
                      {ESTADOS_LEAD.map((s) => (
                        <option key={s} value={s} className="bg-paper-100 text-graph">{estadoLead[s].label}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <UserPlus size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-graph-400" />
                      <select
                        value={l.asignado}
                        onChange={(ev) => setAsignado(l.id, ev.target.value)}
                        className="h-9 rounded-lg border border-graph/10 bg-graph/[0.04] pl-7 pr-2.5 text-xs font-medium text-graph-500 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
                      >
                        {RESPONSABLES.map((r) => (
                          <option key={r} value={r} className="bg-paper-100 text-graph">{r}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => eliminar(l)}
                      title="Eliminar consulta"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-graph/10 text-graph-400 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
