# Temporada por fechas libres — Potente Propiedades

**Problema:** hoy la reserva se ata a una quincena fija (`tramoId`). En Mar del Plata
nadie alquila la quincena entera: se alquila por 4, 5, 7 días, una semana, dos, hasta
un mes. El tablero es demasiado rígido.

**Objetivo:** que Mateo cargue una reserva con fecha de entrada y salida libres, con la
interfaz más conocida (calendario mensual por unidad), y que el sistema calcule el
precio sugerido y no permita solapamientos.

## Alcance

Cambia **solo el motor de reservas del panel**. El sitio público (`src/site/Temporada.tsx`)
sigue usando las quincenas para su formulario de consulta ("¿cuándo venís?") — no lee
reservas, así que no se toca. Se mantienen `TRAMOS`, `tramoById`, `tarifaDe`.

## Modelo de datos (`src/data/types.ts`)

`ReservaTemporada`: se saca `tramoId`, se agregan:
- `desdeISO: string` — check-in (día que entra)
- `hastaISO: string` — check-out (día que se va; no se cuenta como noche ocupada)
- `noches: number`

`UnidadTemporada`: se agregan
- `tarifaNocheARS: number` — tarifa por noche en temporada alta (pico)
- `minNoches?: number` — estadía mínima opcional (solo avisa, no bloquea)

Se conserva `tarifas` (por quincena) para el sitio público y como referencia.

## Precio (`src/data/temporada.ts`)

- `curvaEnFecha(iso): number` — mapea una fecha al multiplicador estacional, reusando
  `CURVA` (ubica en qué quincena cae la fecha). Enero 2ª = 1.0 (pico); dic/mar más bajo.
- `precioSugerido(u, desdeISO, hastaISO): number` — suma, por cada noche del rango,
  `tarifaNocheARS × curvaEnFecha(noche)`. Redondeado.
- El total es **sugerido y editable**: al cargar, se muestra calculado pero Mateo puede
  pisarlo si arregló otra cosa.

## Disponibilidad

- Dos reservas de la misma unidad **no pueden solaparse** por día (check-out == check-in
  de la siguiente SÍ se permite: el que se va libera el día que entra el próximo).
- `haySolape(unidadId, desdeISO, hastaISO, exceptoReservaId?)` valida en el alta.
- Estados que ocupan: señada, confirmada, en_curso, finalizada. `cancelada` libera.

## Vista principal — panel (`src/panel/pages/Temporada.tsx`), pestaña Disponibilidad

1. **Lista de unidades** (una por fila/tarjeta): thumbnail, título, barrio·amb·pers,
   una **tira de disponibilidad** dic→mar (barrita que pinta los rangos ocupados) y
   "próximo hueco libre". Botones editar/limpieza como hoy.
2. Tocás una unidad → se abre su **calendario mensual** (dic, ene, feb, mar 2026/27):
   - días ocupados: pintados con el color del estado + apellido del inquilino
   - días libres: en blanco, clickeables
   - tocás día de entrada, tocás día de salida → abre el alta con ese rango
3. **Alta de reserva** (modal): fechas elegidas, noches, **total sugerido editable**,
   inquilino, contacto, personas, seña, estado. Aviso si `minNoches` no se cumple.
   Rechazo con mensaje si el rango solapa (dice con quién choca).
4. Tocás una reserva existente → detalle (como hoy).

**Mobile:** una tarjeta por unidad con su calendario (sin tabla, sin scroll lateral —
mismo principio que el fix de hoy).

## Lo que NO cambia

- Seña, comisión de Potente (%), **rendición** (suma `montoTotalARS` por unidad — es
  agnóstica al modelo) con export PDF/Excel.
- Semáforo de **limpieza/turnover** (`enLimpieza`).
- Qué unidad se publica en la web (`activa`).
- Pestaña **Tarifario**: pasa a editar la `tarifaNocheARS` por unidad (en vez de las 8
  quincenas), con nota de la curva estacional.

## Datos de demo

Convertir las 18 reservas semilla de `tramoId` a rangos de fechas realistas dentro de
su quincena original (ej: la que estaba en "ene-2" pasa a "16 al 26 de enero"). Sembrar
`tarifaNocheARS` por unidad = tarifa pico / 15. Que la demo se vea llena y creíble.

## Verificación

- Test e2e nuevo: cargar una reserva del 3 al 10 de enero, verificar noches=7 y total
  calculado; intentar solapar 5–12 y verificar el rechazo; check-out==check-in permitido.
- Regresión: rendición sigue sumando bien; mobile sin tabla ni desborde (test existente).
- Visual: calendario en desktop 1440 y celular 390.
