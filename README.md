# Potente Propiedades — Web + Panel

Sistema completo de una inmobiliaria de Mar del Plata con **dos oficinas**
(Chauvín y Punta Mogotes) y dirección centralizada:

- **Web pública** — catálogo con buscador, fichas con galería, temporada de verano,
  formulario de contacto y el asistente "Marina".
- **Panel de gestión** — cartera, CRM, consultas, embudo, agenda, tasaciones,
  alquileres, temporada y reportes. Cada oficina ve **solo lo suyo**.

## Cómo levantarlo

```bash
npm install
npm run dev      # web + panel en http://localhost:5173 (sin el asistente)
```

Con el asistente Marina y el servidor real (lo mismo que corre en producción):

```bash
npm run build
npm start        # sirve dist/ + POST /api/asistente en http://localhost:3000
```

`npm start` lee `.env.local`, que **no está en el repo**. Necesita:

```
VITE_SUPABASE_URL=https://gqhpgexqbnqqqeynbucu.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...      # pública, va al navegador
ANTHROPIC_API_KEY=sk-ant-...                   # SECRETA (asistente Marina)
```

Las dos primeras están en `render.yaml` (son públicas). La de Anthropic vive solo
en `.env.local` y en las variables de Render/Netlify.

> Sin las variables de Supabase la app **no se rompe**: cae sola a los datos de
> muestra de `src/data/` y funciona como demo. Es a propósito.

## Entrar al panel

`/ingresar` — cada oficina tiene su usuario y la base filtra lo que ve cada una:

| Usuario | Ve |
|---|---|
| `mateo@potenteprop.com.ar` | Todo, las dos oficinas |
| `chauvin@potenteprop.com.ar` | Solo Chauvín |
| `mogotes@potenteprop.com.ar` | Solo Punta Mogotes |

Contraseñas en `02_INFRA/credenciales/`. Un perfil puede además pedir **PIN** para
entrar; lo administra Dirección desde "Administrar perfiles".

## Verificar que todo sigue sano

```bash
npm run verificar-db    # 37 pruebas: aislamiento por oficina, permisos, integridad
npm run verificar-pin   # 10 pruebas: el PIN de cada perfil
node e2e/sweep-final.mjs   # 22 rutas sin errores de consola
node e2e/deforma.mjs       # 40 chequeos de que nada desborde en 320 y 390px
```

`verificar-db` es el más importante: prueba **contra la base real** que una oficina
no pueda leer los datos de la otra. Correrlo después de tocar el esquema o las
políticas.

Las pruebas de pantalla necesitan Chrome con depuración remota:
```bash
chrome --headless=new --remote-debugging-port=9222
```

## Cargar datos

```bash
npm run sembrar                 # 103 propiedades + temporada (datos reales)
npm run sembrar -- --con-demo   # + los datos de ejemplo del CRM
```
Es idempotente: deja la base igual a los archivos de `src/data/`.

## Base de datos

Supabase propio en São Paulo. Todo el modelo en **un archivo comentado**:
`02_INFRA/supabase/001_esquema.sql` — y la guía corta en
[`02_INFRA/supabase/README.md`](../../02_INFRA/supabase/README.md).

Lo importante: RLS en las 11 tablas, la oficina del usuario sale de `app_metadata`
(no la puede falsear), y la doble reserva de temporada es **imposible** a nivel base.

## Deploy

Dos entornos con el mismo build:

- **Render** (principal) — `https://potente-propiedades.onrender.com`
  Es un web service, no un sitio estático: el asistente vive en `/api/asistente`
  (Express, `server/index.ts`). Se dispara con el deploy hook después de cada push.
- **Netlify** (espejo) — `https://potente-propiedades-mdp.netlify.app`
  `netlify deploy --prod --dir=dist`. Ahí Marina corre como función
  (`netlify/functions/`).

## Estructura

```
src/
├── site/            la web pública
│   ├── components/  GaleriaPropiedad (el deslizar tipo iPhone), PropiedadCard,
│   │                WhatsAppCTA (selector de oficina), InstagramFeed, Navbar…
│   └── lib/         SEO por ruta y smooth scroll
├── panel/           el panel de gestión
│   ├── pages/       14 páginas (Cartera, CargarPropiedad, CRM, Temporada…)
│   ├── auth.tsx     login real; con base conectada NO hay acceso demo
│   └── profiles.tsx perfiles + PIN. El perfil lo fija el usuario que entró.
├── data/            datos de muestra y los tipos del dominio
├── lib/             DataProvider (base o local), marca.ts, formato, imágenes
└── config/marca.ts  LA fuente de verdad: oficinas, teléfonos, horarios, redes

netlify/functions/   el cerebro de Marina (_core, _prompt, _config)
server/              Express para Render
scripts/             sembrar, verificar-db, verificar-pin, sitemap
e2e/                 pruebas de pantalla por CDP
```

### Dos convenciones que conviene saber

**`src/config/marca.ts` es la fuente de verdad de los datos del negocio.** Ningún
teléfono, dirección ni horario se escribe suelto en un componente: si hay que
cambiar el WhatsApp de una oficina, se cambia ahí y se actualiza en toda la app.

**El modo demo es una red de seguridad, no código muerto.** Si faltan las
credenciales, `DataProvider` usa `src/data/` y guarda en el navegador. Sirve para
mostrar el sistema sin tocar los datos del cliente. Al cambiar esos datos de muestra
hay que **subir `SEED_VERSION`** en `DataProvider.tsx`, si no los navegadores que ya
visitaron siguen mostrando lo viejo.

## SEO

- `index.html`: meta + Open Graph + JSON-LD `RealEstateAgent` (las dos oficinas).
- `src/site/lib/seo.ts`: título, descripción y canonical por ruta; cada ficha emite
  `RealEstateListing`.
- `scripts/gen-sitemap.mjs`: regenera `public/sitemap.xml` en cada build.
- `public/robots.txt`: indexa la web, bloquea `/panel`.
- Para el dominio propio: cambiar `SITE` en `seo.ts`, `SITE_URL` del build y el
  canonical de `index.html` a `potenteprop.com.ar`.
