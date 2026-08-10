/**
 * BUSCAR UNA DIRECCIÓN EN EL MAPA — del lado del servidor.
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo pidió Mateo en el audio del 7-ago, con el problema bien identificado:
 *
 *   "Hay veces que en Google las calles no están actualizadas o tienen otro
 *   nombre… ¿hay alguna posibilidad de que cuando yo pongo la dirección me
 *   muestre el mapita y yo pueda —si detecta la ubicación automática la pongo
 *   automática, y si no— seleccionar con el cosito rojo dónde quiero que se
 *   muestre?"
 *
 * ── POR QUÉ NO GOOGLE ────────────────────────────────────────────────────────
 * Aparte de que exige tarjeta y cuenta facturable siempre (y este proyecto se lo
 * lleva el cliente), el argumento que cierra la discusión es el suyo: la queja es
 * que Google se equivoca con los nombres de las calles. Pagarle al proveedor que
 * él mismo señala como el que se equivoca no tiene sentido. No es un problema de
 * dibujar el mapa, es un problema de AUTORIDAD sobre el nombre de la calle.
 *
 * ── LOS DOS PROVEEDORES, Y POR QUÉ HACEN FALTA LOS DOS ───────────────────────
 * 1. `georef-ar` (apis.datos.gob.ar) — el Servicio de Normalización de Datos
 *    Geográficos del IGN/INDEC. Es el registro OFICIAL de calles del Estado
 *    argentino: exactamente la autoridad que resuelve "esta calle tiene otro
 *    nombre". Sin key, sin tarjeta, sin registro.
 * 2. Nominatim (OpenStreetMap) como segunda opinión.
 *
 * Probado en vivo el 10-ago contra las dos oficinas de Potente:
 *   · "Córdoba 3719"  → georef: "C 138 - CORDOBA 3719, General Pueyrredón"
 *                       lat −38,015553 / lon −57,559905  ✅
 *   · "Av de los Trabajadores 2439" → georef: 0 resultados ❌ (probado también
 *     como "Avenida de los Trabajadores" y "de los Trabajadores": nada)
 *                       → Nominatim: LA ENCUENTRA, y encima la tiene fichada
 *                         como inmobiliaria: "Potente Propiedades, 2439,
 *                         Avenida de los Trabajadores, Punta Mogotes" ✅
 * O sea que se complementan justo donde uno falla. Por eso van los dos.
 *
 * ⚠️ Y una corrección a lo que se había asumido: georef NO entiende
 * intersecciones. "Güemes y Alvear" devuelve 0 resultados. Se probó.
 *
 * ── LOS CAVEATS, SIN MAQUILLAR ───────────────────────────────────────────────
 * · Las coordenadas de georef son una INTERPOLACIÓN sobre el segmento de calle,
 *   no la puerta: pueden caer a 500-700 m.
 * · Devuelve el nombre oficial con el código interno adentro ("C 138 - CORDOBA"),
 *   hay que limpiarlo para mostrárselo a una persona.
 * · No entiende barrios ni referencias.
 *
 * Y eso NO es un problema: es el diseño. **georef te da la cuadra, Mateo pone la
 * puerta.** La corrección a mano no es el plan B, es el evento principal — que es
 * literalmente lo que pidió.
 *
 * ── POR QUÉ ESTO CORRE EN EL SERVIDOR Y NO EN EL NAVEGADOR ───────────────────
 * 1. 🔴 El navegador NO PUEDE mandar `User-Agent`: es un header prohibido para
 *    `fetch`, y la política de Nominatim exige identificar la aplicación. Desde
 *    el browser es imposible de cumplir.
 * 2. 🔴 Nominatim prohíbe explícitamente el autocompletado del lado del cliente.
 *    Eso mata de raíz el patrón "buscar mientras escribe".
 * 3. El límite de 1 pedido por segundo es GLOBAL, no por navegador: con tres
 *    pestañas del panel abiertas no hay forma de respetarlo desde el cliente.
 * 4. La política exige cachear, y Mateo va a reeditar la misma propiedad varias
 *    veces.
 * 5. Proveedor intercambiable: si georef se cae, se cambia un archivo.
 */

/** Una dirección encontrada, ya normalizada para mostrar. */
export interface Encontrada {
  lat: number;
  lng: number;
  /** Lo que se le muestra a Mateo: "CÓRDOBA 3719, General Pueyrredón". */
  etiqueta: string;
  /** Quién la encontró, para poder decirlo y para depurar. */
  fuente: "georef" | "nominatim";
}

/**
 * El nombre oficial trae el código de calle adelante: "C 138 - CORDOBA".
 * A una persona hay que mostrarle "CORDOBA".
 */
const limpiarCalle = (nombre: string) =>
  nombre.replace(/^C\s*\d+\s*-\s*/i, "").replace(/\s+/g, " ").trim();

/** Cache en memoria del proceso. Cumple con la política y ahorra pedidos. */
const cache = new Map<string, { hasta: number; datos: Encontrada[] }>();
const VIDA_CACHE_MS = 24 * 60 * 60 * 1000;
/** Tope de entradas: es un cache, no una base de datos. */
const TOPE_CACHE = 500;

/**
 * Nominatim pide como mucho 1 pedido por segundo. Se serializa de verdad, con
 * una cadena de promesas: si dos pedidos entran juntos, el segundo espera.
 */
