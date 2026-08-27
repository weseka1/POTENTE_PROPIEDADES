/**
 * LA ALERTA DE LO COLGADO — lo que Mateo pidió, probado en la PANTALLA.
 * ─────────────────────────────────────────────────────────────────────────────
 *   APP=https://potentepropiedades.com node e2e/bandeja-colgados.mjs
 *   (Chrome headless en :9222 · META_APP_SECRET y PANEL_MATEO_PASS en .env.local)
 *
 * 27-ago. Decisión de Juani: en WhatsApp nadie contesta por API — el panel es el
 * espejo, y lo valioso es que Mateo VEA al instante qué quedó sin responder.
 * Todo lo del conector se probó contra la base; esto prueba lo que ve él:
 *   1. Entra una consulta por el webhook (firmada, como la manda Meta) con
 *      fecha de hace 45 minutos → en la bandeja tiene que estar ARRIBA de todo,
 *      con el rótulo rojo "Sin responder".
 *   2. La oficina contesta desde el celular (eco) → el rótulo pasa a "Respondido".
 * Siembra su propia conversación y la borra en el finally.
 */
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { nuevaPestania } from "./cdp.mjs";
import { pedirSesion, guionSesion } from "./login.mjs";

const APP = process.env.APP || "http://localhost:3000";
const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const SECRET = env.META_APP_SECRET;
if (!SECRET) { console.log("⏭️  Sin META_APP_SECRET: la suite se saltea."); process.exit(0); }

let ok = 0; const fallos = [];
const chequear = (n, cond, extra = "") => {
  if (cond) { ok++; console.log(`PASS  ${n}${extra ? " :: " + extra : ""}`); }
  else { fallos.push(n); console.log(`FAIL  ${n}${extra ? " :: " + extra : ""}`); }
};

