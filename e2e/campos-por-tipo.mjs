/**
 * Los campos que pide el formulario según el TIPO de propiedad.
 * ─────────────────────────────────────────────────────────────────────────────
 * Es el pedido textual de Mateo (audio 7-ago):
 *   "si es departamento que me pida piso, departamento, disposición y la
 *    orientación… después en los lotes, cuando quiero cargar un terreno o un lote
 *    que me pida metros de frente, metros de fondo, superficie total, el tipo de
 *    acceso —si es por asfalto, si es por tierra— y la superficie construible."
 *
 * Se abre una propiedad REAL de cada tipo con `?id=`, así de paso se verifica el
 * hidratado (que al editar los campos vengan cargados y no vacíos).
 *
 * ⚠️ Dos trampas de este panel, ya documentadas en e2e/README.md:
 *   · `innerText` respeta `text-transform`, y las etiquetas van en `uppercase`:
 *     todo se compara en minúscula.
 *   · El panel NO usa `<select>` nativo (usa un listbox propio para que el menú se
 *     vea igual en Windows y Mac), así que no se puede setear `.value`.
 *
 * USO: APP=http://localhost:3000 node e2e/campos-por-tipo.mjs
 */
import { nuevaPestania } from "./cdp.mjs";
import { pedirSesion, guionSesion } from "./login.mjs";

const { evaluar, ir, cerrar, URL_APP } = await nuevaPestania();

let ok = 0;
const fallos = [];
const chequear = (n, paso, extra = "") => {
  if (paso) { ok++; console.log(`PASS  ${n}${extra ? ` · ${extra}` : ""}`); }
  else { fallos.push(n); console.log(`FAIL  ${n}${extra ? ` · ${extra}` : ""}`); }
};

// Una propiedad real de cada tipo, de la cartera de Potente.
const CASOS = {
  departamento: "POT-153420",
  lote: "POT-153220",
  casa: "POT-153864",
  ph: "POT-161465",
  // El edificio REAL de Mateo ("12 Unidades en Block", Chauvín). Se abre y se
  // mira: esta suite JAMÁS envía el formulario.
  edificio: "PROP-1788880265805",
};

await ir(URL_APP + "/", 900);
const sesion = await pedirSesion("mateo");
await evaluar(guionSesion(sesion));

/** Abre el formulario de edición de esa propiedad y devuelve lo que se ve. */
const abrir = async (id) => {
  await ir(`${URL_APP}/panel/cargar?id=${id}`, 4000);
  return await evaluar(`
    const t = (document.body.innerText || "").toLowerCase();
    return {
      texto: t,
      // Cuántos campos numéricos/texto vinieron con valor: prueba el hidratado.
      conValor: [...document.querySelectorAll("form input")]
        .filter(i => i.type !== "checkbox" && i.value.trim() !== "").length,
      titulo: (document.querySelector("form input")?.value || ""),
    };
  `);
};

const pide = (v, campo) => v.texto.includes(campo.toLowerCase());

// ── DEPARTAMENTO ─────────────────────────────────────────────────────────────
console.log("\n── DEPARTAMENTO ──");
const depto = await abrir(CASOS.departamento);
for (const c of ["Piso", "Departamento", "Disposición", "Orientación", "Acceso al edificio",
                 "Expensas", "Antigüedad", "Tipo de cochera", "Baños", "Dormitorios",
                 "Superficie cubierta", "Superficie semicubierta", "Superficie descubierta", "Superficie total"])
  chequear(`Departamento pide "${c}"`, pide(depto, c));
chequear("Departamento NO pide superficie construible", !pide(depto, "construible"));
chequear("Departamento NO pide tipo de acceso (eso es del lote)", !pide(depto, "tipo de acceso"));
chequear("Al editar, los datos vienen cargados", depto.conValor >= 4, `${depto.conValor} campos con valor`);

