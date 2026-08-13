// Barrido completo: cada ruta del panel y del sitio, contando errores reales.
import { pedirSesion, guionSesion } from "./login.mjs";

const BASE = "http://localhost:9222";
const APP = process.env.APP || "http://localhost:5177";

const t = await (await fetch(BASE + "/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pend.set(i, (m) => (m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluar = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "error");
  return r.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.__errs = [];
    const ce = console.error;
    console.error = (...a) => { window.__errs.push('console.error: ' + a.map(x => (x && x.message) || String(x)).join(' ')); ce(...a); };
    window.addEventListener('error', e => window.__errs.push('error: ' + (e.message || e.error)));
    window.addEventListener('unhandledrejection', e => window.__errs.push('rejection: ' + ((e.reason && e.reason.message) || e.reason)));
  `,
});

const ir = async (url, ms = 2800) => { await send("Page.navigate", { url }); await new Promise((r) => setTimeout(r, ms)); };

// Sesión real de Supabase (el atajo demo quedó desactivado al conectar la base).
await ir(APP + "/", 1200);
const sesionMateo = await pedirSesion("mateo");
await evaluar(guionSesion(sesionMateo));

const RUIDO = [/React DevTools/i, /Download the React/i, /favicon/i, /^console\.error: Warning:/i, /ResizeObserver loop/i];

const PANEL = [
  ["/panel", "Inicio"], ["/panel/asistente", "Asistente IA"], ["/panel/cargar", "Cargar"],
  ["/panel/fichas", "Fichas"], ["/panel/planos", "Planos"], ["/panel/temporada", "Temporada"],
  ["/panel/cartera", "Cartera"], ["/panel/leads", "Consultas"], ["/panel/crm", "Clientes"],
  ["/panel/pipeline", "Embudo"], ["/panel/agenda", "Agenda"], ["/panel/tasaciones", "Tasaciones"], ["/panel/llaves", "Registro de llaves"],
  ["/panel/arrendamientos", "Alquileres"], ["/panel/reportes", "Reportes"],
];
const SITIO = [
  ["/", "Potente"], ["/propiedades", "propiedad"], ["/propiedad/POT-153992", "Playa Grande"],
  // Desde el 13-ago temporada es SOLO Punta Mogotes: los otros barrios ya no
  // tienen página (la ruta redirige a /temporada, así que un link viejo no
  // muere, pero no hay contenido propio que verificar).
  ["/temporada", "temporada"], ["/temporada/punta-mogotes", "Punta Mogotes"],
  ["/favoritos", "favorit"], ["/cuenta", "Potente"], ["/ingresar", "INMOBILIARIA"],
];

let fallos = 0;
const revisar = async (ruta, esperado) => {
  await ir(APP + ruta, 3000);
  const r = await evaluar(`
    return {
      errs: window.__errs || [],
      largo: (document.body.innerText||'').length,
      tiene: (document.body.innerText||'').toLowerCase().includes(${JSON.stringify(esperado.toLowerCase())}),
      roto: /algo salió mal|something went wrong/i.test(document.body.innerText||''),
    };
  `);
  const errs = r.errs.filter((e) => !RUIDO.some((x) => x.test(e)));
  const bien = r.largo > 200 && r.tiene && !r.roto && errs.length === 0;
  if (!bien) fallos++;
  console.log(`${bien ? "OK  " : "MAL "} ${ruta.padEnd(26)} chars=${String(r.largo).padStart(5)} contenido=${r.tiene ? "si" : "NO"} errores=${errs.length}`);
  errs.slice(0, 3).forEach((e) => console.log("        ! " + String(e).slice(0, 150)));
};

console.log("=== PANEL ===");
for (const [ruta, esp] of PANEL) await revisar(ruta, esp);
console.log("\n=== SITIO PUBLICO ===");
for (const [ruta, esp] of SITIO) await revisar(ruta, esp);

console.log(`\n==== ${PANEL.length + SITIO.length - fallos} rutas limpias / ${fallos} con problemas ====`);
ws.close();
await fetch(`${BASE}/json/close/${t.id}`);
if (fallos) process.exitCode = 1;
