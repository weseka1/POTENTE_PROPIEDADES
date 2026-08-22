import express from "express";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { atenderAsistente, chatGenerico } from "../netlify/functions/_core";
import { geocodificar } from "../netlify/functions/_geocodificar";
import { pasaElCupo, ipDe, tieneSesionDePanel, CABECERAS_SEGURIDAD } from "../netlify/functions/_seguridad";
import { firmaValida, respuestaDeVerificacion, parsearEntrada } from "../netlify/functions/_meta";
import { guardarMensajes } from "../netlify/functions/_ingesta";
import { BARRIOS_TEMPORADA, slugBarrio } from "../src/config/temporada.js";

// ── Server de producción para Render ──────────────────────────────────────────
// Sirve el build estático (dist/) + expone el asistente en POST /api/asistente.
// Se corre con `npm start` (tsx). En Netlify este server no se usa: ahí el
// asistente vive en netlify/functions y /api/asistente redirige a la function.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 3000);

// Carga .env.local (KEY=valor) si existe, para correr local sin exportar vars.
// En Render esto no hace nada: las vars vienen del dashboard.
try {
  const env = readFileSync(path.resolve(__dirname, "..", ".env.local"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* sin .env.local */ }

const app = express();

// Express anuncia "x-powered-by: Express" en cada respuesta. Es regalarle al que
// escanea la mitad del trabajo: le dice con qué está hecho y qué exploits probar.
app.disable("x-powered-by");

// Confiar en el proxy de Render/Cloudflare para leer la IP real del visitante.
app.set("trust proxy", true);

// Cabeceras de seguridad en TODA respuesta (HSTS, anti-clickjacking, etc.).
app.use((_req, res, next) => {
  for (const [k, v] of Object.entries(CABECERAS_SEGURIDAD)) res.setHeader(k, v);
  next();
});

/* ── LOS CANALES DE MATEO: WhatsApp e Instagram entran por acá ───────────────
 *
 * Mateo (13-ago): «registrará los WhatsApp de su misma empresa, supervisará que
 * no quede ningún mensaje colgado». Sus tres líneas viven en tres celulares y él
 * no ve nada; la bandeja del panel está construida y vacía. Esto la llena.
 *
 * 🔴 LA UBICACIÓN DE ESTE BLOQUE NO ES NEGOCIABLE — las tres razones, medidas
 * contra producción antes de escribirlo:
 *
 *  1. Va ANTES del redirect de dominio canónico (más abajo): ese middleware
 *     manda 301 a cualquier host que no sea el canónico, y **Meta no sigue
 *     redirects** — ni en la verificación ni al entregar mensajes. Un 301 acá
 *     es el webhook muerto sin que nadie se entere.
 *  2. Va ANTES del `express.json()` global: la firma `X-Hub-Signature-256` se
 *     calcula sobre el body CRUDO byte por byte, y `express.json()` lo consume
 *     y lo tira. Por eso este POST trae su propio `express.raw()`.
 *  3. Va ANTES del catch-all de la SPA: comprobado en producción, un
 *     `GET /api/meta/webhook` registrado después devuelve **404 con HTML**, y
 *     Meta lo lee como verificación fallida.
 *
 * v1 ESCUCHA Y NADA MÁS: no hay una sola respuesta saliente. El bot es una
 * pieza que se enchufa después sobre las mismas tablas.
 */
app.get("/api/meta/webhook", (req, res) => {
  const { status, texto } = respuestaDeVerificacion(req.query as Record<string, unknown>, process.env.META_VERIFY_TOKEN);
  res.status(status).type("text/plain").send(texto);
});

app.post("/api/meta/webhook", express.raw({ type: "application/json", limit: "1mb" }), (req, res) => {
  const crudo = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  if (!firmaValida(crudo, req.header("x-hub-signature-256"), process.env.META_APP_SECRET)) {
    // Sin firma válida no se mira siquiera el contenido.
    return res.status(401).type("text/plain").send("firma invalida");
  }

  /* 🔴 200 PRIMERO, TRABAJO DESPUÉS. Meta reintenta si tardás más de ~20 s, y
   * cada reintento es un mensaje repetido en la bandeja de Mateo. Se acusa
   * recibo al instante y el guardado sigue por su cuenta: la idempotencia de la
   * migración 018 cubre igual el caso de que un reintento gane la carrera. */
  res.status(200).type("text/plain").send("ok");

  let cuerpo: unknown = null;
  try { cuerpo = JSON.parse(crudo.toString("utf8")); }
  catch { console.error("Webhook Meta · body ilegible"); return; }

  const mensajes = parsearEntrada(cuerpo);
  if (!mensajes.length) return; // acuses de entrega, "leído", etc.: se ignoran en silencio

  void guardarMensajes(mensajes).then((r) => {
    // Se loguea SIEMPRE: si un día dejan de entrar mensajes, esto es lo que lo cuenta.
    console.log(`Webhook Meta · ${r.guardados} guardados · ${r.repetidos} repetidos · ${r.fallados} fallados`);
  });
});

/* ── UN SITIO, UN DOMINIO: 301 de todo host que no sea el canónico ───────────
 *
 * Pedido de Juani y Mateo (20-ago): *«queremos que la web vieja redirija a la
 * nueva ya también, porque si no quedaron 2»*. Este middleware resuelve la
 * mitad que vive de nuestro lado y sirve para TRES casos a la vez:
 *
 *   1. `www.potentepropiedades.com` → apex. Hasta hoy las DOS respondían 200
 *      con el mismo contenido: contenido duplicado para Google, y la autoridad
 *      partida en dos.
 *   2. `potente-propiedades.onrender.com` → el dominio real, cuando Render
 *      quede solo de respaldo.
 *   3. **`potentepropiedades.com.ar`** (el WordPress viejo), el día que su DNS
 *      apunte acá: cae en esta regla y se redirige solo, sin tocar el hosting
 *      viejo.
 *
 * Es 301 (permanente) y **preserva la ruta y el query**: `/propiedad/POT-123`
 * del dominio viejo aterriza en la MISMA ficha del nuevo. Un 301 masivo al home
 * tira a la basura todo el SEO acumulado por página.
 *
 * Se salta en local (localhost / IPs) para no romper las suites e2e ni el
 * desarrollo, y solo actúa si `VITE_SITE_URL` define un dominio canónico. */
const CANONICO = (() => {
  try { return new URL(process.env.VITE_SITE_URL || "").host.toLowerCase(); }
  catch { return ""; }
})();

/* ── EL MAPA DEL SITIO VIEJO (WordPress de potentepropiedades.com.ar) ────────
 *
 * 21-ago. Mateo quiere apuntar el `.com.ar` directo acá («no podemos hostear el
 * dominio en Hostinger poniendo sus dns?») y tiene razón: el dominio está en
 * NIC.ar y él maneja los nameservers, así que NO hace falta el panel del
 * hosting viejo — al que además no pudimos entrar.
 *
 * Pero el middleware de arriba, solo, preserva la ruta TAL CUAL: una ficha
 * vieja `/propiedad/153223_terreno-lote.../` aterrizaría en una URL que en el
 * sitio nuevo no existe → 404, y se pierde el posicionamiento de esa página.
 * Estas reglas traducen las direcciones del WordPress a las de acá.
 *
 * Verificado contra el sitemap real del sitio viejo (239 URLs). La regla de oro:
 * cada dirección va a su equivalente, NUNCA todo al home — un 301 masivo tira a
 * la basura los años que el `.com.ar` tiene ganados en Google, que hoy es el
 * único de los dos dominios que aparece en las búsquedas.
 *
 * ⚠️ Se aplica a CUALQUIER host, no solo al viejo: si Google ya tiene indexada
 * una de estas direcciones, alguien puede llegar por acá también. */
const MAPA_SITIO_VIEJO: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  // Las ~98 fichas. El número de propiedad se conserva entre los dos sistemas
  // (comprobado: 153223, 153220, 153256, 153420 responden en el nuevo).
  [/^\/propiedad\/(\d+)(?:_[^/]*)?\/?$/, (m) => `/propiedad/POT-${m[1]}`],
  // Las taxonomías del WordPress, al catálogo con el filtro puesto.
  [/^\/estado\/en-venta\/?$/, () => "/propiedades?operacion=venta"],
  [/^\/estado\/en-alquiler\/?$/, () => "/propiedades?operacion=alquiler"],
  [/^\/tipo-propiedad\/([^/]+)\/?$/, (m) => `/propiedades?cat=${encodeURIComponent(m[1])}`],
  [/^\/(?:area|ciudad)\/([^/]+)\/?$/, (m) => `/propiedades?q=${encodeURIComponent(m[1].replace(/-/g, " "))}`],
  // Páginas institucionales: en el sitio nuevo son secciones del home.
  [/^\/nosotros\/?$/, () => "/#nosotros"],
  [/^\/tasaciones\/?$/, () => "/#tasaciones"],
  [/^\/contacto\/?$/, () => "/#contacto"],
  // 🔴 `/propiedades` NO va acá: en el sitio nuevo ES una ruta real, y mapearla
  // a sí misma sería un redirect infinito en producción. Solo va `/mapa`, que
  // era una página del WordPress y acá no existe.
  [/^\/mapa\/?$/, () => "/propiedades"],
];

/* Páginas de demo del template de WordPress que nunca fueron contenido real.
 * Se responden 410 (muerta y no vuelve) en vez de redirigir: le dice a Google
 * que las saque del índice en lugar de mantenerlas dando vueltas. */
const BASURA_SITIO_VIEJO =
  /^\/(?:api-demo|api-web|api-insight|upload-images|property-outside|blog-post-outside|landing|author\/|destacada\/)/;

app.use((req, res, next) => {
  const host = String(req.headers.host ?? "").toLowerCase().split(":")[0];
  const esLocal = !host || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || /^\d+\.\d+\.\d+\.\d+$/.test(host);
  const destino = CANONICO && !esLocal ? `https://${CANONICO}` : "";

  // 1 · Direcciones del sitio viejo → su equivalente de acá (venga del host que
  //     venga). Va ANTES del salto de dominio: así se hace UN solo redirect y
  //     no dos encadenados, que diluyen la señal y suman latencia.
  for (const [patron, aDonde] of MAPA_SITIO_VIEJO) {
    const m = req.path.match(patron);
    if (!m) continue;
    const a = aDonde(m);
    // Cinturón: si el destino es la MISMA ruta y ya estamos en el dominio bueno,
    // no se redirige — un 301 a uno mismo es un bucle infinito servido al
    // visitante. Barato de poner, carísimo de descubrir en producción.
    if (a === req.originalUrl && (host === CANONICO || esLocal)) break;
    return res.redirect(301, `${destino}${a}`);
  }
  if (BASURA_SITIO_VIEJO.test(req.path)) return res.status(410).type("text/plain").send("410 Gone");

  // 2 · Cualquier host que no sea el canónico → el canónico, misma ruta.
  if (!destino || host === CANONICO) return next();
  // 308 no: los buscadores entienden el 301 como consolidación de autoridad,
  // que es exactamente lo que queremos decirle a Google.
  return res.redirect(301, `${destino}${req.originalUrl}`);
});

app.use(express.json({ limit: "256kb" }));

// ── Marina, el asistente de la web ───────────────────────────────────────────
// Público a la fuerza: lo usa cualquier visitante. Se limita por IP para que
// nadie lo use de canilla libre contra la cuenta de Anthropic.
app.post("/api/asistente", async (req, res) => {
  const cupo = pasaElCupo(ipDe(req.headers), "asistente");
  if (!cupo.ok) {
    // 🔴 El cupo protege la billetera, NO rompe la atención (19-ago). Antes esto
    // era un 429 con `error`, y el widget lo pintaba como "el asistente no está
    // disponible" — el cartel que vio Mateo. Ahora Marina contesta como una
    // persona ocupada: la charla sigue viva y el visitante reintenta.
    res.setHeader("Retry-After", String(cupo.esperarS));
    return res.status(200).json({
      respuesta:
        "Perdón, estoy atendiendo a varias personas a la vez. Dame unos segundos y repetime el mensaje, o si preferís seguimos por WhatsApp y un asesor te atiende ya.",
      camposIds: [],
      lead: null,
      degradado: true,
    });
  }
  const { status, data } = await atenderAsistente(req.body);
  res.status(status).json(data);
});

// ── El Probador del panel ────────────────────────────────────────────────────
// 🔒 CERRADO. Antes cualquiera podía mandarle un curl con el system prompt que
// quisiera y gastar la cuenta de Anthropic: es un chat genérico con la clave del
// servidor. Ahora exige sesión de panel.
app.post("/api/chat", async (req, res) => {
  if (!(await tieneSesionDePanel(req.headers.authorization))) {
    return res.status(401).json({ error: "Hace falta entrar al panel para usar el Probador." });
  }
  const cupo = pasaElCupo(ipDe(req.headers), "chat");
  if (!cupo.ok) {
    res.setHeader("Retry-After", String(cupo.esperarS));
    return res.status(429).json({ error: "Demasiadas pruebas seguidas. Esperá un momento." });
  }
  const { status, data } = await chatGenerico(req.body);
  res.status(status).json(data);
});

// ── Buscar una dirección en el mapa (para el panel) ──────────────────────────
// 🔒 Exige sesión: lo usa el que carga propiedades, no el visitante. Sin el
// candado seríamos un proxy gratis a Nominatim para cualquiera, y su política
// (1 pedido/segundo) la pagaríamos nosotros con la IP de Render bloqueada.
app.post("/api/geocodificar", async (req, res) => {
  if (!(await tieneSesionDePanel(req.headers.authorization))) {
    return res.status(401).json({ error: "Hace falta entrar al panel." });
  }
  const cupo = pasaElCupo(ipDe(req.headers), "chat");
  if (!cupo.ok) {
    res.setHeader("Retry-After", String(cupo.esperarS));
    return res.status(429).json({ error: "Muchas búsquedas seguidas. Esperá un momento." });
  }
  res.json(await geocodificar(req.body ?? {}));
});

// ── Tiles de edificios (proxy a ShadeMap) ────────────────────────────────────
// El CDN de ShadeMap (cfw.shademap.app) solo permite CORS desde sus dominios y
// localhost — desde nuestro dominio el navegador bloquea la respuesta (medido
// 11-ago: sin Access-Control-Allow-Origin para onrender.com). Server a server
// no hay CORS, así que el sitio pide acá. Es PÚBLICO (lo usa el visitante que
// abre las sombras/3D) pero con cupo por IP y cache: cada vista son 1-4 tiles.
const EDIFICIOS_ORIGEN = "https://cfw.shademap.app/buildings20260617";
const cacheEdificios = new Map<string, Buffer>(); // ~200 KB por tile
app.get("/api/edificios/:x/:y", async (req, res) => {
  const cupo = pasaElCupo(ipDe(req.headers), "chat");
  if (!cupo.ok) {
    res.setHeader("Retry-After", String(cupo.esperarS));
    return res.status(429).json({ error: "Muchos pedidos seguidos. Esperá un momento." });
  }
  const x = Number(req.params.x), y = Number(req.params.y);
  // Los tiles existen solo en z14: 0 ≤ x,y < 2^14.
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 16384 || y >= 16384) {
    return res.status(400).json({ error: "Tile inválido." });
  }
  const clave = `${x}/${y}`;
  try {
    let bytes = cacheEdificios.get(clave);
    if (!bytes) {
      // Cabeceras de navegador: el CDN es un worker de Cloudflare y a un fetch
      // pelado desde la IP de un datacenter lo mira feo (502 medido en Render;
      // el mismo fetch desde una IP hogareña pasaba).
      const r = await fetch(`${EDIFICIOS_ORIGEN}/14/${x}/${y}.mlt`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "*/*",
          "Accept-Language": "es-AR,es;q=0.9",
          Referer: "https://shademap.app/",
        },
      });
      // El estado del origen viaja en el error: sin esto, diagnosticar un 502
      // en producción es adivinar (cicatriz del 11-ago).
      if (!r.ok) return res.status(502).json({ error: "El proveedor de edificios no contestó.", origen: r.status });
      bytes = Buffer.from(await r.arrayBuffer());
      // Tope de memoria: ~50 tiles ≈ 10 MB. El archivo es datado (inmutable),
      // así que el navegador cachea 30 días y casi nunca vuelve a pedir.
      if (cacheEdificios.size >= 50) cacheEdificios.delete(cacheEdificios.keys().next().value!);
      cacheEdificios.set(clave, bytes);
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    res.send(bytes);
  } catch {
    res.status(502).json({ error: "El proveedor de edificios no contestó." });
  }
});

