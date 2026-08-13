/**
 * REGISTRO DE LLAVES — el flujo completo, como lo hace el equipo.
 * ─────────────────────────────────────────────────────────────────────────────
 * Existe porque este módulo salió de un problema REAL de la oficina (audios de
 * Mateo, 12-ago-2026: un juego de llaves que estuvo un año sin ubicar). Lo que
 * se prueba es el recorrido de verdad, con clicks reales:
 *   cargar una llave → verla en la lista → entregarla a alguien → que la lista
 *   diga a quién y desde cuándo → que el historial tenga los dos movimientos →
 *   devolverla → borrarla.
 *
 * ⚠️ Deja la base como la encontró: la llave de sonda usa un número alto
 * (8801) y al final se borra. Si el script se corta a mitad, borrarla a mano:
 *   delete from potente_llaves where propietario = 'SondaVerificacion';
 *
 * ⚠️ El aislamiento entre oficinas NO se prueba acá: eso es de la base y lo
 * cubre `npm run verificar-db` (Chauvín no ve la llave de Mogotes, no puede
 * mudarla ni anotarle un movimiento).
 *
 * USO: APP=http://localhost:3000 node e2e/llaves.mjs
 */
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";
import { pedirSesion, guionSesion } from "./login.mjs";

const NUM = 8801; // alto a propósito: no choca con el llavero real
const APELLIDO = "SondaVerificacion";

const { send, evaluar, ir, cerrar, URL_APP } = await nuevaPestania();
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await ir(URL_APP + "/", 3000);
const sesion = await pedirSesion("mateo");
await evaluar(guionSesion(sesion));
await ir(URL_APP + "/panel/llaves", 7000);

const clickBoton = async (texto) => {
  const p = JSON.parse(await evaluar(`
    const b = [...document.querySelectorAll("button")].find(x => (x.textContent||"").includes(${JSON.stringify(texto)}));
    if (!b) return JSON.stringify({ falta: true });
    const r = b.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
  `));
  if (p.falta) return false;
  // Eventos REALES: `.click()` da verde sobre botones muertos (cicatriz de la galería).
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 1300));
  return true;
};

const escribir = (ph, valor) => evaluar(`
  const i = [...document.querySelectorAll("input, textarea")].find(x => (x.placeholder||"") === ${JSON.stringify(ph)});
  if (!i) return "falta";
  const proto = i.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(i, ${JSON.stringify(valor)});
  i.dispatchEvent(new Event("input", { bubbles: true }));
  return "ok";
`);

const filaSonda = () => evaluar(`
  const tr = [...document.querySelectorAll("tbody tr")].find(x => (x.innerText||"").includes(${JSON.stringify(APELLIDO)}));
  return tr ? (tr.innerText || "") : "";
`);

/* ── La pantalla existe y está en el menú ──────────────────────────────────── */
const base = JSON.parse(await evaluar(`
  const h1 = document.querySelector("h1");
  return JSON.stringify({
    titulo: h1 ? (h1.textContent || "").trim() : "",
    enElMenu: [...document.querySelectorAll("a")].some(a => (a.getAttribute("href")||"") === "/panel/llaves"),
    buscaPorApellido: [...document.querySelectorAll("input")].some(i => (i.placeholder||"").includes("apellido")),
    ordenaPorNumero: [...document.querySelectorAll("button")].some(b => (b.textContent||"").includes("por número")),
  });
`));
chequear("La sección Llaves está en el menú del panel", base.enElMenu);
chequear("La página abre con su título", base.titulo === "Registro de llaves", base.titulo);
chequear("Se busca por número, apellido o dirección", base.buscaPorApellido);
chequear("Se puede ordenar por número (y por apellido)", base.ordenaPorNumero);

/* ── Alta: los campos que pidió Mateo ──────────────────────────────────────── */
await clickBoton("Nueva llave");
const campos = JSON.parse(await evaluar(`
  const phs = [...document.querySelectorAll("input, textarea")].map(i => i.placeholder || "");
  return JSON.stringify({ numero: phs.includes("12"), apellido: phs.some(p => p.includes("Gutiérrez")), direccion: phs.some(p => p.includes("Córdoba")) });
`));
chequear("El alta pide número, apellido del dueño y dirección", campos.numero && campos.apellido && campos.direccion, JSON.stringify(campos));

