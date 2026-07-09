# Diseño — Módulo Temporada (Alquiler Temporario de Verano) · Potente Propiedades

**Fecha:** 2026-07-09
**Contexto:** Potente Propiedades (inmobiliaria MdP). El alquiler temporario de verano es el negocio fuerte de la ciudad. Se agrega un módulo de gestión en el panel + posicionamiento en la web pública. Es una **demo para enamorar a Mateo**; el flujo operativo fino se confirma con el cliente. Planos sale del sidebar y pasa a vivir dentro de la ficha de propiedad; "Temporada" toma su lugar.

## Datos de mercado (research, jul-2026)

- **Unidad de alquiler = la QUINCENA.** Se estructura por 1ª/2ª quincena de dic, enero, febrero, marzo. Complementa semana/día (marzo, findes largos).
- **Tarifas reales por quincena (ARS 2026), 2-3 amb cerca de playa:**
  - 2ª quincena enero (PICO): 2 amb ~$900.000 · 3 amb ~$1.250.000
  - 1ª quincena enero / 1ª feb: 2 amb ~$800.000 · 3 amb ~$1.100.000
  - 2ª quincena febrero: 2 amb ~$700.000 · 3 amb ~$950.000
  - Nov/Dic/Marzo (hombro): ~$400.000
- **Flujo:** propietario contrata a la inmob → reserva con **seña** (no reintegrable) → pre-ingreso saldo + **depósito garantía** → check-in 15:00 con contrato+inventario → check-out control → **garantía devuelta 48hs** → **rendición al dueño** descontando comisión **~15%** (temporario exento del tope legal).
- **Dolores top:** (1) doble reserva/overbooking, (2) no saber qué está libre, (3) turnover llaves+limpieza mismo día, (4) cobros y rendición manual.
- **SEO:** no pelear head keywords (las copan Zonaprop/Argenprop). Ganar en **long-tail barrio + quincena + ambientes**. Páginas por barrio con contenido local. Indexado **antes de octubre** (la gente reserva desde el finde del 12-oct). Schema correcto = `Product`+`Offer` / `Apartment` (NO `VacationRental`, está gateado por Google). WhatsApp visible como diferencial.

## Alcance (aprobado)

**Panel — sección "Temporada":** grilla de disponibilidad + tarifario por quincena + reservas con seña + semáforo de estado + rendición al dueño.
**Web pública:** landing "Verano 2027" + páginas por barrio + buscador por quincena/barrio/ambientes + fichas con tarifa por quincena y CTA WhatsApp + schema correcto.
**Fuera de alcance (roadmap para el pitch):** contratos PDF automáticos, portal del propietario, channel manager (Airbnb/Booking), pago online de seña.

## Modelo de datos (`src/data/types.ts`)

```ts
// Temporada = franjas fijas del verano. id estable para tarifas y celdas.
export type TemporadaTramoId =
  | "dic-1" | "dic-2" | "ene-1" | "ene-2" | "feb-1" | "feb-2" | "mar-1" | "mar-2";

export interface TemporadaTramo {
  id: TemporadaTramoId;
  label: string;        // "1ª quincena enero"
  corto: string;        // "Ene 1"
  desdeISO: string;     // 2026-12-01
  hastaISO: string;     // 2026-12-15
  pico?: boolean;
}

// Propiedad ofrecida en temporada (subconjunto de la cartera). Reusa Propiedad por propiedadId.
export interface UnidadTemporada {
  id: string;
  propiedadId: string;          // FK a Propiedad
  ambientes: number;
  capacidad: number;            // personas
  barrio: string;               // Playa Grande, Güemes, La Perla, Varese, Chauvín, Punta Mogotes
  frenteAlMar?: boolean;
  comodidades: string[];        // pileta, parrilla, cochera, wifi, aire
  tarifas: Partial<Record<TemporadaTramoId, number>>; // ARS por quincena
  comisionPct: number;          // % Potente (default 15)
  activa: boolean;              // se muestra en la web
}

export type EstadoReserva = "senada" | "confirmada" | "en_curso" | "finalizada" | "cancelada";

export interface ReservaTemporada {
  id: string;
  unidadId: string;
  tramoId: TemporadaTramoId;    // qué quincena
  inquilino: string;
  contacto: string;
  personas: number;
  montoTotalARS: number;        // = tarifa del tramo (editable)
  senaARS: number;
  garantiaARS: number;
  estado: EstadoReserva;
  creadaISO: string;
  notas?: string;
}

// Estado de una celda (unidad × tramo) derivado en runtime:
// libre | senada | confirmada | en_curso | finalizada | limpieza | bloqueada
```

