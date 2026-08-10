/**
 * El catálogo: que la barra de filtros NO se coma la pantalla al scrollear.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 EL MISMO BUG, REPORTADO DOS VECES POR JUANI:
 *
 * 1. Celular (8-ago) — "cuando bajo en propiedades me bajan los filtros y se me
 *    queda la mitad de página sin ver". La barra apilaba tres filas (categorías,
 *    filtros y chips) y en un iPhone medía 435 px: pegada arriba tapaba el 59 %
 *    de la pantalla y las tarjetas pasaban por abajo.
 *
 * 2. Escritorio (10-ago) — "cuando bajo me baja todo el filtro de precio, eso no
 *    puede bajar, tosquea la página". Y era peor de lo que parecía: en una laptop
 *    de 1366×768 los 259 px de barra tapaban el 82 % del alto útil y quedaban
 *    CERO tarjetas enteras a la vista.
 *
 * La lección: la primera vez se arregló SOLO el celular y la suite solo medía
 * celulares, así que el mismo problema en escritorio pasó dos días sin que nadie
 * lo viera. Por eso ahora esta suite mide los dos, y por eso se llama
 * `catalogo-filtros` y no `catalogo-mobile`.
 *
 * USO: APP=http://localhost:3000 node e2e/catalogo-filtros.mjs
 */
import { nuevaPestania } from "./cdp.mjs";

const { send, evaluar, ir, cerrar, URL_APP } = await nuevaPestania();

let ok = 0;
const fallos = [];
const chequear = (n, paso, extra = "") => {
  if (paso) { ok++; console.log(`PASS  ${n}${extra ? ` · ${extra}` : ""}`); }
  else { fallos.push(`${n}${extra ? ` · ${extra}` : ""}`); console.log(`FAIL  ${n}${extra ? ` · ${extra}` : ""}`); }
};

// Los tres celulares que importan: el chico, el común y el grande.
const EQUIPOS = [
  { nombre: "iPhone SE", w: 375, h: 667 },
  { nombre: "iPhone 14", w: 390, h: 844 },
  { nombre: "Pixel 8", w: 412, h: 915 },
];

for (const eq of EQUIPOS) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: eq.w, height: eq.h, deviceScaleFactor: 2, mobile: true,
    screenOrientation: { type: "portraitPrimary", angle: 0 },
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await ir(URL_APP + "/propiedades", 4000);

  console.log(`\n── ${eq.nombre} (${eq.w}×${eq.h}) ──`);

  const m = await evaluar(`
    window.scrollTo(0, 900);
    await new Promise(r => setTimeout(r, 500));
    const barra = document.querySelector(".sticky");
    const b = barra?.getBoundingClientRect();
    const nav = document.querySelector("header, nav");
    const n = nav?.getBoundingClientRect();
    const techo = Math.max(0, b ? b.bottom : 0, n ? n.bottom : 0);
    // Visible al 70 %, no "entera": ver el porqué en el bloque de escritorio.
    const cs = [...document.querySelectorAll('a[href^="/propiedad/"]')].map(c => c.getBoundingClientRect());
    const utiles = cs.filter(r => Math.min(r.bottom, innerHeight) - Math.max(r.top, techo) >= r.height * 0.7).length;
    return {
      alturaBarra: Math.round(b ? b.height : 0),
      techo: Math.round(techo),
      pctTapado: Math.round(techo / innerHeight * 100),
      utiles,
      altoTarjeta: Math.round(cs[0] ? cs[0].height : 0),
      hueco: Math.round(innerHeight - techo),
      scrollHorizontal: document.documentElement.scrollWidth > innerWidth + 2,
    };
  `);

  chequear(`${eq.nombre}: la barra de filtros es compacta`, m.alturaBarra <= 110, `${m.alturaBarra}px`);
  chequear(`${eq.nombre}: las barras tapan menos de 1/4 de la pantalla`, m.pctTapado <= 25, `${m.pctTapado}%`);
  chequear(`${eq.nombre}: se ve una propiedad cómoda`, m.utiles >= 1, `${m.utiles} tarjetas al 70 %`);
  chequear(`${eq.nombre}: una tarjeta entra en el hueco libre`, m.hueco >= m.altoTarjeta, `hueco ${m.hueco}px vs tarjeta ${m.altoTarjeta}px`);
  chequear(`${eq.nombre}: sin scroll horizontal`, !m.scrollHorizontal);

  // La hoja de filtros: que abra, que tenga TODO adentro y que cierre.
  const hoja = await evaluar(`
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 300));
    const b = [...document.querySelectorAll("button")].find(x => /^filtros/i.test((x.textContent||"").trim()));
    if (!b) return { error: "no hay boton de filtros" };
    b.click(); await new Promise(r => setTimeout(r, 500));
    const d = document.querySelector('[role="dialog"]');
    const t = (d?.innerText || "").toLowerCase();
    const r = d?.getBoundingClientRect();
    return {
      abrio: !!d,
      alto: r ? Math.round(r.height) : 0,
      cabe: r ? r.height <= innerHeight : false,
      tiene: ["operación","zona","ambientes","dormitorios","baños","precio","ver "].filter(x => t.includes(x)),
      bloqueoScroll: getComputedStyle(document.body).overflow === "hidden",
    };
  `);
  chequear(`${eq.nombre}: el botón abre la hoja de filtros`, hoja.abrio, hoja.error ?? "");
  chequear(`${eq.nombre}: la hoja entra en la pantalla`, hoja.cabe, `${hoja.alto}px de ${eq.h}`);
  chequear(`${eq.nombre}: la hoja tiene todos los filtros`, (hoja.tiene?.length ?? 0) >= 6, (hoja.tiene ?? []).join(", "));
  chequear(`${eq.nombre}: con la hoja abierta no scrollea el fondo`, hoja.bloqueoScroll);

  const cerro = await evaluar(`
    const d = document.querySelector('[role="dialog"]');
    const btn = [...(d?.querySelectorAll("button") ?? [])].find(b => /^ver /i.test((b.textContent||"").trim()));
    btn?.click(); await new Promise(r => setTimeout(r, 450));
    return { cerrada: !document.querySelector('[role="dialog"]'),
             scrollVuelve: getComputedStyle(document.body).overflow !== "hidden" };
  `);
  chequear(`${eq.nombre}: "Ver N propiedades" cierra la hoja`, cerro.cerrada);
  chequear(`${eq.nombre}: y devuelve el scroll a la página`, cerro.scrollVuelve);
}

