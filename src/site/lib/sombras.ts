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
