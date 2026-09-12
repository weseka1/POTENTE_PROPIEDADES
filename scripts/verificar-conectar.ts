/**
 * EL CANDADO DE /conectar, PROBADO EN FRÍO.
 * ─────────────────────────────────────────────────────────────────────────────
 * Es la pieza que decide si un flujo de Meta toca algo o no toca nada, y con un
 * `code` real NO se puede probar: vence a los 30 segundos, es de un solo uso, y
 * del otro lado está el teléfono de la oficina que atiende todo el día. O sea:
 * se prueba acá, en frío, o no se prueba nunca. `e2e/conectar.mjs` cubre la
 * cáscara (código inventado, cuerpo vacío, 404) pero jamás llega hasta acá.
 *
 * 🔴 Y este candado ya estuvo MAL una vez, doce días sin que nadie lo notara:
 * exigía que el token viera el portfolio de siempre, cuando Meta obliga a que
 * el flujo venga de otro. Habría cortado con 403 DESPUÉS del QR, con el celular
 * ya tocado para siempre. Nunca se ejecutó, así que nadie lo vio fallar. Esta
 * suite existe para que la próxima vez falle acá y no en la oficina.
 *
 *   npm run verificar-conectar
 */
import { colaTelefono, esDelCliente, soloDigitos, telefonosDelCliente } from "../netlify/functions/_conectar";
import { OFICINAS } from "../src/config/marca";

let ok = 0;
const fallos: string[] = [];
const igual = (nombre: string, real: unknown, esperado: unknown) => {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  if (r === e) { ok++; console.log(`  ✓ ${nombre}`); }
  else fallos.push(`  ✗ ${nombre}\n      esperado ${e}\n      real     ${r}`);
};
const cierto = (nombre: string, cond: boolean, detalle = "") => {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else fallos.push(`  ✗ ${nombre}${detalle ? `\n      ${detalle}` : ""}`);
};

console.log("\n🔒 El candado de /conectar\n");

/* ── 1 · La lista blanca sale de marca.ts, no de un número escrito a mano ──── */
const lista = telefonosDelCliente();
igual("la lista sale de las oficinas de marca.ts, sin hardcodear", lista.length, OFICINAS.length);
cierto("…y ahí está Chauvín", esDelCliente("5492235129032", lista));
cierto("…y ahí está Punta Mogotes", esDelCliente("5492235851198", lista));

/* ── 2 · El mismo teléfono, escrito de las cuatro formas que usa Meta ──────── */
const FORMAS = [
  "+54 9 223 512-9032",   // como viene en metadata.display_phone_number
  "5492235129032",        // como viene en messages[].from
  "542235129032",         // sin el 9
  "2235129032",           // pelado
  " +54-9-223-512-9032 ", // con basura alrededor
];
for (const f of FORMAS) {
  cierto(`"${f.trim()}" se reconoce como Chauvín`, esDelCliente(f, lista),
    `cola=${colaTelefono(f)}`);
}
igual("las cinco formas dan la misma cola", new Set(FORMAS.map(colaTelefono)).size, 1);

/* ── 3 · 🔴 Lo que TIENE que rebotar ───────────────────────────────────────── */
cierto("el número de un desconocido NO pasa", !esDelCliente("5491155667788", lista));
cierto("un número de otro país NO pasa", !esDelCliente("+1 415 555 0100", lista));
cierto("un número parecido pero distinto NO pasa", !esDelCliente("5492235129033", lista));
cierto("vacío NO pasa", !esDelCliente("", lista));
cierto("null NO pasa", !esDelCliente(null, lista));
cierto("texto NO pasa", !esDelCliente("hola", lista));
cierto("un número corto NO pasa (no se compara media cola)", !esDelCliente("5129032", lista));

/* 🔴 La puerta cierra sola: SIN lista, no pasa nadie. Nunca "por las dudas sí".
 * Es la misma regla que la RLS: permiso por defecto CERO. */
cierto("sin lista blanca, ni el número real de la oficina pasa", !esDelCliente("5492235129032", []));

/* ── 4 · El entorno SUMA, no reemplaza ─────────────────────────────────────── */
const conExtra = telefonosDelCliente("5492233029591, 5491133334444");
cierto("un teléfono sumado por entorno pasa", esDelCliente("5492233029591", conExtra));
cierto("…y los de marca.ts siguen pasando", esDelCliente("5492235129032", conExtra));
igual("…y no se duplica lo que ya estaba", telefonosDelCliente("5492235129032").length, lista.length);
igual("basura en el entorno no rompe la lista", telefonosDelCliente(",,  ; ").length, lista.length);
igual("entorno sin definir no rompe la lista", telefonosDelCliente(undefined).length, lista.length);

/* ── 5 · Nada de esto puede TIRAR ──────────────────────────────────────────── */
let tiro = "";
for (const v of [null, undefined, {}, [], 0, NaN, Infinity, "   ", "+++"]) {
  try { soloDigitos(v); colaTelefono(v); esDelCliente(v, lista); }
  catch (e) { tiro = `${JSON.stringify(v)} → ${String(e)}`; break; }
}
cierto("ningún valor raro hace tirar al candado", tiro === "", tiro);

console.log("");
if (fallos.length) {
  console.log(fallos.join("\n"));
  console.log(`\n❌ ${ok} pasaron · ${fallos.length} fallaron\n`);
  process.exit(1);
}
console.log(`✅ ${ok}/${ok} — solo un teléfono de Potente abre esta puerta\n`);