// ── LOTE ─────────────────────────────────────────────────────────────────────
console.log("\n── LOTE ──");
const lote = await abrir(CASOS.lote);
for (const c of ["Metros de frente", "Metros de fondo", "Superficie total",
                 "Superficie construible", "Tipo de acceso", "Asfalto", "Tierra", "Mejorado"])
  chequear(`Lote pide "${c}"`, pide(lote, c));
chequear("Lote NO pide piso ni unidad", !pide(lote, "acceso al edificio"));
chequear("Lote NO pide dormitorios", !pide(lote, "dormitorios"));
chequear("Lote NO pide expensas", !pide(lote, "expensas"));
chequear("Lote NO pide superficie semicubierta", !pide(lote, "semicubierta"));

// ── CASA ─────────────────────────────────────────────────────────────────────
console.log("\n── CASA ──");
const casa = await abrir(CASOS.casa);
chequear("Casa pide dormitorios", pide(casa, "dormitorios"));
chequear("Casa pide metros de frente y fondo", pide(casa, "metros de frente") && pide(casa, "metros de fondo"));
chequear("Casa pide antigüedad", pide(casa, "antigüedad"));
chequear("Casa NO pide piso ni unidad", !pide(casa, "acceso al edificio"));
chequear("Casa NO pide superficie construible", !pide(casa, "construible"));

// ── PH: la excepción documentada (los datos reales tienen PH con expensas) ────
console.log("\n── PH (la excepción: sí lleva expensas) ──");
const ph = await abrir(CASOS.ph);
chequear("PH pide expensas", pide(ph, "expensas"));
chequear("PH pide dormitorios", pide(ph, "dormitorios"));

// ── 🏢 EDIFICIO (028, Mateo 8-sep): composición en vez de ambientes ─────────
// Se pregunta por atributo `data-campo`, no por texto en el body: "Medidas y
// ambientes" y "Ambientes" aparecen como palabras en cualquier pantalla del
// panel, así que buscarlas por texto daba verde con el bug puesto.
console.log("\n── EDIFICIO ──");
const edificio = await abrir(CASOS.edificio);
const campos = await evaluar(`
  return {
    presentes: [...document.querySelectorAll("[data-campo]")].map(e => e.getAttribute("data-campo")),
    editor: Boolean(document.querySelector('[data-editor="composicion"]')),
    boton: (document.body.innerText || "").toLowerCase().includes("agregar unidades"),
  };
`);
chequear("Edificio muestra el editor de composición (unidades × ambientes)", campos.editor && campos.boton);
chequear("Edificio NO pide ambientes en general", !campos.presentes.includes("ambientes"), campos.presentes.join(", "));
chequear("Edificio NO pide baños ni dormitorios", !campos.presentes.includes("banos") && !campos.presentes.includes("dormitorios"));
// 🔴 Lo que un edificio SÍ conserva de comercial: si falta uno acá, el guardado lo pone en null.
for (const c of ["m2cubiertos", "m2totales", "m2descubiertos", "metrosFrente", "metrosFondo", "orientacion", "antiguedadAnios", "expensasARS", "cocheras"])
  chequear(`Edificio conserva "${c}" (no se borra al guardar)`, campos.presentes.includes(c));
chequear("Edificio: el bloque se llama 'Unidades y medidas'", pide(edificio, "unidades y medidas"));
chequear("Al editar el edificio real, sus datos vienen cargados", edificio.conValor >= 4, `${edificio.conValor} campos con valor`);

// ── Publicar / bajar de la web + los 5 estados ───────────────────────────────
console.log("\n── PUBLICAR Y ESTADOS ──");
chequear("Está el interruptor de publicar/bajar de la web", pide(depto, "publicada en la web"));
const estados = ["activa", "reservada", "vendida", "alquilada", "suspendida"].filter((e) => depto.texto.includes(e));
chequear("Están los 5 estados de Mateo", estados.length === 5, estados.join(" · "));
chequear("Se explica qué es 'lo que dejes vacío no se muestra'", pide(depto, "no se"));

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
if (fallos.length) fallos.forEach((f) => console.log(`   · ${f}`));
await cerrar();
process.exitCode = fallos.length ? 1 : 0;
