import { useMemo, useState } from "react";
import { Pencil, Sparkles, ChevronRight, CalendarDays } from "lucide-react";
import type { ReservaTemporada, UnidadTemporada } from "@/data/types";
import { fmtARS } from "@/lib/format";
import { cn } from "../ui/cn";

// Estados que ocupan un día (la cancelada libera).
const OCUPA: ReservaTemporada["estado"][] = ["senada", "confirmada", "en_curso", "finalizada"];
const COLOR: Record<string, { bar: string; cell: string; dot: string }> = {
  senada:     { bar: "bg-amber-500",  cell: "bg-amber-500/20 text-amber-800 ring-amber-500/30", dot: "bg-amber-500" },
  confirmada: { bar: "bg-brand",      cell: "bg-brand/20 text-brand-700 ring-brand/30",         dot: "bg-brand" },
  en_curso:   { bar: "bg-sea",        cell: "bg-sea/20 text-sea ring-sea/40",                   dot: "bg-sea" },
  finalizada: { bar: "bg-graph/40",   cell: "bg-graph/[0.10] text-graph-500 ring-graph/15",     dot: "bg-graph/40" },
};

// Meses de la temporada (dic 2026 → mar 2027).
const MESES = [
  { y: 2026, m: 11, label: "Diciembre 2026" },
  { y: 2027, m: 0, label: "Enero 2027" },
  { y: 2027, m: 1, label: "Febrero 2027" },
  { y: 2027, m: 2, label: "Marzo 2027" },
];
const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const TEMP_DESDE = "2026-12-01";
const TEMP_HASTA = "2027-03-31";

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const diasEnMes = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
// Lunes = 0 … Domingo = 6
const dowLunes = (y: number, m: number, d: number) => (new Date(y, m, d).getDay() + 6) % 7;
const fmtDia = (isoStr: string) => {
  const [, mm, dd] = isoStr.split("-");
  return `${Number(dd)}/${Number(mm)}`;
};

type Props = {
  unidades: UnidadTemporada[];
  reservas: ReservaTemporada[];
  fotoDe: (u: UnidadTemporada) => string | undefined;
  tituloDe: (u: UnidadTemporada) => string;
  precioSugerido: (u: UnidadTemporada, desdeISO: string, hastaISO: string) => number;
  onReservar: (u: UnidadTemporada, desdeISO: string, hastaISO: string) => void;
  onVerReserva: (reservaId: string) => void;
  onEditUnidad: (u: UnidadTemporada) => void;
  onToggleLimpieza: (u: UnidadTemporada) => void;
};

