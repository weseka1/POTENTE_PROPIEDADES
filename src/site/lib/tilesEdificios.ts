// ═════════════════════════════════════════════════════════════════════════════
// QUÉ TILES DE EDIFICIOS CUBREN UN PUNTO — solo la matemática, sin decodificador.
// ─────────────────────────────────────────────────────────────────────────────
// Vive aparte de `edificiosMlt.ts` a propósito. Ese módulo importa el
// decodificador `@maplibre/mlt` (~80 kb) y por eso se carga LAZY, dentro del
// chunk del 3D. Si la ficha importara desde ahí solo para calcular un número de
// tile, el decodificador se colaría al bundle principal y lo pagaría todo
// visitante — es la cicatriz del 12-ago.
//
// Acá no hay más que aritmética: la usa el 3D para pedir los tiles, y la ficha
// para PRECARGARLOS antes de que el visitante toque el botón.
// ═════════════════════════════════════════════════════════════════════════════

/** El nivel de zoom del dataset de edificios (tiles z14). */
export const Z_EDIFICIOS = 14;

/** lng → columna del tile. */
export function tileX(lng: number, z = Z_EDIFICIOS): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

/** lat → fila del tile (proyección Web Mercator). */
export function tileY(lat: number, z = Z_EDIFICIOS): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

/** La URL del tile en NUESTRO proxy (el CDN no da CORS a nuestro dominio). */
export const urlTile = (x: number, y: number) => `/api/edificios/${x}/${y}`;

/**
 * Los tiles que va a necesitar la vista 3D centrada en un punto.
 *
 * El 3D abre con un encuadre fijo (minZoom 15), y medido contra la vista real
 * son **6 tiles**: la columna del punto y la siguiente, por tres filas. Se
 * devuelven en orden de cercanía para que el primero que llega sea el de abajo
 * del pin.
 */
export function tilesDeLaVista3D(lat: number, lng: number): Array<[number, number]> {
  const x = tileX(lng);
  const y = tileY(lat);
  const alrededor: Array<[number, number]> = [];
  for (const dy of [0, -1, 1]) for (const dx of [0, 1, -1]) alrededor.push([x + dx, y + dy]);
  return alrededor.slice(0, 6);
}