const SELLO = `COLG-${Date.now()}`;
const TEL = `54900033${String(Date.now()).slice(-6)}`;
const OFICINA = "5492235129032";
const firmar = (c) => "sha256=" + createHmac("sha256", SECRET).update(c).digest("hex");
const postear = async (obj) => {
  const cuerpo = JSON.stringify(obj);
  const r = await fetch(APP + "/api/meta/webhook", { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": firmar(cuerpo) }, body: cuerpo });
  return r.status;
};
const cambio = (field, value) => ({ object: "whatsapp_business_account", entry: [{ id: "SONDA", changes: [{ field, value }] }] });

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: eLogin } = await sb.auth.signInWithPassword({ email: "mateo@potenteprop.com.ar", password: env.PANEL_MATEO_PASS });
if (eLogin) { console.log(`⏭️  No se pudo entrar como la dirección (${eLogin.message}).`); process.exit(0); }
const limpiar = async () => {
  const { data } = await sb.from("potente_conversaciones").select("id").eq("contacto", TEL);
  for (const f of data ?? []) await sb.from("potente_conversaciones").delete().eq("id", f.id);
};

const { evaluar, ir, cerrar, URL_APP } = await nuevaPestania();
console.log(`\n🚨 Alerta de lo colgado contra ${APP}\n`);

const leerLista = () => evaluar(`
  const tarjetas = [...document.querySelectorAll('[data-bandeja=lista] button')];
  return JSON.stringify(tarjetas.map(b => ({
    nombre: (b.querySelector('.truncate')?.textContent || '').trim(),
    colgada: b.querySelector('[data-colgada]')?.getAttribute('data-colgada') || null,
    rotulo: (b.querySelector('[data-colgada]')?.textContent || '').trim(),
  })));
`);

try {
  await limpiar();
  // 1 · una consulta de hace 45 minutos, sin respuesta
  const hace45 = Math.floor(Date.now() / 1000) - 45 * 60;
  const st = await postear(cambio("messages", {
    messaging_product: "whatsapp",
    contacts: [{ profile: { name: "Sonda Colgada" }, wa_id: TEL }],
    messages: [{ from: TEL, id: `${SELLO}-1`, timestamp: String(hace45), type: "text", text: { body: "Hola, ¿sigue disponible el depto?" } }],
  }));
  chequear("La consulta entra por el webhook", st === 200, `HTTP ${st}`);
  await new Promise((r) => setTimeout(r, 2500));

  await ir(URL_APP + "/", 900);
  const sesion = await pedirSesion("mateo");
  await evaluar(guionSesion(sesion));
  await ir(URL_APP + "/panel/asistente", 5000);

  let lista = JSON.parse(await leerLista());
  const fila = lista.find((x) => x.nombre === "Sonda Colgada");
  chequear("La conversación aparece en la bandeja de Mateo", Boolean(fila), fila ? "sí" : `no está (hay ${lista.length})`);
  // 27-ago · Con hilos reales colgados hace más tiempo (Instagram de Mateo), la
  // sonda no es la primera: lo que se afirma es que está en el BLOQUE de arriba
  // (todo lo que la precede también está colgado) — no que le gane a un cliente.
  const pos = lista.findIndex((x) => x.nombre === "Sonda Colgada");
  const antes = pos > 0 ? lista.slice(0, pos) : [];
  chequear("🔴 …está en el bloque de arriba (todo lo que la precede también está colgado)", pos >= 0 && antes.every((x) => x.colgada === "si"), `posición ${pos + 1}; antes: ${antes.map((x) => `${x.nombre}=${x.colgada}`).join(", ") || "nada"}`);
  chequear("🔴 …con el rótulo rojo 'Sin responder'", fila?.colgada === "si" && /Sin responder/i.test(fila?.rotulo ?? ""), `rótulo: "${fila?.rotulo}"`);

  const metrica = await evaluar(`return (document.body.innerText.match(/Sin responder[^\\n]*\\n?\\s*(\\d+)/) || [])[1] || (document.body.innerText.match(/(\\d+)\\s*\\n?\\s*Sin responder/) || [])[1] || ''`);
  chequear("…y la métrica 'Sin responder' cuenta al menos 1", Number(metrica) >= 1, `métrica: ${metrica || "no encontrada"}`);

  // 1b · la pestaña Canales: la tarjeta de WhatsApp dice "Conectado" porque ENTRÓ
  //      un mensaje, no porque alguien dejó un flag prendido
  const clickTab = (nombre) => evaluar(`[...document.querySelectorAll('button')].find(b => (b.textContent||'').trim() === '${nombre}')?.click(); return 1;`);
  // Se busca por el TÍTULO de la tarjeta (el <p> de arriba), no por el texto
  // entero: la descripción de Instagram también dice "WhatsApp". Y sin  en el
  // template: adentro de un template de JS,  es BACKSPACE (cicatriz conocida).
  const estadoTarjeta = (nombre) => evaluar(`
    const t = [...document.querySelectorAll('.pcard')].find(x => ((x.querySelector('p')?.textContent) || '').trim().startsWith('${nombre}'));
    return t ? (t.querySelector('[data-canal-estado]')?.getAttribute('data-canal-estado') || 'sin-estado') : 'sin-tarjeta';
  `);
  await clickTab("Canales");
  await new Promise((r) => setTimeout(r, 800));
  const tarjetaWA = await estadoTarjeta("WhatsApp");
  chequear("📡 En Canales, WhatsApp figura 'Conectado · en el panel' (deducido de la bandeja real)", tarjetaWA === "conectado", `estado: ${tarjetaWA}`);
  // 27-ago · Instagram YA entra (ManyChat): su chip dice lo que diga la bandeja
  // real, no lo que decía esta prueba cuando se escribió (verde/rojo falso).
  const hayIG = ((await sb.from("potente_conversaciones").select("id").eq("canal", "instagram").limit(1)).data ?? []).length > 0;
  const tarjetaIG = await estadoTarjeta("Instagram");
  chequear(`…e Instagram figura ${hayIG ? "'Conectado'" : "'A conectar'"} porque eso dice la bandeja real`, tarjetaIG === (hayIG ? "conectado" : "pendiente"), `estado: ${tarjetaIG}`);
  await clickTab("Conversaciones");
  await new Promise((r) => setTimeout(r, 800));

  // 2 · la oficina responde desde el celular
  const st2 = await postear(cambio("smb_message_echoes", {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: OFICINA, phone_number_id: "961292850997751" },
    message_echoes: [{ from: OFICINA, to: TEL, id: `${SELLO}-2`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "¡Hola! Sí, sigue disponible." } }],
  }));
  chequear("La respuesta de la oficina entra (eco)", st2 === 200, `HTTP ${st2}`);
  await new Promise((r) => setTimeout(r, 3500));
  await ir(URL_APP + "/panel/asistente", 5000);
  lista = JSON.parse(await leerLista());
  const fila2 = lista.find((x) => x.nombre === "Sonda Colgada");
  chequear("✅ Con la respuesta, el rótulo pasa a 'Respondido'", fila2?.colgada === "no" && /Respondido/i.test(fila2?.rotulo ?? ""), `rótulo: "${fila2?.rotulo}"`);
} finally {
  await limpiar();
  await cerrar();
  console.log("  (conversación de sonda borrada)");
}

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====\n`);
process.exit(fallos.length ? 1 : 0);
