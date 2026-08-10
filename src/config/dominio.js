// ── EL DOMINIO DEL SITIO, EN UN SOLO LUGAR ────────────────────────────────────
//
// Este archivo es .js plano A PROPÓSITO: lo importan tres mundos distintos y es
// el único formato que los tres entienden sin compilar:
//   1. src/config/marca.ts        → el navegador (canonical, OG, compartir, PDFs)
//   2. scripts/gen-sitemap.mjs    → node en build (sitemap.xml y robots.txt)
//   3. vite.config.ts             → para que %VITE_SITE_URL% exista en index.html
//
// CÓMO SE CAMBIA EL DOMINIO (cuando el cliente apunte el suyo o mude de hosting):
//   · Lo correcto: variable de entorno VITE_SITE_URL en el hosting (build Y
//     runtime) — no hace falta tocar código.
//   · Lo rápido: cambiar el valor de acá abajo y hacer build.
// En los dos casos, sitemap, robots, canonical, OG, JSON-LD, los links de
// compartir por WhatsApp y los pies de los PDF cambian todos juntos. Antes el
// dominio estaba suelto en 4 lugares (y 3 no coincidían entre sí: los PDFs y el
// botón de compartir imprimían potenteprop.com.ar, que nunca fue el sitio).

export const DOMINIO_POR_DEFECTO = "https://potente-propiedades.onrender.com";