// ── Vista previa de WhatsApp por PROPIEDAD (pedido Mateo, 12-ago) ────────────
// WhatsApp/Facebook/Instagram NO ejecutan JavaScript: leen los <meta og:*> del
// HTML crudo. En una SPA esos meta son los genéricos del index — toda propiedad
// compartida mostraba la misma tarjeta. Acá, ANTES del fallback SPA, se
// intercepta /propiedad/:id, se lee la propiedad de la vista pública y se
// inyectan título, precio y SU foto en el HTML. El visitante humano no nota
// nada: recibe el mismo index.html y React arranca normal.
// 🔴 Lección BOCHILE→acá: esto es ESTÁNDAR de toda SPA de cliente, no un extra.
const escaparAtributo = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const reemplazarMeta = (html: string, propiedad: string, valor: string) =>
  html.replace(
    new RegExp(`(<meta[^>]*(?:property|name)="${propiedad}"[^>]*content=")[^"]*(")`),
    `$1${escaparAtributo(valor)}$2`,
  );
/* 🔴 EL CANONICAL, AUTORREFERENCIAL (20-ago).
 *
 * `index.html` trae `<link rel="canonical" href="%VITE_SITE_URL%/">` — con la
 * barra final, o sea SIEMPRE la raíz. Resultado: las 99 fichas le decían a
 * Google *"el original de esto es el home"*, y una ficha que canonicaliza al
 * home se deindexa. Peor: en la misma página el `og:url` sí salía correcto, así
 * que el HTML se contradecía a sí mismo.
 *
 * Es el bloqueante del 301 del dominio viejo: redirigir 8 años de autoridad
 * hacia páginas que canonicalizan a otra URL es peor que no migrar. */
