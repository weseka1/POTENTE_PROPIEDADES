/**
 * REGISTRO DE LLAVES — el flujo completo, como lo hace el equipo.
 * ─────────────────────────────────────────────────────────────────────────────
 * Existe porque este módulo salió de un problema REAL de la oficina (audios de
 * Mateo, 12-ago-2026: un juego de llaves que estuvo un año sin ubicar). Lo que
 * se prueba es el recorrido de verdad, con clicks reales:
 *   cargar una llave → verla en la lista → abrir SU historial (acordeón) →
 *   entregarla a alguien por el modal → que la lista diga a quién →
 *   devolverla → borrarla confirmando en el modal.
 *
 * ⚠️ TODOS los diálogos son del sistema: no hay `window.prompt` ni
 * `window.confirm` que interceptar (se sacaron el 12-ago a pedido de Juani:
 * *"¿por qué salen anotaciones desde Google? debe pasar todo por el sistema"*).
 * Si una prueba de acá vuelve a necesitar `window.confirm = () => true`, es que
 * alguien reintrodujo un diálogo del navegador.
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

/** Click REAL sobre un botón por su texto. `.click()` da verde sobre botones
 *  muertos (cicatriz de la galería), así que siempre eventos de mouse. */
const clickBoton = async (texto, dentroDelModal = false) => {
  const p = JSON.parse(await evaluar(`
    const raiz = ${dentroDelModal} ? document.querySelector('[role="dialog"]') : document;
    if (!raiz) return JSON.stringify({ falta: true });
    const b = [...raiz.querySelectorAll("button")].find(x => (x.textContent||"").includes(${JSON.stringify(texto)}));
    if (!b) return JSON.stringify({ falta: true });
    b.scrollIntoView({ block: "center" });
    await new Promise(r => setTimeout(r, 400));
    const r = b.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
  `));
  if (p.falta) return false;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 1500));
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

/** Click en la fila de la llave de sonda: abre/cierra SU historial. */
const clickFilaSonda = async () => {
  const p = JSON.parse(await evaluar(`
    const tr = [...document.querySelectorAll("tbody tr")].find(x => (x.innerText||"").includes(${JSON.stringify(APELLIDO)}));
    if (!tr) return JSON.stringify({ falta: true });
    tr.scrollIntoView({ block: "center" });
    await new Promise(r => setTimeout(r, 400));
    const r = tr.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + 300), y: Math.round(r.y + r.height/2) });
  `));
  if (p.falta) return false;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 1200));
  return true;
};

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

/* 🔴 EL BUG DEL 13-ago. El alta no mandaba `oficina`: la llave nacía "sin
 * llavero", NINGUNA oficina la veía (el scope filtra por igualdad) y el número
 * chocaba contra el índice único de la central. Mateo lo grabó: «me tira este
 * error… en admin me aparece, pero no en la oficina donde la cargué».
 * Estas tres pruebas cierran esa puerta. La sesión es de DIRECCIÓN, que no
 * tiene llavero propio y por eso tiene que elegir uno. */
await clickBoton("Registrar");
await new Promise((r) => setTimeout(r, 1200));
const sinElegir = await evaluar(`
  return JSON.stringify({
    sigueAbierto: Boolean(document.querySelector('[role="dialog"]')),
    aviso: (document.body.innerText || "").includes("Elegí a qué llavero"),
  });
`);
const se = JSON.parse(sinElegir);
chequear("🔑 Sin elegir llavero NO guarda, y lo dice", se.sigueAbierto && se.aviso, sinElegir);

await clickBoton("Punta Mogotes");
await clickBoton("Registrar");
await new Promise((r) => setTimeout(r, 2500));

const trasAlta = await filaSonda();
chequear("La llave nueva aparece en la lista con su número", trasAlta.includes(String(NUM)), trasAlta.slice(0, 60));
chequear("…y nace EN LA OFICINA", trasAlta.includes("En la oficina"));
chequear("🔑 …y queda en el llavero elegido, no huérfana", trasAlta.includes("Punta Mogotes") && !trasAlta.includes("Sin llavero"), trasAlta.slice(0, 90));

