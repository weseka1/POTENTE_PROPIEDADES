/**
 * ASOLEAMIENTO — cuánto sol recibe una propiedad, y a qué hora.
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo pidió Mateo el 10-ago después de ver algo parecido en Roomix. Acá no hay
 * nada inventado ni estimado: es geometría del sol para las coordenadas exactas
 * de la propiedad, cruzada con la orientación del frente que él ya carga en el
 * formulario.
 *
 * ⚠️ LO QUE ESTO **NO** SABE, Y NO SE VA A FINGIR:
 * las sombras de lo que hay alrededor — el edificio de al lado, la medianera, un
 * árbol. Para eso haría falta un modelo 3D de la manzana; para Mar del Plata no
 * existe gratis, y las herramientas que lo hacen (Shadowmap) tienen ese dato
 * comprado. Entonces lo que se afirma acá es exacto para un frente despejado, y
 * la ficha lo dice en una línea. Prometer sombras que no calculamos sería
 * exactamente el tipo de mentira que arruina la confianza en el resto del dato.
 *
 * ── LA MATEMÁTICA ────────────────────────────────────────────────────────────
 * `suncalc` 2.0.1 devuelve **grados** y el azimut **desde el norte en sentido
 * horario** (0 = N, 90 = E, 180 = S, 270 = O). ⚠️ La versión 1.x devolvía
 * RADIANES medidos desde el SUR: si alguien actualiza o baja la versión y esto
 * deja de tener sentido, ese es el motivo. Lo cuida `scripts/verificar-sol.ts`.
 *
 * Verificado contra la fórmula de manual para Mar del Plata (lat −38,0055):
 *   altura del sol al mediodía = 90 − |lat| ∓ 23,44
 *   21-jun → 28,56° (medido 28,6°) · 21-dic → 75,44° (medido 75,4°)
 * Y al mediodía el azimut da 0° = NORTE, que es lo que corresponde en el
 * hemisferio sur. Ojo con esto: es lo contrario de la intuición del que aprendió
 * con ejemplos del hemisferio norte, y es la razón de que acá el frente al norte
 * sea el que se paga.
 */
import * as SunCalc from "suncalc";
import type { Orientacion } from "@/data/propiedadTypes";

/**
 * Las horas se muestran SIEMPRE en la hora de la propiedad, no en la del que
 * mira. Un comprador desde España tiene que leer "recibe sol de 9 a 14", no la
 * traducción a su horario, que no significa nada para una casa en Mar del Plata.
 * Va por nombre de zona (no un −3 fijo) para que un cambio de huso lo resuelva
 * el navegador y no nosotros.
 */
export const ZONA_PROPIEDAD = "America/Argentina/Buenos_Aires";

/** Rumbo de cada orientación, en grados desde el norte. */
const RUMBO: Record<Orientacion, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315,
};

/**
 * Un frente recibe sol directo cuando el sol está de su lado: menos de 90° de
 * diferencia entre el rumbo del frente y el azimut del sol. A 90° justo el sol
 * pega de canto (rasante) y no entra; más de 90° está atrás del muro.
 */
const APERTURA = 90;

/** Diferencia angular más corta entre dos rumbos (0-180). */
const diferencia = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * El sol tiene que estar además lo bastante alto. Con menos de 5° está entrando
 * por el horizonte entre las casas de enfrente: contarlo como "recibe sol"
 * infla el número y se nota. Es el único parámetro con criterio y no con
 * geometría, así que queda acá, con el nombre a la vista.
 */
const ALTURA_MINIMA = 5;

export interface PuntoDelSol {
  /** Minutos desde la medianoche, en hora de la propiedad. */
  minutos: number;
  /** Grados desde el norte, sentido horario. */
  azimut: number;
  /** Grados sobre el horizonte. */
  altura: number;
}

export interface DiaDeSol {
  amanecer: Date | null;
  atardecer: Date | null;
  mediodia: Date;
  /** Horas entre el amanecer y el atardecer. */
  horasDeLuz: number;
  /** El recorrido del sol, cada 10 minutos, mientras está sobre el horizonte. */
  recorrido: PuntoDelSol[];
}

/** Minutos desde la medianoche en la hora de la propiedad (no la del visitante). */
export function minutosLocales(d: Date): number {
  const [h, m] = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_PROPIEDAD, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d).split(":");
  return Number(h) * 60 + Number(m);
}

/** "09:35", en la hora de la propiedad. */
export function horaLocal(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_PROPIEDAD, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

/** "9:35" a partir de minutos desde la medianoche. */
export function horaDeMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** El recorrido del sol de un día, para esas coordenadas. */
export function diaDeSol(lat: number, lng: number, fecha: Date): DiaDeSol {
  const t = SunCalc.getTimes(fecha, lat, lng);
  const recorrido: PuntoDelSol[] = [];

  // Se recorre el día en UTC de a 10 minutos y se guarda lo que está sobre el
  // horizonte. Barrer en UTC evita tener que pensar en el huso: la posición del
  // sol depende del instante, no de cómo lo escribimos.
  const arranque = new Date(fecha);
  arranque.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i <= 24 * 6; i++) {
    const cuando = new Date(arranque.getTime() + i * 10 * 60_000);
    const p = SunCalc.getPosition(cuando, lat, lng);
    if (p.altitude <= 0) continue;
    recorrido.push({ minutos: minutosLocales(cuando), azimut: p.azimuth, altura: p.altitude });
  }
  // El barrido en UTC arranca a las 21:00 del día anterior en hora local, así
  // que el recorrido puede quedar desordenado al cruzar la medianoche. Se ordena
  // por hora local, que es como se va a dibujar.
  recorrido.sort((a, b) => a.minutos - b.minutos);

  const horasDeLuz =
    t.sunrise && t.sunset ? (t.sunset.getTime() - t.sunrise.getTime()) / 3_600_000 : 0;

  return { amanecer: t.sunrise, atardecer: t.sunset, mediodia: t.solarNoon, horasDeLuz, recorrido };
}

