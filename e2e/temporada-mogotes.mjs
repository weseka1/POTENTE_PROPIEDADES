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
 * ⚠️ 14-ago · YA NO ES DE SOLO LECTURA, y el motivo importa.
 * Desde que temporada es una OPERACIÓN (migración 014), lo que se publica exige
 * una ficha con `operacion = 'temporada'`. En la base viva hoy hay CERO: las
 * unidades que existen son semillas y cuelgan de fichas de venta/alquiler, así
 * que /temporada está vacía hasta que Mateo cargue las suyas.
 *
 * Con la página vacía, ONCE de estas aserciones pasaban SOLAS —"0 tarjetas con
 * precio de 0 tarjetas"— y el archivo entero se volvía verde sin probar nada.
 * Es exactamente la trampa que ya está anotada para `sweep-final` (no puede
 * cazar el crash de un estado si no hay una fila de ese estado). Un test que
 * pasa por falta de datos es peor que un test en rojo: miente y nadie lo mira.
 *
 * Entonces la suite SIEMBRA su propia ficha de temporada, corre todo contra
 * ella y la borra en el `finally` — pase lo que pase, incluso si una aserción
 * explota. Mismo criterio que `llaves.mjs` y que `verificar-db`.
 *
 * ⚠️ Escribe en la base de PRODUCCIÓN (es la única que hay). La fila vive unos
 * segundos y lleva el prefijo PROP-E2E-TEMP-. Si el script se corta a mitad y
 * queda huérfana, se borra a mano:
 *   delete from potente_unidades_temporada where "propiedadId" like 'PROP-E2E-TEMP-%';
 *   delete from potente_propiedades where id like 'PROP-E2E-TEMP-%';
 *
 * USO: APP=http://localhost:5173 node e2e/temporada-mogotes.mjs
 */
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";
import { pedirSesion } from "./login.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/* ── Siembra: una ficha de temporada de verdad, como la cargaría Mateo ─────── */
const AQUI = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(AQUI, "..", ".env.local"), "utf8")
    .split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const SB_URL = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;

const ID_PROP = `PROP-E2E-TEMP-${Date.now()}`;
const ID_UNIDAD = `TMP-E2E-${Date.now()}`;

const sesion = await pedirSesion("mateo");
const sb = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${sesion.access_token}` } },
});

const limpiar = async () => {
  await sb.from("potente_unidades_temporada").delete().like("propiedadId", "PROP-E2E-TEMP-%");
  await sb.from("potente_propiedades").delete().like("id", "PROP-E2E-TEMP-%");
};

// Por si una corrida anterior se cortó antes del finally.
await limpiar();

const { error: errProp } = await sb.from("potente_propiedades").insert({
  id: ID_PROP,
  categoria: "departamento",
  titulo: "Departamento de verificación en Punta Mogotes",
  // 🔑 Las tres cosas que la hacen publicable en temporada: la OPERACIÓN, que
  // esté publicada y no suspendida, y la ZONA dentro de BARRIOS_TEMPORADA.
  operacion: "temporada",
  publicado: true,
  estado: "activa",
  zona: "Punta Mogotes",
  provincia: "Mar del Plata",
  oficina: "puntamogotes",
  ambientes: 2,
  dormitorios: 1,
  banos: 1,
  descripcion:
    "Ficha creada por la verificación automática de WESEKA para comprobar que una propiedad " +
    "cargada en temporada aparece en la sección Temporada con su ficha propia, sus fotos y su " +
    "descripción, y sin publicar ninguna tarifa. Se borra sola al terminar la prueba. " +
    "Si la estás viendo en la web, avisá: quedó huérfana de una corrida que se cortó a mitad.",
  fotos: ["/img/props/depto2.jpg"],
});
if (errProp) {
  console.error("No se pudo sembrar la ficha de temporada:", errProp.message);
  process.exit(1);
}

const { error: errUni } = await sb.from("potente_unidades_temporada").insert({
  id: ID_UNIDAD,
  propiedadId: ID_PROP,
  oficina: "puntamogotes",
  barrio: "Punta Mogotes",
  ambientes: 2,
  capacidad: 4,
  frenteAlMar: false,
  comodidades: ["wifi", "aire"],
  tarifas: {},
  tarifaNocheARS: 0,
  comisionPct: 15,
  activa: true,
  enLimpieza: false,
});
if (errUni) {
  console.error("No se pudo sembrar la unidad de temporada:", errUni.message);
  await limpiar();
  process.exit(1);
}

const { send, evaluar, ir, cerrar, URL_APP } = await nuevaPestania();
try {

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

// 🔑 Y que la que se ve sea LA QUE SEMBRAMOS: sin esto, el día que alguien
// vuelva a publicar una unidad colgada de una ficha de venta, la prueba pasaría
// igual mirando esa otra tarjeta.
chequear(
  "🔑 …y la tarjeta sembrada es la que aparece (la regla nueva la publicó)",
  href.includes(ID_PROP),
  `${href} vs ${ID_PROP}`,
);

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
      /* 14-ago · Se mira la COLUMNA DE PRECIO ENTERA (el <aside>), no solo el
       * bloque azul. Antes el "A consultar" vivía adentro del bloque y arriba se
       * publicaba igual el precio de la ficha: la aserción vieja miraba justo el
       * único lugar donde no estaba el problema y pasaba en verde. Ahora la
       * regla es la de verdad — en toda la columna no puede haber un número de
       * plata — y el "A consultar" ocupa el lugar del precio. */
      aConsultar: (() => {
        const a = document.querySelector("aside");
        const t2 = a ? (a.innerText || "").toLowerCase() : "";
        return {
          texto: t2,
          ok: t2.includes("a consultar") && !/\\$\\s?\\d/.test(t2) && !t2.includes("desde"),
        };
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
  chequear("🔒 La columna de precio dice A CONSULTAR y no lleva NINGÚN número de plata", f.aConsultar.ok,
    f.aConsultar.texto.split("\n").join(" ").slice(0, 70));
  chequear("…con la capacidad (hasta N personas)", f.capacidad);
  chequear("…y su CTA propio de temporada", f.ctaTemporada);
  chequear("🔑 La ficha tiene las FOTOS y la descripción (lo que faltaba)", f.hayFotos && f.hayDescripcion);
  chequear("Ficha sin desborde horizontal", f.overflow <= 0, `${f.overflow}px`);
  chequear("Ficha con consola limpia", f.errores === 0);
}

} finally {
  /* 🔴 El borrado va en el `finally` y no al final del guion: si una aserción
   * de arriba explota, la ficha de prueba se queda PUBLICADA en la web del
   * cliente. El costo de olvidarse acá no es un test en rojo, es una propiedad
   * inventada en producción. */
  await cerrar();
  await limpiar();
}
resumen();
