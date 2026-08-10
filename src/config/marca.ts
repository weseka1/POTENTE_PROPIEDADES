// ── Marca y datos del negocio — LA fuente de verdad ──────────────────────────
// Datos definitivos de Mateo (cierre 3-ago-2026). Todo lo que muestre dirección,
// teléfono, WhatsApp u horario sale de acá: nada hardcodeado en componentes.
// Numeración de Mateo: Oficina 1 = Chauvín · Oficina 2 = Punta Mogotes.
import { DOMINIO_POR_DEFECTO } from "./dominio.js";

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

// Horarios DISTINTOS por oficina (WhatsApp Mateo 4-ago 9:39: Trabajadores
// atiende más tarde y los sábados; pisa el "ambas 9 a 16" de la videollamada).
export const OFICINAS: Oficina[] = [
  {
    id: "chauvin",
    numero: 1,
    nombre: "Chauvín",
    direccion: "Córdoba 3719",
    telefono: "223 512-9032",
    whatsapp: "5492235129032",
    horario: "Lun a Vie 9 a 16 hs",
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
    horario: "Lun a Vie 9 a 18 hs · Sáb hasta 12",
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

export const INSTAGRAM = {
  usuario: "potentepropiedades",
  // Reels REALES de @potentepropiedades (relevados 4-ago del perfil, más nuevos
  // primero). Para destacar otros: pegar acá la URL completa del reel.
  reels: [
    "https://www.instagram.com/reel/DbL67Szx_M2/",
    "https://www.instagram.com/reel/DaYW-NzxwFp/",
    "https://www.instagram.com/reel/DaERkh-RY7A/",
    "https://www.instagram.com/reel/DZLpkgexoxv/",
    "https://www.instagram.com/reel/DZDQub9RFQG/",
    "https://www.instagram.com/reel/DYYSokKxRVW/",
  ] as string[],
};

export const REDES = {
  instagram: "https://www.instagram.com/potentepropiedades",
  facebook: "https://www.facebook.com/potente.propiedades",
};

/* ── El sitio ─────────────────────────────────────────────────────────────────
 * La URL donde vive la web. TODO lo que arme una URL absoluta sale de acá:
 * canonical y OG (seo.ts), el JSON-LD de temporada, el link de "Compartir por
 * WhatsApp" del panel y los pies de los tres PDF.
 *
 * 🔴 Por qué existe: el 10-ago la auditoría encontró TRES dominios distintos
 * hardcodeados. El botón de compartir y los PDF imprimían potenteprop.com.ar
 * (que solo es el dominio del MAIL): cada link que Mateo mandaba por WhatsApp
 * era un link muerto. El dominio de deploy vive en src/config/dominio.js y se
 * pisa con la variable VITE_SITE_URL — así mudar de hosting no toca código.
 */
export const SITIO: string =
  (import.meta.env?.VITE_SITE_URL as string | undefined) || DOMINIO_POR_DEFECTO;

/** El dominio para leer en pantalla o imprimir: sin el https:// adelante. */
export const SITIO_LEGIBLE = SITIO.replace(/^https?:\/\//, "");
