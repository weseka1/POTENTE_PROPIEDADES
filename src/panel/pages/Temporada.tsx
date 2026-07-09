import { useMemo, useState } from "react";
import { Building2, Percent, Wallet, BadgeCheck, Waves, Pencil, Users, ArrowRight, Ban, Sparkles } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import type { ReservaTemporada, EstadoReserva, TemporadaTramoId, UnidadTemporada } from "@/data/types";
import type { Propiedad } from "@/data/propiedadTypes";
import { TRAMOS, tramoById, tarifaDe } from "@/data/temporada";
import { fmtARS } from "@/lib/format";
import { PageHeader } from "../components/PageShell";
import { Btn, Segmented } from "../components/Controls";
import Modal from "../components/Modal";
import KpiCard from "../components/KpiCard";
import { useToast } from "../components/Toast";
import { cn } from "../ui/cn";

const INP =
  "h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15";

// ── Estado de reserva → look de celda / chip (senada=ámbar, confirmada=azul marca,
//    en_curso=celeste mar, finalizada=gris). La cancelada no pinta celda: libera el cupo.
const EST: Record<EstadoReserva, { label: string; cell: string; dot: string; chip: string }> = {
  senada:     { label: "Señada",     cell: "bg-amber-500/15 text-amber-800 ring-amber-500/30 hover:bg-amber-500/25", dot: "bg-amber-500", chip: "border-amber-500/30 bg-amber-500/12 text-amber-700" },
  confirmada: { label: "Confirmada", cell: "bg-brand/15 text-brand-700 ring-brand/30 hover:bg-brand/25",             dot: "bg-brand",     chip: "border-brand/30 bg-brand/[0.08] text-brand-700" },
  en_curso:   { label: "En curso",   cell: "bg-sea/15 text-sea ring-sea/40 hover:bg-sea/25",                         dot: "bg-sea",       chip: "border-sea/40 bg-sea/12 text-sea" },
  finalizada: { label: "Finalizada", cell: "bg-graph/[0.07] text-graph-500 ring-graph/15 hover:bg-graph/[0.12]",     dot: "bg-graph/40",  chip: "border-graph/15 bg-graph/[0.05] text-graph-500" },
  cancelada:  { label: "Cancelada",  cell: "",                                                                       dot: "bg-graph/30",  chip: "border-red-500/20 bg-red-500/10 text-red-700" },
};
// Estados a los que el operador puede mover una reserva desde el detalle (cancelar es un botón aparte).
const ESTADOS_EDIT: EstadoReserva[] = ["senada", "confirmada", "en_curso", "finalizada"];

type Tab = "grilla" | "tarifario" | "rendicion";
type NuevaCtx = { unidadId: string; tramoId: TemporadaTramoId };
type NuevaForm = { inquilino: string; contacto: string; personas: string; monto: string; sena: string; garantia: string };

// Apellido / referencia corta del inquilino para la celda ("Familia Gutiérrez" → "Gutiérrez").
const apellido = (nombre: string) => {
  const p = nombre.trim().split(/\s+/);
  return p[p.length - 1] || nombre;
};
const r10k = (n: number) => Math.round(n / 10_000) * 10_000;

