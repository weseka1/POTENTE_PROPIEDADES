// ===== Datos de muestra — TEMPORADA (alquiler temporario verano 2026/27) =====
// La unidad es la quincena. Tarifas en ARS con la curva real del mercado MdP
// (pico 2ª de enero, cae hacia fin de febrero, hombro en dic/marzo).

import { waDigits } from "@/config/marca";
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
type Semilla = { id: string; propiedadId: string; amb: number; cap: number; barrio: string; oficina?: "chauvin" | "puntamogotes"; mar?: boolean; com: string[]; factor?: number; limpieza?: boolean };
// Las unidades apuntan a propiedades REALES de la cartera (ids POT-*). El barrio
// es el de la propiedad (Lomas de Stella Maris es la zona de la ensenada de Varese).
const SEMILLAS: Semilla[] = [
  // TMP-01 salió una reserva finalizada (Godoy, dic 2ª) → queda en turnover: limpieza y llaves.
  { id: "TMP-01", propiedadId: "POT-218380", amb: 5, cap: 8, barrio: "Playa Grande", oficina: "chauvin", mar: true, com: ["wifi", "aire", "cochera", "balcón"], factor: 1.2, limpieza: true },
  { id: "TMP-02", propiedadId: "POT-218377", amb: 1, cap: 2, barrio: "Punta Mogotes", oficina: "puntamogotes", mar: true, com: ["wifi", "aire", "vista al mar"], factor: 1.1 },
  { id: "TMP-03", propiedadId: "POT-223356", amb: 2, cap: 3, barrio: "Punta Mogotes", oficina: "puntamogotes", com: ["wifi", "aire", "cochera", "balcón"] },
  { id: "TMP-04", propiedadId: "POT-205391", amb: 1, cap: 2, barrio: "Punta Mogotes", oficina: "puntamogotes", com: ["wifi", "aire"] },
  { id: "TMP-05", propiedadId: "POT-172350", amb: 3, cap: 5, barrio: "Punta Mogotes", oficina: "puntamogotes", com: ["wifi", "parrilla", "patio"] },
  { id: "TMP-06", propiedadId: "POT-219780", amb: 3, cap: 4, barrio: "Las Avenidas", oficina: "puntamogotes", com: ["wifi", "aire"] },
  { id: "TMP-07", propiedadId: "POT-217419", amb: 2, cap: 3, barrio: "Macrocentro", oficina: "chauvin", com: ["wifi", "aire"] },
  { id: "TMP-08", propiedadId: "POT-219651", amb: 2, cap: 4, barrio: "Villa Primera", oficina: "chauvin", com: ["wifi", "parrilla", "patio"] },
  { id: "TMP-09", propiedadId: "POT-207693", amb: 3, cap: 5, barrio: "Barrio El Jardín", oficina: "puntamogotes", com: ["wifi", "parrilla", "cochera"] },
  { id: "TMP-10", propiedadId: "POT-215539", amb: 3, cap: 4, barrio: "Varese", oficina: "chauvin", com: ["wifi", "aire", "balcón"], factor: 1.1 },
  { id: "TMP-11", propiedadId: "POT-153864", amb: 4, cap: 6, barrio: "Chauvín", oficina: "chauvin", com: ["parrilla", "cochera", "wifi"], factor: 0.95 },
];

// Tarifa por noche en temporada alta (pico) = valor de la 2ª de enero / 15 noches.
function tarifaNocheDesde(amb: number, factor = 1): number {
  const pico = picoPorAmbientes(amb) * factor;
  return Math.round(pico / 15 / 1_000) * 1_000; // redondeo a $1.000/noche
}