/* ── El historial de ESA llave se abre y se cierra (pedido 12-ago) ─────────── */
await clickFilaSonda();
const abierto = JSON.parse(await evaluar(`
  const t = document.body.innerText || "";
  return JSON.stringify({
    acciones: t.includes("Se la lleva alguien"),
    ingreso: t.includes("Ingresó al llavero"),
    cerrar: t.includes("Cerrar"),
  });
`));
chequear("🔑 Al tocar la llave se abre SU historial", abierto.acciones && abierto.cerrar, JSON.stringify(abierto));
chequear("El historial guarda el ingreso al llavero", abierto.ingreso);

await clickFilaSonda(); // se cierra con el mismo click
chequear(
  "…y se cierra volviendo a tocarla",
  (await evaluar(`return (document.body.innerText||"").includes("Se la lleva alguien") ? "abierto" : "cerrado"`)) === "cerrado",
);

/* ── Entregarla: el pedido central («a quién se las entregamos») ───────────── */
// Botón de la fila (el primero de Acciones), sin abrir el acordeón.
const clickBotonDeLaFila = async (indice) => {
  const p = JSON.parse(await evaluar(`
    const tr = [...document.querySelectorAll("tbody tr")].find(x => (x.innerText||"").includes(${JSON.stringify(APELLIDO)}));
    if (!tr) return JSON.stringify({ falta: true });
    const bs = [...tr.querySelectorAll("button")];
    const b = ${indice} < 0 ? bs[bs.length + ${indice}] : bs[${indice}];
    if (!b) return JSON.stringify({ falta: true });
    b.scrollIntoView({ block: "center" });
    await new Promise(r => setTimeout(r, 400));
    const r = b.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
  `));
  if (p.falta) return false;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 1500));
  return true;
};

await clickBotonDeLaFila(0);
const modalEntrega = JSON.parse(await evaluar(`
  const d = document.querySelector('[role="dialog"]');
  const t = d ? (d.innerText || "") : "";
  return JSON.stringify({ abrio: t.includes("¿Quién se lleva la llave?"), pideNombre: Boolean(d && [...d.querySelectorAll("input")].some(i => (i.placeholder||"").includes("albañil"))), tieneFecha: Boolean(d && d.querySelector('input[type="date"]')) });
`));
chequear("🚫 Pide el dato con un modal NUESTRO, no con el cuadro del navegador", modalEntrega.abrio && modalEntrega.pideNombre, JSON.stringify(modalEntrega));
chequear("…y de paso deja elegir la fecha (el prompt del navegador no podía)", modalEntrega.tieneFecha);

await escribir("Propietario, albañil, inquilino, otra inmobiliaria…", "Albanil de prueba");
await clickBoton("Anotar la entrega", true);
await new Promise((r) => setTimeout(r, 2000));

const trasEntrega = await filaSonda();
chequear("Entregada: la lista dice el estado", trasEntrega.includes("Entregada"), trasEntrega.slice(0, 70));
chequear("🔑 …y DICE A QUIÉN (el corazón del pedido)", trasEntrega.includes("Albanil de prueba"), trasEntrega.slice(0, 90));

/* ── El movimiento quedó en el historial ───────────────────────────────────── */
await clickFilaSonda();
chequear(
  "El historial guarda la entrega con su nombre",
  (await evaluar(`return (document.body.innerText||"").includes("Se la llevó") ? "si" : "no"`)) === "si",
);

/* ── Devolverla ────────────────────────────────────────────────────────────── */
await clickBoton("Volvió al llavero");
await new Promise((r) => setTimeout(r, 2000));
const trasDevolver = await filaSonda();
chequear("Al devolverla vuelve a EN LA OFICINA", trasDevolver.includes("En la oficina"), trasDevolver.slice(0, 60));
chequear("…y ya no figura en poder de nadie", !trasDevolver.includes("Albanil de prueba"));

/* ── Borrar: confirmación del sistema, no del navegador ────────────────────── */
await clickBotonDeLaFila(-1); // el último botón de la fila es borrar
const modalBorrar = await evaluar(`
  const d = document.querySelector('[role="dialog"]');
  return d ? (d.innerText || "") : "";
`);
chequear("🚫 Borrar pide confirmación en un modal del sistema", modalBorrar.includes("¿Borrar la llave del registro?"), modalBorrar.slice(0, 60));
await clickBoton("Borrar", true);
await new Promise((r) => setTimeout(r, 2000));
const limpio = await evaluar(`return (document.body.innerText || "").includes(${JSON.stringify(APELLIDO)}) ? "queda" : "limpio"`);
chequear("La llave de prueba se borró (la base queda como estaba)", limpio === "limpio", limpio);

await cerrar();
resumen();
