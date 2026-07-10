// ===== Datos de muestra — TEMPORADA (alquiler temporario verano 2026/27) =====
// La unidad es la quincena. Tarifas en ARS con la curva real del mercado MdP
// (pico 2ª de enero, cae hacia fin de febrero, hombro en dic/marzo).

import type {
  TemporadaTramo,
  TemporadaTramoId,
  UnidadTemporada,
  ReservaTemporada,
} from "./types";

export const TRAMOS: TemporadaTramo[] = [
  { id: "dic-1", label: "1ª quincena de diciembre", corto: "Dic 1ª", desdeISO: "2026-12-01", hastaISO: "2026-12-15" },
  { id: "dic-2", label: "2ª quincena de diciembre", corto: "Dic 2ª", desdeISO: "2026-12-16", hastaISO: "2026-12-31" },
  { id: "ene-1", label: "1ª quincena de enero", corto: "Ene 1ª", desdeISO: "2027-01-01", hastaISO: "2027-01-15" },
  { id: "ene-2", label: "2ª quincena de enero", corto: "Ene 2ª", desdeISO: "2027-01-16", hastaISO: "2027-01-31", pico: true },
  { id: "feb-1", label: "1ª quincena de febrero", corto: "Feb 1ª", desdeISO: "2027-02-01", hastaISO: "2027-02-15" },
  { id: "feb-2", label: "2ª quincena de febrero", corto: "Feb 2ª", desdeISO: "2027-02-16", hastaISO: "2027-02-28" },
  { id: "mar-1", label: "1ª quincena de marzo", corto: "Mar 1ª", desdeISO: "2027-03-01", hastaISO: "2027-03-15" },
  { id: "mar-2", label: "2ª quincena de marzo", corto: "Mar 2ª", desdeISO: "2027-03-16", hastaISO: "2027-03-31" },
];

export const tramoById = (id: TemporadaTramoId) => TRAMOS.find((t) => t.id === id)!;

// Curva de tarifas por ambientes: multiplicadores sobre el valor pico (2ª enero).
const CURVA: Record<TemporadaTramoId, number> = {
  "dic-1": 0.45, "dic-2": 0.62, "ene-1": 0.9, "ene-2": 1.0,
  "feb-1": 0.9, "feb-2": 0.78, "mar-1": 0.5, "mar-2": 0.42,
};

// Valor pico (2ª quincena enero) por cantidad de ambientes — base del tarifario.
function picoPorAmbientes(amb: number): number {
  if (amb <= 1) return 620_000;
  if (amb === 2) return 900_000;
  if (amb === 3) return 1_250_000;
  if (amb === 4) return 1_600_000;
  return 1_950_000; // 5+ (casas grandes)
}

// Redondeo comercial a los $10.000
const r10k = (n: number) => Math.round(n / 10_000) * 10_000;

function tarifasDesde(amb: number, factor = 1): UnidadTemporada["tarifas"] {
  const pico = picoPorAmbientes(amb) * factor;
  const out: Partial<Record<TemporadaTramoId, number>> = {};
  (Object.keys(CURVA) as TemporadaTramoId[]).forEach((k) => (out[k] = r10k(pico * CURVA[k])));
  return out;
}

// Unidades en temporada: se apoyan en propiedades urbanas de la cartera (propiedadId).
// factor: ajuste fino por ubicación/calidad (frente al mar y Playa Grande valen más).
type Semilla = { id: string; propiedadId: string; amb: number; cap: number; barrio: string; mar?: boolean; com: string[]; factor?: number; limpieza?: boolean };
const SEMILLAS: Semilla[] = [
  // TMP-01 salió una reserva finalizada (Godoy, dic 2ª) → queda en turnover: limpieza y llaves.
  { id: "TMP-01", propiedadId: "URB-015", amb: 3, cap: 5, barrio: "Playa Grande", mar: true, com: ["wifi", "aire", "cochera", "frente al mar"], factor: 1.15, limpieza: true },
  { id: "TMP-02", propiedadId: "URB-011", amb: 4, cap: 6, barrio: "Varese", mar: true, com: ["wifi", "aire", "cochera", "balcón al mar"], factor: 1.2 },
  { id: "TMP-03", propiedadId: "URB-010", amb: 3, cap: 4, barrio: "Playa Grande", com: ["wifi", "aire", "cochera"], factor: 1.1 },
  { id: "TMP-04", propiedadId: "URB-014", amb: 3, cap: 5, barrio: "Güemes", com: ["wifi", "aire", "parrilla"] },
  { id: "TMP-05", propiedadId: "URB-013", amb: 2, cap: 3, barrio: "La Perla", com: ["wifi", "aire"] },
  { id: "TMP-06", propiedadId: "URB-012", amb: 2, cap: 4, barrio: "Centro", com: ["wifi", "cochera"] },
  { id: "TMP-07", propiedadId: "URB-016", amb: 2, cap: 3, barrio: "Güemes", com: ["wifi", "aire"] },
  { id: "TMP-08", propiedadId: "URB-009", amb: 2, cap: 4, barrio: "La Perla", com: ["wifi", "parrilla", "patio"] },
  { id: "TMP-09", propiedadId: "URB-008", amb: 3, cap: 6, barrio: "Güemes", com: ["wifi", "parrilla", "cochera"] },
  { id: "TMP-10", propiedadId: "URB-001", amb: 5, cap: 8, barrio: "Chauvín", com: ["pileta", "parrilla", "cochera", "wifi", "aire"], factor: 1.1 },
  { id: "TMP-11", propiedadId: "URB-003", amb: 4, cap: 7, barrio: "Punta Mogotes", com: ["parrilla", "cochera", "wifi"], factor: 0.95 },
];

