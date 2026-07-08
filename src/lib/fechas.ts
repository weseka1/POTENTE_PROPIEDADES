// ===== "Hoy" dinámico — el demo se ve SIEMPRE actual =====
// Las fechas del dataset de ejemplo se escribieron relativas al 24-jun-2026 (el "ancla").
// Para que el demo nunca se vea viejo, desplazamos TODO el dataset la misma cantidad de días
// que separa ese ancla del día real (ver lib/DataProvider). Así la coherencia diseñada
// (visitas de hoy/mañana, consultas "hace X h", contratos por vencer) se mantiene intacta.

const ANCLA = new Date(2026, 5, 24, 12, 0, 0); // 24 de junio de 2026, mediodía local

export function hoy(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

// Días a desplazar el dataset (día real − ancla).
export const SHIFT_DIAS = Math.round((hoy().getTime() - ANCLA.getTime()) / 86_400_000);

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hoyISO(): string {
  return isoDate(hoy());
}

// Desplaza una fecha ISO del dataset original al "ahora" real (conserva el horario si lo trae).
export function rebaseISO(iso: string): string {
  if (!iso) return iso;
  const soloFecha = iso.length <= 10;
  const base = new Date(soloFecha ? iso + "T12:00:00" : iso);
  if (isNaN(base.getTime())) return iso;
  base.setDate(base.getDate() + SHIFT_DIAS);
  return soloFecha ? isoDate(base) : isoDate(base) + iso.slice(10);
}