export default function Temporada() {
  const { push } = useToast();
  const {
    unidadesTemporada, reservasTemporada, propiedades,
    updateUnidadTemporada, addReservaTemporada, updateReservaTemporada,
  } = useData();

  const [tab, setTab] = useState<Tab>("grilla");

  // modales
  const [nuevaCtx, setNuevaCtx] = useState<NuevaCtx | null>(null);
  const [form, setForm] = useState<NuevaForm>({ inquilino: "", contacto: "", personas: "2", monto: "", sena: "", garantia: "80000" });
  const setF = (k: keyof NuevaForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [detalleId, setDetalleId] = useState<string | null>(null);

  // edición inline del tarifario
  const [tEdit, setTEdit] = useState<string | null>(null);
  const [tDraft, setTDraft] = useState("");

  const propDe = (u: UnidadTemporada): Propiedad | undefined => propiedades.find((p) => p.id === u.propiedadId);
  const tituloCorto = (u: UnidadTemporada) => propDe(u)?.titulo.split(",")[0] ?? u.id;

  // Reserva ACTIVA por celda (unidad+tramo). La cancelada no cuenta → esa celda queda libre.
  const reservaDe = useMemo(() => {
    const m = new Map<string, ReservaTemporada>();
    for (const r of reservasTemporada) {
      if (r.estado === "cancelada") continue;
      m.set(`${r.unidadId}|${r.tramoId}`, r);
    }
    return m;
  }, [reservasTemporada]);

  // ── KPIs ──
  const activas = useMemo(() => reservasTemporada.filter((r) => r.estado !== "cancelada"), [reservasTemporada]);
  const totalCeldas = unidadesTemporada.length * TRAMOS.length;
  const ocupacion = totalCeldas ? Math.round((activas.length / totalCeldas) * 100) : 0;
  const ingresos = activas.reduce((a, r) => a + r.montoTotalARS, 0);
  const senadas = reservasTemporada.filter((r) => r.estado === "senada").length;

  // ── Nueva reserva ──
  const abrirNueva = (u: UnidadTemporada, tramoId: TemporadaTramoId) => {
    const tarifa = tarifaDe(u, tramoId) ?? 0;
    setNuevaCtx({ unidadId: u.id, tramoId });
    setForm({
      inquilino: "", contacto: "", personas: "2",
      monto: String(tarifa),
      sena: String(r10k(tarifa * 0.3)),
      garantia: "80000",
    });
  };
  const guardarNueva = async () => {
    if (!nuevaCtx) return;
    if (!form.inquilino.trim()) { push("Poné el nombre del inquilino", "error"); return; }
    // Anti doble-reserva: no dejar dos activas en la misma unidad+quincena.
    if (reservaDe.has(`${nuevaCtx.unidadId}|${nuevaCtx.tramoId}`)) {
      push("Esa quincena ya tiene una reserva activa", "error");
      return;
    }
    const monto = Number(form.monto) || 0;
    const r: ReservaTemporada = {
      id: "RSV-" + Date.now(),
      unidadId: nuevaCtx.unidadId,
      tramoId: nuevaCtx.tramoId,
      inquilino: form.inquilino.trim(),
      contacto: form.contacto.trim(),
      personas: Number(form.personas) || 1,
      montoTotalARS: monto,
      senaARS: Number(form.sena) || 0,
      garantiaARS: Number(form.garantia) || 0,
      estado: "senada",
      creadaISO: new Date().toISOString(),
    };
    await addReservaTemporada(r);
    setNuevaCtx(null);
    push("Reserva señada ✓", "success");
  };

  // ── Detalle de reserva ──
  const detalle = detalleId ? reservasTemporada.find((r) => r.id === detalleId) ?? null : null;
  const cambiarEstado = (estado: EstadoReserva) => {
    if (!detalle) return;
    updateReservaTemporada(detalle.id, { estado });
    push(`Reserva movida a “${EST[estado].label}”`, "info");
  };
  const cancelarReserva = () => {
    if (!detalle) return;
    if (!window.confirm("¿Cancelar la reserva? La quincena vuelve a quedar disponible.")) return;
    updateReservaTemporada(detalle.id, { estado: "cancelada" });
    setDetalleId(null);
    push("Reserva cancelada — cupo liberado", "info");
  };

  // ── Tarifario (edición inline) ──
  const abrirTarifa = (u: UnidadTemporada, tramoId: TemporadaTramoId) => {
    setTEdit(`${u.id}|${tramoId}`);
    setTDraft(u.tarifas[tramoId] != null ? String(u.tarifas[tramoId]) : "");
  };
  const guardarTarifa = async (u: UnidadTemporada, tramoId: TemporadaTramoId) => {
    const raw = tDraft.replace(/[^\d]/g, "");
    const tarifas: UnidadTemporada["tarifas"] = { ...u.tarifas };
    if (raw === "") delete tarifas[tramoId];
    else tarifas[tramoId] = Number(raw);
    await updateUnidadTemporada(u.id, { tarifas });
    setTEdit(null);
    push("Tarifa actualizada ✓", "success");
  };

  // ── Rendición al propietario ──
  const rendicion = useMemo(() => {
    const filas = unidadesTemporada.map((u) => {
      const rs = reservasTemporada.filter(
        (r) => r.unidadId === u.id && (r.estado === "confirmada" || r.estado === "finalizada" || r.estado === "en_curso")
      );
      const bruto = rs.reduce((a, r) => a + r.montoTotalARS, 0);
      const comisionPct = u.comisionPct ?? 15;
      const comision = Math.round((bruto * comisionPct) / 100);
      return { u, n: rs.length, bruto, comisionPct, comision, alPropietario: bruto - comision };
    });
    filas.sort((a, b) => b.bruto - a.bruto);
    const tot = filas.reduce(
      (a, f) => ({ bruto: a.bruto + f.bruto, comision: a.comision + f.comision, prop: a.prop + f.alPropietario }),
      { bruto: 0, comision: 0, prop: 0 }
    );
    return { filas, tot };
  }, [unidadesTemporada, reservasTemporada]);

  return (
    <div>
      <PageHeader
        title="Temporada · Verano 2027"
        subtitle="Grilla de disponibilidad, tarifario y rendición del alquiler temporario en la costa"
      />

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Unidades en temporada" value={String(unidadesTemporada.length)} icon={Building2} accent="ink" hint="propiedades publicadas para el verano" />
        <KpiCard label="Ocupación del verano" value={`${ocupacion}%`} icon={Percent} accent="field" hint={`${activas.length} de ${totalCeldas} quincenas reservadas`} />
        <KpiCard label="Ingresos proyectados" value={fmtARS(ingresos, { short: true })} icon={Wallet} accent="wheat" hint="reservas no canceladas" />
        <KpiCard label="Reservas señadas" value={String(senadas)} icon={BadgeCheck} accent="clay" hint="a la espera de confirmar saldo" />
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: "grilla", label: "Disponibilidad" },
            { value: "tarifario", label: "Tarifario" },
            { value: "rendicion", label: "Rendición" },
          ]}
        />
      </div>

      {tab === "grilla" && (
        <>
          {/* Leyenda */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-graph-500">
              <span className="h-2.5 w-2.5 rounded-md border border-dashed border-graph/25 bg-graph/[0.02]" /> Libre
            </span>
            {(["senada", "confirmada", "en_curso", "finalizada"] as EstadoReserva[]).map((e) => (
              <span key={e} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-graph-500">
                <span className={cn("h-2.5 w-2.5 rounded-full", EST[e].dot)} /> {EST[e].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-graph-500">
              <Sparkles size={12} className="text-amber-600" /> En limpieza
            </span>
            <span className="ml-auto text-[11px] text-graph-400">Tocá una celda libre para reservar · una ocupada para ver el detalle</span>
          </div>

          {/* GRILLA */}
          <div className="pcard overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 border-b border-graph/[0.08] bg-paper-100 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-graph-400">
                      Unidad
                    </th>
                    {TRAMOS.map((t) => (
                      <th
                        key={t.id}
                        className={cn(
                          "border-b border-graph/[0.08] px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide",
                          t.pico ? "bg-brand/[0.06] text-brand-700" : "bg-graph/[0.02] text-graph-400"
                        )}
                        title={t.label}
                      >
                        {t.corto}
                        {t.pico && <div className="mt-0.5 text-[8px] font-bold tracking-widest text-brand">PICO</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unidadesTemporada.map((u) => {
                    const p = propDe(u);
                    return (
                      <tr key={u.id} className="group">
                        <td className="sticky left-0 z-10 border-b border-graph/[0.06] bg-paper-100 px-4 py-2.5 group-hover:bg-graph/[0.02]">
                          <div className="flex items-center gap-2.5">
                            <Thumb src={p?.fotos?.[0]} alt={tituloCorto(u)} mar={u.frenteAlMar} />
                            <div className="min-w-0">
                              <p className="max-w-[188px] truncate text-[13px] font-semibold leading-tight text-graph">{tituloCorto(u)}</p>
                              <p className="mt-0.5 truncate text-[11px] text-graph-400">
                                {u.barrio} · {u.ambientes} amb · {u.capacidad} pers
                              </p>
                            </div>
                            {/* Turnover: marcar la unidad "en limpieza" entre un inquilino y el siguiente. */}
                            <button
                              onClick={() => updateUnidadTemporada(u.id, { enLimpieza: !u.enLimpieza })}
                              title={u.enLimpieza ? "Limpieza y llaves pendientes — tocá para marcar lista" : "Marcar en limpieza (turnover)"}
                              className={cn(
                                "ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition",
                                u.enLimpieza
                                  ? "bg-amber-500/15 text-amber-700 ring-amber-500/30"
                                  : "text-graph-400 opacity-0 ring-transparent hover:bg-graph/[0.06] hover:text-graph group-hover:opacity-100"
                              )}
                              aria-label="Marcar en limpieza"
                            >
                              <Sparkles size={14} />
                            </button>
                          </div>
                        </td>
                        {TRAMOS.map((t) => {
                          const r = reservaDe.get(`${u.id}|${t.id}`);
                          if (r) {
                            const st = EST[r.estado];
                            return (
                              <td key={t.id} className="border-b border-graph/[0.06] p-1">
                                <button
                                  onClick={() => setDetalleId(r.id)}
                                  title={`${r.inquilino} · ${st.label} · ${fmtARS(r.montoTotalARS)}`}
                                  className={cn("flex h-[52px] w-full flex-col justify-center gap-0.5 rounded-lg px-2 text-left ring-1 ring-inset transition", st.cell)}
                                >
                                  <span className="truncate text-xs font-semibold leading-tight">{apellido(r.inquilino)}</span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-80">
                                    <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} /> {st.label}
                                  </span>
                                </button>
                              </td>
                            );
                          }
                          const tarifa = tarifaDe(u, t.id);
                          return (
                            <td key={t.id} className="border-b border-graph/[0.06] p-1">
                              <button
                                onClick={() => abrirNueva(u, t.id)}
                                title={`Reservar ${t.label} · ${tarifa != null ? fmtARS(tarifa) : "sin tarifa"}`}
                                className="group/cell flex h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-graph/12 bg-graph/[0.015] transition hover:border-brand/40 hover:bg-brand/[0.04]"
                              >
                                <span className="text-[11px] font-semibold text-graph-500 transition group-hover/cell:text-brand">
                                  {tarifa != null ? fmtARS(tarifa, { short: true }) : "—"}
                                </span>
                                <span className="text-[9px] uppercase tracking-wide text-graph-300 transition group-hover/cell:text-brand/70">libre</span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "tarifario" && (
        <div className="pcard overflow-hidden">
          <div className="border-b border-graph/[0.07] px-5 py-3.5">
            <p className="text-sm font-semibold text-graph">Tarifario por quincena</p>
            <p className="mt-0.5 text-xs text-graph-400">Tocá un valor para editarlo. Los precios impactan en la web y en las nuevas reservas.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 border-b border-graph/[0.08] bg-paper-100 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-graph-400">Unidad</th>
                  {TRAMOS.map((t) => (
                    <th key={t.id} className={cn("border-b border-graph/[0.08] px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide", t.pico ? "bg-brand/[0.06] text-brand-700" : "bg-graph/[0.02] text-graph-400")} title={t.label}>
                      {t.corto}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unidadesTemporada.map((u) => {
                  const p = propDe(u);
                  return (
                    <tr key={u.id} className="group">
                      <td className="sticky left-0 z-10 border-b border-graph/[0.06] bg-paper-100 px-4 py-2.5 group-hover:bg-graph/[0.02]">
                        <div className="flex items-center gap-2.5">
                          <Thumb src={p?.fotos?.[0]} alt={tituloCorto(u)} mar={u.frenteAlMar} />
                          <div className="min-w-0">
                            <p className="max-w-[188px] truncate text-[13px] font-semibold leading-tight text-graph">{tituloCorto(u)}</p>
                            <p className="mt-0.5 truncate text-[11px] text-graph-400">{u.barrio} · {u.ambientes} amb · comisión {u.comisionPct}%</p>
                          </div>
                        </div>
                      </td>
                      {TRAMOS.map((t) => {
                        const key = `${u.id}|${t.id}`;
                        const editando = tEdit === key;
                        const val = u.tarifas[t.id];
                        return (
                          <td key={t.id} className={cn("border-b border-graph/[0.06] px-2 py-2 text-center", t.pico && "bg-brand/[0.03]")}>
                            {editando ? (
                              <input
                                type="number"
                                autoFocus
                                value={tDraft}
                                onChange={(e) => setTDraft(e.target.value)}
                                onBlur={() => guardarTarifa(u, t.id)}
                                onKeyDown={(e) => { if (e.key === "Enter") guardarTarifa(u, t.id); if (e.key === "Escape") setTEdit(null); }}
                                className="h-8 w-[92px] rounded-lg border border-brand/40 bg-graph/[0.04] px-2 text-right text-xs text-graph outline-none focus:ring-2 focus:ring-brand/15"
                              />
                            ) : (
                              <button
                                onClick={() => abrirTarifa(u, t.id)}
                                title="Editar tarifa"
                                className={cn("group/t inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-graph/[0.06]", val != null ? "text-graph" : "text-graph-400")}
                              >
                                {val != null ? fmtARS(val, { short: true }) : "—"}
                                <Pencil size={11} className="text-graph-400 opacity-0 transition group-hover/t:opacity-100" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "rendicion" && (
        <div className="pcard overflow-hidden">
          <div className="border-b border-graph/[0.07] px-5 py-3.5">
            <p className="text-sm font-semibold text-graph">Rendición al propietario</p>
            <p className="mt-0.5 text-xs text-graph-400">Sobre reservas confirmadas, en curso y finalizadas. Comisión de Potente según cada unidad.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-graph/[0.07] bg-graph/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-graph-400">
                  <th className="px-5 py-3">Unidad</th>
                  <th className="px-5 py-3 text-center">Reservas</th>
                  <th className="px-5 py-3 text-right">Bruto</th>
                  <th className="px-5 py-3 text-right">Comisión Potente</th>
                  <th className="px-5 py-3 text-right">Al propietario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graph/[0.07]">
                {rendicion.filas.map(({ u, n, bruto, comisionPct, comision, alPropietario }) => (
                  <tr key={u.id} className="transition hover:bg-graph/[0.03]">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-graph">{tituloCorto(u)}</p>
                      <p className="text-xs text-graph-400">{u.barrio}</p>
                    </td>
                    <td className="px-5 py-3.5 text-center text-graph-500">{n || "—"}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-graph">{bruto ? fmtARS(bruto) : "—"}</td>
                    <td className="px-5 py-3.5 text-right text-graph-500">
                      {bruto ? <>−{fmtARS(comision)} <span className="text-graph-400">({comisionPct}%)</span></> : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-display font-semibold text-brand-700">{bruto ? fmtARS(alPropietario) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-graph/10 bg-graph/[0.03] font-semibold">
                  <td className="px-5 py-3.5 text-graph">Total general</td>
                  <td className="px-5 py-3.5" />
                  <td className="px-5 py-3.5 text-right text-graph">{fmtARS(rendicion.tot.bruto)}</td>
                  <td className="px-5 py-3.5 text-right text-graph-500">−{fmtARS(rendicion.tot.comision)}</td>
                  <td className="px-5 py-3.5 text-right font-display text-brand-700">{fmtARS(rendicion.tot.prop)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Nueva reserva ── */}
      <Modal
        open={!!nuevaCtx}
        onClose={() => setNuevaCtx(null)}
        title="Nueva reserva"
        subtitle={nuevaCtx ? `${tituloCorto(unidadesTemporada.find((u) => u.id === nuevaCtx.unidadId)!)} · ${tramoById(nuevaCtx.tramoId).label}` : undefined}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setNuevaCtx(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={guardarNueva}>Señar reserva</Btn>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); guardarNueva(); }}>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Inquilino</span>
            <input className={INP} placeholder="Nombre o familia" value={form.inquilino} onChange={(e) => setF("inquilino", e.target.value)} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Contacto</span>
            <input className={INP} placeholder="Teléfono o mail" value={form.contacto} onChange={(e) => setF("contacto", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Personas</span>
            <input type="number" min={1} className={INP} value={form.personas} onChange={(e) => setF("personas", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Monto total (ARS)</span>
            <input type="number" className={INP} value={form.monto} onChange={(e) => setF("monto", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Seña (ARS)</span>
            <input type="number" className={INP} value={form.sena} onChange={(e) => setF("sena", e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Garantía (ARS)</span>
            <input type="number" className={INP} value={form.garantia} onChange={(e) => setF("garantia", e.target.value)} />
          </label>
        </form>
        {(() => {
          const monto = Number(form.monto) || 0;
          const sena = Number(form.sena) || 0;
          return (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-graph/10 bg-graph/[0.03] px-4 py-3 text-sm">
              <span className="text-graph-500">Saldo contra ingreso</span>
              <span className="font-display font-semibold text-graph">{fmtARS(Math.max(monto - sena, 0))}</span>
            </div>
          );
        })()}
      </Modal>

      {/* ── Modal Detalle de reserva ── */}
      <Modal
        open={!!detalle}
        onClose={() => setDetalleId(null)}
        title={detalle ? detalle.inquilino : "Reserva"}
        subtitle={detalle ? `${tituloCorto(unidadesTemporada.find((u) => u.id === detalle.unidadId)!)} · ${tramoById(detalle.tramoId).label}` : undefined}
        footer={
          <>
            <Btn variant="ghost" onClick={cancelarReserva} className="text-red-600 hover:border-red-400/50 hover:text-red-700">
              <Ban size={15} /> Cancelar reserva
            </Btn>
            <Btn variant="primary" onClick={() => setDetalleId(null)}>Listo</Btn>
          </>
        }
      >
        {detalle && (() => {
          const saldo = Math.max(detalle.montoTotalARS - detalle.senaARS, 0);
          const st = EST[detalle.estado];
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", st.chip)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} /> {st.label}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-graph-400">
                  <Users size={13} /> {detalle.personas} personas
                </span>
                {detalle.contacto && <span className="text-xs text-graph-400">· {detalle.contacto}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Dato label="Monto total" value={fmtARS(detalle.montoTotalARS)} />
                <Dato label="Seña" value={fmtARS(detalle.senaARS)} />
                <Dato label="Saldo pendiente" value={fmtARS(saldo)} strong />
                <Dato label="Garantía" value={fmtARS(detalle.garantiaARS)} />
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-graph-400">Estado de la reserva</span>
                <select
                  value={detalle.estado}
                  onChange={(e) => cambiarEstado(e.target.value as EstadoReserva)}
                  className="h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm font-medium text-graph outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
                >
                  {ESTADOS_EDIT.map((s) => (
                    <option key={s} value={s} className="bg-paper-100 text-graph">{EST[s].label}</option>
                  ))}
                </select>
              </label>

              <p className="flex items-center gap-1.5 text-[11px] text-graph-400">
                <ArrowRight size={12} /> Señada → Confirmada (saldo + garantía) → En curso → Finalizada. Cancelar libera la quincena.
              </p>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// Miniatura de la unidad (1ª foto de la propiedad); si falla, fondo mar de marca.
function Thumb({ src, alt, mar }: { src?: string; alt: string; mar?: boolean }) {
  const [err, setErr] = useState(false);
  return (
    <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-brand/25 to-sea/25 ring-1 ring-inset ring-graph/10">
      {src && !err ? (
        <img src={src} alt={alt} onError={() => setErr(true)} className="h-full w-full object-cover" />
      ) : (
        <Waves size={16} className="text-brand/50" />
      )}
      {mar && <span className="absolute bottom-0 left-0 right-0 h-1 bg-sea/70" title="Frente al mar" />}
    </div>
  );
}

// Celda de dato del detalle.
function Dato({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-graph/[0.08] bg-graph/[0.02] px-3 py-2.5">
      <p className="text-[11px] font-medium text-graph-400">{label}</p>
      <p className={cn("mt-0.5 font-display font-semibold", strong ? "text-brand-700" : "text-graph")}>{value}</p>
    </div>
  );
}
