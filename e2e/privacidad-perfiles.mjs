/**
 * PRIVACIDAD INTERNA: una oficina no puede ponerse el sombrero de la Dirección.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 EL BUG QUE ESTO EXISTE PARA QUE NO VUELVA (8-ago-2026, lo encontró Juani):
 * entró con el mail de Chauvín y el panel lo dejó pasarse al perfil de Mateo.
 *
 * La causa: el candado dependía de que un perfil GUARDADO EN EL NAVEGADOR tuviera
 * la oficina puesta (`perfiles.find(p => p.oficina === oficinaUsuario)`). Si no
 * coincidía ninguno, el candado se abría. Y romper la coincidencia era trivial: la
 * pantalla ofrece "Agregar perfil" y "Eliminar", y un perfil creado a mano lleva
 * un id al azar que la migración por id no alcanza.
 *
 * El panel de Mateo tiene números, métricas y conversaciones de toda la
 * inmobiliaria. Los DATOS los protege el RLS de la base (una oficina nunca lee lo
 * de la otra, eso lo prueba `verificar-db`), pero la PANTALLA no puede darle el
 * sombrero de CEO a una oficina.
 *
 * Se ataca desde los tres lados por los que se puede forzar:
 *   1. perfiles por defecto
 *   2. perfiles renombrados / recreados con ids al azar  ← el caso que falló
 *   3. localStorage editado a mano para decir `admin: true`
 *
 * USO: APP=http://localhost:3000 node e2e/privacidad-perfiles.mjs
 */
import { nuevaPestania } from "./cdp.mjs";
import { pedirSesion, guionSesion } from "./login.mjs";

const { evaluar, ir, cerrar, URL_APP } = await nuevaPestania();

let ok = 0;
const fallos = [];
const chequear = (n, paso, extra = "") => {
  if (paso) { ok++; console.log(`PASS  ${n}${extra ? ` · ${extra}` : ""}`); }
  else { fallos.push(`${n}${extra ? ` · ${extra}` : ""}`); console.log(`FAIL  ${n}${extra ? ` · ${extra}` : ""}`); }
};

// Secciones que son SOLO de la dirección (no básicas y no habilitadas a las oficinas).
const SOLO_DIRECCION = ["Asistente IA", "Embudo de ventas", "Alquileres"];

const mirar = async () =>
  JSON.parse(await evaluar(
    'const t = document.body.innerText || ""; ' +
    'const menu = [...document.querySelectorAll("nav a, aside a")].map(a => (a.textContent||"").trim()).filter(Boolean); ' +
    'return JSON.stringify({ gate: t.indexOf("Quién está usando") >= 0, menu, url: location.pathname });'
  ));

await ir(URL_APP + "/", 900);
const sesion = await pedirSesion("chauvin");
await evaluar(guionSesion(sesion));

// ── 1 · Perfiles por defecto ──────────────────────────────────────────────────
console.log("\n── 1 · Chauvín con los perfiles por defecto ──");
await evaluar('localStorage.removeItem("potente_perfiles"); localStorage.removeItem("potente_perfil_activo"); return 1;');
await ir(URL_APP + "/panel/leads", 4000);
let v = await mirar();
chequear("No le abre la pantalla de elegir perfil", !v.gate);
for (const s of SOLO_DIRECCION)
  chequear(`No ve "${s}" en el menú`, !v.menu.some((m) => m.startsWith(s)));

// ── 2 · Perfiles recreados con ids al azar (el caso que falló) ────────────────
console.log("\n── 2 · Perfiles recreados con ids al azar (el caso del bug) ──");
await evaluar(`
  localStorage.setItem("potente_perfiles", JSON.stringify([
    { id: "pa1b2c", nombre: "Mateo", rol: "Direccion", foto: null, color: "#0C4DA2", admin: true, permisos: [] },
    { id: "pd4e5f", nombre: "Oficina Mogotes", rol: "Equipo 1", foto: null, color: "#1495D8", admin: false, permisos: ["inicio","cartera","temporada"] },
    { id: "pg7h8i", nombre: "Oficina Chauvin", rol: "Equipo 2", foto: null, color: "#083469", admin: false, permisos: ["inicio","cartera","temporada"] }
  ]));
  localStorage.removeItem("potente_perfil_activo");
  return 1;
`);
await ir(URL_APP + "/panel/leads", 4000);
v = await mirar();
chequear("Tampoco le abre la pantalla de perfiles", !v.gate);
for (const s of SOLO_DIRECCION)
  chequear(`Sigue sin ver "${s}"`, !v.menu.some((m) => m.startsWith(s)));

// ── 3 · localStorage editado para decir admin: true ──────────────────────────
console.log("\n── 3 · Se pone admin:true a mano en el navegador ──");
await evaluar(`
  localStorage.setItem("potente_perfiles", JSON.stringify([
    { id: "pzz999", nombre: "Chauvin", rol: "Direccion", foto: null, color: "#083469", admin: true,
      permisos: ["inicio","asistente","cartera","temporada","pipeline","arrendamientos"] }
  ]));
  localStorage.setItem("potente_perfil_activo", "pzz999");
  return 1;
`);
await ir(URL_APP + "/panel/leads", 4000);
v = await mirar();
for (const s of SOLO_DIRECCION)
  chequear(`Editar el navegador NO le da "${s}"`, !v.menu.some((m) => m.startsWith(s)));

// ── 3b · El resquicio fino: oficina correcta PERO permisos inventados ────────
console.log("\n── 3b · Se pone la oficina correcta con permisos inventados ──");
await evaluar(`
  localStorage.setItem("potente_perfiles", JSON.stringify([
    { id: "pqq111", nombre: "Chauvin", rol: "Direccion", foto: null, color: "#083469",
      admin: true, oficina: "chauvin",
      permisos: ["inicio","asistente","cartera","temporada","pipeline","arrendamientos"] }
  ]));
  localStorage.setItem("potente_perfil_activo", "pqq111");
  return 1;
`);
await ir(URL_APP + "/panel/leads", 4000);
v = await mirar();
for (const s of SOLO_DIRECCION)
  chequear(`Con la oficina puesta a mano tampoco gana "${s}"`, !v.menu.some((m) => m.startsWith(s)));

// Y que entrar por la URL directa tampoco funcione: el guard tiene que sacarlo.
await ir(URL_APP + "/panel/asistente", 4000);
v = await mirar();
chequear("Ir directo a /panel/asistente lo redirige", v.url !== "/panel/asistente", `quedó en ${v.url}`);

// ── 4 · Y la Dirección SÍ puede todo (que el candado no se pase de rosca) ────
console.log("\n── 4 · Mateo (dirección) sí puede ──");
await ir(URL_APP + "/", 900);
const sMateo = await pedirSesion("mateo");
await evaluar(guionSesion(sMateo));
await evaluar('localStorage.removeItem("potente_perfiles"); localStorage.removeItem("potente_perfil_activo"); return 1;');
await ir(URL_APP + "/panel/asistente", 4500);
v = await mirar();
chequear("La dirección entra al Asistente IA", v.url === "/panel/asistente", `quedó en ${v.url}`);
for (const s of SOLO_DIRECCION)
  chequear(`La dirección ve "${s}"`, v.menu.some((m) => m.startsWith(s)));

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
if (fallos.length) fallos.forEach((f) => console.log(`   · ${f}`));
await cerrar();
process.exitCode = fallos.length ? 1 : 0;