/** Un rato seguido de sol. Minutos desde la medianoche, hora de la propiedad. */
export interface TramoDeSol {
  desde: number;
  hasta: number;
  horas: number;
}

export interface SolDelFrente {
  /** Puede haber MÁS DE UNO. Ver el comentario de abajo, que es el corazón de esto. */
  tramos: TramoDeSol[];
  /** La suma real de los tramos, no la distancia entre el primero y el último. */
  horas: number;
}

/**
 * Cuándo le entra el sol a un frente con esta orientación.
 *
 * 🔴 POR QUÉ ESTO DEVUELVE UNA LISTA Y NO UN "DESDE / HASTA":
 * porque un frente puede recibir sol en DOS ratos separados por horas de sombra,
 * y tratarlo como una sola franja continua miente por muchísimo.
 *
 * El caso concreto que lo destapó (lo encontró `verificar-sol`): en Mar del Plata,
 * en pleno verano, el sol sale al SUDESTE (azimut 120°) y se pone al SUDOESTE
 * (239°). Un frente al SUR (180°) lo tiene de su lado al amanecer y otra vez al
 * atardecer, pero al mediodía el sol está al NORTE, o sea atrás del muro. La
 * primera versión de esta función tomaba el primer y el último punto con sol y
 * devolvía "de 6:00 a 19:30, 13,5 horas": le daba a un frente al sur más sol que
 * al norte, que es al revés de la realidad. Con tramos da ~3 h repartidas en dos
 * ratos, que es la verdad y además es un dato útil ("sol al amanecer y al
 * atardecer" es exactamente lo que quiere saber el que compra).
 *
 * Devuelve `tramos: []` cuando no le entra sol en todo el día — que es un
 * resultado real y hay que poder decirlo: un frente al sur en pleno invierno no
 * recibe sol directo, y ocultarlo sería mentirle al comprador.
 */
export function solDelFrente(orientacion: Orientacion, dia: DiaDeSol): SolDelFrente {
  const rumbo = RUMBO[orientacion];
  const dentro = dia.recorrido.filter(
    (p) => p.altura >= ALTURA_MINIMA && diferencia(p.azimut, rumbo) < APERTURA,
  );

  // El recorrido viene cada 10 minutos. Un salto mayor a 25 minutos entre dos
  // puntos con sol significa que en el medio hubo sombra: ahí se corta el tramo.
  const PASO_MAXIMO = 25;
  const tramos: TramoDeSol[] = [];
  for (const p of dentro) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && p.minutos - ultimo.hasta <= PASO_MAXIMO) {
      ultimo.hasta = p.minutos;
      ultimo.horas = (ultimo.hasta - ultimo.desde) / 60;
    } else {
      tramos.push({ desde: p.minutos, hasta: p.minutos, horas: 0 });
    }
  }

  // Un "tramo" de un solo punto son 10 minutos de sol rasante: no es un dato,
  // es ruido de muestreo. Se descarta.
  const utiles = tramos.filter((t) => t.hasta > t.desde);
  return { tramos: utiles, horas: utiles.reduce((s, t) => s + t.horas, 0) };
}

/** Cómo pega el sol, en una palabra. Lo usa la ficha para titular el resultado. */
export type FranjaDelSol =
  | "todo-el-dia"
  | "manana"
  | "tarde"
  | "manana-y-tarde"
  | "poco";

/**
 * La franja se decide con el MEDIODÍA SOLAR como eje, no con las 12:00 del
 * reloj: en Mar del Plata el mediodía solar cae cerca de las 12:50, así que
 * partir por las 12 en punto mueve el resultado casi una hora y haría ver como
 * "de mañana" a un frente que en realidad es parejo.
 */
export function franjaDelSol(sol: SolDelFrente, dia: DiaDeSol): FranjaDelSol {
  if (sol.horas < 1.5) return "poco";

  // Dos ratos separados con el mediodía en el medio = el caso del frente al sur
  // en verano. Tiene nombre propio porque es un dato de venta real.
  if (sol.tramos.length >= 2) {
    const eje = minutosLocales(dia.mediodia);
    const antes = sol.tramos.some((t) => t.hasta < eje);
    const despues = sol.tramos.some((t) => t.desde > eje);
    if (antes && despues) return "manana-y-tarde";
  }

  if (sol.horas >= 7) return "todo-el-dia";

  const eje = minutosLocales(dia.mediodia);
  const centro =
    sol.tramos.reduce((s, t) => s + ((t.desde + t.hasta) / 2) * t.horas, 0) / sol.horas;
  if (centro < eje - 45) return "manana";
  if (centro > eje + 45) return "tarde";
  return "todo-el-dia";
}
