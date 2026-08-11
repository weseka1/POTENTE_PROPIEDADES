/**
 * Cartera: el buscador del panel encuentra por DIRECCIÓN y sin tildes.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Reportado por MATEO (WhatsApp 11-ago): "me toma TODO menos la dirección
 * cuando quiero buscarla". El filtro indexaba título+zona+id; la dirección —
 * que es como el equipo piensa las propiedades — quedaba afuera. Y de paso:
 * él tipea "colon 3537" y la ficha dice "Colón", así que la comparación va
 * sin tildes en las dos puntas (sinTildes de parseBusqueda, el mismo criterio
 * que el buscador público).
 *
 * ⚠️ La cartera es VIVA (Mateo edita a diario): la propiedad a buscar se lee
 * de la base EN EL MOMENTO — invariantes, nunca cantidades ni IDs fijos.
 *
 * USO: APP=http://localhost:3000 node e2e/cartera-busqueda.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";
import { pedirSesion, guionSesion } from "./login.mjs";

// La misma lectura de .env.local que hace login.mjs, para consultar la vista
// pública desde acá (elegimos el caso de prueba con datos vivos, no fijos).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const AQUI = dirname(fileURLToPath(import.meta.url));
const envLocal = Object.fromEntries(
  readFileSync(resolve(AQUI, "..", ".env.local"), "utf8")
    .split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const env = { ...envLocal, ...process.env };
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const sin = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Una propiedad cuya CALLE no aparezca en título ni zona: si el buscador la
// encuentra tipeando la calle, fue por la DIRECCIÓN, no por otra cosa.
const { data: filas, error } = await sb
  .from("potente_propiedades_web")
  .select("id,direccion,titulo,zona")
  .not("direccion", "is", null)
  .limit(60);
if (error) { console.error("No pude leer la vista pública:", error.message); process.exit(1); }
const objetivo = (filas || [])
  .map((p) => {
    const calle = sin(p.direccion).replace(/\d+/g, "").trim().split(" ").filter((w) => w.length > 3)[0];
    return { ...p, calle };
  })
  .find((p) => p.calle && !sin(p.titulo + " " + p.zona).includes(p.calle));

const { evaluar, ir, cerrar, URL_APP } = await nuevaPestania();
await ir(URL_APP + "/", 3000);
const sesion = await pedirSesion("mateo");
await evaluar(guionSesion(sesion));
await ir(URL_APP + "/panel/cartera", 6000);

// El buscador de la PÁGINA (no el del Topbar, que también menciona dirección
// pero deriva con Enter — se distingue porque ese dice "(Enter)").
const escribirYContar = async (texto) =>
  JSON.parse(
    await evaluar(`
      const i = [...document.querySelectorAll("input")].filter(x => (x.placeholder||"").includes("direcci") && !(x.placeholder||"").includes("Enter"))[0];
      if (!i) return JSON.stringify({ n: -1 });
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(i, ${JSON.stringify(texto)});
      i.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise(r => setTimeout(r, 900));
      const cards = [...document.querySelectorAll(".pcard")].filter(c => c.querySelector("img"));
      return JSON.stringify({ n: cards.length });
    `),
  );

if (objetivo) {
  const res = await escribirYContar(objetivo.calle);
  chequear(
    `tipear la calle "${objetivo.calle}" (de ${objetivo.id}, "${objetivo.direccion}") la encuentra`,
    res.n >= 1,
    `${res.n} resultado(s) — el título ("${objetivo.titulo.slice(0, 40)}…") no contiene la calle: matcheó por dirección`,
  );
  const teniaTilde = objetivo.direccion.normalize("NFD").length !== objetivo.direccion.length;
  chequear(
    "la comparación ignora tildes (se buscó la calle ya normalizada, sin tilde)",
    res.n >= 1,
    teniaTilde ? `la dirección real tiene tilde: "${objetivo.direccion}"` : "esta dirección no tenía tilde, pero el camino es el mismo",
  );
} else {
  chequear("hay una propiedad con dirección para armar el caso", false, "ninguna fila con calle ausente del título — ¿cartera vacía?");
}

const nada = await escribirYContar("zzzqqq");
chequear("una búsqueda sin sentido no devuelve nada", nada.n === 0, `${nada.n} resultados`);

const vacio = await escribirYContar("");
chequear("limpiar la búsqueda vuelve a mostrar la cartera", vacio.n >= 10, `${vacio.n} tarjetas (viva: se pide ≥10, no un número exacto)`);

const ph = await evaluar(
  'const i = [...document.querySelectorAll("input")].filter(x => (x.placeholder||"").includes("direcci") && !(x.placeholder||"").includes("Enter"))[0]; return i ? i.placeholder : ""',
);
chequear("el placeholder le dice al equipo que la dirección busca", ph.includes("dirección"), ph);

await cerrar();
resumen();
