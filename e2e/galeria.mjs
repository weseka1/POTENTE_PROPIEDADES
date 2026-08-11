/**
 * Los controles de la galería, con MOUSE DE VERDAD.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 EL BUG QUE ESTO EXISTE PARA QUE NO VUELVA (8-ago-2026, lo vio Juani):
 * la flecha de "foto siguiente" no hacía nada.
 *
 * La causa: el gesto de arrastre hace `setPointerCapture` en el marco de la
 * galería. Al capturar el puntero, el navegador re-dirige al marco todos los
 * eventos siguientes Y el `click` que viene después — así que las flechas, que
 * viven adentro del marco, nunca recibían su click.
 *
 * ⚠️ Y LO PEOR: con `.click()` por código FUNCIONABA. Un click sintético no pasa
 * por el hit-testing ni por la captura de puntero, así que cualquier prueba
 * escrita con `.click()` daba verde sobre un botón muerto. Por eso todo acá se
 * hace con `Input.dispatchMouseEvent`, que es un click de verdad.
 *
 * (Está anotado en e2e/README.md, y esta es la segunda vez que nos muerde.)
 *
 * USO: APP=http://localhost:3000 node e2e/galeria.mjs
 */
import { nuevaPestania } from "./cdp.mjs";

const { send, evaluar, ir, cerrar, URL_APP } = await nuevaPestania();

let ok = 0;
const fallos = [];
const chequear = (n, paso, extra = "") => {
  if (paso) { ok++; console.log(`PASS  ${n}${extra ? ` · ${extra}` : ""}`); }
  else { fallos.push(`${n}${extra ? ` · ${extra}` : ""}`); console.log(`FAIL  ${n}${extra ? ` · ${extra}` : ""}`); }
};

// ⚠️ Sin expresiones regulares acá: el driver envuelve el string en una función y
// una barra suelta revienta con "Invalid regular expression".
const CONTADOR =
  'const e = [...document.querySelectorAll("span,div")].map(x => (x.textContent||"").trim())' +
  '  .find(t => t.length < 8 && t.indexOf("/") > 0); return e || "?";';

/** Número de la última miniatura que está ENTERA dentro del scroller. */
const VISIBLE_EN_LA_TIRA =
  'const minis = [...document.querySelectorAll("button")].filter(b => (b.getAttribute("aria-label")||"").indexOf("Ver foto") === 0);' +
  'const tira = minis[0] && minis[0].parentElement;' +
  'if (!tira) return 0;' +
  'const t = tira.getBoundingClientRect();' +
  'let ultima = 0;' +
  'minis.forEach((b, i) => { const r = b.getBoundingClientRect(); if (r.x >= t.x - 1 && r.right <= t.right + 1) ultima = i + 1; });' +
  'return ultima;';

/** Click de MOUSE en el centro del botón. NO usar .click() (ver cabecera). */
const clickReal = async (etiqueta) => {
  const p = JSON.parse(await evaluar(
    'const b = [...document.querySelectorAll("button")].find(x => (x.getAttribute("aria-label")||"") === "' + etiqueta + '");' +
    'if (!b) return JSON.stringify({ falta: true });' +
    'const r = b.getBoundingClientRect();' +
    'const cx = Math.round(r.x + r.width/2), cy = Math.round(r.y + r.height/2);' +
    'const encima = document.elementFromPoint(cx, cy);' +
    'return JSON.stringify({ x: cx, y: cy, leLlega: encima ? (encima === b || b.contains(encima)) : false });'
  ));
  if (p.falta) return { error: `no existe el botón "${etiqueta}"` };
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 800));
  return { leLlega: p.leLlega, ahora: await evaluar(CONTADOR) };
};

// Una propiedad real con muchas fotos.
const PROP = "POT-191694";

