/**
 * UN TIMEOUT DE FETCH QUE FUNCIONA EN TODOS LOS NAVEGADORES DE VERDAD.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 31-ago · `AbortSignal.timeout` no existe en Safari ≤15.3 (todo iOS 15) ni
 * en Chrome ≤102 / Firefox ≤99, y no hay polyfill en el proyecto. En esos
 * navegadores tiraba TypeError ADENTRO del try, en LOS DOS intentos del
 * asistente: el visitante con un iPhone viejo escribía "hola" y recibía
 * "se me cortó la conexión, escribímelo de nuevo" — reintentar jamás iba a
 * andar. El widget quedaba muerto para esa persona, con un mensaje que mentía.
 * El bundle SÍ carga en esos navegadores (target de Vite ≈ Safari 14), así que
 * el chat se veía perfecto: la trampa era invisible hasta el primer mensaje.
 */
export function corteEn(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}