Reglas de derivación de la grilla:
- Celda sin reserva → **libre**.
- Con reserva → color según `estado`.
- **Anti-doble-reserva:** no se puede crear 2ª reserva activa (no cancelada) en la misma `unidadId+tramoId`.
- "Limpieza" = flag efímero opcional en la unidad para el turnover (fase demo: derivado/manual simple).

## Panel — página `Temporada.tsx`

1. **Header:** título + KPIs (unidades en temporada · % ocupación del verano · ingresos proyectados ARS · reservas señadas).
2. **Grilla de disponibilidad** (el "wow"): filas = unidades (thumb + barrio + ambientes), columnas = 8 tramos. Celdas coloreadas con estado + monto. Click en celda libre → modal "Nueva reserva" (inquilino, personas, monto pre-cargado de la tarifa, seña sugerida 30%, garantía). Click en celda reservada → detalle + cambiar estado + cancelar. Scroll horizontal, sticky la primera columna.
3. **Tarifario:** editar tarifa por unidad×tramo inline (reusa patrón de edición de Tasaciones).
4. **Rendición al dueño:** por unidad, suma reservas confirmadas/finalizadas, descuenta comisión, muestra "al propietario le corresponden $X · comisión Potente $Y". Exportable (reusa jsPDF de Reportes).
5. Persistencia: `unidadesTemporada` y `reservasTemporada` al `DataProvider` con el mismo patrón localStorage + mutaciones (add/update/cancel) que el resto.

## Web pública — Temporada

- **Landing** `/temporada` ("Verano 2027 en Mar del Plata"): hero con buscador **quincena + barrio + ambientes**, grilla de unidades activas, franjas de confianza.
- **Páginas por barrio** `/temporada/:barrio` (Playa Grande, Güemes, La Perla, Varese, Chauvín, Punta Mogotes): H1 local, texto de 300-500 palabras de color local (SEO), listado filtrado del barrio, FAQ con `FAQPage` schema.
- **Ficha temporaria** (o vista de la propiedad con modo temporada): tabla de tarifas por quincena, comodidades, CTA WhatsApp ("Consultá disponibilidad enero"), schema `Apartment`/`Product`+`Offer`.
- **SEO:** títulos/metas por barrio+temporada, canonical, sitemap con las rutas nuevas, JSON-LD correcto. Navbar/Home suman entrada a "Alquiler de temporada".
- Nota estacional para el pitch: publicar antes de octubre.

## Datos de muestra

- Marcar ~10-12 propiedades urbanas de la cartera como `UnidadTemporada` (deptos en Playa Grande, Güemes, La Perla, Varese; alguna casa con pileta en Chauvín/San Carlos).
- Tarifas por los 8 tramos con la curva real (pico 2ª enero).
- ~15-20 `ReservaTemporada` repartidas (señadas, confirmadas, alguna en curso) para que la grilla se vea viva y el % de ocupación tenga sentido.

## Migración Planos → ficha

- Sacar "Planos" de `SECCIONES` (profiles.tsx) y su ruta de `PanelApp.tsx`. Meter "Temporada".
- El editor de planos (`PlanEditor`) se accede desde la ficha/detalle de la propiedad (Cartera → propiedad → pestaña/acción "Plano"). No se pierde funcionalidad.

## Verificación

- TypeScript limpio, build OK.
- E2E navegador: crear reserva en celda libre → celda pasa a amarillo → refresh → persiste; intento de doble reserva bloqueado; rendición calcula bien; web /temporada y /temporada/playa-grande cargan con schema válido.