export const unidadesTemporada: UnidadTemporada[] = SEMILLAS.map((s) => ({
  id: s.id,
  oficina: s.oficina,
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
/**
 * La tarifa más baja de la unidad — el "desde $X la quincena".
 * Vive acá y no en la página de Temporada: también la usa la ficha pública, y
 * un helper puro no puede obligar a importar una página entera (con su Navbar,
 * su Footer y su hero) dentro de otro bundle.
 */
export function tarifaDesde(u: UnidadTemporada): number {
  const vals = Object.values(u.tarifas).filter((v): v is number => typeof v === "number");
  return vals.length ? Math.min(...vals) : 0;
}

/**
 * WhatsApp de consulta por una propiedad de temporada. Va DIRECTO al número de
 * la oficina que la administra (pedido de Mateo, 4-ago: la división por oficina
 * no puede fallar). Sin oficina cae al central.
 */
export function waTemporada(titulo: string, quincenaLabel?: string, oficina?: "chauvin" | "puntamogotes"): string {
  const txt =
    `Hola Potente Propiedades, me interesa alquilar para la temporada "${titulo}"` +
    (quincenaLabel ? ` en la ${quincenaLabel.toLowerCase()}` : "") +
    `. ¿Tienen disponibilidad?`;
  return `https://wa.me/${waDigits(oficina)}?text=${encodeURIComponent(txt)}`;
}

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
  // ── Segunda tanda de temporada (la ocupación real de un verano que viene bien vendido) ──
  reserva("RSV-19", "TMP-01", "2026-12-29", "2027-01-04", "Familia Zanetti", "+54 9 11 5210-4433", 4, "confirmada"),
  reserva("RSV-20", "TMP-01", "2027-02-12", "2027-02-19", "Carolina Funes", "+54 9 351 522-7810", 3, "senada"),
  reserva("RSV-21", "TMP-02", "2026-12-26", "2027-01-06", "Matías Aldao", "+54 9 11 6098-2211", 2, "confirmada"),
  reserva("RSV-22", "TMP-02", "2027-01-07", "2027-01-14", "Familia Kaufman", "+54 9 11 4785-9034", 2, "senada"),
  reserva("RSV-23", "TMP-03", "2027-01-02", "2027-01-12", "Valeria Ledesma", "+54 9 223 540-6712", 3, "confirmada"),
  reserva("RSV-24", "TMP-03", "2027-01-28", "2027-02-08", "Familia Roldán", "+54 9 2954 44-8802", 4, "senada"),
  reserva("RSV-25", "TMP-04", "2026-12-27", "2027-01-02", "Grupo Etchegaray", "+54 9 11 3390-5566", 4, "confirmada"),
  reserva("RSV-26", "TMP-04", "2027-01-25", "2027-02-01", "Josefina Barral", "+54 9 341 688-1290", 3, "senada"),
  reserva("RSV-27", "TMP-05", "2027-01-02", "2027-01-16", "Familia Miranda", "+54 9 11 5877-3402", 5, "confirmada"),
  reserva("RSV-28", "TMP-05", "2027-01-27", "2027-02-06", "Pedro Galarza", "+54 9 223 415-6688", 4, "senada"),
  reserva("RSV-29", "TMP-06", "2027-01-04", "2027-01-18", "Familia Ibarra", "+54 9 261 433-2019", 4, "confirmada"),
  reserva("RSV-30", "TMP-06", "2027-01-20", "2027-01-30", "Silvia Cardozo", "+54 9 11 6244-8075", 3, "senada"),
  reserva("RSV-31", "TMP-07", "2027-01-02", "2027-01-16", "Familia Peralta", "+54 9 11 4099-1287", 3, "confirmada"),
  reserva("RSV-32", "TMP-07", "2027-01-17", "2027-01-31", "Gonzalo Iriarte", "+54 9 2923 46-1150", 2, "senada"),
  reserva("RSV-33", "TMP-07", "2027-02-02", "2027-02-12", "Marta Villalba", "+54 9 223 690-4471", 3, "senada"),
  reserva("RSV-34", "TMP-08", "2026-12-28", "2027-01-02", "Camila Ortega", "+54 9 11 7305-9912", 4, "confirmada"),
  reserva("RSV-35", "TMP-08", "2027-01-03", "2027-01-13", "Familia Ayala", "+54 9 381 455-2098", 4, "confirmada"),
  reserva("RSV-36", "TMP-08", "2027-01-16", "2027-01-26", "Bruno Scaglia", "+54 9 11 5540-7781", 3, "senada"),
  reserva("RSV-37", "TMP-09", "2027-01-02", "2027-01-13", "Familia Quiroga", "+54 9 11 3865-2244", 5, "confirmada"),
  reserva("RSV-38", "TMP-09", "2027-02-01", "2027-02-08", "Laura Benítez", "+54 9 2284 51-6633", 4, "senada"),
  reserva("RSV-39", "TMP-10", "2026-12-27", "2027-01-01", "Grupo Almada", "+54 9 11 6122-9058", 4, "confirmada"),
  reserva("RSV-40", "TMP-10", "2027-02-01", "2027-02-11", "Familia Sagasti", "+54 9 11 4471-3356", 4, "senada"),
  reserva("RSV-41", "TMP-11", "2027-01-02", "2027-01-15", "Familia Echeverría", "+54 9 11 5933-8140", 6, "confirmada"),
  reserva("RSV-42", "TMP-11", "2027-01-29", "2027-02-08", "Ramiro Sotelo", "+54 9 223 502-7719", 5, "senada"),
  reserva("RSV-43", "TMP-11", "2027-02-12", "2027-02-19", "Ana Clara Ponce", "+54 9 341 590-2367", 4, "senada"),
];
