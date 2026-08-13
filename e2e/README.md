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
| `sweep-final.mjs` | Las 23 rutas del panel y del sitio: que rendericen y **no tiren un solo error de consola** | sesión real | 23 |
| `deforma.mjs` | Que ninguna ruta estire la página en pantallas angostas (320 y 390 px) | público | 42 |
| `galeria.mjs` | Las flechas y las miniaturas de la galería **con mouse de verdad** (`Input.dispatchMouseEvent`), en escritorio y celular. Existe porque `setPointerCapture` mataba las flechas y con `.click()` daba verde igual | público | 23 |
| `cartera-busqueda.mjs` | Que el buscador del panel encuentre por **dirección** y sin tildes ("cordoba" → "Av. Córdoba"). El caso de prueba se elige de la base VIVA en cada corrida — invariantes, nunca IDs fijos (reporte de Mateo del 11-ago) | sesión real | 5 |
| `llaves.mjs` | El **registro de llaves** de punta a punta, con clicks reales: cargar una llave, verla en la lista, entregarla (y que diga A QUIÉN — el corazón del pedido de Mateo), el historial con sus movimientos, devolverla y borrarla. Se limpia sola: la llave de sonda usa el número 8801 y al final se borra. El aislamiento entre oficinas NO va acá, es de la base (`verificar-db`) | sesión real | 16 |
| `catalogo-filtros.mjs` | Que la barra de filtros no se coma la pantalla al bajar: 3 celulares + 3 escritorios. La aserción que importa: **una tarjeta NO se mueve durante el scroll** (el bug del 10-ago era un salto de layout de 201 px). También: el bloque se desvanece y reaparece, y el botón "Filtros" queda siempre como puerta. Antes era `catalogo-mobile` y por eso el mismo bug en escritorio pasó dos días | público | 72 |
| `campos-por-tipo.mjs` | Que el formulario pida los campos de cada categoría (piso y expensas en depto, frente/fondo y superficie construible en lote) y que no queden los del tipo anterior | sesión real | 39 |
| `ficha-sin-vacios.mjs` | Que la ficha pública **no muestre campos sin dato** —el pedido textual de Mateo— y que las expensas salgan junto al precio | público | 41 |
| `privacidad-perfiles.mjs` | Que una oficina no pueda ponerse el sombrero de la Dirección, ni recreando perfiles con ids al azar ni editando `localStorage` a mano | sesión real | 19 |
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
npm run verificar-db    # 62 · aislamiento por oficina, permisos, integridad, auditoría
npm run verificar-pin   # 10 · el PIN de cada perfil
npm run verificar-sol   # 27 · el motor de asoleamiento, contra FÍSICA (altura del
                        #      sol al mediodía = 90 − |lat| ∓ 23,44; azimut 0 = norte
                        #      en el hemisferio sur). Existe porque suncalc cambió de
                        #      convención entre versiones: un update silencioso daría
                        #      números plausibles y equivocados.
```

Y dos operativos que no verifican pero conviene conocer: `npm run respaldo`
(baja toda la base a JSON — obligatorio antes de cualquier migración; el plan
free no tiene backups) y `npm run cerrar-puerta` (los interruptores de Supabase).

⚠️ **`verificar-db` corre contra la cartera VIVA de Mateo, no contra un seed.**
Por eso ninguna prueba afirma cantidades ("103 propiedades", "21 con expensas"):
esos números bajan cuando él borra y suben cuando carga, y un rojo que no es un
bug enseña a ignorar los rojos. Lo que se verifica son **invariantes** — que la
dirección vea más que cualquier oficina, que ninguna propiedad tenga las expensas
como texto suelto teniendo la columna vacía. Eso es cierto con 97 propiedades y
con 300.

Y sirve: el 10-ago esa forma de escribir la prueba encontró que editar un lote
**borraba** el campo "apta crédito" (el esquema no lo incluía para esa familia y
el formulario lo mandaba en `null`). Cinco propiedades ya habían perdido el dato.

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
- 🔴 **Un `.click()` por código puede dar verde sobre un botón MUERTO.** No pasa
  por el hit-testing ni por la captura de puntero, así que no ve que otra capa
  esté tapando el botón ni que un `setPointerCapture` le esté robando el click.
  Nos costó la flecha de la galería: andaba en los tests y no andaba con el mouse.
  Para cualquier control que viva adentro de algo que escuche eventos de puntero,
  usar `Input.dispatchMouseEvent` (`galeria.mjs` tiene el ayudante `clickReal`) y
  chequear con `elementFromPoint` que el click **le llegue** al botón.
- **Medir la visibilidad contra el contenedor, no contra la ventana.** En un
  scroller horizontal `getBoundingClientRect` devuelve la posición real de los
  hijos aunque el `overflow` los tape: si el scroller es más angosto que la
  pantalla, un elemento recortado igual "cae dentro de `innerWidth`".
- **No afirmar "se ve una tarjeta entera"**: eso depende de dónde caiga el scroll,
  no del layout. Medir "visible al 70 %" y, aparte, que el hueco libre alcance
  para el alto de la tarjeta. Con "entera" el mismo código daba rojo a 1366 y
  verde a 1440 por 130 px de scroll.
