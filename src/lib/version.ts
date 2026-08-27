/**
 * ¿ESTA PESTAÑA ESTÁ CORRIENDO LA VERSIÓN PUBLICADA?
 * ─────────────────────────────────────────────────────────────────────────────
 * 27-ago. El panel de un cliente que lo usa todo el día queda abierto durante
 * horas. Deployamos, y su pestaña sigue con el JavaScript viejo: los botones
 * nuevos no existen para él y el sistema "no anda". Le pasó a Juani y perdimos
 * media tarde buscando un bug que no estaba.
 *
 * `__BUILD__` se estampa en el bundle en tiempo de compilación y el mismo valor
 * queda en `/version.json`. Si difieren, esta pestaña es vieja.
 *
 * No recarga sola: alguien puede estar escribiendo. Avisa, y la persona decide.
 */
declare const __BUILD__: string;

/** La versión con la que se compiló ESTE JavaScript. */
export const BUILD_ACTUAL: string = typeof __BUILD__ === "string" ? __BUILD__ : "";

/**
 * ¿Hay una versión más nueva publicada? `false` ante cualquier duda: sin red,
 * sin archivo o con una respuesta rara no se molesta a nadie.
 */
export async function hayVersionNueva(): Promise<boolean> {
  if (!BUILD_ACTUAL) return false;
  try {
    const r = await fetch("/version.json", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return false;
    const j = (await r.json()) as { build?: string };
    return typeof j?.build === "string" && Boolean(j.build) && j.build !== BUILD_ACTUAL;
  } catch {
    return false;
  }
}
