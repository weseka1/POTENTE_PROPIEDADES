/**
 * MAPAS — de dónde salen los mosaicos y a dónde llevan los botones.
 * ─────────────────────────────────────────────────────────────────────────────
 * Hermano de `marca.ts`: acá no se decide nada de diseño, solo el proveedor.
 *
 * ¿Por qué existe este archivo y no está la URL suelta en el componente?
 * Porque la política de OpenStreetMap avisa que el acceso gratuito a sus
 * servidores de mosaicos puede retirarse. Si algún día hay que pasar a MapTiler
 * o a otro proveedor, es UN renglón acá y no una cacería por los componentes.
 *
 * ⚠️ Los mosaicos de OSM exigen que el navegador mande `Referer`. Nuestro
 * `Referrer-Policy: strict-origin-when-cross-origin` (en `server/index.ts`)
 * cumple. Si alguien lo pone en `no-referrer`, los mapas se cortan EN SILENCIO.
 */

export const MAPA = {
  /** Mosaicos. Uso liviano y con atribución, como pide la política de OSM. */
  mosaicos: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  /** Crédito obligatorio por la licencia (ODbL). Corto y sin links de terceros. */
  atribucion: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  zoomMax: 19,
  /** Zoom con el que se muestra una propiedad: se ve la cuadra y las de al lado. */
  zoomPropiedad: 16,
} as const;

/** Mar del Plata, para cuando todavía no hay coordenadas. */
export const CENTRO_MDP = { lat: -38.0055, lng: -57.5426 } as const;

/* ── Los botones ────────────────────────────────────────────────────────────
 * Se arman con COORDENADAS, nunca con el texto de la dirección. Es a propósito:
 * la queja de Mateo (audio del 7-ago) es que "en Google las calles no están
 * actualizadas o tienen otro nombre". Mandando lat/lng, Google no tiene que
 * interpretar nada y el pin cae donde nosotros decimos.
 *
 * `api=1` es la forma universal de Google: en la compu abre el navegador y en el
 * celular abre la app de Maps directo, sin pasar por la web.
 */

const coord = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

/** "Cómo llegar": arranca la navegación desde donde está el que consulta. */
export const linkComoLlegar = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${coord(lat, lng)}`;

/** "Abrir en Maps": la ficha del lugar, para mirar alrededor. */
export const linkEnMaps = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${coord(lat, lng)}`;

/**
 * "Ver en satélite": Google Maps en vista satelital, clavado en el pin a ~80 m
 * de altura. Es un LINK, no una API: gratis, sin key. Lo usa el PANEL para
 * verificar hacia dónde da el frente antes de marcar el pétalo de la brújula:
 * se ve el techo, el lote y la calle desde arriba CON EL NORTE HACIA ARRIBA —
 * para orientación es mejor que la foto de la fachada.
 *
 * 🔴 Por qué NO Street View: se probó (11-ago) y donde Google no tiene fotos de
 * esa cuadra el link abre una PANTALLA NEGRA — le pasó a Juani a la primera. La
 * cobertura en la costa es despareja y saber si hay panorama exige la Static
 * API, que es paga. El satélite existe en todos lados, siempre. (Desde el
 * satélite, arrastrar el muñequito a la calle son dos clics para quien quiera
 * la fachada igual.)
 */
export const linkSatelite = (lat: number, lng: number) =>
  `https://www.google.com/maps/@${coord(lat, lng)},80m/data=!3m1!1e3`;
