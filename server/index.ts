import express from "express";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { atenderAsistente, chatGenerico } from "../netlify/functions/_core";
import { geocodificar } from "../netlify/functions/_geocodificar";
import { pasaElCupo, ipDe, tieneSesionDePanel, CABECERAS_SEGURIDAD } from "../netlify/functions/_seguridad";

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

app.use(express.json({ limit: "256kb" }));

// ── Marina, el asistente de la web ───────────────────────────────────────────
// Público a la fuerza: lo usa cualquier visitante. Se limita por IP para que
// nadie lo use de canilla libre contra la cuenta de Anthropic.
app.post("/api/asistente", async (req, res) => {
  const cupo = pasaElCupo(ipDe(req.headers), "asistente");
  if (!cupo.ok) {
    res.setHeader("Retry-After", String(cupo.esperarS));
    return res.status(429).json({ error: "Vas muy rápido. Probá de nuevo en un momento." });
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
      const r = await fetch(`${EDIFICIOS_ORIGEN}/14/${x}/${y}.mlt`);
      if (!r.ok) return res.status(502).json({ error: "El proveedor de edificios no contestó." });
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
app.get("*", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Potente Propiedades sirviendo en :${PORT} (dist: ${DIST})`);
});