// Tarifa por noche en temporada alta (pico) = valor de la 2ª de enero / 15 noches.
function tarifaNocheDesde(amb: number, factor = 1): number {
  const pico = picoPorAmbientes(amb) * factor;
  return Math.round(pico / 15 / 1_000) * 1_000; // redondeo a $1.000/noche
}

export const unidadesTemporada: UnidadTemporada[] = SEMILLAS.map((s) => ({
  id: s.id,
  propiedadId: s.propiedadId,
  ambientes: s.amb,
  capacidad: s.cap,
  barrio: s.barrio,
  frenteAlMar: s.mar,
  comodidades: s.com,
  tarifas: tarifasDesde(s.amb, s.factor ?? 1),
  tarifaNocheARS: tarifaNocheDesde(s.amb, s.factor ?? 1),
  minNoches: s.amb >= 4 ? 7 : undefined, // las casas grandes suelen pedir semana mínima
  comisionPct: 15,
  activa: true,
  enLimpieza: s.limpieza ?? false,
}));

// Precio de un tramo para una unidad (helper compartido con la web).
export function tarifaDe(unidad: UnidadTemporada, tramoId: TemporadaTramoId): number | undefined {
  return unidad.tarifas[tramoId];
}

// ── Fechas y precio por rango ────────────────────────────────────────────────
const DIA_MS = 86_400_000;
// Defensivo: nunca asumir que el ISO viene (un dato viejo cacheado sin fecha no
// debe romper toda la sección). Sin fecha → "".
const soloFecha = (iso?: string | null) => (iso ? String(iso) : "").slice(0, 10);

/** Noches entre dos fechas (check-out no cuenta). */
export function nochesEntre(desdeISO?: string, hastaISO?: string): number {
  const a = soloFecha(desdeISO), b = soloFecha(hastaISO);
  if (!a || !b) return 0;
  const d = new Date(a + "T00:00:00").getTime();
  const h = new Date(b + "T00:00:00").getTime();
  if (!Number.isFinite(d) || !Number.isFinite(h)) return 0;
  return Math.max(0, Math.round((h - d) / DIA_MS));
}

/** Multiplicador estacional para una fecha: ubica en qué quincena cae. */
export function curvaEnFecha(iso?: string): number {
  const f = soloFecha(iso);
  if (!f) return 0.42;
  const t = TRAMOS.find((x) => f >= x.desdeISO && f <= x.hastaISO);
  return t ? CURVA[t.id] : 0.42; // fuera de temporada: valor de hombro bajo
}

/** Total sugerido: suma cada noche a su tarifa (tarifaNoche × curva del día). */
export function precioSugerido(u: UnidadTemporada, desdeISO?: string, hastaISO?: string): number {
  const a = soloFecha(desdeISO);
  const n = nochesEntre(desdeISO, hastaISO);
  if (!a || n <= 0) return 0;
  let total = 0;
  const cursor = new Date(a + "T00:00:00");
  for (let i = 0; i < n; i++) {
    total += (u.tarifaNocheARS || 0) * curvaEnFecha(cursor.toISOString());
    cursor.setDate(cursor.getDate() + 1);
  }
  return r10k(total);
}

const OCUPA: ReservaTemporada["estado"][] = ["senada", "confirmada", "en_curso", "finalizada"];

