/**
 * UN SITIO, UN DOMINIO — la suite que faltaba.
 *
 * Nace del bug más caro de SEO del proyecto (20-ago): producción servía
 * `<link rel="canonical" href="https://potente-propiedades.onrender.com/">`.
 * O sea, le decíamos a Google que la versión buena de potentepropiedades.com
 * era el dominio de Render. Causa: los archivos `.env` de Vite se cargan
 * DESPUÉS de evaluar vite.config.ts, así que el build siempre caía al default
 * viejo. El sitemap y el robots salían BIEN (los arma el server en runtime con
 * el host real), y por eso nadie lo vio: el único síntoma estaba en el HTML.
 *
 * Ninguna suite miraba el canonical. Esta lo mira, y de paso vigila que no
 * queden dos sitios donde tiene que haber uno.
 *
 *   APP=https://potentepropiedades.com node e2e/dominio.mjs
 */
const APP = process.env.APP || "https://potentepropiedades.com";
const CANONICO = new URL(APP).host.toLowerCase();

let ok = 0;
const fallos = [];
const chequear = (nombre, cond, detalle = "") => {
  if (cond) { ok++; console.log(`PASS  ${nombre}${detalle ? ` :: ${detalle}` : ""}`); }
  else { fallos.push(`${nombre} — ${detalle}`); console.log(`FAIL  ${nombre} :: ${detalle}`); }
};

const traer = async (url, opts = {}) => {
  const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000), ...opts });
  return { status: r.status, location: r.headers.get("location") || "", texto: await r.text().catch(() => "") };
};

console.log(`\n🌐 Un sitio, un dominio · canónico = ${CANONICO}\n`);

