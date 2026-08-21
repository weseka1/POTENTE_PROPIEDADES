/**
 * "Si no tengo el dato lo dejo en blanco y que ni se muestre" — Mateo, 7-ago.
 * ─────────────────────────────────────────────────────────────────────────────
 * Se cargan tres propiedades por la base: una con TODO, una PELADA y una VENDIDA.
 *   · En la ficha de la llena tienen que estar todas las etiquetas.
 *   · En la pelada NO pueden aparecer ni como palabra en el DOM.
 *   · Las expensas van pegadas al precio, no en la grilla de datos.
 *   · La vendida sale del catálogo, pero su ficha sigue abriendo.
 *
 * ⚠️ Nota para el que venga: en los strings que van a `evaluar()` NO usar
 * expresiones regulares. El driver los envuelve en una función y una barra suelta
 * revienta con "Invalid regular expression". Usar indexOf / includes.
 *
 * USO: APP=http://localhost:3000 node e2e/ficha-sin-vacios.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { nuevaPestania } from "./cdp.mjs";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: errLogin } = await sb.auth.signInWithPassword({
  email: "mateo@potenteprop.com.ar", password: env.PANEL_MATEO_PASS,
});
if (errLogin) { console.error("No pude entrar:", errLogin.message); process.exit(1); }

const sello = Date.now();
const LLENA = `PROP-VERIF-A-${sello}`;
const PELADA = `PROP-VERIF-B-${sello}`;
const VENDIDA = `PROP-VERIF-C-${sello}`;

const base = {
  categoria: "departamento", operacion: "venta", titulo: "Verificación", precioUSD: 120000,
  zona: "Playa Grande", provincia: "Mar del Plata", publicado: true, estado: "activa",
  descripcion: "Propiedad de verificación automática.", fotos: [], caracteristicas: [],
};

const limpiar = () => sb.from("potente_propiedades").delete().like("id", `PROP-VERIF-%-${sello}`);

// ⚠️ Se VERIFICA el insert. Sin esto, si la base rechaza una fila el test falla
// entero y parece que se rompió la app.
const { error: errAlta } = await sb.from("potente_propiedades").insert([
  { ...base, id: LLENA, titulo: "Ficha llena de prueba", dormitorios: 3, banos: 2,
    m2cubiertos: 95, m2semicubiertos: 14, m2descubiertos: 22, m2totales: 131,
    piso: "7", depto: "B", disposicion: "frente", orientacion: "NE",
    accesoEdificio: "ascensor", cocheras: 1, tipoCochera: "cubierta",
    antiguedadAnios: 12, expensasARS: 85000, aptaCredito: true },
  { ...base, id: PELADA, titulo: "Ficha pelada de prueba" },
  { ...base, id: VENDIDA, titulo: "Ficha vendida de prueba", estado: "vendida" },
]);
if (errAlta) { console.error("No pude crear las propiedades de prueba:", errAlta.message); await limpiar(); process.exit(1); }

const { evaluar, ir, cerrar, URL_APP } = await nuevaPestania();
let ok = 0;
const fallos = [];
const chequear = (n, paso, extra = "") => {
  if (paso) { ok++; console.log(`PASS  ${n}${extra ? ` · ${extra}` : ""}`); }
  else { fallos.push(`${n}${extra ? ` · ${extra}` : ""}`); console.log(`FAIL  ${n}${extra ? ` · ${extra}` : ""}`); }
};

// Se leen DOS textos: la grilla de datos (donde importa que un campo vacío no
// aparezca) y la página entera. Sin separarlos, "baños" daba falso positivo:
// aparece en las propiedades similares del pie.
const LEER = 'const g = document.querySelector("[data-datos=propiedad]"); const t = document.body.innerText || ""; '
  + 'return JSON.stringify({ datos: ((g && g.innerText) || "").toLowerCase(), t: t.toLowerCase(), largo: t.length });';
const abrir = async (id) => {
  await ir(URL_APP + "/propiedad/" + id, 4200);
  return JSON.parse(await evaluar(LEER));
};

try {
  console.log("\n── La ficha CON datos: tienen que estar ──");
  const llena = await abrir(LLENA);
  chequear("La ficha carga", llena.t.includes("ficha llena de prueba"), `${llena.largo} caracteres`);
  for (const c of ["dormitorios", "baños", "superficie cubierta", "superficie semicubierta",
                   "superficie descubierta", "superficie total", "piso", "departamento",
                   "disposición", "frente", "orientación", "noreste", "acceso al edificio",
                   "con ascensor", "tipo de cochera", "cubierta", "antigüedad", "12 años",
                   "apta para crédito"])
    chequear(`Muestra "${c}"`, llena.datos.includes(c));
  chequear("Las expensas van pegadas al precio",
    llena.t.includes("de expensas") && llena.t.includes("85.000"));
  chequear("Las expensas NO están en la grilla de datos",
    !llena.t.includes("expensas\n\n$") , "van abajo del precio, no como un dato más");

  console.log("\n── La ficha SIN datos: NO pueden aparecer ──");
  const pelada = await abrir(PELADA);
  chequear("La ficha pelada carga igual", pelada.t.includes("ficha pelada de prueba"), `${pelada.largo} caracteres`);
  for (const c of ["superficie semicubierta", "superficie descubierta", "superficie cubierta",
                   "disposición", "orientación", "acceso al edificio", "tipo de cochera",
                   "antigüedad", "expensas", "apta para crédito", "dormitorios", "baños", "piso"])
    chequear(`NO muestra "${c}"`, !pelada.datos.includes(c));
  chequear("La pelada es MÁS CORTA que la llena", pelada.largo < llena.largo,
    `${pelada.largo} vs ${llena.largo}`);

  console.log("\n── Una vendida sale del catálogo, pero su ficha abre ──");
  await ir(URL_APP + "/propiedades", 4500);
  const enCatalogo = JSON.parse(await evaluar(
    'return JSON.stringify({ vendida: !!document.querySelector(\'a[href="/propiedad/' + VENDIDA + '"]\'),' +
    ' activa: !!document.querySelector(\'a[href="/propiedad/' + LLENA + '"]\') });'
  ));
  chequear("La vendida NO está en el catálogo", !enCatalogo.vendida);
  chequear("…pero la activa sí", enCatalogo.activa);
  const vendida = await abrir(VENDIDA);
  chequear("La ficha de la vendida sigue abriendo (prueba social)", vendida.t.includes("ficha vendida de prueba"));
  chequear("…y avisa que está vendida", vendida.t.includes("vendida"));

  /* 🔴 LA OFICINA QUE ATIENDE, NO LAS DOS (21-ago, pedido de Mateo).
   * La ficha listaba las dos sucursales, así que un interesado por una
   * propiedad de Chauvín podía terminar llamando a Mogotes. Se mide DENTRO
   * del <aside> a propósito: el footer del sitio SÍ lista las dos, y eso está
   * bien — mirar el body entero daría un falso rojo. */
  console.log("== El pie de la ficha muestra SOLO la oficina de esa propiedad ==");
  for (const [id, oficina] of [["POT-191694", "chauvin"], ["POT-214582", "puntamogotes"]]) {
    await ir(URL_APP + "/propiedad/" + id, 4000);
    const r = JSON.parse(await evaluar(
      'const a = document.querySelector("aside"); const t = a ? a.innerText : "";' +
      ' return JSON.stringify({ cordoba: (t.match(/Córdoba 3719/g)||[]).length,' +
      ' mogotes: (t.match(/Av. de los Trabajadores/g)||[]).length });'
    ));
    const total = r.cordoba + r.mogotes;
    const suya = oficina === "chauvin" ? r.cordoba === 1 && r.mogotes === 0
                                       : r.mogotes === 1 && r.cordoba === 0;
    chequear(id + " (" + oficina + "): una sola oficina en la ficha", total === 1, "mostro " + total);
    chequear(id + ": y es la suya", suya, "Cordoba=" + r.cordoba + " Mogotes=" + r.mogotes);
  }


  console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
  if (fallos.length) fallos.forEach((f) => console.log(`   · ${f}`));
} finally {
  await limpiar();
  await sb.auth.signOut();
  await cerrar();
}
process.exitCode = fallos.length ? 1 : 0;