/** ¿Se solapa un rango con alguna reserva viva de la unidad? Devuelve con quién choca. */
export function reservaEnConflicto(
  reservas: ReservaTemporada[],
  unidadId: string,
  desdeISO: string,
  hastaISO: string,
  exceptoId?: string
): ReservaTemporada | undefined {
  const d = soloFecha(desdeISO);
  const h = soloFecha(hastaISO);
  return reservas.find((r) => {
    const rd = soloFecha(r.desdeISO), rh = soloFecha(r.hastaISO);
    if (!rd || !rh) return false; // reserva sin fechas (dato viejo) → se ignora
    return (
      r.unidadId === unidadId &&
      r.id !== exceptoId &&
      OCUPA.includes(r.estado) &&
      // se pisan si empieza antes de que el otro termine y termina después de que el otro empiece
      d < rh &&
      h > rd
    );
  });
}

// ── Reservas de muestra: rangos reales dentro de la temporada, estados variados ──
function reserva(
  id: string, unidadId: string, desdeISO: string, hastaISO: string,
  inquilino: string, contacto: string, personas: number, estado: ReservaTemporada["estado"]
): ReservaTemporada {
  const u = unidadesTemporada.find((x) => x.id === unidadId)!;
  const monto = precioSugerido(u, desdeISO, hastaISO);
  return {
    id, unidadId, desdeISO, hastaISO, noches: nochesEntre(desdeISO, hastaISO),
    inquilino, contacto, personas,
    montoTotalARS: monto,
    senaARS: r10k(monto * 0.3),
    garantiaARS: 80_000,
    estado,
    creadaISO: "2026-09-20",
  };
}

export const reservasTemporada: ReservaTemporada[] = [
  reserva("RSV-01", "TMP-01", "2027-01-18", "2027-01-28", "Familia Gutiérrez", "+54 9 11 5544-2210", 4, "confirmada"),
  reserva("RSV-02", "TMP-01", "2027-01-05", "2027-01-12", "Andrea Solís", "+54 9 341 622-8890", 3, "senada"),
  reserva("RSV-03", "TMP-01", "2027-02-03", "2027-02-10", "Grupo Mancini", "+54 9 11 6677-1200", 5, "senada"),
  reserva("RSV-04", "TMP-02", "2027-01-16", "2027-01-31", "Familia Del Río", "+54 9 11 4433-9087", 6, "confirmada"),
  reserva("RSV-05", "TMP-02", "2027-02-05", "2027-02-15", "Lucas Vergara", "+54 9 223 511-7788", 4, "senada"),
  reserva("RSV-06", "TMP-03", "2027-01-20", "2027-01-27", "Paula Restrepo", "+54 9 351 448-9021", 4, "confirmada"),
  reserva("RSV-07", "TMP-03", "2026-12-26", "2027-01-02", "Familia Ozuna", "+54 9 11 3322-4455", 3, "confirmada"),
  reserva("RSV-08", "TMP-04", "2027-01-03", "2027-01-10", "Hernán Cabral", "+54 9 261 500-3311", 5, "senada"),
  reserva("RSV-09", "TMP-04", "2027-01-17", "2027-01-24", "Familia Prieto", "+54 9 11 7788-9900", 5, "confirmada"),
  reserva("RSV-10", "TMP-05", "2027-01-19", "2027-01-26", "Romina Aguirre", "+54 9 223 466-1234", 2, "senada"),
  reserva("RSV-11", "TMP-06", "2027-02-07", "2027-02-14", "Diego Salas", "+54 9 11 2200-1177", 4, "senada"),
  reserva("RSV-12", "TMP-09", "2027-01-16", "2027-01-30", "Familia Bianchi", "+54 9 11 9090-2323", 6, "confirmada"),
  reserva("RSV-13", "TMP-09", "2027-02-18", "2027-02-25", "Sofía Márquez", "+54 9 223 588-6644", 5, "senada"),
  reserva("RSV-14", "TMP-10", "2027-01-02", "2027-01-14", "Familia Herrera", "+54 9 11 4545-6767", 8, "confirmada"),
  reserva("RSV-15", "TMP-10", "2027-01-16", "2027-01-31", "Grupo Paz", "+54 9 11 1212-3434", 8, "confirmada"),
  reserva("RSV-16", "TMP-11", "2027-01-18", "2027-01-28", "Familia Duarte", "+54 9 223 477-8899", 7, "senada"),
  reserva("RSV-17", "TMP-01", "2026-12-20", "2026-12-28", "Marina Godoy", "+54 9 11 6363-1919", 3, "finalizada"),
  reserva("RSV-18", "TMP-08", "2027-02-04", "2027-02-11", "Nicolás Ferrer", "+54 9 341 700-5522", 4, "senada"),
];