let ultimoNominatim = 0;
let colaNominatim: Promise<unknown> = Promise.resolve();
const enFila = <T,>(fn: () => Promise<T>): Promise<T> => {
  const siguiente = colaNominatim.then(async () => {
    const esperar = 1100 - (Date.now() - ultimoNominatim);
    if (esperar > 0) await new Promise((r) => setTimeout(r, esperar));
    ultimoNominatim = Date.now();
    return fn();
  });
  // La cola no se puede cortar por un error de un pedido.
  colaNominatim = siguiente.catch(() => undefined);
  return siguiente;
};

const TIEMPO_LIMITE_MS = 6000;

async function traer(url: string, headers: Record<string, string> = {}) {
  const corte = new AbortController();
  const t = setTimeout(() => corte.abort(), TIEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, { headers, signal: corte.signal });
    if (!r.ok) return null;
    return (await r.json()) as unknown;
  } catch {
    // Un geocodificador caído no puede tirar abajo la carga de una propiedad:
    // el mapa igual se muestra y Mateo pone el pin a mano.
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** El registro oficial de calles del Estado argentino. */
async function porGeoref(direccion: string, localidad: string, provincia: string) {
  const q = new URLSearchParams({ direccion, provincia, max: "3", campos: "estandar" });
  if (localidad) q.set("localidad", localidad);
  const j = (await traer(`https://apis.datos.gob.ar/georef/api/direcciones?${q}`)) as
    | { direcciones?: any[] }
    | null;
  return (j?.direcciones ?? [])
    .filter((d) => d?.ubicacion?.lat && d?.ubicacion?.lon)
    .map((d): Encontrada => {
      const calle = limpiarCalle(d.calle?.nombre ?? "");
      const altura = d.altura?.valor ?? "";
      const partido = d.departamento?.nombre ?? d.localidad_censal?.nombre ?? "";
      return {
        lat: d.ubicacion.lat,
        lng: d.ubicacion.lon,
        etiqueta: [[calle, altura].filter(Boolean).join(" "), partido].filter(Boolean).join(", "),
        fuente: "georef",
      };
    });
}

/** Segunda opinión. Encuentra cosas que el registro oficial no tiene. */
async function porNominatim(direccion: string, localidad: string, provincia: string) {
  const q = new URLSearchParams({
    format: "jsonv2",
    limit: "3",
    countrycodes: "ar",
    addressdetails: "0",
    q: [direccion, localidad, provincia, "Argentina"].filter(Boolean).join(", "),
  });
  const j = (await enFila(() =>
    traer(`https://nominatim.openstreetmap.org/search?${q}`, {
      // Obligatorio por su política, e imposible de mandar desde el navegador.
      "User-Agent": "PotentePropiedades/1.0 (inmobiliaria Mar del Plata; ju4nl0pezs@gmail.com)",
      "Accept-Language": "es",
    }),
  )) as Array<{ lat: string; lon: string; display_name?: string; name?: string }> | null;

  return (j ?? [])
    .filter((d) => d.lat && d.lon)
    .map((d): Encontrada => ({
      lat: Number(d.lat),
      lng: Number(d.lon),
      // El display_name completo es larguísimo ("…, Buenos Aires, B7600, Argentina").
      // Se recortan las tres primeras partes, que es lo que le sirve a una persona.
      etiqueta: (d.display_name ?? d.name ?? "").split(",").slice(0, 3).join(",").trim(),
      fuente: "nominatim",
    }));
}

/**
 * Mar del Plata y alrededores, con margen generoso (unos 60 km).
 * No es un filtro de seguridad: es para no ofrecerle a Mateo una "Córdoba 3719"
 * que en realidad está en la provincia de Córdoba, que es el error clásico de
 * geocodificar sin contexto.
 */
const CERCA_DE_MDP = (e: Encontrada) =>
  e.lat > -38.6 && e.lat < -37.5 && e.lng > -58.2 && e.lng < -57.0;

export interface PedidoGeo {
  direccion?: string;
  /** Barrio o zona: mejora muchísimo el acierto. */
  zona?: string;
  localidad?: string;
  provincia?: string;
}

export interface RespuestaGeo {
  resultados: Encontrada[];
  /** Si ninguno de los dos encontró nada, se dice y el panel centra el mapa. */
  aviso?: string;
}

/**
 * Busca la dirección. Primero el registro oficial; si no aparece, la segunda
 * opinión. NUNCA tira una excepción hacia arriba: un geocodificador caído no
 * puede impedir cargar una propiedad.
 */
export async function geocodificar(p: PedidoGeo): Promise<RespuestaGeo> {
  const direccion = (p.direccion ?? "").trim();
  if (direccion.length < 4) return { resultados: [], aviso: "Escribí la dirección para buscarla." };

  const localidad = (p.localidad ?? "Mar del Plata").trim();
  const provincia = (p.provincia ?? "Buenos Aires").trim();
  // La zona entra en la consulta de Nominatim, que sí la aprovecha.
  const zona = (p.zona ?? "").trim();

  const llave = `${direccion}|${zona}|${localidad}|${provincia}`.toLowerCase();
  const guardado = cache.get(llave);
  if (guardado && guardado.hasta > Date.now()) return { resultados: guardado.datos };

  let resultados = (await porGeoref(direccion, localidad, provincia)).filter(CERCA_DE_MDP);

  if (!resultados.length) {
    resultados = (await porNominatim(direccion, [zona, localidad].filter(Boolean).join(", "), provincia))
      .filter(CERCA_DE_MDP);
  }

  if (resultados.length) {
    if (cache.size >= TOPE_CACHE) cache.clear();
    cache.set(llave, { hasta: Date.now() + VIDA_CACHE_MS, datos: resultados });
    return { resultados };
  }

  return {
    resultados: [],
    aviso: "No la encontré. Tocá en el mapa dónde está la propiedad.",
  };
}
