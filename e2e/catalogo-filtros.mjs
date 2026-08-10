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

  // Arriba de todo los filtros TIENEN que estar a la vista, sin abrir nada.
  const arriba = await evaluar(`
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 400));
    const t = (document.body.innerText || "").toLowerCase();
    return { tiene: ["precio","dormitorio","ambiente","baño"].filter(x => t.includes(x)) };
  `);
  chequear(`${eq.nombre}: arriba se ven los filtros`, (arriba.tiene?.length ?? 0) >= 3, (arriba.tiene ?? []).join(", "));

  /* 🔴 LA PRUEBA QUE IMPORTA, la que hubiera evitado todo esto.
     El bug real nunca fue estético: al colapsar con `hidden` (o sea
     `display:none`) se sacaban 201 px DEL FLUJO, el documento se acortaba de
     golpe y las tarjetas ya visibles pegaban un salto hacia arriba. Eso es el
     "choca" que reportó Mateo.
     Se mide directo: se fija una tarjeta, se scrollea de a poco, y en cada paso
     se compara su posición REAL en el documento (top del viewport + scroll) con
     la que tenía al empezar. Si el layout no se mueve, es constante. */
  const salto = await evaluar(`
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));
    const tarjeta = document.querySelectorAll('a[href^="/propiedad/"]')[6];
    if (!tarjeta) return { error: "no hay tarjetas" };
    const dondeEsta = () => Math.round(tarjeta.getBoundingClientRect().top + window.scrollY);
    const base = dondeEsta();
    let peor = 0, dondePeor = 0;
    for (let y = 0; y <= 700; y += 25) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 90));
      const d = Math.abs(dondeEsta() - base);
      if (d > peor) { peor = d; dondePeor = y; }
    }
    return { peor, dondePeor, base };
  `);
  // 2 px de tolerancia por el redondeo de subpíxeles. El bug daba 201.
  chequear(
    `${eq.nombre}: 🔴 la propiedad NO se mueve al scrollear`,
    (salto.peor ?? 999) <= 2,
    salto.error ?? `se corrió ${salto.peor}px (con el bug: 201) en scroll=${salto.dondePeor}`,
  );

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
  /* La que de verdad describe la queja: "ver las propiedades placenteramente".
     ⚠️ Se BARRE el scroll en vez de medir en un punto fijo. Cuántas tarjetas
     quedan bien encuadradas depende de dónde caiga el scroll, no del layout: a
     1366 medir clavado en 1200 daba 0 porque las filas caían justo cortadas,
     con 627 px de hueco libre y tarjetas de 487. Eso no es un bug, es un
     encuadre. Lo que importa es que EXISTA una posición cómoda. */
  const barrido = await evaluar(`
    let mejor = 0, dondeMejor = 0;
    for (let y = 400; y <= 1600; y += 60) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 70));
      const barra = document.querySelector(".sticky");
      const b = barra && barra.getBoundingClientRect();
      const nav = document.querySelector("header, nav");
      const n = nav && nav.getBoundingClientRect();
      const techo = Math.max(0, b ? b.bottom : 0, n ? n.bottom : 0);
      const cs = [...document.querySelectorAll('a[href^="/propiedad/"]')].map(c => c.getBoundingClientRect());
      const u = cs.filter(r => Math.min(r.bottom, innerHeight) - Math.max(r.top, techo) >= r.height * 0.7).length;
      if (u > mejor) { mejor = u; dondeMejor = y; }
    }
    return { mejor, dondeMejor };
  `);
  chequear(
    `${eq.nombre}: hay scroll donde se ve una fila entera cómoda`,
    barrido.mejor >= 3,
    `${barrido.mejor} tarjetas al 70 % (scroll ${barrido.dondeMejor})`,
  );
  // Y que en el hueco que queda ENTRE una tarjeta entera, aunque el scroll la corte.
  chequear(`${eq.nombre}: una tarjeta entra en el hueco libre`, abajo.hueco >= abajo.altoTarjeta, `hueco ${abajo.hueco}px vs tarjeta ${abajo.altoTarjeta}px`);
  chequear(`${eq.nombre}: sin scroll horizontal`, !abajo.scrollHorizontal);

  // Y que vuelva sola al subir. La disolución es función pura del scroll, así que
  // subir tiene que devolver el bloque a opacidad 1 sin estado ni histéresis.
  const volviendo = await evaluar(`
    window.scrollTo(0, 800);
    await new Promise(r => setTimeout(r, 500));
    const bloque = document.querySelector("[data-bloque=filtros]");
    const idoOpacidad = bloque ? Number(getComputedStyle(bloque).opacity) : -1;
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 700));
    const vueltoOpacidad = bloque ? Number(getComputedStyle(bloque).opacity) : -1;
    const t = (document.body.innerText || "").toLowerCase();
    return { idoOpacidad, vueltoOpacidad, visible: getComputedStyle(bloque).visibility,
             tiene: ["precio","dormitorio","ambiente"].filter(x => t.includes(x)) };
  `);
  chequear(`${eq.nombre}: al bajar el bloque se desvanece`, volviendo.idoOpacidad === 0, `opacidad ${volviendo.idoOpacidad}`);
  chequear(`${eq.nombre}: al volver arriba reaparece entero`, volviendo.vueltoOpacidad === 1 && volviendo.visible !== "hidden", `opacidad ${volviendo.vueltoOpacidad} · ${volviendo.visible}`);
  chequear(`${eq.nombre}: y los filtros vuelven a estar`, (volviendo.tiene?.length ?? 0) >= 3, (volviendo.tiene ?? []).join(", "));

  // El botón "Filtros" tiene que estar SIEMPRE, también en escritorio: es la
  // única puerta a los filtros una vez que el bloque se fue. Sin esto, scrolleás
  // y te quedás sin forma de filtrar (fue exactamente el bug de la v1).
  const puerta = await evaluar(`
    window.scrollTo(0, 900);
    await new Promise(r => setTimeout(r, 500));
    const b = [...document.querySelectorAll("button")].find(x => (x.textContent||"").trim().indexOf("Filtros") === 0);
    if (!b) return { hay: false };
    const r = b.getBoundingClientRect();
    const encima = document.elementFromPoint(Math.round(r.x + r.width/2), Math.round(r.y + r.height/2));
    b.click(); await new Promise(r2 => setTimeout(r2, 500));
    const d = document.querySelector('[role="dialog"]');
    const dr = d && d.getBoundingClientRect();
    return { hay: true, alcanzable: encima ? b.contains(encima) || encima === b : false,
             abrio: !!d, cabe: dr ? dr.height <= innerHeight : false,
             tiene: ((d && d.innerText) || "").toLowerCase().indexOf("dormitorio") >= 0 };
  `);
  chequear(`${eq.nombre}: con el bloque ido queda el botón "Filtros"`, puerta.hay && puerta.alcanzable);
  chequear(`${eq.nombre}: y abre el panel completo`, puerta.abrio && puerta.tiene);
  chequear(`${eq.nombre}: el panel entra en la pantalla`, puerta.cabe);
}

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
if (fallos.length) fallos.forEach((f) => console.log(`   · ${f}`));
await cerrar();
process.exitCode = fallos.length ? 1 : 0;
