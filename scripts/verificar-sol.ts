/**
 * POTENTE PROPIEDADES · Verificación del cálculo del sol
 * ─────────────────────────────────────────────────────────────────────────────
 * No hace falta base ni navegador: es matemática, se verifica contra física.
 *
 * Y se verifica de verdad, no contra "lo que devolvió la librería la primera vez
 * que la corrí". Todo lo de acá se puede comprobar con lápiz y papel:
 *
 *   · La altura del sol al mediodía en el solsticio = 90 − |latitud| ∓ 23,44°.
 *   · En el hemisferio sur, al mediodía el sol está al NORTE (azimut ≈ 0°).
 *   · El día del solsticio de verano es más largo que el de invierno.
 *   · El mediodía solar cae entre el amanecer y el atardecer, casi al medio.
 *   · En diciembre el sol sale al sudeste y se pone al sudoeste; en junio sale
 *     al noreste y se pone al noroeste (al revés que en el hemisferio norte).
 *
 * ⚠️ POR QUÉ ESTE ARCHIVO EXISTE: `suncalc` cambió de convención entre versiones.
 * La 1.x devolvía RADIANES medidos desde el SUR; la 2.x devuelve GRADOS medidos
 * desde el NORTE. Un cambio de versión que pase desapercibido no rompe nada: da
 * números plausibles y equivocados, y la web publicaría "sol de tarde" en una
 * propiedad que tiene sol de mañana. Esto lo agarra.
 *
 * USO: npm run verificar-sol
 */
import * as SunCalc from "suncalc";
import {
  diaDeSol, solDelFrente, franjaDelSol, horaLocal, horaDeMinutos, minutosLocales,
} from "../src/site/lib/asoleamiento";

const MDP = { lat: -38.0055, lng: -57.5426 };
const INCLINACION_TERRESTRE = 23.44;

let ok = 0;
const fallos: string[] = [];
const chequear = (n: string, paso: boolean, extra = "") => {
  if (paso) { ok++; console.log(`  ✓ ${n}${extra ? ` · ${extra}` : ""}`); }
  else { fallos.push(`${n}${extra ? ` · ${extra}` : ""}`); console.log(`  ✗ ${n}${extra ? ` · ${extra}` : ""}`); }
};
const cerca = (a: number, b: number, tolerancia: number) => Math.abs(a - b) <= tolerancia;

// Mediodía se toma a las 15:00 UTC = 12:00 en Argentina, así que la fecha del
// "día solar" que calcula suncalc es la que queremos sin ambigüedad de huso.
const INVIERNO = new Date("2026-06-21T15:00:00Z");
const VERANO = new Date("2026-12-21T15:00:00Z");

console.log("\n═══ 1 · LA GEOMETRÍA DEL SOL EN MAR DEL PLATA ═══\n");

for (const [nombre, fecha, signo] of [["invierno", INVIERNO, -1], ["verano", VERANO, +1]] as const) {
  const d = diaDeSol(MDP.lat, MDP.lng, fecha);
  const enElPico = SunCalc.getPosition(d.mediodia, MDP.lat, MDP.lng);
  const esperada = 90 - Math.abs(MDP.lat) + signo * INCLINACION_TERRESTRE;

  chequear(
    `Solsticio de ${nombre}: la altura al mediodía es 90 − |lat| ${signo > 0 ? "+" : "−"} 23,44`,
    cerca(enElPico.altitude, esperada, 0.5),
    `${enElPico.altitude.toFixed(1)}° vs ${esperada.toFixed(2)}° de fórmula`,
  );

  // 🔴 La prueba que agarra un cambio de convención de la librería.
  chequear(
    `Solsticio de ${nombre}: al mediodía el sol está al NORTE (hemisferio sur)`,
    cerca(enElPico.azimuth, 0, 2) || cerca(enElPico.azimuth, 360, 2),
    `azimut ${enElPico.azimuth.toFixed(1)}°`,
  );

  chequear(
    `Solsticio de ${nombre}: el mediodía solar cae entre el amanecer y el atardecer`,
    Boolean(d.amanecer && d.atardecer &&
      d.mediodia > d.amanecer && d.mediodia < d.atardecer),
    `${d.amanecer ? horaLocal(d.amanecer) : "?"} · ${horaLocal(d.mediodia)} · ${d.atardecer ? horaLocal(d.atardecer) : "?"}`,
  );

  // El mediodía solar tiene que caer casi justo en el medio del día.
  if (d.amanecer && d.atardecer) {
    const medio = (minutosLocales(d.amanecer) + minutosLocales(d.atardecer)) / 2;
    chequear(
      `Solsticio de ${nombre}: el mediodía solar está en el centro del día`,
      cerca(minutosLocales(d.mediodia), medio, 3),
      `${horaDeMinutos(minutosLocales(d.mediodia))} vs centro ${horaDeMinutos(medio)}`,
    );
  }
}

