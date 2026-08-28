/**
 * A DÓNDE MANDA MARINA CADA CONSULTA — la tabla de ruteo, probada en frío.
 * ─────────────────────────────────────────────────────────────────────────────
 * `derivacionDe()` es lógica PURA: lee lo que escribió la persona y elige el
 * destino. No pasa por el modelo, no pega a la base, no depende del humor de
 * nadie. Por eso se prueba acá y no en una suite e2e: es determinista, corre en
 * un segundo y no gasta una llamada a la API por caso.
 *
 * 🔴 Existe porque el 28-ago una auditoría encontró tres errores de ruteo que
 * las pruebas por endpoint no podían ver —el pie del mensaje lo arma el envío,
 * no la respuesta del asistente— y que salieron al Instagram de gente real:
 *   · «me mudo en febrero y busco alquiler ANUAL» iba al WhatsApp de temporada,
 *     con un cartel que decía "para alquileres de temporada";
 *   · «necesito el teléfono de ustedes» recibía un listado de propiedades;
 *   · «quiero VENDER mi casa» recibía la lista de casas en venta de otros.
 *
 * Las reglas que fija Juani (28-ago): temporada → WhatsApp de Mogotes ·
 * propiedades → la web · lo demás → la dirección, que deriva.
 *
 *   npm run verificar-derivacion
 */
import { derivacionDe } from "../netlify/functions/_marina";
import { OFICINA_TEMPORADA } from "../src/config/temporada.js";
import { waDigits } from "../src/config/marca";

const WA_TEMPORADA = waDigits(OFICINA_TEMPORADA);
const WA_DIRECCION = waDigits(null);

const CATALOGO = [
  { id: "POT-218380", titulo: "Semipiso en Playa Grande", zona: "Playa Grande", categoria: "departamento", operacion: "alquiler" as const },
];

type Destino = "temporada" | "direccion" | "web" | "ficha";

const destinoDe = (hilo: string, ultimo = hilo): Destino => {
  const { link } = derivacionDe({ hilo, ultimo }, CATALOGO as any);
  if (link.includes(`wa.me/${WA_TEMPORADA}`)) return "temporada";
  if (link.includes(`wa.me/${WA_DIRECCION}`)) return "direccion";
  if (link.includes("/propiedad/")) return "ficha";
  return "web";
};

/** [lo que escribió la persona, a dónde TIENE que ir, por qué importa] */
const CASOS: [string, Destino, string][] = [
  // ── Temporada: va a Mogotes, siempre ──
  ["Hola, busco algo para la temporada de verano", "temporada", "la palabra manda"],
  ["quiero alquilar una quincena en enero", "temporada", "quincena es temporada"],
  ["tienen algo por días en Mogotes?", "temporada", "por días es temporada"],
  ["buscamos para semana santa", "temporada", "semana santa es temporada"],
  ["algo para las vacaciones con la familia", "temporada", "vacaciones es temporada"],

  // ── 🔴 Un mes NO es una temporada si hablan de alquiler largo ──
  ["me mudo a Mar del Plata en febrero y busco alquiler anual de 3 ambientes", "web", "el mes NO puede ganarle a 'anual'"],
  ["el contrato vence en febrero, necesito mudarme", "web", "'contrato' y 'mudarme' desactivan el mes"],
  ["busco vivienda permanente, entro en enero", "web", "permanente no es temporada"],
  // …pero el mes solo, sin nada que lo contradiga, sí insinúa temporada.
  ["hola! tienen algo para enero?", "temporada", "el mes solo sigue insinuando temporada"],

  // ── Lo que no se contesta con la cartera → la dirección ──
  ["Necesito el número de teléfono de ustedes", "direccion", "pedir el teléfono no es buscar una propiedad"],
  ["Me pasás el whatsapp de la oficina?", "direccion", "idem"],
  ["Quiero vender mi casa, con quién hablo?", "direccion", "el que VENDE no quiere el listado de otros"],
  ["Cuánto cobran de comisión?", "direccion", "comisiones las contesta una persona"],
  ["quiero poner mi depto en alquiler", "direccion", "ofrecer no es buscar"],
  ["me hacen una tasación?", "direccion", "tasar es de una persona"],
  ["qué requisitos piden para alquilar?", "direccion", "requisitos los contesta una persona"],

  // ── Buscar una propiedad → la web ──
  ["Busco casa en venta hasta 200 mil dólares", "web", "comprar va a la web"],
  ["tienen departamentos de 2 ambientes en Chauvín?", "web", "alquilar/comprar va a la web"],
  ["hola, qué tienen para mostrarme?", "web", "el default es la web"],

  // ── Nombró una ficha → esa ficha, que ya trae el WhatsApp de su oficina ──
  ["me interesa la POT-218380", "ficha", "el código gana: la ficha lleva a su oficina"],
  ["quiero el telefono por la POT-218380", "ficha", "la ficha le contesta mejor que la dirección"],
];

let ok = 0;
const fallos: string[] = [];
for (const [texto, esperado, porque] of CASOS) {
  const real = destinoDe(texto);
  if (real === esperado) { ok++; console.log(`  ✓ ${esperado.padEnd(9)} « ${texto.slice(0, 62)} »`); }
  else fallos.push(`  ✗ « ${texto} »\n      esperaba ${esperado}, dio ${real}  (${porque})`);
}

/* 🔴 La acumulación: temporada se lee en TODO el hilo (quien la nombró sigue
 * siendo de temporada), pero persona-o-cartera se lee SOLO en el último mensaje
 * — si no, un "¿me pasás el teléfono?" al principio secuestraría la charla. */
const hiloTemporada = "quiero alquilar en temporada \n somos 4 en familia";
if (destinoDe(hiloTemporada, "somos 4 en familia") === "temporada") { ok++; console.log("  ✓ temporada  se recuerda en todo el hilo"); }
else fallos.push("  ✗ temporada se perdió al llegar el segundo mensaje del hilo");

const hiloTelefono = "me pasás el teléfono? \n busco depto en venta en Güemes";
if (destinoDe(hiloTelefono, "busco depto en venta en Güemes") === "web") { ok++; console.log("  ✓ web        pedir el teléfono NO secuestra los mensajes siguientes"); }
else fallos.push("  ✗ un 'pasame el teléfono' viejo se llevó puesta una consulta de propiedades");

console.log(`\n${"═".repeat(66)}\n  ${ok} rutas correctas · ${fallos.length} fallaron\n${"═".repeat(66)}`);
if (fallos.length) { console.log(fallos.join("\n")); process.exit(1); }
