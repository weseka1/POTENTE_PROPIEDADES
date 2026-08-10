// Genera public/sitemap.xml Y public/robots.txt antes del build (lo corre
// `npm run build`). Extrae los IDs de propiedades de los datasets locales por
// regex (sin importar TS) para que el script sea robusto ante cualquier cambio
// de imports en src/data.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOMINIO_POR_DEFECTO } from "../src/config/dominio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
// La misma variable que usa el front (VITE_SITE_URL); SITE_URL queda aceptada
// por compatibilidad con lo que ya esté configurado en el hosting.
const SITE = process.env.VITE_SITE_URL || process.env.SITE_URL || DOMINIO_POR_DEFECTO;

const hoy = new Date().toISOString().slice(0, 10);

// Barrios con página propia de temporada. DEBE coincidir exactamente con
// BARRIOS_TEMPORADA de src/site/Temporada.tsx: un slug de más acá = URL en el
// sitemap que redirige, y Google penaliza eso.
const BARRIOS_TEMPORADA = ["Playa Grande", "Varese", "Güemes", "La Perla", "Chauvín", "Punta Mogotes"];
const slugBarrio = (b) =>
  b.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "-");

const estaticas = [
  { loc: "/", prioridad: "1.0" },
  { loc: "/propiedades", prioridad: "0.9" },
  // temporada: la búsqueda arranca en octubre, estas páginas tienen que estar indexadas antes
  { loc: "/temporada", prioridad: "0.9" },
  ...BARRIOS_TEMPORADA.map((b) => ({ loc: `/temporada/${slugBarrio(b)}`, prioridad: "0.8" })),
  { loc: "/propiedades?cat=casa", prioridad: "0.8" },
  { loc: "/propiedades?cat=departamento", prioridad: "0.8" },
  { loc: "/propiedades?cat=local", prioridad: "0.7" },
  { loc: "/propiedades?cat=lote", prioridad: "0.7" },
  { loc: "/propiedades?operacion=alquiler", prioridad: "0.8" },
];

// IDs de propiedades publicadas en los datasets de muestra
const fuentes = ["src/data/urbanas.ts", "src/data/campos.ts"];
const ids = new Set();
for (const f of fuentes) {
  try {
    const texto = readFileSync(path.join(ROOT, f), "utf8");
    for (const m of texto.matchAll(/\bid:\s*"([^"]+)"/g)) ids.add(m[1]);
  } catch {
    /* dataset opcional */
  }
}

const esc = (s) => s.replace(/&/g, "&amp;");
const urls = [
  ...estaticas.map((e) => `  <url><loc>${SITE}${esc(e.loc)}</loc><lastmod>${hoy}</lastmod><priority>${e.prioridad}</priority></url>`),
  ...[...ids].map((id) => `  <url><loc>${SITE}/propiedad/${encodeURIComponent(id)}</loc><lastmod>${hoy}</lastmod><priority>0.6</priority></url>`),
].join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
writeFileSync(path.join(ROOT, "public", "sitemap.xml"), xml);

// robots.txt se genera ACÁ, junto con el sitemap, a propósito: era un archivo
// estático con la URL del sitemap hardcodeada que nadie regeneraba. El modo de
// falla era silencioso y feo — cambiás el dominio, el sitemap apunta al nuevo y
// robots.txt le sigue diciendo a Google que el sitemap vive en el viejo.
const robots = `User-agent: *
Allow: /
Disallow: /panel
Disallow: /admin
Disallow: /ingresar
Disallow: /cuenta
Disallow: /favoritos

Sitemap: ${SITE}/sitemap.xml
`;
writeFileSync(path.join(ROOT, "public", "robots.txt"), robots);
console.log(`sitemap.xml: ${estaticas.length} rutas + ${ids.size} propiedades → ${SITE} (+ robots.txt)`);