const inv = diaDeSol(MDP.lat, MDP.lng, INVIERNO);
const ver = diaDeSol(MDP.lat, MDP.lng, VERANO);

chequear(
  "El día más largo del año es el de diciembre",
  ver.horasDeLuz > inv.horasDeLuz + 3,
  `verano ${ver.horasDeLuz.toFixed(1)} h vs invierno ${inv.horasDeLuz.toFixed(1)} h`,
);

// En Mar del Plata el mediodía solar cae bastante después de las 12: la ciudad
// está al este del meridiano que le correspondería al huso −3. Es el motivo por
// el que la franja mañana/tarde se parte por el mediodía SOLAR y no por las 12.
chequear(
  "El mediodía solar cae después de las 12:30 (la ciudad está al este del huso)",
  minutosLocales(ver.mediodia) > 12 * 60 + 30,
  horaDeMinutos(minutosLocales(ver.mediodia)),
);

// Por dónde sale y se pone. Al revés del hemisferio norte.
const salida = (d: typeof inv) => d.recorrido[0]?.azimut ?? -1;
const puesta = (d: typeof inv) => d.recorrido[d.recorrido.length - 1]?.azimut ?? -1;
chequear("En diciembre el sol sale del sudeste", salida(ver) > 90 && salida(ver) < 150, `azimut ${salida(ver).toFixed(0)}°`);
chequear("En diciembre se pone en el sudoeste", puesta(ver) > 210 && puesta(ver) < 270, `azimut ${puesta(ver).toFixed(0)}°`);
chequear("En junio el sol sale del noreste", salida(inv) > 30 && salida(inv) < 90, `azimut ${salida(inv).toFixed(0)}°`);
chequear("En junio se pone en el noroeste", puesta(inv) > 270 && puesta(inv) < 330, `azimut ${puesta(inv).toFixed(0)}°`);

console.log("\n═══ 2 · QUÉ SOL RECIBE CADA FRENTE ═══\n");

const tramosLegibles = (s: { tramos: { desde: number; hasta: number }[] }) =>
  s.tramos.length ? s.tramos.map((t) => `${horaDeMinutos(t.desde)}-${horaDeMinutos(t.hasta)}`).join(" y ") : "nada";

// El frente al norte es el que se paga en Argentina. Tiene que ganar siempre.
const norteInv = solDelFrente("N", inv);
chequear("Frente al NORTE: recibe sol en invierno", norteInv.horas > 6, `${tramosLegibles(norteInv)} · ${norteInv.horas.toFixed(1)} h`);
chequear("Frente al NORTE: un solo tramo, de corrido", norteInv.tramos.length === 1, `${norteInv.tramos.length} tramo(s)`);
chequear("Frente al NORTE: la franja es 'todo el día'", franjaDelSol(norteInv, inv) === "todo-el-dia", franjaDelSol(norteInv, inv));

