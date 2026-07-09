import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Building2, Percent, Wallet, BadgeCheck, Waves, Pencil, Users, ArrowRight, Ban, Sparkles, Plus, Trash2, FileDown, FileSpreadsheet } from "lucide-react";
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
// Alta de unidad y edición de unidad (los números viajan como string para el input).
type NuevaUnidadForm = { propiedadId: string; barrio: string; ambientes: string; capacidad: string; comisionPct: string; frenteAlMar: boolean; comodidades: string[] };
type EditUnidadForm = { barrio: string; ambientes: string; capacidad: string; comisionPct: string; frenteAlMar: boolean; comodidades: string[]; activa: boolean };

// Comodidades ofrecibles como chips (el "frente al mar" es un toggle aparte → campo frenteAlMar).
const COMODIDADES = ["wifi", "aire", "cochera", "parrilla", "pileta", "patio", "balcón al mar"] as const;

// Curva del mercado MdP para PRE-cargar el tarifario de una unidad nueva: multiplicador por
// quincena sobre el valor pico (2ª de enero), que a su vez depende de los ambientes. Después
// el cliente ajusta cada valor a mano en el Tarifario.
const CURVA_TMP: Record<TemporadaTramoId, number> = {
  "dic-1": 0.45, "dic-2": 0.62, "ene-1": 0.9, "ene-2": 1.0,
  "feb-1": 0.9, "feb-2": 0.78, "mar-1": 0.5, "mar-2": 0.42,
};
function picoPorAmbientes(amb: number): number {
  if (amb <= 1) return 620_000;
  if (amb === 2) return 900_000;
  if (amb === 3) return 1_250_000;
  if (amb === 4) return 1_600_000;
  return 1_950_000; // 5+ (casas grandes)
}
function tarifasCalculadas(amb: number): UnidadTemporada["tarifas"] {
  const pico = picoPorAmbientes(amb);
  const out: Partial<Record<TemporadaTramoId, number>> = {};
  (Object.keys(CURVA_TMP) as TemporadaTramoId[]).forEach((k) => (out[k] = r10k(pico * CURVA_TMP[k])));
  return out;
}
const conComodidad = (arr: string[], c: string) => (arr.includes(c) ? arr.filter((x) => x !== c) : [...arr, c]);

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
    addUnidadTemporada, updateUnidadTemporada, deleteUnidadTemporada,
    addReservaTemporada, updateReservaTemporada, deleteReservaTemporada,
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

  // alta y edición de unidades de temporada
  const emptyNueva: NuevaUnidadForm = { propiedadId: "", barrio: "", ambientes: "2", capacidad: "4", comisionPct: "15", frenteAlMar: false, comodidades: ["wifi"] };
  const [sumarOpen, setSumarOpen] = useState(false);
  const [nueva, setNueva] = useState<NuevaUnidadForm>(emptyNueva);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditUnidadForm>({ barrio: "", ambientes: "2", capacidad: "4", comisionPct: "15", frenteAlMar: false, comodidades: [], activa: true });

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

  // ── Sumar propiedad a la temporada ──
  // Candidatas: las de la cartera que todavía no son unidad. Las urbanas (depto/casa) van primero.
  const disponibles = useMemo(() => {
    const yaUnidad = new Set(unidadesTemporada.map((u) => u.propiedadId));
    const rank = (c: string) => (c === "departamento" || c === "casa" ? 0 : 1);
    return propiedades
      .filter((p) => !yaUnidad.has(p.id))
      .sort((a, b) => rank(a.categoria) - rank(b.categoria) || a.titulo.localeCompare(b.titulo));
  }, [propiedades, unidadesTemporada]);
  // Tarifas que quedarían pre-cargadas según los ambientes elegidos (preview antes de guardar).
  const previewTarifas = useMemo(() => tarifasCalculadas(Number(nueva.ambientes) || 1), [nueva.ambientes]);

  const abrirSumar = () => { setNueva(emptyNueva); setSumarOpen(true); };
  // Al elegir la propiedad pre-cargamos barrio (zona) y ambientes desde su ficha.
  const elegirPropiedad = (id: string) => {
    const p = propiedades.find((x) => x.id === id);
    setNueva((f) => ({
      ...f,
      propiedadId: id,
      barrio: p?.zona ?? f.barrio,
      ambientes: p?.ambientes != null ? String(p.ambientes) : f.ambientes,
    }));
  };
  const guardarNuevaUnidad = async () => {
    if (!nueva.propiedadId) { push("Elegí una propiedad de la cartera", "error"); return; }
    const amb = Number(nueva.ambientes) || 1;
    const u: UnidadTemporada = {
      id: "TMP-" + Date.now(),
      propiedadId: nueva.propiedadId,
      barrio: nueva.barrio.trim(),
      ambientes: amb,
      capacidad: Number(nueva.capacidad) || 1,
      frenteAlMar: nueva.frenteAlMar,
      comodidades: nueva.comodidades,
      tarifas: tarifasCalculadas(amb),
      comisionPct: Number(nueva.comisionPct) || 15,
      activa: true,
      enLimpieza: false,
    };
    await addUnidadTemporada(u);
    setSumarOpen(false);
    push("Propiedad sumada a la temporada ✓", "success");
  };

  // ── Editar / quitar una unidad ──
  const editU = editId ? unidadesTemporada.find((u) => u.id === editId) ?? null : null;
  const abrirEdit = (u: UnidadTemporada) => {
    setEdit({
      barrio: u.barrio,
      ambientes: String(u.ambientes),
      capacidad: String(u.capacidad),
      comisionPct: String(u.comisionPct ?? 15),
      frenteAlMar: !!u.frenteAlMar,
      comodidades: u.comodidades ?? [],
      activa: u.activa,
    });
    setEditId(u.id);
  };
  const guardarEdit = async () => {
    if (!editId) return;
    await updateUnidadTemporada(editId, {
      barrio: edit.barrio.trim(),
      ambientes: Number(edit.ambientes) || 1,
      capacidad: Number(edit.capacidad) || 1,
      comisionPct: Number(edit.comisionPct) || 15,
      frenteAlMar: edit.frenteAlMar,
      comodidades: edit.comodidades,
      activa: edit.activa,
    });
    setEditId(null);
    push("Unidad actualizada ✓", "success");
  };
  const quitarUnidad = async () => {
    if (!editId) return;
    if (!window.confirm("¿Quitar esta propiedad de la temporada? También se borran todas sus reservas. Esta acción no se puede deshacer.")) return;
    await deleteUnidadTemporada(editId);
    setEditId(null);
    push("Propiedad quitada de la temporada", "info");
  };

  // Eliminar una reserva definitivamente (distinto de cancelar, que deja el registro).
  const eliminarReserva = async () => {
    if (!detalle) return;
    if (!window.confirm("¿Eliminar la reserva definitivamente? Se borra del sistema y no queda registro. Si sólo querés liberar la quincena, usá Cancelar.")) return;
    await deleteReservaTemporada(detalle.id);
    setDetalleId(null);
    push("Reserva eliminada", "info");
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

  // Rendición en PDF (membrete de marca) — lo que la inmobiliaria le manda a cada propietario.
  const exportarRendicionPDF = () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const hoy = new Date();
      const fechaTxt = hoy.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

      doc.setFillColor(12, 77, 162);
      doc.rect(0, 0, W, 72, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(18);
      doc.text("Potente Propiedades · Rendición de temporada", 40, 34);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text("Alquiler temporario · Verano 2027 · Mar del Plata", 40, 51);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("Rendición al propietario", W - 40, 34, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(fechaTxt, W - 40, 51, { align: "right" });

      doc.setTextColor(35, 35, 35); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Detalle por unidad", 40, 104);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(95, 95, 95);
      doc.text("Sobre reservas confirmadas, en curso y finalizadas.", 40, 121);

      autoTable(doc, {
        startY: 138,
        head: [["Unidad", "Barrio", "Bruto", "Comisión Potente", "Al propietario"]],
        body: rendicion.filas.map((f) => [
          tituloCorto(f.u),
          f.u.barrio,
          f.bruto ? fmtARS(f.bruto) : "—",
          f.bruto ? `-${fmtARS(f.comision)} (${f.comisionPct}%)` : "—",
          f.bruto ? fmtARS(f.alPropietario) : "—",
        ]),
        foot: [["Total general", "", fmtARS(rendicion.tot.bruto), `-${fmtARS(rendicion.tot.comision)}`, fmtARS(rendicion.tot.prop)]],
        headStyles: { fillColor: [12, 77, 162], textColor: 255, fontStyle: "bold" },
        footStyles: { fillColor: [240, 237, 228], textColor: 35, fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 5 },
        alternateRowStyles: { fillColor: [248, 246, 240] },
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
        margin: { left: 40, right: 40 },
      });

      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text("Generado por el panel de Potente Propiedades · potenteprop.com.ar", 40, ph - 24);

      doc.save(`Potente-Rendicion-${hoy.toISOString().slice(0, 10)}.pdf`);
      push("Rendición PDF descargada ✓", "success");
    } catch {
      push("No se pudo generar el PDF", "error");
    }
  };

  // Rendición en Excel: CSV (separador ; para Excel en español) con BOM para los acentos.
  const exportarRendicionExcel = () => {
    try {
      const hoy = new Date();
      const esc = (v: any) => {
        const s = String(v ?? "");
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows: (string | number)[][] = [];
      rows.push(["Potente Propiedades — Rendición de temporada", hoy.toLocaleDateString("es-AR")]);
      rows.push([]);
      rows.push(["Unidad", "Barrio", "Bruto ARS", "Comisión Potente ARS", "Comisión %", "Al propietario ARS"]);
      rendicion.filas.forEach((f) => rows.push([tituloCorto(f.u), f.u.barrio, f.bruto, f.comision, f.comisionPct, f.alPropietario]));
      rows.push(["Total general", "", rendicion.tot.bruto, rendicion.tot.comision, "", rendicion.tot.prop]);

      const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Potente-Rendicion-${hoy.toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      push("Rendición Excel descargada ✓", "success");
    } catch {
      push("No se pudo generar el Excel", "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Temporada · Verano 2027"
        subtitle="Grilla de disponibilidad, tarifario y rendición del alquiler temporario en la costa"
        actions={
          <Btn variant="primary" onClick={abrirSumar}>
            <Plus size={16} /> Sumar propiedad
          </Btn>
        }
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
                      <tr key={u.id} className={cn("group", !u.activa && "opacity-55")}>
                        <td className="sticky left-0 z-10 border-b border-graph/[0.06] bg-paper-100 px-4 py-2.5 group-hover:bg-graph/[0.02]">
                          <div className="flex items-center gap-2.5">
                            <Thumb src={p?.fotos?.[0]} alt={tituloCorto(u)} mar={u.frenteAlMar} />
                            <div className="min-w-0">
                              <p className="max-w-[188px] truncate text-[13px] font-semibold leading-tight text-graph">{tituloCorto(u)}</p>
                              <p className="mt-0.5 truncate text-[11px] text-graph-400">
                                {u.barrio} · {u.ambientes} amb · {u.capacidad} pers
                              </p>
                              {!u.activa && (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-graph/15 bg-graph/[0.06] px-2 py-0.5 text-[10px] font-semibold text-graph-500">
                                  No publicada
                                </span>
                              )}
                            </div>
                            <div className="ml-auto flex shrink-0 items-center gap-1">
                              {/* Editar / quitar la unidad. */}
                              <button
                                onClick={() => abrirEdit(u)}
                                title="Editar unidad"
                                className="grid h-7 w-7 place-items-center rounded-lg text-graph-400 opacity-0 ring-1 ring-inset ring-transparent transition hover:bg-graph/[0.06] hover:text-graph group-hover:opacity-100"
                                aria-label="Editar unidad"
                              >
                                <Pencil size={14} />
                              </button>
                              {/* Turnover: marcar la unidad "en limpieza" entre un inquilino y el siguiente. */}
                              <button
                                onClick={() => updateUnidadTemporada(u.id, { enLimpieza: !u.enLimpieza })}
                                title={u.enLimpieza ? "Limpieza y llaves pendientes — tocá para marcar lista" : "Marcar en limpieza (turnover)"}
                                className={cn(
                                  "grid h-7 w-7 place-items-center rounded-lg ring-1 ring-inset transition",
                                  u.enLimpieza
                                    ? "bg-amber-500/15 text-amber-700 ring-amber-500/30"
                                    : "text-graph-400 opacity-0 ring-transparent hover:bg-graph/[0.06] hover:text-graph group-hover:opacity-100"
                                )}
                                aria-label="Marcar en limpieza"
                              >
                                <Sparkles size={14} />
                              </button>
                            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-graph/[0.07] px-5 py-3.5">
            <div>
              <p className="text-sm font-semibold text-graph">Rendición al propietario</p>
              <p className="mt-0.5 text-xs text-graph-400">Sobre reservas confirmadas, en curso y finalizadas. Comisión de Potente según cada unidad.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Btn variant="ghost" onClick={exportarRendicionExcel}>
                <FileSpreadsheet size={16} /> Exportar Excel
              </Btn>
              <Btn variant="primary" onClick={exportarRendicionPDF}>
                <FileDown size={16} /> Exportar PDF
              </Btn>
            </div>
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
            <Btn variant="ghost" onClick={eliminarReserva} className="text-red-600 hover:border-red-400/50 hover:text-red-700">
              <Trash2 size={15} /> Eliminar
            </Btn>
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

      {/* ── Modal Sumar propiedad a la temporada ── */}
      <Modal
        open={sumarOpen}
        onClose={() => setSumarOpen(false)}
        title="Sumar propiedad a la temporada"
        subtitle="Elegí una propiedad de la cartera y queda publicada para el verano"
        size="lg"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setSumarOpen(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={guardarNuevaUnidad}>Sumar a la temporada</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-graph-400">Propiedad de la cartera</span>
            <select
              value={nueva.propiedadId}
              onChange={(e) => elegirPropiedad(e.target.value)}
              className="h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm font-medium text-graph outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
            >
              <option value="" className="bg-paper-100 text-graph">Elegí una propiedad…</option>
              {disponibles.map((p) => (
                <option key={p.id} value={p.id} className="bg-paper-100 text-graph">
                  {p.titulo.split(",")[0]} · {p.zona}
                </option>
              ))}
            </select>
            {disponibles.length === 0 && (
              <span className="mt-1 block text-[11px] text-graph-400">Todas las propiedades de la cartera ya están en la temporada.</span>
            )}
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-graph-400">Barrio</span>
              <input className={INP} placeholder="Playa Grande, Güemes…" value={nueva.barrio} onChange={(e) => setNueva((f) => ({ ...f, barrio: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-graph-400">Ambientes</span>
              <input type="number" min={1} className={INP} value={nueva.ambientes} onChange={(e) => setNueva((f) => ({ ...f, ambientes: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-graph-400">Capacidad (personas)</span>
              <input type="number" min={1} className={INP} value={nueva.capacidad} onChange={(e) => setNueva((f) => ({ ...f, capacidad: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-graph-400">Comisión Potente (%)</span>
              <input type="number" min={0} className={INP} value={nueva.comisionPct} onChange={(e) => setNueva((f) => ({ ...f, comisionPct: e.target.value }))} />
            </label>
          </div>

          <Toggle
            checked={nueva.frenteAlMar}
            onChange={(v) => setNueva((f) => ({ ...f, frenteAlMar: v }))}
            label="Frente al mar"
            hint="Se destaca en la web y suele valer más"
          />

          <div>
            <span className="mb-2 block text-xs font-semibold text-graph-400">Comodidades</span>
            <Chips selected={nueva.comodidades} onToggle={(c) => setNueva((f) => ({ ...f, comodidades: conComodidad(f.comodidades, c) }))} />
          </div>

          {/* Preview de las tarifas que quedan pre-cargadas (después se editan en el Tarifario). */}
          <div className="rounded-xl border border-graph/10 bg-graph/[0.02] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-semibold text-graph">Tarifas iniciales por quincena</span>
              <span className="text-[11px] text-graph-400">calculadas con la curva del mercado · las editás después en el Tarifario</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {TRAMOS.map((t) => (
                <div key={t.id} className={cn("rounded-lg border px-2 py-1.5 text-center", t.pico ? "border-brand/30 bg-brand/[0.05]" : "border-graph/10 bg-graph/[0.02]")}>
                  <p className="text-[10px] uppercase tracking-wide text-graph-400">{t.corto}</p>
                  <p className="mt-0.5 text-xs font-semibold text-graph">{fmtARS(previewTarifas[t.id], { short: true })}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Modal Editar unidad ── */}
      <Modal
        open={!!editU}
        onClose={() => setEditId(null)}
        title="Editar unidad"
        subtitle={editU ? tituloCorto(editU) : undefined}
        size="lg"
        footer={
          <>
            <Btn variant="ghost" onClick={quitarUnidad} className="text-red-600 hover:border-red-400/50 hover:text-red-700">
              <Trash2 size={15} /> Quitar de temporada
            </Btn>
            <Btn variant="primary" onClick={guardarEdit}>Guardar cambios</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-graph-400">Barrio</span>
              <input className={INP} value={edit.barrio} onChange={(e) => setEdit((f) => ({ ...f, barrio: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-graph-400">Ambientes</span>
              <input type="number" min={1} className={INP} value={edit.ambientes} onChange={(e) => setEdit((f) => ({ ...f, ambientes: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-graph-400">Capacidad (personas)</span>
              <input type="number" min={1} className={INP} value={edit.capacidad} onChange={(e) => setEdit((f) => ({ ...f, capacidad: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-graph-400">Comisión Potente (%)</span>
              <input type="number" min={0} className={INP} value={edit.comisionPct} onChange={(e) => setEdit((f) => ({ ...f, comisionPct: e.target.value }))} />
            </label>
          </div>

          <Toggle
            checked={edit.frenteAlMar}
            onChange={(v) => setEdit((f) => ({ ...f, frenteAlMar: v }))}
            label="Frente al mar"
          />

          <div>
            <span className="mb-2 block text-xs font-semibold text-graph-400">Comodidades</span>
            <Chips selected={edit.comodidades} onToggle={(c) => setEdit((f) => ({ ...f, comodidades: conComodidad(f.comodidades, c) }))} />
          </div>

          <Toggle
            checked={edit.activa}
            onChange={(v) => setEdit((f) => ({ ...f, activa: v }))}
            label="Publicada en la web"
            hint="Si la apagás, deja de mostrarse en la web pública (sigue disponible en el panel)."
          />

          <p className="text-[11px] text-graph-400">
            Las tarifas de esta unidad se ajustan en la pestaña Tarifario.
          </p>
        </div>
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

// Comodidades como chips seleccionables (azul de marca cuando están activas).
function Chips({ selected, onToggle }: { selected: string[]; onToggle: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COMODIDADES.map((c) => {
        const on = selected.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => onToggle(c)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition first-letter:uppercase",
              on
                ? "border-brand/40 bg-brand/[0.08] text-brand-700"
                : "border-graph/12 bg-graph/[0.03] text-graph-500 hover:border-graph/25 hover:text-graph"
            )}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

// Interruptor sí/no con label y ayuda; azul de marca al estar encendido.
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-graph/10 bg-graph/[0.03] px-3.5 py-3 text-left transition hover:border-graph/20"
      aria-pressed={checked}
    >
      <span>
        <span className="block text-sm font-semibold text-graph">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-graph-400">{hint}</span>}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-graph/20")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}
