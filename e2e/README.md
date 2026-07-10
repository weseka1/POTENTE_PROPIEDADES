# Pruebas end-to-end · Potente Propiedades

Manejan un Chrome de verdad contra la app corriendo, y **verifican contra los datos
guardados, no contra el HTML**: si el dato no quedó, el botón no sirvió por más
lindo que se vea.

No hay framework. Son scripts de Node que hablan con Chrome por el protocolo de
DevTools (`cdp.mjs` y `cdp2.mjs` son el driver).

## Cómo se corren

Hacen falta dos cosas prendidas: la app y un Chrome con el puerto de depuración
abierto.

```bash
# 1) la app (desde frontend/)
npm run dev -- --port 5177 --strictPort

# 2) Chrome con depuración remota (en otra terminal)
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-e2e --no-first-run --disable-gpu about:blank

# 3) las pruebas (desde frontend/e2e/)
node flujos.mjs
```

Si la app corre en otro puerto: `APP=http://localhost:3400 node flujos.mjs`.

## Qué prueba cada uno

| Script | Qué verifica | Chequeos |
|---|---|---|
| `flujos.mjs` | Alta, edición, baja y persistencia de clientes, visitas, tasaciones, contratos, propiedades y reservas. Anti doble reserva. Que el PDF y la planilla **bajen de verdad** | 20 |
| `botones2.mjs` | Hace click en **cada botón** del panel, recargando la página y reseteando los datos antes de cada uno. Detecta botones rotos o sin efecto | 411 botones |
| `test-bandeja.mjs` | La bandeja del Asistente: burbujas por canal, filtros, WhatsApp con el texto correcto, confirmación de envío, tomar/devolver/cerrar | 41 |
| `dispositivos.mjs` | iPhone SE/14/15 Pro Max, Galaxy S22, Pixel 8, iPad — con touch activado. Viewport, campos a 16px (Safari no hace zoom), blancos tocables | 7 |
| `deforma.mjs` | Que ninguna ruta estire la página en pantallas angostas (320 y 390 px) | 40 |
| `chips.mjs` | Que los 7 canales se vean siempre, sin cortarse, en 10 anchos distintos | 10 |
| `sweep-final.mjs` | Las 22 rutas del panel y del sitio: que rendericen y **no tiren un solo error de consola** | 22 |
| `verificar-arreglos.mjs` | Regresión de los tres bugs de la revisión de julio (fichas, planos, drawer) | 5 |

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
