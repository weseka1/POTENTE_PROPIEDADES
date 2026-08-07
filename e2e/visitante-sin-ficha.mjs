/**
 * ¿Qué se lleva el navegador de un DESCONOCIDO?
 * ─────────────────────────────────────────────────────────────────────────────
 * La web pública tiene que leer la VISTA (potente_propiedades_web), no la tabla.
 * La diferencia es la ficha interna: propietario, si tenemos las llaves,
 * observaciones. Eso no puede viajar al navegador de cualquiera.
 *
 * No alcanza con mirar la pantalla: un `select("*")` sobre la tabla trae la
 * ficha igual aunque no se muestre. Así que se mira el TRÁFICO — qué le pidió
 * la página a Supabase y qué le volvió.
 *
 * USO:  APP=http://localhost:3000 node e2e/visitante-sin-ficha.mjs
 */
import { nuevaPestania } from "./cdp.mjs";

const { send, evaluar, ir, cerrar, URL_APP } = await nuevaPestania();

let ok = 0;
const fallos = [];
const chequear = (nombre, paso, extra = "") => {
  if (paso) { ok++; console.log(`PASS  ${nombre}${extra ? ` · ${extra}` : ""}`); }
  else { fallos.push(nombre); console.log(`FAIL  ${nombre}${extra ? ` · ${extra}` : ""}`); }
};

// El espía tiene que estar puesto ANTES de que corra el bundle, si no la primera
// sincronización pasa sin que la veamos. addScriptToEvaluateOnNewDocument corre
// antes que cualquier script de la página.
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.__base = [];
    const original = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === "string" ? args[0] : args[0].url;
      const respuesta = await original(...args);
      if (String(url).includes("/rest/v1/")) {
        try { window.__base.push({ url: String(url), cuerpo: await respuesta.clone().json() }); }
        catch { window.__base.push({ url: String(url), cuerpo: null }); }
      }
      return respuesta;
    };
  `,
});

// Visitante limpio: sin sesión de panel ni nada guardado de antes.
await ir(URL_APP + "/", 500);
await evaluar(`localStorage.clear(); sessionStorage.clear();`);
await ir(URL_APP + "/propiedades", 4500);

const traf = await evaluar(`
  const b = window.__base || [];
  const props = b.filter((p) => /potente_propiedades(_web)?\\?/.test(p.url));
  const filas = props.flatMap((p) => Array.isArray(p.cuerpo) ? p.cuerpo : []);
  return {
    llamadas: b.length,
    tablas: [...new Set(b.map((p) => (p.url.split("/rest/v1/")[1] || "").split("?")[0]))],
    filasProp: filas.length,
    conFicha: filas.filter((f) => "ficha" in f).length,
    tarjetas: document.querySelectorAll('a[href^="/propiedad/"]').length,
  };
`);

chequear("El visitante habla con la base", traf.llamadas > 0, `${traf.llamadas} llamadas`);
chequear("Pide la VISTA, no la tabla de propiedades",
  traf.tablas.includes("potente_propiedades_web") && !traf.tablas.includes("potente_propiedades"),
  traf.tablas.join(", "));
chequear("Recibe el catálogo completo", traf.filasProp > 50, `${traf.filasProp} propiedades`);
chequear("NINGUNA propiedad le llega con la ficha interna", traf.conFicha === 0,
  traf.conFicha ? `🔴 ${traf.conFicha} con ficha` : "limpio");
chequear("El catálogo se ve en pantalla", traf.tarjetas > 0, `${traf.tarjetas} tarjetas`);

// Una ficha suelta: el mismo control en la página de detalle.
await ir(URL_APP + "/propiedad/POT-153992", 3500);
const detalle = await evaluar(`
  const filas = (window.__base || [])
    .filter((p) => /potente_propiedades(_web)?\\?/.test(p.url))
    .flatMap((p) => Array.isArray(p.cuerpo) ? p.cuerpo : []);
  return { conFicha: filas.filter((f) => "ficha" in f).length, titulo: document.title };
`);
chequear("La ficha de una propiedad tampoco filtra datos internos", detalle.conFicha === 0);

// De paso: el visitante no tiene por qué pedir las tablas del panel. Cada una es
// un viaje a São Paulo que vuelve vacío (el RLS no le deja ver nada).
chequear("No pide de más: solo el catálogo y la temporada", traf.tablas.length <= 2, traf.tablas.join(", "));

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
await cerrar();
process.exitCode = fallos.length ? 1 : 0;
