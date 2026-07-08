# Potente Propiedades — Web + Panel

Web pública (futurista clara, SEO completo) + panel de gestión de cartera + asistente IA "Marina".
Réplica del software IAGRO rebrandeada para Potente Propiedades (Mar del Plata, +50 años, 3 generaciones, 2 sucursales).

## Stack
- Vite + React + TypeScript + Tailwind
- GSAP + Lenis (micro-animaciones, smooth scroll)
- Asistente IA: Claude Haiku 4.5 vía `/api/asistente` (server Express en Render / Netlify Function en Netlify)
- Datos: **modo demo con datos de muestra locales** (sin DB). Si se cargan `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, sincroniza contra tablas `potente_*`.

## Correr local
```bash
npm install
npm run dev          # web + panel en http://localhost:5173
```

Para probar el asistente Marina en local (necesita la API key):
```bash
npm run build
ANTHROPIC_API_KEY=sk-... npm start   # sirve dist/ + POST /api/asistente en :3000
```

## Accesos de demo
- Panel: `/panel` → email `demo@potenteprop.com.ar` · pass `potente2026`
- Perfiles: Mateo (admin) · Punta Mogotes · Chauvín

## Deploy (Render)
1. Repo en GitHub → Render → New → **Blueprint** → conectar el repo (lee `render.yaml`).
2. Cargar env var `ANTHROPIC_API_KEY` (sin eso la web anda igual; el chat avisa que no está configurado).
3. Supabase queda vacío a propósito (demo con datos locales). Al cerrar la venta: proyecto/tablas `potente_*` + cargar las 2 vars.

## SEO
- `index.html`: meta completo + Open Graph + JSON-LD `RealEstateAgent` (2 sucursales).
- `src/site/lib/seo.ts`: title/description/canonical/JSON-LD por ruta; fichas de propiedad emiten `RealEstateListing`.
- `scripts/gen-sitemap.mjs`: genera `public/sitemap.xml` en cada build (rutas + propiedades).
- `public/robots.txt`: indexa el sitio público, bloquea `/panel`.
- Upgrade futuro para dominio propio: cambiar `SITE` en `seo.ts` + `SITE_URL` del build + canonical de `index.html` a `potenteprop.com.ar`, y evaluar prerender/SSG.

## Estructura
- `src/site/` — web pública (Home, Catálogo, Ficha, Favoritos, Cuenta)
- `src/panel/` — panel de gestión (13 páginas: Dashboard, Cartera, CRM, Leads, Pipeline, Agenda, Tasaciones, Planos, Reportes…)
- `src/data/` — datos de muestra (Mar del Plata)
- `netlify/functions/` — núcleo del asistente (`_core.ts`) + config del cliente (`_config.ts`)
- `server/` — server Express para Render (estáticos + `/api/asistente`)

> Molde replicable: ver `02_PRODUCTO/TEMPLATES_BASE/INMOBILIARIA_BASE.md` en la estructura WSK.
