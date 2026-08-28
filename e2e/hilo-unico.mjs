/**
 * UNA PERSONA, UN HILO (migración 024) — la charla no se parte al medio.
 * ─────────────────────────────────────────────────────────────────────────────
 *   node e2e/hilo-unico.mjs          (habla con la base, no necesita el server)
 *
 * 28-ago, primera prueba real: Juani le escribió al Instagram de Potente, Marina
 * contestó en 5 segundos… y al segundo mensaje se quedó muda. La causa: la misma
 * charla entraba por DOS puertas con DOS identidades —ManyChat manda el usuario
 * ("juaani_lopez") y el webhook de Meta manda el id interno ("2094389197952857")—
 * y se abrían dos hilos. El eco caía en el segundo, lo pasaba a manos de una
 * persona, y ahí Marina se calla por diseño: los mensajes siguientes morían.
 *
 * Esto prueba, contra la base VIVA y con sondas propias que se borran:
 *   1. ManyChat primero, Meta después → UN hilo.
 *   2. Meta primero, ManyChat después → UN hilo (y el número feo se cambia por
 *      el usuario legible: el panel muestra personas, no ids).
 *   3. Dos personas distintas NO se fusionan (el arreglo no une de más).
 *   4. La idempotencia sigue viva — 🔴 se rompió al escribir la 024: al meter el
 *      select del hilo entre el insert y el `if not found`, `found` dejaba de ser
 *      el del insert. Los repetidos habrían entrado y los nuevos se habrían
 *      descartado. Por eso esta prueba existe.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const TOKEN = env.POTENTE_INGESTA_TOKEN;
if (!TOKEN || !env.PANEL_MATEO_PASS) { console.log("⏭️  Falta POTENTE_INGESTA_TOKEN o PANEL_MATEO_PASS: la suite se saltea."); process.exit(0); }

let ok = 0; const fallos = [];
const chequear = (n, cond, extra = "") => {
  if (cond) { ok++; console.log(`PASS  ${n}${extra ? " :: " + extra : ""}`); }
  else { fallos.push(n); console.log(`FAIL  ${n}${extra ? " :: " + extra : ""}`); }
};

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: eLogin } = await sb.auth.signInWithPassword({ email: "mateo@potenteprop.com.ar", password: env.PANEL_MATEO_PASS });
if (eLogin) { console.log(`⏭️  No se pudo entrar como la dirección (${eLogin.message}).`); process.exit(0); }

const SELLO = String(Date.now()).slice(-8);
/** Como entra un mensaje de verdad: por la única puerta (la RPC con el token). */
const ingresar = async (contacto, texto, externo, extra = {}) => {
  const { data, error } = await sb.rpc("potente_ingresar_mensaje", {
    p_token: TOKEN,
    p_canal: "instagram",
    p_contacto: contacto,
    p_nombre: extra.nombre ?? "",
    p_mensaje_id: extra.mensajeId ?? `sonda-${SELLO}-${Math.random().toString(36).slice(2, 9)}`,
    p_texto: texto,
    p_hora: new Date().toISOString(),
    p_de: extra.de ?? "cliente",
    p_historico: false,
    p_externo: externo ?? null,
  });
  if (error) return { error: error.message };
  return { convId: data };
};
const hilosDe = async (...contactos) =>
  (await sb.from("potente_conversaciones").select("id,contacto,nombre,estado,externo,mensajes").in("contacto", contactos)).data ?? [];

// Dos personas de sonda, cada una con sus dos identidades.
const A_USER = `sonda_a_${SELLO}`, A_IGID = `90${SELLO}01`;
const B_USER = `sonda_b_${SELLO}`, B_IGID = `90${SELLO}02`;
const creados = new Set();

const limpiar = async () => {
  for (const c of [A_USER, A_IGID, B_USER, B_IGID]) {
    for (const h of await hilosDe(c)) await sb.from("potente_conversaciones").delete().eq("id", h.id);
  }
};

