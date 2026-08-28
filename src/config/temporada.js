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

/**
 * La oficina que ADMINISTRA la temporada. Mateo, 17-ago (audios): «cuando toco
 * consultar por WhatsApp manda a mi WhatsApp personal… cambiar eso para que
 * mande directamente al WhatsApp de Mogotes».
 *
 * Es la misma decisión de negocio que BARRIOS_TEMPORADA: la temporada se hace
 * únicamente en Punta Mogotes, así que las fichas de temporada nacen de esa
 * oficina. Lo que cuelga de esto: a qué WhatsApp rutea la consulta del
 * visitante, y en el panel de QUIÉN aparece la ficha (el scope filtra por
 * oficina exacta — una ficha sin oficina no la ve NINGUNA oficina, que es
 * exactamente lo que le pasó a Mateo el 16-ago con sus fichas de prueba).
 */
export const OFICINA_TEMPORADA = "puntamogotes";

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

/**
 * ¿ESTO ES UNA CONSULTA DE TEMPORADA? — una sola definición.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Nace de un drift del 28-ago: la misma regla estaba escrita DOS veces con
 * listas distintas —el widget de la web y el server de Marina— y 6 de 10 frases
 * reales se clasificaban distinto según por dónde entraran. El server conocía
 * "semana santa", "finde largo" y "por días"; el widget no. Y como el widget usa
 * esto para decidir a qué WhatsApp manda el botón, una consulta de temporada que
 * entraba por la web podía terminar eligiendo Chauvín.
 * Lo peor: la copia MÁS NUEVA era la más pobre — se re-tipeó en vez de reusar la
 * que ya existía.
 *
 * Vive acá porque este archivo ya es la fuente de verdad de la temporada y lo
 * importan los dos lados (y los scripts de build, que son JS plano).
 */

/** Dicen temporada por sí solas: con una alcanza. */
const TEMPORADA_SEGURA = /\b(temporada|temporario|veraneo|vacacion\w*|vacación\w*|quincena|semana santa|finde largo|fin de semana largo|por d[ií]as?)\b/i;

/* 🔴 Un mes NO es una temporada. "enero" y "febrero" estaban en la lista dura, y
 * «me mudo a Mar del Plata en febrero y busco alquiler ANUAL» terminaba derivado
 * al WhatsApp de temporada, con un cartel que afirmaba algo que la persona no
 * pidió. Igual «el contrato vence en febrero». Ahora el mes solo INSINÚA, y
 * cualquier palabra de alquiler largo lo desactiva. */
const TEMPORADA_INSINUADA = /\b(verano|enero|febrero)\b/i;
const ALQUILER_LARGO = /\b(anual|anuales|permanente|todo el a[nñ]o|largo plazo|contrato|dos a[nñ]os|2 a[nñ]os|tres a[nñ]os|3 a[nñ]os|vivienda|me mudo|mudarme|residir|vivir)\b/i;

/**
 * @param {string} texto Lo que escribió la persona (conviene pasar el hilo entero:
 *   quien dijo "temporada" hace tres mensajes sigue siendo de temporada).
 * @returns {boolean}
 */
export function esConsultaDeTemporada(texto) {
  const t = String(texto || "");
  return TEMPORADA_SEGURA.test(t) || (TEMPORADA_INSINUADA.test(t) && !ALQUILER_LARGO.test(t));
}
