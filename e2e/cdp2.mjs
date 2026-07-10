// Driver CDP con captura de eventos (descargas) y de errores de consola.
const BASE = "http://localhost:9222";

export async function sesion({ descargasEn } = {}) {
  const t = await (await fetch(BASE + "/json/new?about:blank", { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pend = new Map();
  const eventos = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method) eventos.push(m);
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pend.set(i, (m) => (m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result)));
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  const evaluar = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "error en pagina");
    return r.result.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__errs = [];
      const ce = console.error;
      console.error = (...a) => { window.__errs.push(a.map(x => (x && x.message) || String(x)).join(' ')); ce(...a); };
      window.addEventListener('error', e => window.__errs.push('error: ' + (e.message || e.error)));
      window.addEventListener('unhandledrejection', e => window.__errs.push('rejection: ' + ((e.reason && e.reason.message) || e.reason)));
      // Evitamos que se abran pestañas de verdad al probar
      window.__abiertos = [];
      window.open = (u) => { window.__abiertos.push(String(u)); return null; };
      // confirm() bloquea el hilo: lo respondemos que si
      window.__confirms = 0;
      window.confirm = () => { window.__confirms++; return true; };
      window.alert = () => {};
    `,
  });
  if (descargasEn) {
    await send("Browser.setDownloadBehavior", { behavior: "allowAndName", downloadPath: descargasEn, eventsEnabled: true });
  }

  const ir = async (url, ms = 2600) => { await send("Page.navigate", { url }); await new Promise((r) => setTimeout(r, ms)); };
  const metrica = (w, h, mobile = false) =>
    send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  const limpiarEventos = () => (eventos.length = 0);
  const descargas = () => eventos.filter((e) => e.method === "Browser.downloadWillBegin" || e.method === "Page.downloadWillBegin");
  const cerrar = async () => { ws.close(); await fetch(`${BASE}/json/close/${t.id}`); };

  return { send, evaluar, ir, metrica, eventos, limpiarEventos, descargas, cerrar };
}

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
