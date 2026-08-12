/**
 * EDIFICIOS con cobertura TOTAL — el dataset de ShadeMap decodificado.
 * ─────────────────────────────────────────────────────────────────────────────
 * Pedido de Juani (11-ago): "en MDQ en muchísimas propiedades no se ve el 3D,
 * debe verse en TODAS". OSM solo tiene los edificios que alguien mapeó a mano
 * (Mar del Sur: 1; barrios enteros de MdP: cero). ShadeMap sirve la huella de
 * TODOS los edificios (detección satelital, el dataset del video de Mateo) en
 * formato MLT — y el decodificador oficial `@maplibre/mlt` los abre.
 *
 * Medido el 11-ago contra tiles reales:
 *   · z14 x5571 y10063 (MdP oeste): 16.953 edificios · x5572 (centro): 16.384
 *   · altura en DECÍMETROS donde se conoce (torre de Güemes: 384 → 38,4 m);
 *     la mayoría viene sin altura → default 6 m (dos plantas). El ejemplo del
 *     proveedor usa 3,1 m, pero acá subestimar la sombra del vecino es
 *     prometer un sol que después no está — regla de la casa: conservador.
 *   · El archivo es DATADO (buildings20260617): si ShadeMap publica uno nuevo,
 *     el viejo puede desaparecer → los consumidores tienen respaldo OSM.
 *
 * Una sola función para las DOS vistas (sombras 2D y ciudad 3D): mismos
 * edificios, mismas alturas, mismo criterio. Todo lazy: `@maplibre/mlt` baja
 * recién en la primera llamada.
 */

// Import ESTÁTICO a propósito: este módulo ya llega solo por `import()` desde
// las dos vistas, así que el decoder queda en ESTE chunk lazy. (Con un import
// dinámico anidado, Vite lo subía al bundle principal — medido: +80 kB para
// todo visitante.)
import { decodeTile } from "@maplibre/mlt";

/**
 * 🔴 Los tiles van por NUESTRO server (`/api/edificios`), no directo al CDN:
 * cfw.shademap.app solo permite CORS desde sus dominios y localhost — desde
 * potente-propiedades.onrender.com el navegador bloquea la respuesta (medido
 * 11-ago; el archivo real vive en cfw.shademap.app/buildings20260617).
 */
const ARCHIVO_MLT = "/api/edificios/{x}/{y}";
/** Los tiles de edificios existen SOLO en z14 (igual que los .mvt viejos). */
const Z = 14;
/** Default para huellas sin altura: dos plantas. Ver nota de arriba. */
const ALTURA_DEFAULT_M = 6;

export type EdificioGeoJSON = {
  type: "Feature";
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
  properties: { height: number; render_height: number };
};

const cachePorTile = new Map<string, EdificioGeoJSON[]>();

/** Punto de tile (0..extent) → [lng, lat]. Matemática slippy estándar. */
function aLngLat(x: number, y: number, px: number, py: number, extent: number): [number, number] {
  const n = 2 ** Z;
  const lng = ((x + px / extent) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n)));
  return [lng, (latRad * 180) / Math.PI];
}

async function tileDecodificado(x: number, y: number): Promise<EdificioGeoJSON[]> {
  const clave = `${x}/${y}`;
  const guardado = cachePorTile.get(clave);
  if (guardado) return guardado;
  try {
    const url = ARCHIVO_MLT.replace("{x}", String(x)).replace("{y}", String(y));
    const r = await fetch(url);
    if (!r.ok) return [];
    const tablas = decodeTile(new Uint8Array(await r.arrayBuffer()));
    const tabla = tablas.find((t) => t.name === "building") ?? tablas[0];
    if (!tabla) return [];
    const extent = tabla.extent || 4096;
    // La altura vive en un vector COLUMNAR aparte: `getFeatures()` del decoder
    // deja `properties` vacío (medido) — hay que leerla por índice con has().
    let alturas: { has: (i: number) => boolean; getValue: (i: number) => unknown } | null = null;
    try { alturas = tabla.getPropertyVector("height"); } catch { alturas = null; }

    const edificios: EdificioGeoJSON[] = [];
    const crudos = tabla.getFeatures();
    for (let i = 0; i < crudos.length; i++) {
      const g = crudos[i].geometry as { type: number; coordinates: Array<Array<{ x: number; y: number }>> };
      // 2 = POLYGON, 5 = MULTIPOLYGON (el resto no es un edificio dibujable).
      if (g.type !== 2 && g.type !== 5) continue;
      const anillos = g.coordinates.map((anillo) => anillo.map((p) => aLngLat(x, y, p.x, p.y, extent)));
      const h = alturas && alturas.has(i) ? Number(alturas.getValue(i)) / 10 : ALTURA_DEFAULT_M;
      edificios.push({
        type: "Feature",
        geometry:
          g.type === 2
            ? { type: "Polygon", coordinates: anillos }
            // MULTIPOLYGON: el decoder entrega los anillos chatos (sin agrupar
            // por parte); cada anillo como polígono propio dibuja bien las ~4
            // piezas por tile que vienen así (medido en el tile del centro).
            : { type: "MultiPolygon", coordinates: anillos.map((a) => [a]) },
        properties: { height: h, render_height: h },
      });
    }
    cachePorTile.set(clave, edificios);
    return edificios;
  } catch {
    return []; // sin red o sin archivo: el consumidor cae a su respaldo OSM
  }
}

/**
 * Todos los edificios que tocan el encuadre [sur, oeste, norte, este].
 * Junta los tiles z14 que lo cubren (con el zoom mínimo 15 de las vistas son
 * 1 a 4; el tope 9 es un fusible por si alguien lo llama con un bbox gigante).
 */
export async function edificiosEnBbox(sur: number, oeste: number, norte: number, este: number): Promise<EdificioGeoJSON[]> {
  const n = 2 ** Z;
  const xDe = (lng: number) => Math.floor(((lng + 180) / 360) * n);
  const yDe = (lat: number) => {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  };
  const tiles: Array<[number, number]> = [];
  for (let x = xDe(oeste); x <= xDe(este); x++) for (let y = yDe(norte); y <= yDe(sur); y++) tiles.push([x, y]);
  if (tiles.length === 0 || tiles.length > 9) return [];
  const porTile = await Promise.all(tiles.map(([x, y]) => tileDecodificado(x, y)));
  return porTile.flat();
}