for (const [nombre, w, h] of [["Escritorio 1440x900", 1440, 900], ["Celular 390x844", 390, 844]]) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: w, height: h, deviceScaleFactor: 1, mobile: w < 500,
  });
  // ⚠️ `maxTouchPoints` tiene que ser 1-16 SIEMPRE, incluso apagando el touch:
  // con 0 el protocolo tira "Touch points must be between 1 and 16".
  await send("Emulation.setTouchEmulationEnabled", { enabled: w < 500, maxTouchPoints: 5 });
  await ir(URL_APP + "/propiedad/" + PROP, 4500);

  console.log(`\n── ${nombre} ──`);
  const inicio = await evaluar(CONTADOR);
  chequear(`${nombre}: la galería arranca en la primera foto`, inicio.startsWith("1 /"), inicio);

  // ⚠️ Aserciones ABSOLUTAS ("tiene que decir 2 / 12"), no relativas ("cambió").
  // Con el bug puesto, un "retrocede" escrito como `c.ahora === a.ahora` pasaba
  // de arriba: nada se movía nunca, así que las dos lecturas coincidían.
  const a = await clickReal("Foto siguiente");
  chequear(`${nombre}: el click LLEGA a la flecha (nada encima)`, a.leLlega === true);
  chequear(`${nombre}: "Foto siguiente" va a la 2`, a.ahora.startsWith("2 /"), `${inicio} → ${a.ahora}`);

  const b = await clickReal("Foto siguiente");
  chequear(`${nombre}: y de ahí a la 3`, b.ahora.startsWith("3 /"), `${a.ahora} → ${b.ahora}`);

  const c = await clickReal("Foto anterior");
  chequear(`${nombre}: "Foto anterior" vuelve a la 2`, c.ahora.startsWith("2 /"), `${b.ahora} → ${c.ahora}`);

  // Las miniaturas también tienen que responder a un click real. Se elige la
  // última que esté ENTERA a la vista: la tira es un scroller horizontal y las
  // de la cola están recortadas — clickear una recortada no prueba nada (el
  // click cae en el borde del scroller, no en el botón).
  //
  // ⚠️ La visibilidad se mide contra LA TIRA, no contra la ventana. A 1440 la
  // tira está centrada con márgenes, así que una miniatura recortada por el
  // scroller igual cae dentro de `innerWidth`: `getBoundingClientRect` devuelve
  // la posición real aunque el `overflow` la tape. Medir contra la ventana daba
  // por visible la miniatura 9, que en realidad está afuera.
  const nMini = Number(await evaluar(VISIBLE_EN_LA_TIRA));
  const m = await clickReal("Ver foto " + nMini);
  chequear(`${nombre}: el click llega a la miniatura ${nMini}`, m.leLlega === true);
  chequear(`${nombre}: la miniatura salta a esa foto`, m.ahora.startsWith(nMini + " /"), m.ahora);
}

/* ── AMPLIAR LA FOTO (el visor a pantalla completa) ──────────────────────────
 * 🔴 Tocar la foto para ampliarla tuvo EL MISMO BUG que las flechas y nadie lo
 * vio hasta que lo reportó Juani (10-ago): la captura de puntero le entrega el
 * click al marco, así que el onClick de la <img> no se disparaba nunca con 2+
 * fotos. Por eso acá se abre CON MOUSE REAL y se prueba todo el visor.
 */
console.log("\n── Ampliar la foto ──");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setTouchEmulationEnabled", { enabled: false, maxTouchPoints: 5 });
await ir(URL_APP + "/propiedad/" + PROP, 4500);

// 1. Click real en el centro de la foto grande → se abre el visor.
const foto = JSON.parse(await evaluar(
  'const img = document.querySelector(".cursor-zoom-in");' +
  'if (!img) return JSON.stringify({ falta: true });' +
  'const r = img.getBoundingClientRect();' +
  'return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });'
));
await send("Input.dispatchMouseEvent", { type: "mousePressed", x: foto.x, y: foto.y, button: "left", clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: foto.x, y: foto.y, button: "left", clickCount: 1 });
await new Promise((r) => setTimeout(r, 900));
chequear("Tocar la FOTO abre el visor a pantalla completa", (await evaluar('return Boolean(document.querySelector("[role=dialog]"))')) === true);

// El contador y las flechas de ADENTRO del visor (hay otro juego atrás, tapado).
const CONTADOR_VISOR =
  'const d = document.querySelector("[role=dialog]");' +
  'if (!d) return "sin visor";' +
  'const e = [...d.querySelectorAll("span,div")].map(x => (x.textContent||"").trim())' +
  '  .find(t => t.length < 8 && t.indexOf("/") > 0); return e || "?";';
