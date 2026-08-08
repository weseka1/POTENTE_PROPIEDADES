/**
 * El catálogo en el celular: que la barra de filtros NO se coma la pantalla.
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo reportó Juani el 8-ago: "cuando bajo en propiedades me bajan los filtros y
 * se me queda la mitad de página sin ver".
 *
 * Era cierto y medible: la barra apilaba tres filas (categorías, filtros y chips)
 * y en un iPhone medía 435 px. Pegada arriba tapaba el 59 % de la pantalla y las
 * tarjetas pasaban por abajo. Ahora en el celular queda solo la fila de
 * categorías + un botón que abre los filtros en una hoja.
 *
 * USO: APP=http://localhost:3000 node e2e/catalogo-mobile.mjs
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
    // Tarjetas ENTERAS y visibles debajo de las barras pegadas arriba.
    const enteras = [...document.querySelectorAll('a[href^="/propiedad/"]')]
      .map(c => c.getBoundingClientRect())
      .filter(r => r.top >= techo && r.bottom <= innerHeight).length;
    return {
      alturaBarra: Math.round(b ? b.height : 0),
      techo: Math.round(techo),
      pctTapado: Math.round(techo / innerHeight * 100),
      enteras,
      scrollHorizontal: document.documentElement.scrollWidth > innerWidth + 2,
    };
  `);

  chequear(`${eq.nombre}: la barra de filtros es compacta`, m.alturaBarra <= 110, `${m.alturaBarra}px`);
  chequear(`${eq.nombre}: las barras tapan menos de 1/4 de la pantalla`, m.pctTapado <= 25, `${m.pctTapado}%`);
  chequear(`${eq.nombre}: se ve al menos una propiedad entera`, m.enteras >= 1, `${m.enteras} tarjetas enteras`);
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

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
if (fallos.length) fallos.forEach((f) => console.log(`   · ${f}`));
await cerrar();
process.exitCode = fallos.length ? 1 : 0;