console.log(`\n🧵 Una persona, un hilo (024)\n`);
try {
  await limpiar();

  // ── 1 · ManyChat primero (usuario + ig_id), Meta después (solo el id) ──────
  const r1 = await ingresar(A_USER, "Hola, busco algo en alquiler", { ig_username: A_USER, ig_id: A_IGID, manychat_subscriber_id: "111" }, { nombre: "Sonda A" });
  chequear("📸 Entra por ManyChat (usuario) y crea el hilo", Boolean(r1.convId), r1.error ?? r1.convId);
  const r2 = await ingresar(A_IGID, "…y este llega por el webhook de Meta", null);
  chequear("🌐 El MISMO mensaje por la otra puerta cae en el MISMO hilo", r2.convId === r1.convId, `${r2.error ?? r2.convId} vs ${r1.convId}`);
  let hilosA = await hilosDe(A_USER, A_IGID);
  chequear("…y queda UN solo hilo, con los dos mensajes", hilosA.length === 1 && hilosA[0].mensajes.length === 2, `${hilosA.length} hilo(s) · ${hilosA[0]?.mensajes?.length} msgs`);

  // ── 2 · La idempotencia sigue viva (la 024 casi la da vuelta) ─────────────
  const idFijo = `sonda-rep-${SELLO}`;
  const p1 = await ingresar(A_USER, "mensaje con id fijo", null, { mensajeId: idFijo });
  const p2 = await ingresar(A_USER, "mensaje con id fijo", null, { mensajeId: idFijo });
  hilosA = await hilosDe(A_USER, A_IGID);
  chequear("🔁 El mismo mensaje dos veces entra UNA sola (idempotencia intacta)",
    Boolean(p1.convId) && p2.convId === null && hilosA[0].mensajes.length === 3,
    `1º: ${p1.convId ?? p1.error} · 2º: ${p2.convId === null ? "descartado ✓" : p2.convId ?? p2.error} · ${hilosA[0]?.mensajes?.length} msgs`);

  // ── 3 · Al revés: Meta primero (id), ManyChat después (usuario) ────────────
  const r3 = await ingresar(B_IGID, "Entra primero por Meta", null);
  chequear("🌐 Un hilo que nace por el webhook de Meta (con el id como contacto)", Boolean(r3.convId), r3.error ?? r3.convId);
  const r4 = await ingresar(B_USER, "Ahora llega por ManyChat", { ig_username: B_USER, ig_id: B_IGID, manychat_subscriber_id: "222" }, { nombre: "Sonda B" });
  chequear("📸 …y ManyChat cae en ESE hilo, no abre otro", r4.convId === r3.convId, `${r4.error ?? r4.convId} vs ${r3.convId}`);
  const hilosB = await hilosDe(B_USER, B_IGID);
  chequear("🏷️ …y el contacto pasa del número feo al usuario legible (el panel muestra personas)",
    hilosB.length === 1 && hilosB[0].contacto === B_USER, `${hilosB.length} hilo(s) · contacto=${hilosB[0]?.contacto}`);
  chequear("…con el nombre real, no el id", hilosB[0]?.nombre === "Sonda B", `nombre=${hilosB[0]?.nombre}`);

  // ── 4 · No une de más: dos personas distintas siguen separadas ────────────
  const todos = await hilosDe(A_USER, A_IGID, B_USER, B_IGID);
  chequear("🔒 Dos personas distintas NO se fusionan", todos.length === 2, `${todos.length} hilos (esperados 2)`);
  chequear("…y cada hilo tiene solo SUS mensajes",
    todos.every((h) => h.mensajes.every((m) => (h.contacto === A_USER ? !m.texto.includes("Sonda B") : !m.texto.includes("alquiler")))),
    todos.map((h) => `${h.contacto}:${h.mensajes.length}`).join(" · "));
} finally {
  await limpiar();
  console.log("  (sondas borradas)");
}
console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====\n`);
process.exit(fallos.length ? 1 : 0);
