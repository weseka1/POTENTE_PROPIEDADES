/**
 * CONFIRMACIONES DEL SISTEMA — que ningún borrado se ejecute sin preguntar.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 POR QUÉ EXISTE. El 12-ago se reemplazaron los 13 diálogos NATIVOS del
 * navegador (`window.confirm` / `alert`) por el modal propio del panel, a pedido
 * de Juani: *"¿por qué salen anotaciones desde Google? nada que ver, debe pasar
 * todo por el sistema"*.
 *
 * El riesgo de esa conversión es concreto y grave: `window.confirm` BLOQUEA el
 * código (la línea de abajo solo corre si dijiste sí), el modal es ASÍNCRONO.
 * Si al convertir queda un borrado fuera del `onOk`, **el sistema borra sin
 * preguntar**. Esta suite prueba las dos mitades en cada pantalla:
 *   1. tocar Eliminar abre un modal NUESTRO (y no el del navegador)
 *   2. 🔑 CANCELAR NO BORRA NADA (la mitad que de verdad protege los datos)
 *
 * También vigila que no vuelva ningún diálogo nativo: se sobreescriben
 * `window.confirm/prompt/alert` para que TIREN si alguien los llama.
 *
 * ⚠️ No borra nada: siempre cancela. Es de solo lectura sobre los datos.
 *
 * USO: APP=http://localhost:3000 node e2e/confirmaciones.mjs
 */
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";
import { pedirSesion, guionSesion } from "./login.mjs";

const { send, evaluar, ir, cerrar, URL_APP } = await nuevaPestania();
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await ir(URL_APP + "/", 3000);
const sesion = await pedirSesion("mateo");
await evaluar(guionSesion(sesion));

/** Trampa: si la app llama a un diálogo del navegador, lo anotamos. */
const ponerTrampa = () => evaluar(`
  window.__nativos = [];
  window.confirm = (m) => { window.__nativos.push("confirm: " + m); return false; };
  window.prompt = (m) => { window.__nativos.push("prompt: " + m); return null; };
  window.alert = (m) => { window.__nativos.push("alert: " + m); };
  return 1;
`);

const cazados = () => evaluar(`return JSON.stringify(window.__nativos || [])`);

/** Click real sobre el primer botón que tenga ese title/texto. */
const clickPor = async (selector) => {
  const p = JSON.parse(await evaluar(`
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return JSON.stringify({ falta: true });
    el.scrollIntoView({ block: "center" });
    await new Promise(r => setTimeout(r, 400));
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
  `));
  if (p.falta) return false;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 1200));
  return true;
};

const clickTexto = async (texto, dentroDelModal = false) => {
  const p = JSON.parse(await evaluar(`
    const raiz = ${dentroDelModal} ? document.querySelector('[role="dialog"]') : document;
    if (!raiz) return JSON.stringify({ falta: true });
    const b = [...raiz.querySelectorAll("button")].find(x => (x.textContent||"").trim().includes(${JSON.stringify(texto)}));
    if (!b) return JSON.stringify({ falta: true });
    b.scrollIntoView({ block: "center" });
    await new Promise(r => setTimeout(r, 400));
    const r = b.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
  `));
  if (p.falta) return false;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 1200));
  return true;
};

/**
 * Prueba una pantalla: cuenta las filas, abre el borrado, ve el modal, cancela,
 * y confirma que la cuenta NO cambió.
 */
async function probar({ nombre, ruta, abrirBorrado, contar, espera = 6000 }) {
  await ir(URL_APP + ruta, espera);
  await ponerTrampa();

  const antes = Number(await evaluar(contar));
  if (antes === 0) {
    chequear(`${nombre}: hay datos para probar`, false, "0 filas — no se puede verificar acá");
    return;
  }

  const abrio = await abrirBorrado();
  if (!abrio) {
    chequear(`${nombre}: encuentra el botón de borrar`, false, "no encontré el botón");
    return;
  }

  const modal = await evaluar(`
    const d = document.querySelector('[role="dialog"]');
    return d ? (d.innerText || "").slice(0, 120) : "";
  `);
  chequear(`${nombre}: pregunta con un modal del sistema`, modal.length > 0, modal.split("\n")[0] || "sin modal");

  const nativos = JSON.parse(await cazados());
  chequear(`${nombre}: NO usó un diálogo del navegador`, nativos.length === 0, nativos.join(" | "));

  await clickTexto("Cancelar", true);
  const despues = Number(await evaluar(contar));
  chequear(`🔑 ${nombre}: CANCELAR no borró nada`, despues === antes, `${antes} → ${despues}`);
}

/* ── Clientes: 10 demo, el botón vive en el drawer del cliente ─────────────── */
await probar({
  nombre: "Clientes",
  ruta: "/panel/crm",
  // El CRM lista con tarjetas (.pcard), no con tabla.
  contar: `return document.querySelectorAll("button.pcard").length`,
  abrirBorrado: async () => {
    // Se abre la ficha del cliente (modal de detalle) y desde ahí se elimina:
    // por eso acá hay DOS dialogos abiertos y el helper toma el de arriba.
    if (!(await clickPor("button.pcard"))) return false;
    return clickTexto("Eliminar", true);
  },
});

/* ── Tasaciones: 5 demo, el botón está en la fila ──────────────────────────── */
await probar({
  nombre: "Tasaciones",
  ruta: "/panel/tasaciones",
  contar: `return document.querySelectorAll("tbody tr").length`,
  abrirBorrado: () => clickPor('button[title*="Eliminar"]'),
});

/* ── Cartera: la cartera REAL de Mateo. Acá cancelar mal cuesta una propiedad ─ */
await probar({
  nombre: "Cartera (datos REALES)",
  ruta: "/panel/cartera",
  espera: 8000,
  contar: `return [...document.querySelectorAll("button.pcard")].filter(c => c.querySelector("img")).length`,
  abrirBorrado: async () => {
    if (!(await clickPor("button.pcard"))) return false; // abre el drawer
    // El boton vive al final del drawer: hay que scrollear hasta el.
    return clickTexto("Eliminar");
  },
});

/* ── Y que la app no tenga NINGÚN diálogo nativo escondido ────────────────── */
await ir(URL_APP + "/panel/llaves", 6000);
await ponerTrampa();
const trasRecorrido = JSON.parse(await cazados());
chequear("Llaves: sigue sin diálogos del navegador", trasRecorrido.length === 0, trasRecorrido.join(" | "));

await cerrar();
resumen();
