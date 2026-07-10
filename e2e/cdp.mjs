// Driver CDP minimo: abre una pestaña, evalua JS, reporta.
const BASE = "http://localhost:9222";
const URL_APP = process.env.APP || "http://localhost:5177";

const j = async (p, method = "GET") => (await fetch(BASE + p, { method })).json();

export async function nuevaPestania() {
  const t = await j("/json/new?" + encodeURIComponent("about:blank"), "PUT");
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
    const r = await send("Runtime.evaluate", {
      expression: `(async () => { ${expr} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "error en pagina");
    return r.result.value;
  };
  const ir = async (url, esperaMs = 1400) => {
    await send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, esperaMs));
  };
  const cerrar = async () => { ws.close(); await fetch(`${BASE}/json/close/${t.id}`); };
  const metrica = (w, h) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send("Page.enable");
  await send("Runtime.enable");
  return { send, evaluar, ir, cerrar, metrica, URL_APP };
}

/* ===== helpers de test ===== */
export const ok = [];
export const fail = [];
export function chequear(nombre, cond, extra = "") {
  (cond ? ok : fail).push(nombre + (extra ? ` — ${extra}` : ""));
  console.log(`${cond ? "PASS" : "FAIL"}  ${nombre}${extra ? " :: " + extra : ""}`);
}
export function resumen() {
  console.log(`\n==== ${ok.length} PASS / ${fail.length} FAIL ====`);
  if (fail.length) { console.log("FALLARON:"); fail.forEach((f) => console.log(" - " + f)); process.exitCode = 1; }
}
