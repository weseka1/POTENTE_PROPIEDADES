/**
 * RENDIMIENTO — que la lentitud la cace una prueba, no el cliente.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 POR QUÉ EXISTE. El 14-ago Juani abrió el 3D y tardó 30-40 segundos. La
 * causa era el cold start de Render, que YA estaba anotado como el bloqueante
 * nº1 del lanzamiento… pero nadie lo estaba midiendo, así que el aviso llegó
 * por WhatsApp en vez de por consola.
 *
 * Hasta ese día había 24 suites que probaban que las cosas FUNCIONARAN —que
 * rendericen, que no desborden a 390px, que el RLS aguante, que cancelar no
 * borre— y CERO que probaran que fueran RÁPIDAS. Donde hay prueba, el problema
 * aparece antes que el cliente. Donde no la hay, aparece el cliente.
 *
 * Los topes de abajo NO son aspiracionales: son ~1,6× lo medido en producción
 * con el servicio despierto. Si algo los pasa, es que empeoró de verdad.
 *
 * ⚠️ Contra Render hay que CALENTAR el servicio antes (el free duerme a los
 * ~15 min). Si la primera corrida da rojo en todo, no es el código: es el
 * hosting — que es exactamente el dato que esta suite tiene que hacer visible.
 *
 * USO: APP=https://potente-propiedades.onrender.com node e2e/rendimiento.mjs
 */
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";

const PROP = process.env.PROP || "POT-223356";

/** Topes en ms. Medido 14-ago en producción, servicio despierto y sin caché. */
const TOPE = {
  home: 6000,        // medido ~3,5 s
  catalogo: 6000,
  ficha: 7000,       // trae galería + mapa
  mapa3dMontado: 2500,   // medido 679 ms con precarga, 1.258 sin
  mapa3dSombra: 6000,    // medido 2.546 ms con precarga
  bundlePrincipalKB: 1000, // hoy 894 KB; si pasa el mega, algo se coló
};

const { send, evaluar, ir, cerrar, URL_APP } = await nuevaPestania();
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Network.enable", {});

// Despertar el servicio antes de medir: si no, se mide el cold start del
// hosting y no el sitio (y esa es otra conversación, la del abono).
await ir(URL_APP + "/", 4000);

async function cuantoTarda(ruta) {
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  const t0 = Date.now();
  await ir(URL_APP + ruta, 1500);
  const listo = await evaluar(`
    const hasta = performance.now() + 25000;
    while (performance.now() < hasta) {
      // "Listo" = hay contenido de verdad, no el cascarón del SPA.
      if ((document.body.innerText || "").length > 600) return 1;
      await new Promise(r => setTimeout(r, 100));
    }
    return 0;
  `);
  return { ms: Date.now() - t0, ok: listo === "1" || listo === 1 };
}

for (const [ruta, clave, nombre] of [
  ["/", "home", "La home"],
  ["/propiedades", "catalogo", "El catálogo"],
  [`/propiedad/${PROP}`, "ficha", "La ficha de una propiedad"],
]) {
  const r = await cuantoTarda(ruta);
  chequear(`⏱️ ${nombre} carga en menos de ${TOPE[clave] / 1000} s`, r.ok && r.ms < TOPE[clave], `${r.ms} ms`);
}

/* ── El 3D, que es lo más pesado del sitio ─────────────────────────────────── */
await ir(`${URL_APP}/propiedad/${PROP}`, 8000);
const tres = await evaluar(`
  const b = [...document.querySelectorAll("button")].find(x => /ver en 3d/i.test(x.textContent || ""));
  if (!b) return JSON.stringify({ sinBoton: true });
  b.scrollIntoView({ block: "center" });
  await new Promise(r => setTimeout(r, 2000));
  // La precarga por intención: es como llega una persona de verdad al botón.
  b.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
  await new Promise(r => setTimeout(r, 1500));

  const t0 = performance.now();
  b.click();
  let montado = 0, sombra = 0;
  const hasta = performance.now() + 45000;
  while (performance.now() < hasta) {
    const c = document.querySelector(".maplibregl-map canvas, canvas.maplibregl-canvas");
    if (!montado && c && c.width > 200) montado = Math.round(performance.now() - t0);
    if (montado && !sombra && c) {
      try {
        const g = c.getContext("webgl2") || c.getContext("webgl");
        if (g) { const px = new Uint8Array(4);
                 g.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
                 if (px[0] + px[1] + px[2] > 0) sombra = Math.round(performance.now() - t0); }
      } catch (e) {}
    }
    if (montado && sombra) break;
    await new Promise(r => setTimeout(r, 150));
  }
  return JSON.stringify({ montado, sombra });
`);
const t = JSON.parse(tres);
if (t.sinBoton) {
  chequear("⏱️ El 3D está disponible", false, "no encontré el botón (¿falta VITE_SHADEMAP_API_KEY?)");
} else {
  chequear(`⏱️ El 3D monta en menos de ${TOPE.mapa3dMontado / 1000} s`, t.montado > 0 && t.montado < TOPE.mapa3dMontado, `${t.montado} ms`);
  chequear(`⏱️ …y la sombra se ve en menos de ${TOPE.mapa3dSombra / 1000} s`, t.sombra > 0 && t.sombra < TOPE.mapa3dSombra, `${t.sombra} ms`);
}

/* ── El peso del bundle: la regresión más fácil de cometer y no ver ────────── */
const peso = await evaluar(`
  const r = await fetch("/", { cache: "no-store" });
  const html = await r.text();
  const m = html.match(/assets\\/index-[^"]+\\.js/);
  if (!m) return JSON.stringify({ kb: -1 });
  const j = await fetch("/" + m[0], { cache: "no-store" });
  return JSON.stringify({ kb: Math.round((await j.arrayBuffer()).byteLength / 1024), archivo: m[0] });
`);
const p = JSON.parse(peso);
chequear(
  `📦 El bundle principal pesa menos de ${TOPE.bundlePrincipalKB} KB`,
  p.kb > 0 && p.kb < TOPE.bundlePrincipalKB,
  `${p.kb} KB · ${p.archivo ?? ""}`,
);

await cerrar();
resumen();
