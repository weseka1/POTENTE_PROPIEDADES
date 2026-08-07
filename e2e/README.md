# Pruebas end-to-end · Potente Propiedades

Manejan un Chrome de verdad contra la app corriendo, y **verifican contra los datos
guardados, no contra el HTML**: si el dato no quedó, el botón no sirvió por más
lindo que se vea.

No hay framework. Son scripts de Node que hablan con Chrome por el protocolo de
DevTools (`cdp.mjs` y `cdp2.mjs` son el driver).

> ⚠️ **Leer antes de correr nada del panel.** Al conectar la base de datos
> (6-ago-2026) se desactivó el acceso demo: con Supabase configurado, el panel
> exige una sesión real (`src/panel/auth.tsx`). Las suites que entraban poniendo
> `localStorage.potente_demo_auth = "1"` **ya no entran** y dan fallos en masa que
> no son bugs de la app. Ver la columna "Entra con" de la tabla.

## Cómo se corren

Hacen falta dos cosas prendidas: la app y un Chrome con el puerto de depuración
abierto.

```bash
# 1) la app — con la base (como en producción)
npm run build && npm start          # http://localhost:3000

#    …o sin la base, para las suites que todavía usan el modo demo:
npm run dev -- --port 5177 --strictPort

# 2) Chrome con depuración remota (en otra terminal)
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-e2e --no-first-run --disable-gpu about:blank

# 3) las pruebas (desde frontend/)
APP=http://localhost:3000 node e2e/sweep-final.mjs
```

## Qué prueba cada uno

**Entra con** dice cómo llega al panel: `sesión real` usa `login.mjs` y funciona
con la base conectada; `modo demo` usa el puente viejo y **necesita levantar la app
sin las variables de Supabase** (o migrarse, ver abajo).

| Script | Qué verifica | Entra con | Chequeos |
|---|---|---|---|
| `sweep-final.mjs` | Las 22 rutas del panel y del sitio: que rendericen y **no tiren un solo error de consola** | sesión real | 22 |
| `deforma.mjs` | Que ninguna ruta estire la página en pantallas angostas (320 y 390 px) | público | 40 |
| `visitante-sin-ficha.mjs` | **Qué se lleva el navegador de un desconocido.** Espía el tráfico a Supabase: que pida la vista y no la tabla, que no le llegue la ficha interna (propietario, llaves) y que no pida las tablas del panel | público | 7 |
| `seguridad.mjs` | **Sin navegador, como el que ataca.** Que el Probador de IA no se pueda usar sin sesión (era un proxy abierto a Anthropic), que Marina tenga cupo por IP y que estén las cabeceras de seguridad | pedidos crudos | 9 |
| `flujos.mjs` | Alta, edición, baja y persistencia de clientes, visitas, tasaciones, contratos, propiedades y reservas. Anti doble reserva. Que el PDF y la planilla **bajen de verdad** | modo demo | 20 |
| `botones2.mjs` | Hace click en **cada botón** del panel, recargando y reseteando antes de cada uno. Detecta botones rotos o sin efecto | modo demo | 411 botones |
| `test-bandeja.mjs` | La bandeja del Asistente: burbujas por canal, filtros, WhatsApp con el texto correcto, confirmación de envío, tomar/devolver/cerrar | modo demo | 41 |
| `dispositivos.mjs` | iPhone SE/14/15 Pro Max, Galaxy S22, Pixel 8, iPad — con touch activado. Viewport, campos a 16px (Safari no hace zoom), blancos tocables | público | 7 |
| `chips.mjs` | Que los 7 canales se vean siempre, sin cortarse, en 10 anchos distintos | modo demo | 10 |
| `fotos.mjs` | Que una foto cargada desde el panel **sobreviva al cierre del navegador** | modo demo | 7 |
| `temporada-fechas.mjs` | Reserva por fechas libres: entrada/salida, noches, anti-solape, persistencia | modo demo | — |
| `temporada-mobile.mjs` | Que la grilla de Temporada no arme una tabla con scroll horizontal en el celular | modo demo | — |

Además, fuera de `e2e/` hay dos verificaciones que corren **contra la base real**
(no necesitan Chrome) y son las más importantes del proyecto:

```bash
npm run verificar-db    # 37 · aislamiento por oficina, permisos, integridad, auditoría
npm run verificar-pin   # 10 · el PIN de cada perfil
```

## Migrar una suite al login real

El patrón está en `sweep-final.mjs`. Son tres líneas:

```js
import { pedirSesion, guionSesion } from "./login.mjs";

await ir(APP + "/", 1200);                  // primero pararse en el origin
const sesion = await pedirSesion("mateo");  // o "chauvin" / "mogotes"
await evaluar(guionSesion(sesion));         // deja la sesión en el navegador
```

`login.mjs` lee las contraseñas de `frontend/.env.local` — **nunca del código**.
Si falta una, avisa cuál.

Ojo: varias suites (`flujos.mjs` sobre todo) no solo entran con el puente demo,
también **verifican contra `localStorage.potente_demo_*`**. En esas, migrar el
login no alcanza: hay que cambiar el oráculo para que consulte la base.

## Cómo leer los resultados

Cada script imprime `PASS` / `FAIL` por línea y un resumen al final. Salen con
código 1 si algo falla, así que sirven en un hook o en CI.

## Trampas que ya nos costaron caro

- **Nunca pasar `tsc` o los tests por un pipe** (`| head`): el código de salida que
  leés es el del pipe, no el del comando. Un `tsc` roto parece limpio.
- `offsetParent` **no** detecta `visibility: hidden`. Para saber si algo es
  alcanzable con Tab, enfocalo y mirá `document.activeElement`.
- `innerText` respeta `text-transform`, así que un chip con `uppercase` devuelve
  `"TE TOCA A VOS"`, no `"Te toca a vos"`.
- Comparar el **largo** del HTML no alcanza para saber si un click hizo algo: un
  toggle que cambia clases mide igual. Comparar el string completo.
- Un botón que "no hace nada" puede estar simplemente **ya activo** (la pestaña
  actual, el filtro actual). No es un bug.
- El endpoint de login de Supabase **corta si le llegan varios pedidos seguidos**
  desde la misma IP. Por eso `login.mjs` reintenta con espera creciente y las
  suites que abren tres sesiones las separan unos segundos.
- Un `.click()` por código **no dispara** los eventos de puntero. Para probar un
  gesto de arrastre hay que emitir `Input.dispatchMouseEvent` (pressed → varios
  moved → released), como hace la prueba de la galería.