/* ── ESCRITORIO ───────────────────────────────────────────────────────────────
 * Acá no hay hoja de filtros: los filtros se ven de entrada (que es lo bueno de
 * tener pantalla) y se ENCOGEN al bajar. La medida que importa es cuánto tapa la
 * barra cuando ya estás mirando propiedades. La laptop de 1366×768 es el caso
 * duro y es el que reportó Juani.
 */
const ESCRITORIOS = [
  { nombre: "Laptop 1366", w: 1366, h: 768 },
  { nombre: "Notebook 1440", w: 1440, h: 900 },
  { nombre: "Full HD", w: 1920, h: 1080 },
];

for (const eq of ESCRITORIOS) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: eq.w, height: eq.h, deviceScaleFactor: 1, mobile: false,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false, maxTouchPoints: 5 });
  await ir(URL_APP + "/propiedades", 4000);

  console.log(`\n── ${eq.nombre} (${eq.w}×${eq.h}) ──`);

  // Arriba de todo los filtros TIENEN que estar a la vista: en escritorio no hay
  // botón que los abra, así que si se esconden acá no hay forma de filtrar.
  const arriba = await evaluar(`
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 400));
    const b = document.querySelector(".sticky")?.getBoundingClientRect();
    const t = (document.querySelector(".sticky")?.innerText || "").toLowerCase();
    return { alto: Math.round(b ? b.height : 0),
             tiene: ["precio","dormitorio","ambiente","baño"].filter(x => t.includes(x)) };
  `);
  chequear(`${eq.nombre}: arriba se ven los filtros`, (arriba.tiene?.length ?? 0) >= 3, (arriba.tiene ?? []).join(", "));

  const abajo = await evaluar(`
    window.scrollTo(0, 1200);
    await new Promise(r => setTimeout(r, 600));
    const barra = document.querySelector(".sticky");
    const b = barra?.getBoundingClientRect();
    const nav = document.querySelector("header, nav");
    const n = nav?.getBoundingClientRect();
    const techo = Math.max(0, b ? b.bottom : 0, n ? n.bottom : 0);
    // ⚠️ Se mide "visible al 70 %", NO "entera". Una tarjeta mide 462 px y el
    // hueco libre a 1366 son 646: entra entera de sobra. Que quede cortada o no
    // depende de dónde caiga el scroll, no del layout — con "entera" el test
    // daba rojo a 1366 y verde a 1440 por 130 px de scroll, que no es un bug.
    const cs = [...document.querySelectorAll('a[href^="/propiedad/"]')].map(c => c.getBoundingClientRect());
    const utiles = cs.filter(r => Math.min(r.bottom, innerHeight) - Math.max(r.top, techo) >= r.height * 0.7).length;
    return {
      alturaBarra: Math.round(b ? b.height : 0),
      pctTapado: Math.round(techo / innerHeight * 100),
      utiles,
      altoTarjeta: Math.round(cs[0] ? cs[0].height : 0),
      hueco: Math.round(innerHeight - techo),
      scrollHorizontal: document.documentElement.scrollWidth > innerWidth + 2,
    };
  `);

  // 259 px era el número del bug. 110 deja pasar la fila de categorías + los
  // chips de "Buscando:", que son la información que SÍ querés ver al scrollear.
  chequear(`${eq.nombre}: al bajar la barra se encoge`, abajo.alturaBarra <= 110, `${abajo.alturaBarra}px (era 259)`);
  chequear(`${eq.nombre}: tapa menos de 1/4 de la pantalla`, abajo.pctTapado <= 25, `${abajo.pctTapado}% (era ${eq.h === 768 ? "82" : eq.h === 900 ? "70" : "59"}%)`);
  // La que de verdad describe la queja: "ver las propiedades placenteramente".
  chequear(`${eq.nombre}: se ve una fila de propiedades cómoda`, abajo.utiles >= 3, `${abajo.utiles} tarjetas al 70 %`);
  // Y que en el hueco que queda ENTRE una tarjeta entera, aunque el scroll la corte.
  chequear(`${eq.nombre}: una tarjeta entra en el hueco libre`, abajo.hueco >= abajo.altoTarjeta, `hueco ${abajo.hueco}px vs tarjeta ${abajo.altoTarjeta}px`);
  chequear(`${eq.nombre}: sin scroll horizontal`, !abajo.scrollHorizontal);

  // Y que vuelva sola al subir: si se queda encogida, no podés cambiar un filtro.
  const volviendo = await evaluar(`
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 700));
    const t = (document.querySelector(".sticky")?.innerText || "").toLowerCase();
    return { tiene: ["precio","dormitorio","ambiente"].filter(x => t.includes(x)) };
  `);
  chequear(`${eq.nombre}: al volver arriba los filtros reaparecen`, (volviendo.tiene?.length ?? 0) >= 3, (volviendo.tiene ?? []).join(", "));
}

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
if (fallos.length) fallos.forEach((f) => console.log(`   · ${f}`));
await cerrar();
process.exitCode = fallos.length ? 1 : 0;
