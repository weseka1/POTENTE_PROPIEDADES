import { ChevronLeft, ChevronRight, User, TrendingUp } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import type { EtapaPipeline } from "@/data/types";
import { fmtUSD } from "@/lib/format";
import { PageHeader } from "../components/PageShell";
import CampoThumb from "../components/CampoThumb";
import { useToast } from "../components/Toast";
import { ETAPAS_PIPELINE, etapaPipeline } from "../ui/estados";
import { cn } from "../ui/cn";
import { useDragScroll } from "../ui/useDragScroll";

const colHeader: Record<string, string> = {
  consulta: "border-t-white/30",
  visita: "border-t-sky-400",
  oferta: "border-t-brand",
  reserva: "border-t-brand-600",
  boleto: "border-t-brand-400",
  escritura: "border-t-brand-400",
};

export default function Pipeline() {
  const { push } = useToast();
  const { operaciones: ops, getProp, updateOperacion } = useData();
  const scrollRef = useDragScroll<HTMLDivElement>();

  const mover = (id: string, dir: -1 | 1) => {
    const o = ops.find((x) => x.id === id);
    if (!o) return;
    const idx = ETAPAS_PIPELINE.indexOf(o.etapa);
    const next = Math.min(Math.max(idx + dir, 0), ETAPAS_PIPELINE.length - 1);
    if (next === idx) return;
    updateOperacion(id, { etapa: ETAPAS_PIPELINE[next] as EtapaPipeline });
    push(`Operación movida a “${etapaPipeline[ETAPAS_PIPELINE[next]].label}”`, "info");
  };

  const totalPipeline = ops.reduce((a, o) => a + o.valorUSD, 0);

  return (
    <div>
      <PageHeader
        title="Embudo de ventas"
        subtitle={`${ops.length} operaciones en curso · ${fmtUSD(totalPipeline, { short: true })} en juego`}
      />

      <div ref={scrollRef} className="no-scrollbar flex cursor-grab gap-4 overflow-x-auto pb-4 select-none">
        {ETAPAS_PIPELINE.map((etapa) => {
          const cards = ops.filter((o) => o.etapa === etapa);
          const suma = cards.reduce((a, o) => a + o.valorUSD, 0);
          return (
            <div key={etapa} className="flex w-72 shrink-0 flex-col">
              <div className={cn("rounded-t-xl border border-b-0 border-graph/[0.07] border-t-2 bg-graph/[0.04] px-3 pt-3", colHeader[etapa])}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-graph">{etapaPipeline[etapa].label}</span>
                  <span className="rounded-full bg-graph/[0.08] px-2 py-0.5 text-xs font-bold text-graph-400">{cards.length}</span>
                </div>
                <p className="mt-0.5 pb-2 text-xs font-medium text-graph-400">{fmtUSD(suma, { short: true })}</p>
              </div>

              <div className="flex-1 space-y-2.5 rounded-b-xl border border-t-0 border-graph/[0.07] bg-graph/[0.02] p-2.5">
                {cards.length === 0 && (
                  <p className="py-6 text-center text-xs text-graph-400">Sin operaciones</p>
                )}
                {cards.map((o) => {
                  const campo = getProp(o.campoId);
                  const comision = (o.valorUSD * o.comisionPct) / 100;
                  const idx = ETAPAS_PIPELINE.indexOf(o.etapa);
                  return (
                    <div key={o.id} className="pcard p-3 transition hover:border-graph/[0.14]">
                      <div className="flex items-center gap-2.5">
                        <CampoThumb src={campo?.fotos?.[0]} alt="" className="h-9 w-12 shrink-0 ring-1 ring-graph/10" />
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-semibold text-graph">{campo?.zona ?? o.campoId}</p>
                          <p className="line-clamp-1 text-xs text-graph-400">{o.clienteNombre}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-display text-base font-semibold text-graph">{fmtUSD(o.valorUSD, { short: true })}</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[11px] font-semibold text-brand-400">
                          <TrendingUp size={11} /> {fmtUSD(comision, { short: true })}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-graph/[0.07] pt-2">
                        <span className="inline-flex items-center gap-1 truncate text-[11px] text-graph-400">
                          <User size={11} /> {o.responsable}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            disabled={idx === 0}
                            onClick={() => mover(o.id, -1)}
                            className="rounded-md p-1 text-graph-400 transition hover:bg-graph/5 hover:text-graph disabled:opacity-25"
                            aria-label="Atrás"
                          >
                            <ChevronLeft size={15} />
                          </button>
                          <button
                            disabled={idx === ETAPAS_PIPELINE.length - 1}
                            onClick={() => mover(o.id, 1)}
                            className="rounded-md p-1 text-graph-400 transition hover:bg-graph/5 hover:text-graph disabled:opacity-25"
                            aria-label="Avanzar"
                          >
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
