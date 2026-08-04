// ── Marca y datos del negocio — LA fuente de verdad ──────────────────────────
// Datos definitivos de Mateo (cierre 3-ago-2026). Todo lo que muestre dirección,
// teléfono, WhatsApp u horario sale de acá: nada hardcodeado en componentes.
// Numeración de Mateo: Oficina 1 = Chauvín · Oficina 2 = Punta Mogotes.

export type OficinaId = "chauvin" | "puntamogotes";

export interface Oficina {
  id: OficinaId;
  numero: 1 | 2;
  nombre: string;
  direccion: string;
  /** Teléfono para LLAMADAS (formato humano). */
  telefono: string;
  /** WhatsApp en dígitos internacionales (wa.me). Mogotes tiene número distinto al de llamadas. */
  whatsapp: string;
  horario: string;
  maps: string;
  nota: string;
}

export const HORARIO = "Lun a Vie 9 a 16 hs";

export const OFICINAS: Oficina[] = [
  {
    id: "chauvin",
    numero: 1,
    nombre: "Chauvín",
    direccion: "Córdoba 3719",
    telefono: "223 512-9032",
    whatsapp: "5492235129032",
    horario: HORARIO,
    maps: "https://maps.google.com/?q=Cordoba+3719,+Mar+del+Plata",
    nota: "En el corazón de Chauvín, cerca de Güemes y Playa Grande.",
  },
  {
    id: "puntamogotes",
    numero: 2,
    nombre: "Punta Mogotes",
    direccion: "Av. de los Trabajadores 2439",
    telefono: "223 628-2659",
    whatsapp: "5492235851198",
    horario: HORARIO,
    maps: "https://maps.google.com/?q=Av.+de+los+Trabajadores+2439,+Mar+del+Plata",
    nota: "Frente a la costa, a metros de las playas de Punta Mogotes.",
  },
];

// Central / orquestador (Mateo): lo que no tiene oficina asignada va acá.
export const WA_CENTRAL = "5492233029591";

export const getOficina = (id?: string | null): Oficina | undefined =>
  OFICINAS.find((o) => o.id === id);

/** WhatsApp en dígitos: el de la oficina, o el central (Mateo) si no hay oficina. */
export const waDigits = (oficinaId?: string | null): string =>
  getOficina(oficinaId)?.whatsapp ?? WA_CENTRAL;

/** Link wa.me listo, con mensaje opcional. */
export const waUrl = (oficinaId?: string | null, mensaje?: string): string =>
  `https://wa.me/${waDigits(oficinaId)}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;

export const REDES = {
  instagram: "https://www.instagram.com/potentepropiedades",
  facebook: "https://www.facebook.com/potente.propiedades",
};