export default function CalendarioTemporada({
  unidades, reservas, fotoDe, tituloDe, precioSugerido,
  onReservar, onVerReserva, onEditUnidad, onToggleLimpieza,
}: Props) {
  const [selId, setSelId] = useState<string>(unidades[0]?.id ?? "");
  const [desde, setDesde] = useState<string | null>(null); // check-in elegido, esperando salida
  const [aviso, setAviso] = useState<string>("");

  const sel = unidades.find((u) => u.id === selId) ?? unidades[0] ?? null;

  // Reservas vivas por unidad.
  const vivasDe = (uId: string) => reservas.filter((r) => r.unidadId === uId && OCUPA.includes(r.estado));

  // ¿Qué reserva ocupa este día de la unidad seleccionada? (check-out libre)
  const reservaEnDia = (uId: string, dISO: string) =>
    vivasDe(uId).find((r) => r.desdeISO <= dISO && dISO < r.hastaISO);

  // Próximo hueco libre desde hoy-de-temporada, para la tarjeta de la unidad.
  const proximoHueco = (uId: string): string => {
    const vivas = vivasDe(uId).slice().sort((a, b) => a.desdeISO.localeCompare(b.desdeISO));
    let cursor = TEMP_DESDE;
    for (const r of vivas) {
      if (cursor < r.desdeISO) return `libre desde el ${fmtDia(cursor)}`;
      if (r.hastaISO > cursor) cursor = r.hastaISO;
    }
    return cursor <= TEMP_HASTA ? `libre desde el ${fmtDia(cursor)}` : "sin fechas libres";
  };

  // Segmentos de la tira de disponibilidad (dic→mar): un pixel por día pintado por estado.
  const totalDias = useMemo(() => {
    const a = new Date(TEMP_DESDE + "T00:00:00").getTime();
    const b = new Date(TEMP_HASTA + "T00:00:00").getTime();
    return Math.round((b - a) / 86_400_000) + 1;
  }, []);

  const seleccionValida = (uId: string, a: string, b: string): boolean => {
    // ningún día del rango [a, b) puede estar ocupado
    const cursor = new Date(a + "T00:00:00");
    const fin = new Date(b + "T00:00:00");
    while (cursor < fin) {
      if (reservaEnDia(uId, cursor.toISOString().slice(0, 10))) return false;
      cursor.setDate(cursor.getDate() + 1);
    }
    return true;
  };

  const clickDia = (dISO: string) => {
    if (!sel) return;
    setAviso("");
    const r = reservaEnDia(sel.id, dISO);
    if (r) { onVerReserva(r.id); setDesde(null); return; }
    if (!desde) { setDesde(dISO); return; }
    if (dISO <= desde) { setDesde(dISO); return; } // re-arrancar la selección
    if (!seleccionValida(sel.id, desde, dISO)) {
      setAviso("Ese rango pisa una reserva. Elegí fechas libres.");
      setDesde(null);
      return;
    }
    onReservar(sel, desde, dISO);
    setDesde(null);
  };

  if (!sel) {
    return (
      <div className="pcard grid place-items-center py-16 text-center text-sm text-graph-400">
        Todavía no hay propiedades en la temporada. Tocá “Sumar propiedad”.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
      {/* ── Lista de unidades ── */}
      <aside className="pcard max-h-[640px] space-y-1.5 overflow-y-auto p-2">
        {unidades.map((u) => {
          const activa = u.id === sel.id;
          const vivas = vivasDe(u.id);
          const ocupadosDia = new Set<string>();
          vivas.forEach((r) => {
            const c = new Date(r.desdeISO + "T00:00:00");
            const f = new Date(r.hastaISO + "T00:00:00");
            while (c < f) { ocupadosDia.add(c.toISOString().slice(0, 10) + "|" + r.estado); c.setDate(c.getDate() + 1); }
          });
          return (
            <button
              key={u.id}
              onClick={() => { setSelId(u.id); setDesde(null); setAviso(""); }}
              className={cn(
                "w-full rounded-xl border p-2.5 text-left transition",
                activa ? "border-brand/40 bg-brand/[0.05]" : "border-transparent hover:bg-graph/[0.03]",
                !u.activa && "opacity-60"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-graph/[0.06]">
                  {fotoDe(u) ? <img src={fotoDe(u)} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-tight text-graph">{tituloDe(u)}</p>
                  <p className="truncate text-[11px] text-graph-400">{u.barrio} · {u.ambientes} amb · {u.capacidad} pers</p>
                </div>
                <ChevronRight size={15} className={cn("shrink-0 text-graph-300", activa && "text-brand")} />
              </div>
              {/* tira de disponibilidad dic→mar */}
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-graph/[0.06]">
                {Array.from({ length: totalDias }).map((_, i) => {
                  const d = new Date(TEMP_DESDE + "T00:00:00");
                  d.setDate(d.getDate() + i);
                  const key = d.toISOString().slice(0, 10);
                  const hit = [...ocupadosDia].find((x) => x.startsWith(key + "|"));
                  const est = hit?.split("|")[1];
                  return <span key={i} className={cn("h-full flex-1", est ? COLOR[est]?.bar : "bg-transparent")} />;
                })}
              </div>
              <p className="mt-1.5 flex items-center justify-between text-[10.5px] text-graph-400">
                <span>{proximoHueco(u.id)}</span>
                <span className="font-semibold text-graph-500">{fmtARS(u.tarifaNocheARS, { short: true })}/noche</span>
              </p>
            </button>
          );
        })}
      </aside>

      {/* ── Calendario de la unidad seleccionada ── */}
      <section className="pcard p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold text-graph">{tituloDe(sel)}</p>
            <p className="text-[12px] text-graph-400">
              {sel.barrio} · hasta {sel.capacidad} personas
              {sel.minNoches ? ` · mín. ${sel.minNoches} noches` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => onEditUnidad(sel)} aria-label="Editar unidad" className="grid h-8 w-8 place-items-center rounded-lg text-graph-400 ring-1 ring-inset ring-graph/10 transition hover:bg-graph/[0.06] hover:text-graph">
              <Pencil size={15} />
            </button>
            <button
              onClick={() => onToggleLimpieza(sel)}
              aria-label="Marcar en limpieza"
              title={sel.enLimpieza ? "Limpieza y llaves pendientes" : "Marcar en limpieza (turnover)"}
              className={cn("grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset transition",
                sel.enLimpieza ? "bg-amber-500/15 text-amber-700 ring-amber-500/30" : "text-graph-400 ring-graph/10 hover:bg-graph/[0.06] hover:text-graph")}
            >
              <Sparkles size={15} />
            </button>
          </div>
        </div>

        {/* aviso / instrucción */}
        <div className={cn("mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]",
          aviso ? "bg-red-500/10 text-red-700"
            : desde ? "bg-brand/[0.06] text-brand-700"
            : "bg-graph/[0.03] text-graph-500")}>
          <CalendarDays size={14} className="shrink-0" />
          {aviso
            ? aviso
            : desde
            ? <>Entrada: <b className="mx-1">{fmtDia(desde)}</b> · ahora tocá el día de salida</>
            : "Tocá el día de entrada, después el de salida. Los días pintados están ocupados."}
        </div>

        {/* meses */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {MESES.map((mes) => {
            const nd = diasEnMes(mes.y, mes.m);
            const offset = dowLunes(mes.y, mes.m, 1);
            return (
              <div key={mes.label} className="rounded-xl border border-graph/[0.07] p-3">
                <p className="mb-2 text-center text-[12px] font-semibold capitalize text-graph">{mes.label}</p>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {DOW.map((d, i) => <span key={i} className="text-[9px] font-bold uppercase text-graph-300">{d}</span>)}
                  {Array.from({ length: offset }).map((_, i) => <span key={"e" + i} />)}
                  {Array.from({ length: nd }).map((_, i) => {
                    const day = i + 1;
                    const dISO = iso(mes.y, mes.m, day);
                    const r = reservaEnDia(sel.id, dISO);
                    const est = r?.estado;
                    const esDesde = desde === dISO;
                    const enPreview = desde && dISO > desde && !r;
                    return (
                      <button
                        key={day}
                        onClick={() => clickDia(dISO)}
                        title={r ? `${r.inquilino} · ${fmtDia(r.desdeISO)} al ${fmtDia(r.hastaISO)}` : "Libre"}
                        className={cn(
                          "grid aspect-square place-items-center rounded-md text-[11px] font-medium ring-1 ring-inset transition",
                          est ? COLOR[est]?.cell
                            : esDesde ? "bg-brand text-white ring-brand"
                            : enPreview ? "bg-brand/[0.08] text-brand-700 ring-brand/20"
                            : "text-graph-600 ring-transparent hover:bg-brand/[0.06] hover:ring-brand/30"
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