const canonicalDe = (html: string, url: string) =>
  html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${escaparAtributo(url)}" />`,
  );

// La cartera es viva (Mateo edita a diario): cache corto, no eterno.
const cacheOG = new Map<string, { html: string; vence: number }>();

app.get("/propiedad/:id", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = String(req.params.id || "");
  const generico = () => res.sendFile(path.join(DIST, "index.html"));
  if (!/^[A-Za-z0-9-]{1,40}$/.test(id)) return generico();
  try {
    const enCache = cacheOG.get(id);
    if (enCache && enCache.vence > Date.now()) return res.type("html").send(enCache.html);

    const base = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!base || !key) return generico(); // modo demo: sin base no hay datos que inyectar
    const r = await fetch(
      `${base}/rest/v1/potente_propiedades_web?id=eq.${encodeURIComponent(id)}&select=titulo,zona,operacion,fotos,precioUSD,precioARS&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    const filas = r.ok ? ((await r.json()) as Array<Record<string, unknown>>) : [];
    const p = filas[0];
    if (!p) return generico(); // id inexistente: la SPA resuelve el 404 como siempre

    // La descripción se ARMA con campos limpios (nunca el texto scrapeado, que
    // arrastra teléfonos y links viejos). El precio como lo muestra la web.
    /* 🔴 14-ago · Temporada NO lleva precio, tampoco acá. Este es el espejo de
     * `precioPublico()` del front, y tiene que existir aparte porque este archivo
     * corre en Node contra el REST pelado: no comparte el módulo del bundle.
     * Sin esta línea, compartir por WhatsApp una propiedad de temporada publicaba
     * en la previsualización el alquiler MENSUAL que arrastra la ficha — y la
     * preview de WhatsApp es justo el canal de venta de esta inmobiliaria. */
    const usd = Number(p.precioUSD), ars = Number(p.precioARS);
    const precio = p.operacion === "temporada"
      ? "A consultar"
      : usd > 0 ? `U$S ${usd.toLocaleString("es-AR")}` : ars > 0 ? `$ ${ars.toLocaleString("es-AR")}${p.operacion === "alquiler" ? " por mes" : ""}` : "";
    const titulo = `${String(p.titulo || "Propiedad")} · Potente Propiedades`;
    const bajada = [precio, String(p.zona || ""), "Fotos, mapa y sol en la ficha completa."].filter(Boolean).join(" · ");
    // La PRIMERA foto de ESA propiedad — el corazón del pedido de Mateo.
    const fotos = Array.isArray(p.fotos) ? (p.fotos as string[]) : [];
    const foto = fotos.find((f) => /^https?:\/\//.test(String(f)));
    // Portable: sirve en cualquier dominio (Render hoy, Hostinger mañana) y
    // respeta el protocolo real (trust proxy lee x-forwarded-proto).
    const urlPropia = `${req.protocol}://${req.get("host")}${req.path}`;

    let html = readFileSync(path.join(DIST, "index.html"), "utf8");
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escaparAtributo(titulo)}</title>`);
    html = reemplazarMeta(html, "og:title", titulo);
    html = reemplazarMeta(html, "twitter:title", titulo);
    html = reemplazarMeta(html, "og:description", bajada);
    html = reemplazarMeta(html, "twitter:description", bajada);
    html = reemplazarMeta(html, "og:url", urlPropia);
    html = canonicalDe(html, urlPropia);
    if (foto) {
      html = reemplazarMeta(html, "og:image", foto);
      html = reemplazarMeta(html, "twitter:image", foto);
    } // sin foto propia queda la tarjeta de marca (og-portada) — nunca vacío

    if (cacheOG.size >= 300) cacheOG.delete(cacheOG.keys().next().value!);
    cacheOG.set(id, { html, vence: Date.now() + 10 * 60_000 });
    res.type("html").send(html);
  } catch {
    generico(); // cualquier tropiezo = la página de siempre, jamás un error al visitante
  }
});

// ── Sitemap y robots VIVOS (desde la base, no del build) ─────────────────────
// El sitemap que genera el build (scripts/gen-sitemap.mjs) saca los IDs de los
// datasets de muestra: las propiedades que Mateo carga por el panel no entraban
// nunca, y las que borra quedaban listadas para siempre. Acá se arma desde la
// MISMA vista pública que usa el OG, con el host real del pedido (portable:
// Render hoy, Hostinger mañana). Estas rutas van ANTES de express.static —
// si no, el estático sirve el dist/sitemap.xml congelado del build.
// La cartera es viva pero Google no relee cada minuto: cache 1 hora, por host
// (las URLs llevan el dominio con el que llegó el pedido; el Host lo manda el
// cliente, por eso el tope chico del Map).
const cacheSitemap = new Map<string, { xml: string; vence: number }>();

app.get("/sitemap.xml", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  const origen = `${req.protocol}://${req.get("host")}`;
  // Fallback honesto: el sitemap estático del build. Jamás un 500 al crawler.
  const estatico = () => res.type("application/xml").sendFile(path.join(DIST, "sitemap.xml"));
  try {
    const enCache = cacheSitemap.get(origen);
    if (enCache && enCache.vence > Date.now()) return res.type("application/xml").send(enCache.xml);

    const base = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!base || !key) return estatico(); // modo demo: vale el del build
    // PostgREST devuelve hasta 1.000 filas por pedido (techo de Supabase). La
    // cartera anda en ~100; si algún día lo pasa, esto necesita paginar.
    const r = await fetch(`${base}/rest/v1/potente_propiedades_web?select=id,created_at`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return estatico();
    const filas = (await r.json()) as Array<{ id?: unknown; created_at?: unknown }>;

    // /favoritos queda AFUERA a propósito: está bloqueada en robots.txt.
    const fijas = [
      { loc: "/", prioridad: "1.0" },
      { loc: "/propiedades", prioridad: "0.9" },
      // temporada: la búsqueda arranca en octubre, tiene que estar indexada antes
      { loc: "/temporada", prioridad: "0.9" },
      ...BARRIOS_TEMPORADA.map((b: string) => ({ loc: `/temporada/${slugBarrio(b)}`, prioridad: "0.8" })),
    ];
    const urls = [
      ...fijas.map((e) => `  <url><loc>${origen}${e.loc}</loc><priority>${e.prioridad}</priority></url>`),
      ...filas
        .filter((p) => typeof p.id === "string" && p.id)
        .map((p) => {
          // lastmod SOLO con la fecha real que expone la vista (created_at,
          // migración 010) — nada inventado.
          const fecha = typeof p.created_at === "string" ? p.created_at.slice(0, 10) : "";
          const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `<lastmod>${fecha}</lastmod>` : "";
          return `  <url><loc>${origen}/propiedad/${encodeURIComponent(p.id as string)}</loc>${lastmod}<priority>0.6</priority></url>`;
        }),
    ].join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

    if (cacheSitemap.size >= 20) cacheSitemap.delete(cacheSitemap.keys().next().value!);
    cacheSitemap.set(origen, { xml, vence: Date.now() + 60 * 60_000 });
    res.type("application/xml").send(xml);
  } catch {
    estatico(); // base caída = el sitemap del build, jamás un error al crawler
  }
});