const clickEnVisor = async (etiqueta) => {
  const p = JSON.parse(await evaluar(
    'const d = document.querySelector("[role=dialog]");' +
    'const b = d && [...d.querySelectorAll("button")].find(x => (x.getAttribute("aria-label")||"") === "' + etiqueta + '");' +
    'if (!b) return JSON.stringify({ falta: true });' +
    'const r = b.getBoundingClientRect();' +
    'return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });'
  ));
  if (p.falta) return "falta el botón";
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 800));
  return await evaluar(CONTADOR_VISOR);
};

// 2. Las flechas DE ADENTRO avanzan y retroceden.
const v1 = await clickEnVisor("Foto siguiente");
chequear("Adentro del visor, la flecha avanza a la 2", String(v1).startsWith("2 /"), String(v1));
const v2 = await clickEnVisor("Foto anterior");
chequear("Y la de atrás vuelve a la 1", String(v2).startsWith("1 /"), String(v2));

// 3. La flecha del teclado también (es el visor: ahí el teclado manda).
await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await new Promise((r) => setTimeout(r, 700));
chequear("La flecha → del teclado avanza", String(await evaluar(CONTADOR_VISOR)).startsWith("2 /"));

// 4. Escape lo cierra y devuelve el scroll.
await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await new Promise((r) => setTimeout(r, 700));
chequear(
  "Escape cierra el visor y la página vuelve a scrollear",
  (await evaluar('return JSON.stringify({ v: Boolean(document.querySelector("[role=dialog]")), s: document.body.style.overflow !== "hidden" })')) === '{"v":false,"s":true}',
);

// 5. Y un ARRASTRE no abre el visor (deslizar no es tocar).
const f2 = JSON.parse(await evaluar(
  'const img = document.querySelector(".cursor-zoom-in");' +
  'const r = img.getBoundingClientRect();' +
  'return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });'
));
await send("Input.dispatchMouseEvent", { type: "mousePressed", x: f2.x, y: f2.y, button: "left", clickCount: 1 });
for (let k = 1; k <= 6; k++) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: f2.x - k * 40, y: f2.y, button: "left" });
  await new Promise((r) => setTimeout(r, 30));
}
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: f2.x - 240, y: f2.y, button: "left", clickCount: 1 });
await new Promise((r) => setTimeout(r, 900));
const trasArrastre = JSON.parse(await evaluar(
  'return JSON.stringify({ visor: Boolean(document.querySelector("[role=dialog]")),' +
  ' contador: ([...document.querySelectorAll("span,div")].map(x => (x.textContent||"").trim()).find(t => t.length < 8 && t.indexOf("/") > 0) || "?") })',
));
chequear("Arrastrar NO abre el visor (deslizar no es tocar)", trasArrastre.visor === false);
chequear("…y el arrastre pasó de foto", trasArrastre.contador.startsWith("2 /"), trasArrastre.contador);

// La tira de miniaturas tiene que seguir sola a la foto actual: si no, avanzás
// con la flecha y la miniatura marcada queda fuera de vista.
console.log("\n── La tira sigue a la foto actual ──");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ir(URL_APP + "/propiedad/" + PROP, 4500);
for (let k = 0; k < 8; k++) await clickReal("Foto siguiente");
const seguimiento = JSON.parse(await evaluar(
  'const minis = [...document.querySelectorAll("button")].filter(b => (b.getAttribute("aria-label")||"").indexOf("Ver foto") === 0);' +
  'const tira = minis[0] && minis[0].parentElement;' +
  'if (!tira) return JSON.stringify({ scroll: 0, visible: false });' +
  'const t = tira.getBoundingClientRect();' +
  'const r = minis[8] && minis[8].getBoundingClientRect();' +   // 8 clics desde la 1 → la 9
  'return JSON.stringify({ scroll: Math.round(tira.scrollLeft), visible: r ? (r.x >= t.x - 1 && r.right <= t.right + 1) : false });'
));
chequear("La tira scrollea sola", seguimiento.scroll > 0, `scrollLeft=${seguimiento.scroll}`);
chequear("La miniatura de la foto actual queda a la vista", seguimiento.visible);

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
if (fallos.length) fallos.forEach((f) => console.log(`   · ${f}`));
await cerrar();
process.exitCode = fallos.length ? 1 : 0;
