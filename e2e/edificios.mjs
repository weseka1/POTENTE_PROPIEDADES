/**
 * LOS EDIFICIOS DEL 3D — la prueba que faltaba.
 * ─────────────────────────────────────────────────────────────────────────────
 *   APP=https://potentepropiedades.com node e2e/edificios.mjs
 *
 * 🔴 POR QUÉ EXISTE (25-ago). El proxy apuntaba a `buildings20260617`, un nombre
 * CON FECHA. ShadeMap rotó el dataset y el viejo empezó a devolver 403. Todos
 * los tiles fallaron, en TODAS las propiedades, y el visor 3D cayó al respaldo
 * de OSM — que en pueblos chicos casi no tiene edificios. La web mostraba "en
 * esta zona los edificios todavía no están relevados" y el cartel parecía
 * razonable: nadie sospechó nada hasta que Juani abrió una ficha y le pareció
 * raro. El riesgo estaba ANOTADO desde el 11-ago y aun así se nos pasó, porque
 * ninguna prueba lo miraba.
 *
 * Esta prueba mira lo único que importa: que el proxy devuelva BYTES DE VERDAD
 * para tiles conocidos. Si el proveedor vuelve a rotar el nombre, se pone roja
 * el mismo día — y no lo descubre el cliente.
 *
 * Los tiles son z14, calculados sobre coordenadas reales de la cartera.
 */
const APP = process.env.APP || "http://localhost:3000";

/* 🔴 Los tiles NO se eligen a ojo: son los que más propiedades de la cartera
 * cubren, calculados sobre las coordenadas reales, y su peso está MEDIDO contra
 * el origen. (Primera versión de esta prueba: puse un tile "de la zona sur"
 * a ojo, resultó estar vacío, y la prueba se puso roja acusando a un proxy sano.
 * Un umbral inventado es un test que miente igual que uno que pasa de más.) */
const TILES = [
  { x: 5572, y: 10067, donde: "el tile con más propiedades (23)", minimo: 100_000 }, // medido: 143.449 b
  { x: 5572, y: 10068, donde: "el segundo con más propiedades (17)", minimo: 70_000 }, // medido: 103.054 b
  { x: 5552, y: 10084, donde: "Mar del Sur, el pueblo chico del caso", minimo: 10_000 }, // medido: 20.414 b
];

let ok = 0;
const fallos = [];
const chequear = (n, cond, extra = "") => {
  if (cond) { ok++; console.log(`PASS  ${n}${extra ? " :: " + extra : ""}`); }
  else { fallos.push(n); console.log(`FAIL  ${n}${extra ? " :: " + extra : ""}`); }
};

console.log(`\n🏙️  Edificios del 3D contra ${APP}\n`);

for (const t of TILES) {
  const t0 = Date.now();
  let r, bytes = 0, cuerpo = "";
  try {
    r = await fetch(`${APP}/api/edificios/${t.x}/${t.y}`, { signal: AbortSignal.timeout(30_000) });
    const buf = await r.arrayBuffer();
    bytes = buf.byteLength;
    if (r.headers.get("content-type")?.includes("json")) cuerpo = new TextDecoder().decode(buf).slice(0, 120);
  } catch (e) {
    chequear(`Tile del ${t.donde} responde`, false, String(e).slice(0, 80));
    continue;
  }
  const ms = Date.now() - t0;
  chequear(`Tile del ${t.donde} responde 200`, r.status === 200, `HTTP ${r.status}${cuerpo ? " · " + cuerpo : ""}`);
  chequear(`…con edificios de verdad adentro (> ${t.minimo} bytes)`, bytes > t.minimo, `${bytes} bytes en ${ms} ms`);
  // La segunda vez tiene que salir de cache (memoria o disco) y ser rápida.
  const t1 = Date.now();
  const r2 = await fetch(`${APP}/api/edificios/${t.x}/${t.y}`, { signal: AbortSignal.timeout(30_000) });
  const ms2 = Date.now() - t1;
  chequear("…y la segunda vez sale de la cache, rápido", r2.status === 200 && ms2 < 1500, `${ms2} ms`);
}

// Un tile fuera de rango no puede tirar 500.
const malo = await fetch(`${APP}/api/edificios/99999/1`, { signal: AbortSignal.timeout(20_000) });
chequear("Un tile inválido se rechaza con 400, no con un 500", malo.status === 400, `HTTP ${malo.status}`);

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====\n`);
if (fallos.length) {
  console.log("🔴 Si fallan los tiles: lo más probable es que ShadeMap haya vuelto a rotar el nombre");
  console.log("   del dataset. Se prueba a mano y se cambia EDIFICIOS_ORIGEN en server/index.ts:\n");
  console.log("   curl -sI https://cfw.shademap.app/buildings/14/5573/10064.mlt\n");
}
process.exit(fallos.length ? 1 : 0);
