/**
 * Lo compartido entre las DOS vistas de sombras: la 2D (toggle en el mapa de la
 * ficha, Leaflet) y la 3D (pantalla completa con la ciudad extruida, MapLibre).
 * Una sola fuente para las épocas y la fecha del sol: si un día se cambia el
 * solsticio de referencia, se cambia acá y las dos vistas quedan de acuerdo.
 */

/** Las mismas tres épocas que la sección "Orientación y sol": los solsticios
 *  son los extremos reales del año. */
export const EPOCAS_SOMBRA = [
  { k: "verano", l: "Verano", dia: () => new Date(2026, 11, 21) },
  { k: "hoy", l: "Hoy", dia: () => new Date() },
  { k: "invierno", l: "Invierno", dia: () => new Date(2026, 5, 21) },
] as const;
export type EpocaSombra = (typeof EPOCAS_SOMBRA)[number]["k"];

export const fechaSombras = (epoca: EpocaSombra, minutos: number) => {
  const d = EPOCAS_SOMBRA.find((e) => e.k === epoca)!.dia();
  d.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
  return d;
};

export const horaLegible = (minutos: number) =>
  `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, "0")}`;

import * as SunCalc from "suncalc";

/**
 * 🔴 La VENTANA SOLAR del slider: de salida a puesta del sol REALES para esa
 * fecha y ese lugar (SunCalc, el mismo motor de "Orientación y sol").
 *
 * Existe por un bug que encontró Juani en producción (11-ago): a las 18:30 de
 * un día de agosto el sol ya se puso, y el simulador sin sol no pinta "noche" —
 * pinta una PLACA gigante con bordes duros que parece rota. Sin sol no hay
 * sombras que mostrar, así que el slider directamente no llega ahí.
 * Se redondea hacia adentro a los 15 min del paso del slider, con un margen
 * para que el sol esté de verdad ARRIBA del horizonte (sombras con sentido).
 */
export function ventanaSolar(epoca: EpocaSombra, lat: number, lng: number) {
  const dia = EPOCAS_SOMBRA.find((e) => e.k === epoca)!.dia();
  dia.setHours(12, 0, 0, 0); // mediodía: getTimes quiere un instante del día
  const t = SunCalc.getTimes(dia, lat, lng);
  const aMin = (d: Date) => d.getHours() * 60 + d.getMinutes();
  // +/- 30 min del amanecer/atardecer: sol rasante todavía dibuja sombra real.
  const min = Math.ceil((aMin(t.sunrise) + 30) / 15) * 15;
  const max = Math.floor((aMin(t.sunset) - 30) / 15) * 15;
  return { min, max, clamp: (m: number) => Math.min(max, Math.max(min, m)) };
}

import { MAPA } from "../../config/mapa";

/** El terreno para el simulador: dataset Terrain Tiles de AWS Open Data
 *  (gratis, sin key — la URL vive en `MAPA.elevacion`, una sola fuente),
 *  fórmula "terrarium" para decodificar la altura. */
export const TERRENO_SHADEMAP = {
  tileSize: 256,
  maxZoom: 15,
  getSourceUrl: ({ x, y, z }: { x: number; y: number; z: number }) =>
    MAPA.elevacion.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)),
  getElevation: ({ r, g, b }: { r: number; g: number; b: number; a: number }) => r * 256 + g + b / 256 - 32768,
};

/* 🔴 NOTA para el futuro: los tiles de edificios PROPIOS de ShadeMap
 * (cfw.shademap.app/buildings) migraron de .mvt al formato .mlt (MapLibre
 * Tiles) y devuelven 400 al pedirlos como .mvt. MapLibre 6.3 todavía no
 * decodifica MLT, así que la vista 3D extruye los edificios de OSM que ya
 * vienen adentro del estilo de OpenFreeMap (fuente "openmaptiles", capa
 * "building"). El día que MapLibre soporte MLT, volver a evaluar la fuente
 * de ShadeMap: su cobertura es más completa (es la del video de Mateo). */
