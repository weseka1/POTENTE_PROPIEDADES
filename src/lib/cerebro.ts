/**
 * CUÁNTO CONOCIMIENTO LE ENTRA A MARINA — una sola fuente.
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo consumen los DOS lados y por eso vive acá y no adentro de uno:
 *   · el server (`netlify/functions/_iaconfig.ts`), que arma el prompt;
 *   · el panel (`src/panel/pages/Asistente.tsx`), que le muestra a Mateo cuánto
 *     espacio le queda y le avisa si un documento no entra entero.
 *
 * 🔴 Nace de un bug del 28-ago: el tope real era 8.000 caracteres por ficha, el
 * panel decía "no hay límite", y la ficha que cargó Mateo (24.735 caracteres con
 * el negocio entero) entraba por la mitad SIN AVISAR — se perdía el 68%, con su
 * "REGLA ABSOLUTA: NO INVENTAR" adentro. El número vivía suelto en el server y
 * el panel ni sabía que existía. Un límite que el cliente no puede ver es un
 * límite que lo va a agarrar de sorpresa.
 *
 * El presupuesto, con números: el cerebro entero + el catálogo completo (~160
 * fichas ≈ 20k caracteres) ≈ 80k ≈ 20k tokens de system. La ventana del modelo
 * es de 200k, así que entra holgado y la consulta sigue costando centavos. El
 * techo existe para que un pegado accidental no dispare la cuenta, no para
 * recortar lo que el cliente escribió a conciencia.
 */

/** Lo máximo que puede medir UNA ficha de conocimiento. */
export const TOPE_FICHA = 40_000;

/** Lo máximo que suman TODAS las fichas juntas. */
export const TOPE_CONOCIMIENTO = 60_000;

/** El texto libre de "sobre el negocio". */
export const TOPE_CONTEXTO = 12_000;
