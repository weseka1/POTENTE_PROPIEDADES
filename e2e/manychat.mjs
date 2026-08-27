/**
 * EL PUENTE CON MANYCHAT — /api/ingesta/manychat
 * ─────────────────────────────────────────────────────────────────────────────
 *   APP=https://potentepropiedades.com node e2e/manychat.mjs
 *
 * Simula lo que ManyChat manda con "External Request" y verifica que caiga en
 * la bandeja de Mateo por la puerta idempotente. Siembra y borra lo suyo.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP || "http://localhost:3000";
const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const TOKEN = env.MANYCHAT_TOKEN;
if (!TOKEN) { console.log("⏭️  Sin MANYCHAT_TOKEN: la suite se saltea."); process.exit(0); }

let ok = 0; const fallos = [];
const chequear = (n, cond, extra = "") => {
  if (cond) { ok++; console.log(`PASS  ${n}${extra ? " :: " + extra : ""}`); }
  else { fallos.push(n); console.log(`FAIL  ${n}${extra ? " :: " + extra : ""}`); }
};

const SELLO = String(Date.now()).slice(-7);
const IG = `sonda_mc_${SELLO}`;
const TEL = `+54 9 223 00${SELLO.slice(-5)}`;          // con espacios y +: el server lo normaliza
const TEL_DIGITOS = TEL.replace(/\D/g, "");

const post = (body, token = TOKEN) => fetch(`${APP}/api/ingesta/manychat`, {
  method: "POST",
  headers: { "content-type": "application/json", ...(token ? { "x-manychat-token": token } : {}) },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: eLogin } = await sb.auth.signInWithPassword({ email: "mateo@potenteprop.com.ar", password: env.PANEL_MATEO_PASS });
if (eLogin) { console.log(`⏭️  No se pudo entrar como la dirección (${eLogin.message}).`); process.exit(0); }
const leer = async (contacto) => (await sb.from("potente_conversaciones").select("id,canal,nombre,contacto,mensajes,noLeida").eq("contacto", contacto)).data ?? [];
const limpiar = async () => {
  for (const c of [IG, TEL_DIGITOS]) for (const f of await leer(c)) await sb.from("potente_conversaciones").delete().eq("id", f.id);
};

console.log(`\n🔀 Puente ManyChat contra ${APP}\n`);
try {
  await limpiar();

  const sinToken = await post({ canal: "instagram", contacto: IG, texto: "hola" }, null);
  chequear("🔒 Sin token → 401 y no escribe", sinToken.status === 401 && (await leer(IG)).length === 0, `HTTP ${sinToken.status}`);
  const malToken = await post({ canal: "instagram", contacto: IG, texto: "hola" }, "token-inventado");
  chequear("🔒 Token inventado → 401", malToken.status === 401, `HTTP ${malToken.status}`);

  const sinTexto = await post({ canal: "instagram", contacto: IG });
  chequear("Sin texto → 400 con motivo", sinTexto.status === 400 && /texto/.test(sinTexto.json.mensaje ?? ""), `HTTP ${sinTexto.status} · ${sinTexto.json.mensaje}`);
  const canalRaro = await post({ canal: "telegram", contacto: IG, texto: "hola" });
  chequear("Canal que no es instagram/whatsapp → 400", canalRaro.status === 400, `HTTP ${canalRaro.status}`);

  // Instagram, como lo manda ManyChat: usuario con @, nombre, texto
  const ig1 = await post({ canal: "instagram", contacto: `@${IG}`, nombre: "Sonda ManyChat", texto: "Hola! vi el depto de Playa Grande en el feed", subscriber_id: "123456" });
  chequear("📸 Un DM de Instagram entra (200)", ig1.status === 200 && ig1.json.guardados === 1, `HTTP ${ig1.status} · ${JSON.stringify(ig1.json)}`);
  await new Promise((r) => setTimeout(r, 800));
  let convs = await leer(IG);
  chequear("…y aparece en la bandeja como conversación de Instagram, no leída, con el nombre",
    convs.length === 1 && convs[0].canal === "instagram" && convs[0].noLeida === true && convs[0].nombre === "Sonda ManyChat",
    JSON.stringify({ n: convs.length, canal: convs[0]?.canal, nombre: convs[0]?.nombre }));

  const ig2 = await post({ canal: "instagram", contacto: `@${IG}`, nombre: "Sonda ManyChat", texto: "Hola! vi el depto de Playa Grande en el feed", subscriber_id: "123456" });
  chequear("🔁 El mismo mensaje dos veces (reintento de ManyChat) NO se duplica", ig2.status === 200 && ig2.json.repetidos === 1, JSON.stringify(ig2.json));
  convs = await leer(IG);
  chequear("…sigue habiendo 1 conversación con 1 mensaje", convs.length === 1 && convs[0].mensajes.length === 1, `${convs.length} conv · ${convs[0]?.mensajes.length} msgs`);

  const ig3 = await post({ canal: "instagram", contacto: IG, texto: "¿Cuánto sale?" });
  await new Promise((r) => setTimeout(r, 800));
  convs = await leer(IG);
  chequear("💬 Un segundo mensaje se suma al MISMO hilo", ig3.status === 200 && convs.length === 1 && convs[0].mensajes.length === 2, `${convs.length} conv · ${convs[0]?.mensajes.length} msgs`);

  // WhatsApp: el teléfono viene con + y espacios; se guarda solo dígitos
  const wa = await post({ canal: "whatsapp", contacto: TEL, nombre: "Sonda WA", texto: "Buenas, consulto por un alquiler", hora: Math.floor(Date.now() / 1000) });
  await new Promise((r) => setTimeout(r, 800));
  const cw = await leer(TEL_DIGITOS);
  chequear("📱 Un WhatsApp entra con el teléfono normalizado (solo dígitos)", wa.status === 200 && cw.length === 1 && cw[0].canal === "whatsapp", `HTTP ${wa.status} · contacto=${cw[0]?.contacto}`);

  // Una oficina no ve nada de esto
  if (env.PANEL_CHAUVIN_PASS) {
    const sbOf = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    const { error } = await sbOf.auth.signInWithPassword({ email: "chauvin@potenteprop.com.ar", password: env.PANEL_CHAUVIN_PASS });
    if (!error) {
      const { data } = await sbOf.from("potente_conversaciones").select("id").in("contacto", [IG, TEL_DIGITOS]);
      chequear("🔒 Una oficina NO ve lo que entró por ManyChat (RLS de la 015)", (data ?? []).length === 0, `leyó ${(data ?? []).length}`);
    }
  }
} finally {
  await limpiar();
  console.log("  (sondas borradas)");
}
console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====\n`);
process.exit(fallos.length ? 1 : 0);
