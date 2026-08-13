// ═════════════════════════════════════════════════════════════════════════════
// DÓNDE HACEMOS TEMPORADA — una sola fuente de verdad.
// ─────────────────────────────────────────────────────────────────────────────
// 13-ago-2026, Mateo por WhatsApp: «temporada hacemos únicamente en barrio
// Punta Mogotes». Antes eran seis barrios.
//
// Vive en JS plano (no .ts) a propósito: lo consumen el front (Temporada.tsx,
// TemporadaBarrio.tsx) Y `scripts/gen-sitemap.mjs`, que corre en node antes del
// build y no puede importar TypeScript. Hasta hoy la lista estaba COPIADA en el
// generador del sitemap con un comentario admitiendo el riesgo: un barrio de
// más allá era una URL en el sitemap que no existe en el sitio.
//
// Sumar un barrio = agregarlo acá y nada más.
// ═════════════════════════════════════════════════════════════════════════════

/** Los barrios donde se ofrece alquiler de temporada. El orden es el que se muestra. */
export const BARRIOS_TEMPORADA = ["Punta Mogotes"];

/** El barrio principal: el que encabeza los textos y el SEO. */
export const BARRIO_TEMPORADA = BARRIOS_TEMPORADA[0];

/**
 * "Punta Mogotes" → "punta-mogotes".
 * El rango de diacríticos va ESCAPADO (̀-ͯ) y no como bytes crudos:
 * escrito literal funciona hasta que alguien reencodea el archivo y entonces
 * rompe en silencio (es la cicatriz de `Catalogo.tsx`).
 */
export function slugBarrio(b) {
  return b
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/** slug → barrio. Devuelve undefined si el slug no es de los nuestros. */
export function barrioBySlug(slug) {
  return BARRIOS_TEMPORADA.find((b) => slugBarrio(b) === slug);
}
