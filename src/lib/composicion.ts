/**
 * LA COMPOSICIÓN DE UN EDIFICIO — cuántas unidades y de cuántos ambientes.
 * ─────────────────────────────────────────────────────────────────────────────
 * Pedido de Mateo (video, 8-sep-2026): «quiero cargar un edificio. En vez de que
 * me aparezca esto en general [ambientes/baños], que aparezca ponerle cantidad
 * de unidades y cuántos ambientes cada unidad: 2 unidades de 3 ambientes, 3 de
 * 2, 1 de 1». Su edificio real —"12 Unidades en Block CON RENTA", Chauvín—
 * tenía la composición escrita a mano en `características` porque no había
 * dónde ponerla.
 *
 * El dato vive en `potente_propiedades.composicion` (jsonb, migración 028) como
 * filas `{cantidad, ambientes}`. Y se LEE por acá, en un solo lugar, para la
 * ficha pública, la tarjeta, la cartera, el drawer, el buscador y Marina.
 *
 * 🔴 TOTAL, JAMÁS TIRA. Del lado del server el `null` llega crudo (no pasa por
 * `sinNulos`): un `.map` sobre null tiraría las ~100 fichas del catálogo entero
 * y Marina se quedaría sin cartera en Instagram. Cualquier cosa rara —null, un
 * string, filas incompletas, un 0, un decimal— se descarta en silencio y se
 * devuelve lo que sí es válido (o nada).
 *
 * Sin React ni navegador a propósito: el server lo empaqueta tal cual, igual
 * que `catalogoLite.ts`.
 */

export type UnidadComposicion = { cantidad: number; ambientes: number };

/** Topes generosos: un edificio de 999 unidades o de 50 ambientes por unidad no
 *  existe en Mar del Plata; más que eso es un dedo que se fue. Mismos números
 *  que el CHECK de la base (028): lo que pasa acá, pasa allá. */
const MAX_UNIDADES = 999;
const MAX_AMBIENTES = 50;

const entero = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
};

/**
 * Filas válidas, agrupadas por ambientes (2 de 3 + 1 de 3 = 3 de 3) y ordenadas
 * de más ambientes a menos, como las dictó Mateo. Lo inválido se descarta.
 */
export function normalizarComposicion(v: unknown): UnidadComposicion[] {
  if (!Array.isArray(v)) return [];
  const porAmbientes = new Map<number, number>();
  for (const fila of v) {
    if (!fila || typeof fila !== "object") continue;
    const cantidad = entero((fila as Record<string, unknown>).cantidad);
    const ambientes = entero((fila as Record<string, unknown>).ambientes);
    if (cantidad === null || ambientes === null) continue;
    if (cantidad < 1 || cantidad > MAX_UNIDADES || ambientes < 1 || ambientes > MAX_AMBIENTES) continue;
    porAmbientes.set(ambientes, (porAmbientes.get(ambientes) ?? 0) + cantidad);
  }
  return [...porAmbientes.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([ambientes, cantidad]) => ({ cantidad, ambientes }));
}

/** Cuántas unidades en total. 0 si no hay composición válida. */
export function totalUnidades(v: unknown): number {
  return normalizarComposicion(v).reduce((n, u) => n + u.cantidad, 0);
}

/**
 * La frase, una sola para todos: "6 unidades: 2 de 3 amb., 3 de 2 amb., 1 monoambiente".
 * `undefined` cuando no hay nada válido — y entonces NO se muestra (regla de la
 * casa: si un dato no está, la sección no aparece).
 */
export function describirComposicion(v: unknown): string | undefined {
  const filas = normalizarComposicion(v);
  if (!filas.length) return undefined;
  const total = filas.reduce((n, u) => n + u.cantidad, 0);
  const partes = filas.map((u) =>
    u.ambientes === 1
      ? `${u.cantidad} monoambiente${u.cantidad > 1 ? "s" : ""}`
      : `${u.cantidad} de ${u.ambientes} amb.`,
  );
  return `${total} unidad${total === 1 ? "" : "es"}: ${partes.join(", ")}`;
}

/** Versión corta para donde no hay lugar (tarjeta, cartera, drawer): "6 unidades". */
export function resumenComposicion(v: unknown): string | undefined {
  const total = totalUnidades(v);
  return total ? `${total} unidad${total === 1 ? "" : "es"}` : undefined;
}