const surInv = solDelFrente("S", inv);
const surVer = solDelFrente("S", ver);
// 🔴 La prueba de honestidad del sistema: un frente al sur en invierno NO recibe
// sol directo en Mar del Plata, y hay que poder decirlo.
chequear("Frente al SUR en invierno: no recibe sol directo", surInv.horas === 0, surInv.horas ? `dice ${surInv.horas.toFixed(1)} h` : "correcto: nada");

// 🔴 Y LA PRUEBA QUE ENCONTRÓ EL BUG: en verano el sol sale al sudeste y se pone
// al sudoeste, así que a un frente sur le pega temprano Y tarde, con sombra en el
// medio. Tienen que ser DOS tramos y la suma tiene que ser poca. Con una sola
// franja continua daba 13,5 h y le ganaba al norte.
chequear("Frente al SUR en verano: son DOS tramos separados", surVer.tramos.length === 2, `${surVer.tramos.length} tramo(s): ${tramosLegibles(surVer)}`);
// 5,8 h repartidas en dos ratos de sol rasante es el número correcto para un
// frente sur despejado en diciembre a esta latitud. No se afirma "poco" con un
// número inventado: lo que importa es que le gane el norte y que los dos tramos
// caigan en los extremos del día, no que sume menos de X.
const norteVer = solDelFrente("N", ver);
chequear("Frente al SUR en verano: recibe menos que el norte", surVer.horas < norteVer.horas, `sur ${surVer.horas.toFixed(1)} h vs norte ${norteVer.horas.toFixed(1)} h`);
chequear(
  "Frente al SUR en verano: los dos tramos caen en los extremos del día",
  surVer.tramos.length === 2 &&
    surVer.tramos[0].desde < minutosLocales(ver.mediodia) - 180 &&
    surVer.tramos[1].hasta > minutosLocales(ver.mediodia) + 180,
  tramosLegibles(surVer),
);
chequear("Frente al SUR en verano: la franja es 'mañana y tarde'", franjaDelSol(surVer, ver) === "manana-y-tarde", franjaDelSol(surVer, ver));

const este = solDelFrente("E", ver);
const oeste = solDelFrente("O", ver);
chequear("Frente al ESTE: el sol le pega de mañana", franjaDelSol(este, ver) === "manana", `${tramosLegibles(este)} → ${franjaDelSol(este, ver)}`);
chequear("Frente al OESTE: el sol le pega de tarde", franjaDelSol(oeste, ver) === "tarde", `${tramosLegibles(oeste)} → ${franjaDelSol(oeste, ver)}`);

// Simetría: este y oeste tienen que recibir la misma cantidad de horas.
chequear(
  "ESTE y OESTE reciben las mismas horas (simetría)",
  cerca(este.horas, oeste.horas, 0.5),
  `${este.horas.toFixed(1)} h vs ${oeste.horas.toFixed(1)} h`,
);

// Y el norte tiene que recibir más que cualquier otro frente, en las dos épocas.
// Es la prueba que resume todo: si algún día el cálculo se rompe, lo más probable
// es que esto se caiga primero.
const TODAS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"] as const;
for (const [nombre, dia] of [["invierno", inv], ["verano", ver]] as const) {
  const horas = TODAS.map((o) => ({ o, h: solDelFrente(o, dia).horas }));
  const mejor = horas.reduce((a, b) => (b.h > a.h ? b : a));
  chequear(
    `En ${nombre} ningún frente le gana al norte`,
    mejor.o === "N" || cerca(mejor.h, horas[0].h, 0.4),
    horas.map((x) => `${x.o}:${x.h.toFixed(1)}`).join(" "),
  );
}

console.log("\n══════════════════════════════════════════════════");
console.log(`  ${ok} pruebas OK · ${fallos.length} fallaron`);
if (fallos.length) { console.log("\n  FALLARON:"); fallos.forEach((f) => console.log(`   · ${f}`)); }
console.log("══════════════════════════════════════════════════\n");
process.exit(fallos.length ? 1 : 0);
