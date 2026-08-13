/**
 * TEMPORADA — los seis pedidos de Mateo del 13-ago-2026.
 * ─────────────────────────────────────────────────────────────────────────────
 * Grabó dos videos y escribió cuatro mensajes. Textual:
 *   · «que me mande directamente a la ficha que yo cargué en temporada, con las
 *     fotos y la descripción… pero con los datos de temporada, precio de
 *     temporada y que diría temporada» (antes la tarjeta llevaba al BARRIO, y
 *     ahí no se veía ni una foto ni el texto de la propiedad)
 *   · «temporada hacemos únicamente en barrio Punta Mogotes»
 *   · «el buscador eliminarlo y poner únicamente cantidad de personas»
 *   · el copy de la intro, «en vez de 30% pone reservas con un porcentaje», y
 *     atención cara a cara solo con la oficina de Mogotes
 *
 * ⚠️ TRES ASERCIONES SALIERON MAL ANTES DE SALIR BIEN, todas por lo mismo:
 * buscar una palabra en TODA la página cuando esa palabra también vive en otro
 * lado legítimo. «quincena» está en el precio de cada tarjeta; «en qué zona
 * querés estar» está en el CTA final; y el label del filtro va en `uppercase`
 * por CSS, así que `innerText` lo devuelve en mayúsculas. Por eso acá se mira
 * el CONTENEDOR de cada cosa y no el body entero — la misma lección que el
 * saneador de Bochile: un filtro demasiado ancho da falsos positivos.
 *
 * De solo lectura: no crea ni borra nada.
 *
 * USO: APP=http://localhost:5173 node e2e/temporada-mogotes.mjs
 */
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";

const { send, evaluar, ir, cerrar, URL_APP } = await nuevaPestania();

const SONDA = `
  const t = (document.body.innerText || "");
  const T = t.toLowerCase();
  const hero = document.querySelector("header.relative") || document.querySelector("header");
  const caja = hero ? hero.querySelector(".backdrop-blur") : null;
  const cards = document.querySelectorAll("article").length;
  const links = document.querySelectorAll('a[href^="/propiedad/"]').length;
  return JSON.stringify({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    copyIntro: T.includes("propiedades en punta mogotes para disfrutar el verano") && T.includes("más de 50 años en el rubro"),
    porcentaje: T.includes("reservás con un porcentaje") && !T.includes("con el 30%"),
    caraACara: T.includes("oficina sobre la costa, cerca de todo") && !T.includes("dos oficinas en la ciudad"),
    sinBotonBuscar: !T.includes("buscar"),
    // La grilla de barrios se define por sus links a /temporada/<barrio>. Mirar el
    // texto daba falso rojo: "en qué zona querés estar" también está en el CTA final.
    linksABarrio: document.querySelectorAll('a[href^="/temporada/"]').length,
    // El filtro: se mira SOLO la caja del hero. "quincena" aparece legítimamente
    // en el precio de cada tarjeta ("desde $X · la quincena"), así que mirar
    // toda la página daba un falso rojo.
    filtroTexto: caja ? (caja.innerText || "").toLowerCase() : "",
    combos: caja ? caja.querySelectorAll("[role=combobox],[aria-haspopup]").length : -1,
    cards: cards,
    links: links,
    // Ninguna tarjeta de temporada muestra precio: todas dicen A consultar.
    tarjetasConPrecio: [...document.querySelectorAll("article")]
      .filter((a) => /\$\s?\d/.test(a.innerText || "")).length,
    tarjetasAConsultar: [...document.querySelectorAll("article")]
      .filter((a) => (a.innerText || "").toLowerCase().includes("a consultar")).length,
    errores: (window.__err || []).length,
  });
`;

