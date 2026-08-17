/**
 * EL CANDADO DE LA DIRECCIÓN — «que las oficinas no puedan entrar al
 * orquestador de Mateo» (Juani, 17-ago-2026).
 * ─────────────────────────────────────────────────────────────────────────────
 * El caso real que esto protege: Mateo abre SU sesión en la computadora de una
 * oficina, se pasea con el sombrero de la oficina, y se va. Sin PIN, cualquiera
 * de la oficina toca "Mateo · Dirección" en el selector y tiene el panel
 * completo: finanzas, IA, la cartera entera. Con PIN, volver a Dirección lo
 * pide SIEMPRE (cambiarse a una oficina borra la marca de "ya lo puso").
 *
 * Lo que se prueba, con un PIN de prueba real puesto por RPC:
 *   1. con el PIN puesto, una pestaña nueva de la Dirección arranca BLOQUEADA
 *      (el gate no tiene X: la única salida es un perfil)
 *   2. tocar el perfil de Mateo pide el PIN
 *   3. un PIN incorrecto NO entra
 *   4. el correcto sí — y el panel queda completo
 *   5. cambiarse a una oficina y volver a Mateo lo pide DE NUEVO
 *
 * 🔒 REGLAS DE SEGURIDAD DE ESTA SUITE (un cliente usa este panel a diario):
 *   · Si Mateo ya tiene un PIN REAL puesto, la suite NO TOCA NADA y se salta
 *     entera: no hay forma de probar sin conocerlo, y pisárselo sería dejarlo
 *     afuera de su propio panel.
 *   · El PIN de prueba es conocido (4321) y se QUITA en el `finally` por RPC.
 *   · Autocuración: si una corrida anterior se cortó dejando el 4321 puesto,
 *     el arranque lo detecta (¿se puede quitar con 4321?) y lo limpia. Si no
 *     se puede quitar con 4321, es un PIN real → se salta, jamás se fuerza.
 *
 * USO: APP=http://localhost:3000 node e2e/pin-direccion.mjs
 */
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";
import { pedirSesion, guionSesion } from "./login.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PIN_PRUEBA = "4321";

const AQUI = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(AQUI, "..", ".env.local"), "utf8")
    .split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sesion = await pedirSesion("mateo");
