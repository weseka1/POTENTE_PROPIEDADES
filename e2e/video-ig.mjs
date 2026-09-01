/**
 * video-ig.mjs — coreografía para los VIDEOS de App Review de Instagram.
 *
 * 1-sep-2026. Meta pide, para `instagram_basic` e `instagram_manage_messages`,
 * un video con "la experiencia de usuario final". Este guion maneja el panel
 * REAL (producción, sesión de la dirección) en un Chrome visible mientras
 * ffmpeg lo graba desde afuera:
 *   Escena A (basic):   pestaña Canales — la cuenta de Instagram conectada.
 *   Escena B (manage):  la bandeja — abrir el hilo del IG de Juani (nuestro,
 *                       para no molestar a nadie) y responderle de verdad.
 *
 * Corre contra el Chrome de :9222 que levanta quien graba. No es una suite:
 * no afirma nada, solo actúa con pausas para que la cámara respire.
 *   APP=https://potentepropiedades.com node e2e/video-ig.mjs
 */
import { nuevaPestania } from "./cdp.mjs";
import { pedirSesion, guionSesion } from "./login.mjs";

const pausa = (s) => new Promise((r) => setTimeout(r, s * 1000));
const { send, evaluar, ir, URL_APP } = await nuevaPestania();

/* 🔴 Los CLICKS van con evaluación SÍNCRONA (sin awaitPromise): un click que
 * re-renderiza la vista puede reciclar el contexto de la página y la promesa
 * del wrapper async no vuelve nunca — el guion quedó colgado ahí una vez. */
const suelto = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(() => { ${expr} })()`, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "error");
  return r.result.value;
};

const click = (texto) => suelto(`
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith(${JSON.stringify(texto)}));
  if (!b) throw new Error("no encontré el botón: " + ${JSON.stringify(texto)});
  b.click(); return true;
`);

console.log("· login…");
await ir(URL_APP + "/", 3000);
const sesion = await pedirSesion("mateo");
await evaluar(guionSesion(sesion));
await ir(URL_APP + "/panel/asistente", 6000);

console.log("· escena A: Canales (instagram_basic)");
await click("Canales");
await pausa(11);

console.log("· escena B: la bandeja (instagram_manage_messages)");
await click("Conversaciones");
await pausa(4);

// Con reintento: la lista puede tardar un render en volver del cambio de pestaña.
let abierto = null;
for (let i = 0; i < 10 && !abierto; i++) {
  abierto = await suelto(`
    const nodos = [...document.querySelectorAll("button")];
    const hilo = nodos.find((n) => n.textContent.includes("Juani") && n.textContent.includes("Lopez"));
    if (!hilo) return null;
    hilo.click(); return (hilo.textContent || "").slice(0, 50);
  `);
  if (!abierto) await pausa(1);
}
if (!abierto) {
  const diag = await suelto(`
    return JSON.stringify([...document.querySelectorAll("button")].map((x) => x.textContent.trim().slice(0, 50)).slice(0, 40));
  `);
  throw new Error("no encontré el hilo tras 10 intentos. BOTONES EN PANTALLA: " + diag);
}
console.log("  hilo:", abierto);
await pausa(4);

// El hilo está en manos de Marina: para escribir, primero se toma.
const tomado = await suelto(`
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith("Tomar la conversaci"));
  if (b) { b.click(); return true; } return false;
`);
console.log("  tomar la conversación:", tomado);
await pausa(3);

console.log("· escribir y enviar");
await suelto(`
  const ta = document.querySelector("textarea");
  if (!ta) throw new Error("sin textarea");
  const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  set.call(ta, "¡Gracias por tu consulta! Te paso con un asesor de la oficina para coordinar 👋");
  ta.dispatchEvent(new Event("input", { bubbles: true })); return true;
`);
await pausa(3);
if (process.env.SECO) { console.log("· SECO: no se envía"); process.exit(0); }
await click("Enviar");
await pausa(9);

// Se devuelve el hilo a Marina: la cámara ya cortó y ella no queda muda acá.
await suelto(`
  const b = [...document.querySelectorAll("button")].find((x) => /Devolver/i.test(x.textContent));
  if (b) b.click(); return true;
`);
await pausa(2);
console.log("· listo");
process.exit(0);