// robots.txt con el host real: el estático del build lleva el dominio fijado en
// build-time — detrás de otro dominio le diría a Google que el sitemap vive en
// el viejo. Mismas Disallow que scripts/gen-sitemap.mjs. No toca la base, así
// que no necesita fallback.
app.get("/robots.txt", (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /panel",
      "Disallow: /admin",
      "Disallow: /ingresar",
      "Disallow: /cuenta",
      "Disallow: /favoritos",
      "",
      `Sitemap: ${req.protocol}://${req.get("host")}/sitemap.xml`,
      "",
    ].join("\n"),
  );
});

// Estáticos con cache larga para assets versionados por Vite.
// El index.html va SIN caché (no-store): después de cada deploy, los navegadores
// que ya visitaron la demo seguían mostrando la versión vieja (les pasó a Juani
// y le podía pasar al cliente). Los assets hasheados sí se cachean a un año.
app.use(
  express.static(DIST, {
    setHeaders: (res, file) => {
      if (/\.(js|css|woff2?|jpg|jpeg|png|webp|svg|mp4|webm)$/.test(file)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (/index\.html$/.test(file)) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);

// SPA fallback: cualquier ruta (ej. /propiedades, /panel) cae a index.html.
/* ── El catch-all: canonical autorreferencial y 404 de verdad ────────────────
 *
 * 🔴 20-ago. Dos arreglos que son requisito del 301 del dominio viejo:
 *
 * 1. **Canonical por ruta.** `/propiedades` y `/temporada` heredaban el
 *    canonical de `index.html`, que apunta a la raíz: Google las leía como
 *    duplicados del home.
 * 2. **404 real.** Cualquier ruta inexistente devolvía **200 con el home**
 *    (soft-404). Cuando el `.com.ar` redirija, sus taxonomías dadas de baja y
 *    las fichas vendidas van a caer acá: con 200 Google las mantiene en el
 *    índice compitiendo con el sitio nuevo, en vez de entender que murieron.
 *    Se responde 404 con la MISMA app (el router pinta su pantalla), pero con
 *    el código correcto en la cabecera — que es lo único que lee el buscador.
 *
 * Las rutas conocidas se listan acá porque el router vive en el bundle y este
 * archivo no puede importarlo. Si nace una ruta pública nueva, sumala.
 * `e2e/dominio.mjs` verifica las dos cosas contra producción. */
const RUTAS_PUBLICAS = [
  /^\/$/,
  /^\/propiedades\/?$/,
  /^\/temporada\/?$/,
  /^\/temporada\/[^/]+\/?$/,
  /^\/favoritos\/?$/,
  /^\/propiedad\/[^/]+\/?$/, // las inexistentes ya las filtra su propia ruta
  /^\/campos\/?$/,           // redirect interno a /propiedades?cat=campo
  /^\/campo\/[^/]+\/?$/,     // redirect interno de la era "campos"
  /^\/(panel|admin|ingresar|cuenta)(\/|$)/, // privadas: no son 404 ni llevan canonical
];

app.get("*", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const conocida = RUTAS_PUBLICAS.some((re) => re.test(req.path));
  const html = readFileSync(path.join(DIST, "index.html"), "utf8");
  if (!conocida) {
    // Sin canonical: una página que no existe no debe reclamar ser el original
    // de nada, ni apuntar al home (eso la mantiene viva en el índice).
    return res.status(404).type("html").send(html.replace(/<link rel="canonical"[^>]*>/, ""));
  }
  const urlPropia = `${req.protocol}://${req.get("host")}${req.path}`;
  res.type("html").send(canonicalDe(html, urlPropia));
});

app.listen(PORT, () => {
  console.log(`Potente Propiedades sirviendo en :${PORT} (dist: ${DIST})`);
});