/* 1 · El HTML servido se declara canónico en SU dominio, no en otro */
const home = await traer(APP + "/");
const canonical = (home.texto.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || "";
const ogUrl = (home.texto.match(/<meta property="og:url" content="([^"]+)"/) || [])[1] || "";
// En local el HTML servido trae el dominio del BUILD (el real), no "localhost":
// comparar contra CANONICO daría un falso rojo. La aserción es de producción.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(CANONICO.split(":")[0]);
if (!LOCAL_HOST) {
  chequear("🔴 El canonical apunta al dominio canónico",
    canonical.includes(CANONICO), canonical || "(sin canonical)");
  chequear("🔴 El og:url apunta al dominio canónico",
    ogUrl.includes(CANONICO), ogUrl || "(sin og:url)");
} else console.log("SKIP  (2) canonical/og del home — en local traen el dominio del build");

/* 2 · Ni un rastro de los dominios viejos en el HTML que ve Google.
 * (onrender = el hosting de respaldo; .com.ar = el WordPress viejo.) */
const viejos = ["potente-propiedades.onrender.com", "potentepropiedades.com.ar", "potenteprop.com.ar"];
for (const v of viejos) {
  // El .com.ar puede aparecer legítimamente como texto (no como URL del sitio):
  // lo que no puede es estar en canonical/og/JSON-LD.
  const enMeta = new RegExp(`(canonical|og:url|og:image|"url"\\s*:)[^>]*${v.replace(/\./g, "\\.")}`, "i").test(home.texto);
  chequear(`El HTML no se declara en ${v}`, !enMeta, enMeta ? "aparece en un meta de identidad" : "limpio");
}

/* 3 · El sitemap y el robots hablan del dominio canónico */
const sitemap = await traer(APP + "/sitemap.xml");
const primeras = [...sitemap.texto.matchAll(/<loc>([^<]+)<\/loc>/g)].slice(0, 5).map((m) => m[1]);
chequear("El sitemap declara URLs del dominio canónico",
  primeras.length > 0 && primeras.every((u) => u.includes(CANONICO)), primeras[0] || "(sitemap vacío)");
const robots = await traer(APP + "/robots.txt");
chequear("El robots apunta al sitemap del dominio canónico",
  robots.texto.includes(`${CANONICO}/sitemap.xml`), (robots.texto.match(/Sitemap: .*/) || [])[0] || "(sin Sitemap)");

/* 4 · 🔴 UN solo sitio: www redirige al apex con 301 (o al revés, según cuál
 * sea el canónico). Tener los dos respondiendo 200 es contenido duplicado. */
// En local no existe `www.localhost`: estas tres aserciones son de dominio real
// y se saltean solas (la suite tiene que poder correr en las dos partes).
const ES_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(CANONICO.split(":")[0]);
const alterno = CANONICO.startsWith("www.") ? CANONICO.replace(/^www\./, "") : "www." + CANONICO;
const rAlterno = ES_LOCAL ? { status: 0, location: "", texto: "" } : await traer(`https://${alterno}/`);
if (ES_LOCAL) console.log("SKIP  (3) pruebas de www/host alterno — no aplican en localhost");
if (!ES_LOCAL) chequear(`🔴 ${alterno} redirige (no sirve una copia del sitio)`,
  rAlterno.status === 301 || rAlterno.status === 308,
  `HTTP ${rAlterno.status}${rAlterno.location ? ` → ${rAlterno.location}` : ""}`);
if (!ES_LOCAL) chequear(`…y redirige AL dominio canónico`,
  rAlterno.location.includes(CANONICO), rAlterno.location || "(sin Location)");

/* 5 · El 301 PRESERVA la ruta: una ficha vieja aterriza en la misma ficha.
 * Mandar todo al home tira a la basura el SEO por página. */
const ruta = "/propiedades?operacion=venta";
const rRuta = ES_LOCAL ? { location: "" } : await traer(`https://${alterno}${ruta}`);
if (!ES_LOCAL) chequear("El 301 preserva la ruta y el query (no manda todo al home)",
  rRuta.location.includes("/propiedades") && rRuta.location.includes("operacion=venta"),
  rRuta.location || "(sin Location)");

/* 6 · 🔴 CANONICAL AUTORREFERENCIAL — cada página se declara a SÍ MISMA.
 * El `index.html` trae `%VITE_SITE_URL%/` (con barra = la raíz), así que sin
 * inyección del server las 99 fichas le decían a Google "el original de esto es
 * el home" → se deindexan. Es el bloqueante del 301 del dominio viejo. */
const idFicha = ((await traer(APP + "/sitemap.xml")).texto.match(/<loc>[^<]*\/propiedad\/([^<]+)<\/loc>/) || [])[1];
for (const ruta of ["/propiedades", "/temporada", idFicha ? `/propiedad/${idFicha}` : null].filter(Boolean)) {
  const p = await traer(APP + ruta);
  const c = (p.texto.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || "";
  chequear(`🔴 ${ruta} se declara canónica de sí misma`, c.endsWith(ruta), c || "(sin canonical)");
}

/* 7 · 404 DE VERDAD — sin esto, las URLs muertas del dominio viejo se quedan
 * vivas en el índice de Google compitiendo con el sitio nuevo. */
// ⚠️ Acá antes estaban /tipo-propiedad/… y /area/… esperando 404. Desde el
// 21-ago esas rutas las MAPEA el middleware del sitio viejo (301 a su
// equivalente), que es estrictamente mejor que un 404: conserva la visita y la
// señal. Se prueban en el bloque 9. Acá quedan las que de verdad no existen.
for (const ruta of ["/ruta-que-no-existe", "/blog", "/wp-admin"]) {
  const r = await traer(APP + ruta);
  chequear(`${ruta} devuelve 404 (no 200 con el home)`, r.status === 404, `HTTP ${r.status}`);
}

/* 8 · …y las rutas REALES siguen vivas (que el 404 no se lleve puesto el sitio) */
for (const ruta of ["/", "/propiedades", "/temporada", "/favoritos", "/campos", "/ingresar"]) {
  const r = await traer(APP + ruta);
  chequear(`${ruta} sigue respondiendo 200`, r.status === 200, `HTTP ${r.status}`);
}


/* 9 · 🔴 EL MAPA DEL SITIO VIEJO (21-ago) — cuando el `.com.ar` apunte acá, sus
 * direcciones tienen que aterrizar en la equivalente de este sitio, no en un
 * 404. Se prueba mandando el Host del dominio viejo, que es exactamente lo que
 * va a pasar el día del cambio de DNS. */
const VIEJO = "potentepropiedades.com.ar";
const comoViejo = (ruta) => traer(APP + ruta, { headers: { Host: VIEJO } });

const MAPEOS = [
  ["/propiedad/153223_terreno-lote-en-venta-de-300m2-ubicado-en-faro-norte/", "/propiedad/POT-153223"],
  ["/propiedad/153420_departamento-en-venta/", "/propiedad/POT-153420"],
  ["/estado/en-venta/", "/propiedades?operacion=venta"],
  ["/estado/en-alquiler/", "/propiedades?operacion=alquiler"],
  ["/tipo-propiedad/departamento/", "/propiedades?cat=departamento"],
  ["/area/playa-grande/", "/propiedades?q=playa%20grande"],
  ["/nosotros/", "/#nosotros"],
  ["/tasaciones/", "/#tasaciones"],
  ["/mapa/", "/propiedades"],
];
for (const [vieja, esperada] of MAPEOS) {
  const r = await comoViejo(vieja);
  chequear(`viejo ${vieja} → ${esperada}`,
    r.status === 301 && r.location.endsWith(esperada), `HTTP ${r.status} → ${r.location || "(sin Location)"}`);
}

/* Las páginas de demo del template viejo: 410, no un redirect. */
for (const basura of ["/api-demo/", "/landing/", "/destacada/ascensor/"]) {
  const r = await comoViejo(basura);
  chequear(`viejo ${basura} devuelve 410 (muerta)`, r.status === 410, `HTTP ${r.status}`);
}

/* Lo que NO está mapeado igual salta al dominio bueno, misma ruta. */
if (!ES_LOCAL) {
  const rGen = await comoViejo("/propiedades");
  chequear("viejo /propiedades salta al dominio bueno",
    rGen.status === 301 && rGen.location === `https://${CANONICO}/propiedades`, `${rGen.status} → ${rGen.location}`);
} else console.log("SKIP  (1) salto de dominio — en local no hay dominio al que saltar");

/* 🔴 10 · ANTI-BUCLE: la ruta que existe en los DOS sitios no puede redirigirse
 * a sí misma. Un 301 a la propia URL es un bucle infinito servido al visitante
 * — y `/propiedades` es de las más visitadas del catálogo. */
const rBucle = await traer(APP + "/propiedades");
chequear("🔴 /propiedades en el dominio bueno NO se redirige a sí misma",
  rBucle.status === 200, `HTTP ${rBucle.status}${rBucle.location ? ` → ${rBucle.location}` : ""}`);

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
if (fallos.length) { console.log("FALLARON:"); fallos.forEach((f) => console.log(" - " + f)); }
process.exit(fallos.length ? 1 : 0);