for (const [ancho, alto, etiqueta] of [[390, 844, "📱 390"], [1440, 950, "🖥️ 1440"]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 500 });
  await ir(URL_APP + "/temporada", 6000);
  const r = JSON.parse(await evaluar(SONDA));

  // Negativo = barra de scroll vertical, no desborde. Lo que no puede pasar es > 0.
  chequear(`${etiqueta} · sin desborde horizontal`, r.overflow <= 0, `${r.overflow}px`);
  chequear(`${etiqueta} · copy nuevo de la intro`, r.copyIntro);
  chequear(`${etiqueta} · "reservás con un porcentaje" (sin el 30%)`, r.porcentaje);
  chequear(`${etiqueta} · atención cara a cara = solo Mogotes`, r.caraACara);
  chequear(`${etiqueta} · el ÚNICO filtro es cuántas personas`,
    r.combos === 1 && r.filtroTexto.includes("cuántos son"),
    `combos=${r.combos} · "${r.filtroTexto.replace(/\n/g, " ").slice(0, 50)}"`);
  chequear(`${etiqueta} · sin botón Buscar`, r.sinBotonBuscar);
  chequear(`${etiqueta} · sin la grilla de barrios`, r.linksABarrio === 0, `${r.linksABarrio} links a /temporada/<barrio>`);
  chequear(`${etiqueta} · 🔑 las tarjetas llevan a la FICHA de la propiedad`,
    r.cards > 0 && r.links >= r.cards, `${r.cards} tarjetas / ${r.links} links a ficha`);
  chequear(`${etiqueta} · 🔒 ninguna tarjeta muestra precio`, r.tarjetasConPrecio === 0, `${r.tarjetasConPrecio} con $`);
  chequear(`${etiqueta} · …y todas dicen A consultar`, r.tarjetasAConsultar === r.cards, `${r.tarjetasAConsultar}/${r.cards}`);
  chequear(`${etiqueta} · consola limpia`, r.errores === 0);
}

/* ── La otra mitad del pedido: la ficha muestra los datos de temporada ─────── */
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await ir(URL_APP + "/temporada", 6000);
const href = await evaluar(`
  const a = document.querySelector('a[href^="/propiedad/"]');
  return a ? a.getAttribute("href") : "";
`);
chequear("Hay al menos una tarjeta con link a su ficha", Boolean(href), href);

if (href) {
  await ir(URL_APP + href, 7000);
  const f = JSON.parse(await evaluar(`
    const t = (document.body.innerText || "");
    const T = t.toLowerCase();
    return JSON.stringify({
      selloTemporada: T.includes("temporada 2027"),
      bloqueTemporada: T.includes("alquiler de temporada"),
      // 🔴 NINGUNA referencia de precio de temporada (Mateo, 13-ago). Se busca
      // el signo $ y la palabra "desde" en el bloque, no en toda la página: el
      // precio de VENTA de la propiedad sí se publica y sí lleva $.
      aConsultar: (() => {
        const bloques = [...document.querySelectorAll("div")].filter((d) =>
          (d.innerText || "").toLowerCase().startsWith("alquiler de temporada"));
        const b = bloques[bloques.length - 1];
        const t2 = b ? (b.innerText || "").toLowerCase() : "";
        return { texto: t2, ok: t2.includes("a consultar") && !t2.includes("$") && !t2.includes("desde") };
      })(),
      capacidad: /hasta \\d+ personas/.test(T),
      hayFotos: document.querySelectorAll("img").length > 0,
      hayDescripcion: t.length > 800,
      ctaTemporada: T.includes("consultar la temporada"),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      errores: (window.__err || []).length,
    });
  `));
  chequear("🔑 La ficha dice TEMPORADA", f.selloTemporada);
  chequear("🔑 …y su bloque de temporada", f.bloqueTemporada);
  chequear("🔒 …que dice A CONSULTAR, sin precio ni «desde»", f.aConsultar.ok,
    f.aConsultar.texto.split("\n").join(" ").slice(0, 70));
  chequear("…con la capacidad (hasta N personas)", f.capacidad);
  chequear("…y su CTA propio de temporada", f.ctaTemporada);
  chequear("🔑 La ficha tiene las FOTOS y la descripción (lo que faltaba)", f.hayFotos && f.hayDescripcion);
  chequear("Ficha sin desborde horizontal", f.overflow <= 0, `${f.overflow}px`);
  chequear("Ficha con consola limpia", f.errores === 0);
}

await cerrar();
resumen();
