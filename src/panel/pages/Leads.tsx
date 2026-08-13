import { useState, useMemo } from "react";
import { AlertCircle, UserPlus, MapPin, Trash2 } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import type { EstadoLead, Lead } from "@/data/types";
import { desde } from "@/lib/format";
import { PageHeader, EmptyState } from "../components/PageShell";
import { FilterSelect, Segmented } from "../components/Controls";
import Badge from "../components/Badge";
import Select from "@/components/Select";
import ChannelIcon from "../components/ChannelIcon";
import { useConfirmar } from "../components/Confirmar";
import { useToast } from "../components/Toast";
import { estadoLead, ESTADOS_LEAD, canalLabel } from "../ui/estados";
import { cn } from "../ui/cn";

const RESPONSABLES = ["Sin asignar", "Mateo", "Punta Mogotes", "Chauvín"];

export default function Leads() {
  const { push } = useToast();
  // Confirmar por modal del sistema, nunca con el cartel del navegador
  // (pedido de Juani, 12-ago). Ojo: esto es ASÍNCRONO — el borrado va DENTRO
  // del onOk, si algo queda afuera se ejecuta sin preguntar.
  const { confirmar, dialogo } = useConfirmar();
  const { leads, getProp, updateLead, deleteLead } = useData();
  const [estado, setEstado] = useState("todos");
  const [canal, setCanal] = useState("todos");

  const setEstadoLead_ = (id: string, nuevo: EstadoLead) => {
    updateLead(id, { estado: nuevo });
    push(`Consulta movida a “${estadoLead[nuevo].label}”`, "info");
  };
  const setAsignado = (id: string, asignado: string) => {
    // Derivación del orquestador: asignar a una oficina mueve el lead a esa oficina.
    const oficina = asignado === "Punta Mogotes" ? "puntamogotes" : asignado === "Chauvín" ? "chauvin" : undefined;
    updateLead(id, { asignado, oficina });
    push(`Consulta asignada a ${asignado}`, "success");
  };
  const eliminar = (l: Lead) =>
    confirmar({
      titulo: `¿Eliminar la consulta de ${l.nombre}?`,
      // El dato concreto adelante: quién es y por dónde entró, así nadie borra
      // la consulta equivocada de una lista donde varias se parecen.
      // `filter(Boolean)`: si falta el contacto o entra por un canal nuevo que
      // no está en el diccionario, el cartel no muestra huecos ni "undefined".
      detalle: `${[l.contacto, canalLabel[l.canal] ?? l.canal, desde(l.fechaISO)].filter(Boolean).join(" · ")}. Se borra de la bandeja y no se puede deshacer.`,
      boton: "Eliminar",
      peligro: true,
      onOk: async () => {
        await deleteLead(l.id);
        push("Consulta eliminada", "success");
      },
    });

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
                    <Select
                      value={l.estado}
                      onChange={(v) => setEstadoLead_(l.id, v as EstadoLead)}
                      options={ESTADOS_LEAD.map((s) => ({ value: s, label: estadoLead[s].label }))}
                      size="sm"
                      align="right"
                      className="w-36"
                      triggerClassName="font-medium text-graph-500"
                    />
                    <div className="relative w-44">
                      <UserPlus size={13} className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-graph-400" />
                      <Select
                        value={l.asignado}
                        onChange={(v) => setAsignado(l.id, v)}
                        options={RESPONSABLES.map((r) => ({ value: r, label: r }))}
                        size="sm"
                        align="right"
                        triggerClassName="pl-7 font-medium text-graph-500"
                      />
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

      {/* Confirmación de borrado — del sistema, no del navegador. */}
      {dialogo}
    </div>
  );
}