await escribir("12", String(NUM));
await escribir("Gutiérrez", APELLIDO);
await escribir("Córdoba 3712, Chauvín", "Calle de prueba 123");
await clickBoton("Registrar");
await new Promise((r) => setTimeout(r, 2500));

const trasAlta = await filaSonda();
chequear("La llave nueva aparece en la lista con su número", trasAlta.includes(String(NUM)), trasAlta.slice(0, 60));
chequear("…y nace EN LA OFICINA", trasAlta.includes("En la oficina"));

/* ── Entregarla: el pedido central («a quién se las entregamos») ───────────── */
await evaluar(`window.prompt = () => "Albanil de prueba"; return 1;`);
const clickPrimerBotonDeLaFila = async (indice) => {
  const p = JSON.parse(await evaluar(`
    const tr = [...document.querySelectorAll("tbody tr")].find(x => (x.innerText||"").includes(${JSON.stringify(APELLIDO)}));
    if (!tr) return JSON.stringify({ falta: true });
    const bs = [...tr.querySelectorAll("button")];
    const b = ${indice} < 0 ? bs[bs.length + ${indice}] : bs[${indice}];
    if (!b) return JSON.stringify({ falta: true });
    const r = b.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
  `));
  if (p.falta) return false;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 2500));
  return true;
};
await clickPrimerBotonDeLaFila(0); // "Se la lleva alguien"
const trasEntrega = await filaSonda();
chequear("Entregada: la lista dice el estado", trasEntrega.includes("Entregada"));
chequear("🔑 …y DICE A QUIÉN (el corazón del pedido)", trasEntrega.includes("Albanil de prueba"), trasEntrega.slice(0, 80));

/* ── El historial de esa llave ─────────────────────────────────────────────── */
const abrir = JSON.parse(await evaluar(`
  const tr = [...document.querySelectorAll("tbody tr")].find(x => (x.innerText||"").includes(${JSON.stringify(APELLIDO)}));
  const r = tr.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + 250), y: Math.round(r.y + r.height/2) });
`));
await send("Input.dispatchMouseEvent", { type: "mousePressed", x: abrir.x, y: abrir.y, button: "left", clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: abrir.x, y: abrir.y, button: "left", clickCount: 1 });
await new Promise((r) => setTimeout(r, 1500));
const hist = JSON.parse(await evaluar(`
  const t = document.body.innerText || "";
  return JSON.stringify({
    ingreso: t.includes("Ingresó al llavero"),
    entrega: t.includes("Se la llevó"),
    enPoderDe: t.includes("en poder de"),
    ofreceDevolver: t.includes("Volvió al llavero"),
  });
`));
chequear("El historial guarda el ingreso al llavero", hist.ingreso);
chequear("El historial guarda la entrega", hist.entrega);
chequear("El panel dice en poder de quién está", hist.enPoderDe);
chequear("Ofrece devolverla al llavero", hist.ofreceDevolver);

/* ── Devolverla ────────────────────────────────────────────────────────────── */
await clickBoton("Volvió al llavero");
await new Promise((r) => setTimeout(r, 2000));
const trasDevolver = await filaSonda();
chequear("Al devolverla vuelve a EN LA OFICINA", trasDevolver.includes("En la oficina"), trasDevolver.slice(0, 60));
chequear("…y ya no figura en poder de nadie", !trasDevolver.includes("Albanil de prueba"));

/* ── Limpieza: la sonda no queda en el llavero del cliente ─────────────────── */
await evaluar(`window.confirm = () => true; return 1;`);
await clickPrimerBotonDeLaFila(-1); // el último botón de la fila es borrar
const limpio = await evaluar(`return (document.body.innerText || "").includes(${JSON.stringify(APELLIDO)}) ? "queda" : "limpio"`);
chequear("La llave de prueba se borró (la base queda como estaba)", limpio === "limpio", limpio);

await cerrar();
resumen();
