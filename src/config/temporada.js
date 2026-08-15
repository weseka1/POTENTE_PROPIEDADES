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

/**
 * ¿Esta zona es uno de los barrios donde hacemos temporada?
 *
 * 🔴 14-ago · Compara NORMALIZADO (sin acentos, sin mayúsculas, sin espacios de
 * más) y no por igualdad exacta de string. El motivo es concreto: el barrio de
 * la unidad se copia de `zona`, que en el panel es un campo de TEXTO LIBRE que
 * Mateo tipea —muchas veces desde el celular—. Con igualdad exacta, escribir
 * "punta mogotes", "Punta Mogotes " o "PUNTA MOGOTES" hacía que la propiedad
 * quedara INVISIBLE en /temporada, invisible en /temporada/punta-mogotes y
 * también fuera del catálogo general (que excluye temporada) — las tres puntas
 * mudas, y el panel diciendo "Propiedad publicada ✓ — ya está en la web".
 *
 * Esto tolera cómo se escribe. Lo que NO puede adivinar es un barrio que
 * realmente no es de temporada (p. ej. "Varese"): de eso avisa el formulario al
 * guardar, que es el único momento en que Mateo puede corregirlo.
 */
export function esBarrioTemporada(zona) {
  if (!zona) return false;
  const norm = (s) => slugBarrio(String(s).trim());
  const z = norm(zona);
  return BARRIOS_TEMPORADA.some((b) => norm(b) === z);
}