const sb = createClient(
  process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${sesion.access_token}` } } },
);

const pinPuesto = async () => {
  const { data, error } = await sb.rpc("potente_pin_puesto", { p_perfil: "mateo" });
  if (error) throw new Error("No se pudo consultar el PIN: " + error.message);
  return data === true;
};
/** Quita el PIN presentando el de prueba. Devuelve true si lo logró. */
const quitarConPinPrueba = async () => {
  const { error } = await sb.rpc("potente_pin_definir", { p_perfil: "mateo", p_pin: "", p_pin_actual: PIN_PRUEBA });
  return !error;
};

/* ── Puerta de seguridad: nunca pisar un PIN real ─────────────────────────── */
if (await pinPuesto()) {
  if (await quitarConPinPrueba()) {
    console.log("  (limpiado un PIN de prueba huérfano de una corrida cortada)");
  } else {
    console.log("⏭️  Mateo tiene un PIN REAL puesto: esta suite no se puede correr sin conocerlo.");
    console.log("    No se tocó nada. Para probar el candado, quitale el PIN primero desde el panel.");
    process.exit(0);
  }
}

/* ── Se pone el PIN de prueba (por RPC, como lo haría el panel) ───────────── */
{
  const { error } = await sb.rpc("potente_pin_definir", { p_perfil: "mateo", p_pin: PIN_PRUEBA, p_pin_actual: null });
  if (error) { console.error("No se pudo poner el PIN de prueba:", error.message); process.exit(1); }
}

const { send, evaluar, ir, cerrar, URL_APP } = await nuevaPestania();
try {
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
  await ir(URL_APP + "/", 3000);
  await evaluar(guionSesion(sesion));
  // Pestaña "nueva": sin la marca de PIN en sessionStorage (guionSesion recarga,
  // y sessionStorage arranca vacío en la pestaña del CDP).
  await ir(URL_APP + "/panel", 7000);

  const click = async (sel) => {
    const p = JSON.parse(await evaluar(`
      const b = ${sel};
      if (!b) return JSON.stringify({ falta: true });
      b.scrollIntoView({ block: "center" }); await new Promise(r => setTimeout(r, 300));
      const r = b.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
    `));
    if (p.falta) return false;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await new Promise((r) => setTimeout(r, 1200));
    return true;
  };
  /* La baldosa del perfil: el BOTÓN solo tiene el avatar adentro — el nombre es
   * un hermano de abajo. Se busca el contenedor de la baldosa por su texto y se
   * clickea su primer botón (el del avatar; el de "quitar foto" solo existe en
   * modo administrar). */
  const clickPerfil = (nombre) => click(`
    (() => {
      const tile = [...document.querySelectorAll(".panel-bg.fixed .flex-col.items-center")]
        .find(t => (t.innerText||"").includes(${JSON.stringify(nombre)}));
      return tile ? tile.querySelector("button") : null;
    })()
  `);
  /* Abrir el selector desde el Topbar: botón del perfil activo → "Cambiar de perfil".
   * ⚠️ El texto a buscar va SIN acentos ("Direcci", no "Dirección"): el texto de
   * la página y el de este archivo pueden estar en formas Unicode distintas
   * (NFC vs NFD) — se VEN iguales y no coinciden con .includes(). Costó una
   * tarde de "no encontrado" sobre un botón que estaba ahí. */
  const abrirSelector = async (rolActivo) => {
    await click(`[...document.querySelectorAll("header button, button")].find(x => (x.textContent||"").includes(${JSON.stringify(rolActivo)}) && !x.closest(".panel-bg.fixed"))`);
    await click(`[...document.querySelectorAll("button")].find(x => (x.textContent||"").includes("Cambiar de perfil"))`);
    await new Promise((r) => setTimeout(r, 800));
  };

  /* 1 · Arranca bloqueada */
  const g0 = JSON.parse(await evaluar(`
    const gate = document.querySelector(".panel-bg.fixed");
    return JSON.stringify({
      gate: Boolean(gate),
      pregunta: gate ? (gate.innerText||"").includes("Quién está usando Potente") : false,
      // Bloqueado no hay X: la única salida es un perfil.
      tieneX: gate ? Boolean(gate.querySelector('[aria-label="Cerrar"]')) : null,
      panelDetras: (document.body.innerText||"").includes("Cerrar sesión"),
    });
  `));
  chequear("🔒 Con PIN puesto, la Dirección arranca ante el candado", g0.gate && g0.pregunta, JSON.stringify(g0));
  chequear("🔒 …y el candado NO tiene la X (no se puede cerrar sin elegir)", g0.tieneX === false, `tieneX=${g0.tieneX}`);

  /* 2 · Tocar Mateo pide el PIN */
  await clickPerfil("Mateo");
  const g1 = JSON.parse(await evaluar(`
    const dlg = [...document.querySelectorAll("form")].find(f => f.querySelector('input[type="password"]'));
    return JSON.stringify({ pidePin: Boolean(dlg) });
  `));
  chequear("🔑 Tocar el perfil de Mateo pide el PIN", g1.pidePin);

  const escribirPin = async (pin) => {
    await evaluar(`
      const i = [...document.querySelectorAll('input[type="password"]')].pop();
      if (!i) return "falta";
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(pin)});
      i.dispatchEvent(new Event("input", { bubbles: true }));
      return "ok";
    `);
    await click(`[...document.querySelectorAll('button[type="submit"]')].pop()`);
    await new Promise((r) => setTimeout(r, 1500));
  };

  /* 3 · El PIN incorrecto no entra */
  await escribirPin("9999");
  const g2 = JSON.parse(await evaluar(`
    return JSON.stringify({
      sigueElPin: Boolean([...document.querySelectorAll('input[type="password"]')].length),
      dice: (document.body.innerText||"").includes("PIN incorrecto"),
      gate: Boolean(document.querySelector(".panel-bg.fixed")),
    });
  `));
  chequear("🚫 Un PIN incorrecto NO entra, y lo dice", g2.sigueElPin && g2.dice && g2.gate, JSON.stringify(g2));

  /* 4 · El correcto sí */
  await escribirPin(PIN_PRUEBA);
  const g3 = JSON.parse(await evaluar(`
    const t = document.body.innerText || "";
    return JSON.stringify({
      gate: Boolean(document.querySelector(".panel-bg.fixed")),
      panelCompleto: t.includes("Cartera") && t.includes("Temporada") && t.includes("Reportes"),
    });
  `));
  chequear("✅ El PIN correcto abre el panel completo de la Dirección", !g3.gate && g3.panelCompleto, JSON.stringify(g3));

  /* 5 · Irse a una oficina y volver LO PIDE DE NUEVO */
  await abrirSelector("Direcci");
  await clickPerfil("Punta Mogotes");
  const g4 = JSON.parse(await evaluar(`
    const t = document.body.innerText || "";
    return JSON.stringify({
      /* La marca de la vista de OFICINA: sin "Asistente IA" ni "Embudo de
       * ventas" (las del orquestador), pero CON "Cartera" (control positivo:
       * si tampoco estuviera, no es que la vista es de oficina — es que no
       * cargó nada). ⚠️ "Reportes" NO sirve para distinguir: es sección
       * básica y la oficina la ve legítimamente. */
      sinIA: !t.includes("Asistente IA"),
      sinEmbudo: !t.includes("Embudo de ventas"),
      conCartera: t.includes("Cartera"),
    });
  `));
  chequear(
    "🎭 Parado en la oficina, el panel es el de la OFICINA (sin IA ni Embudo, con su Cartera)",
    g4.sinIA && g4.sinEmbudo && g4.conCartera,
    JSON.stringify(g4),
  );

  await abrirSelector("Oficina 2");
  await clickPerfil("Mateo");
  const g5 = JSON.parse(await evaluar(`
    return JSON.stringify({ pidePin: Boolean([...document.querySelectorAll('input[type="password"]')].length) });
  `));
  chequear("🔒 Volver a Mateo pide el PIN OTRA VEZ (irse a la oficina borró la marca)", g5.pidePin, JSON.stringify(g5));

} finally {
  /* 🔴 El PIN de prueba se QUITA pase lo que pase: dejarlo puesto es dejar a
   * Mateo ante un candado cuya llave no conoce. Si esta línea falla, el PIN es
   * 4321 y se quita con potente_pin_definir(p_pin: "", p_pin_actual: "4321"). */
  await cerrar();
  const ok = await quitarConPinPrueba();
  const sigue = await pinPuesto();
  if (!ok || sigue) {
    console.error("🔴🔴 EL PIN DE PRUEBA QUEDÓ PUESTO (4321). Quitarlo YA con:");
    console.error("   potente_pin_definir(p_perfil:'mateo', p_pin:'', p_pin_actual:'4321')");
    process.exitCode = 1;
  } else {
    console.log("  (PIN de prueba quitado — Mateo queda como estaba: sin PIN)");
  }
}
resumen();
