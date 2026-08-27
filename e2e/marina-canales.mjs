/**
 * MARINA EN LOS CANALES — lo que el 27-ago dejó de ser decorativo.
 * ─────────────────────────────────────────────────────────────────────────────
 *   APP=https://potentepropiedades.com node e2e/marina-canales.mjs
 *
 * Prueba, contra el server real y la base viva (sembrando y borrando lo suyo):
 *   · el cerebro vive en la base: anon lo lee y NO lo escribe; la dirección sí;
 *   · el interruptor del panel es real: en pausa, /api/asistente avisa (pausada);
 *   · la charla de la web queda en la bandeja (canal Web, un hilo por visita) y,
 *     al dejar contacto, la consulta nace VINCULADA a ese hilo, con lo que pidió;
 *   · un DM de Instagram despierta a Marina, y si no puede enviar, el hilo pasa
 *     a una persona CON el motivo (nunca en silencio);
 *   · un WhatsApp NO despierta a Marina (decisión 27-ago: supervisión).
 *
 * ⚠️ La prueba de pausa apaga a Marina unos ~25 s en producción (la caché del
 * server dura 20 s). Se restaura en el `finally` pase lo que pase.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP || "http://localhost:3000";
const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
if (!env.MANYCHAT_TOKEN || !env.PANEL_MATEO_PASS) { console.log("⏭️  Falta MANYCHAT_TOKEN o PANEL_MATEO_PASS: la suite se saltea."); process.exit(0); }

let ok = 0; const fallos = [];
const chequear = (n, cond, extra = "") => {
  if (cond) { ok++; console.log(`PASS  ${n}${extra ? " :: " + extra : ""}`); }
  else { fallos.push(n); console.log(`FAIL  ${n}${extra ? " :: " + extra : ""}`); }
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const SELLO = String(Date.now()).slice(-7);

const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: eLogin } = await sb.auth.signInWithPassword({ email: "mateo@potenteprop.com.ar", password: env.PANEL_MATEO_PASS });
if (eLogin) { console.log(`⏭️  No se pudo entrar como la dirección (${eLogin.message}).`); process.exit(0); }

const postAsistente = (body) => fetch(`${APP}/api/asistente`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
const postManychat = (body) => fetch(`${APP}/api/ingesta/manychat`, { method: "POST", headers: { "content-type": "application/json", "x-manychat-token": env.MANYCHAT_TOKEN }, body: JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
const leerConv = async (contacto) => (await sb.from("potente_conversaciones").select("id,canal,nombre,contacto,estado,motivo,mensajes,leadId,propiedadId").eq("contacto", contacto)).data ?? [];

// Catálogo de sonda (IDs irreales: no toca la cartera). Marina necesita algo que recomendar.
const CATALOGO = [
  { id: "SONDA-ALQ-1", titulo: "Departamento 2 ambientes", zona: "Chauvín", categoria: "departamento", operacion: "alquiler", precio: "$ 650.000 por mes", ambientes: 2, dormitorios: 1, oficina: "chauvin" },
  { id: "SONDA-ALQ-2", titulo: "PH 3 ambientes con patio", zona: "Punta Mogotes", categoria: "ph", operacion: "alquiler", precio: "$ 800.000 por mes", ambientes: 3, dormitorios: 2, oficina: "puntamogotes" },
  { id: "SONDA-VTA-1", titulo: "Casa 3 dormitorios", zona: "Los Troncos", categoria: "casa", operacion: "venta", precio: "U$S 240.000", dormitorios: 3, oficina: "chauvin" },
];

const SESION = `visita-sonda${SELLO}`;
const IG = `sonda_ig_${SELLO}`;
const TEL = `5492230${SELLO.slice(-6)}`;
let cfgOriginal = null;
const leadsCreados = [];

const limpiar = async () => {
  for (const c of [SESION, IG, TEL]) for (const f of await leerConv(c)) await sb.from("potente_conversaciones").delete().eq("id", f.id);
  for (const id of leadsCreados) await sb.from("potente_leads").delete().eq("id", id);
};

console.log(`\n🧠 Marina en los canales contra ${APP}\n`);
try {
  await limpiar();

  // ── 1 · El cerebro vive en la base ────────────────────────────────────────
  const { data: cfgAnon, error: eAnon } = await anon.from("potente_ia_config").select("cfg").eq("id", true).maybeSingle();
  chequear("🧠 La config de la IA existe y anon la puede leer (Marina la usa en cada consulta)", !eAnon && cfgAnon && typeof cfgAnon.cfg === "object", eAnon?.message ?? JSON.stringify(Object.keys(cfgAnon?.cfg ?? {})));
  const { data: escrituraAnon } = await anon.from("potente_ia_config").update({ cfg: { activa: false, sonda: true } }).eq("id", true).select();
  const { data: sigue } = await anon.from("potente_ia_config").select("cfg").eq("id", true).maybeSingle();
  chequear("🔒 anon NO puede escribir la config (RLS)", (escrituraAnon ?? []).length === 0 && sigue?.cfg?.sonda !== true, `filas tocadas: ${(escrituraAnon ?? []).length}`);

  const { data: cfgMateo, error: eCfg } = await sb.from("potente_ia_config").select("cfg").eq("id", true).maybeSingle();
  chequear("La dirección lee la config", !eCfg && cfgMateo, eCfg?.message ?? "");
  cfgOriginal = cfgMateo?.cfg ?? {};

  // ── 2 · La web: la charla queda en la bandeja, la consulta nace vinculada ──
  const t1 = await postAsistente({ mensaje: "Hola, busco un departamento en alquiler de 2 ambientes en Chauvín", historial: [], catalogo: CATALOGO, sesion: SESION });
  chequear("🌐 Marina responde en la web (200 + texto)", t1.status === 200 && t1.json.respuesta && !t1.json.degradado, `HTTP ${t1.status} · ${String(t1.json.respuesta ?? "").slice(0, 80)}`);
  chequear("…y la charla ya tiene su hilo en la bandeja (conversacionId)", typeof t1.json.conversacionId === "string", t1.json.conversacionId ?? "sin id");
  await espera(800);
  let hilos = await leerConv(SESION);
  chequear("📥 Hilo canal Web con los 2 mensajes (lo que preguntó + lo que contestó Marina)",
    hilos.length === 1 && hilos[0].canal === "web" && hilos[0].mensajes.length === 2 && hilos[0].mensajes[0].de === "cliente" && hilos[0].mensajes[1].de === "ia",
    `${hilos.length} hilo(s) · ${hilos[0]?.mensajes?.map((m) => m.de).join(",")}`);

  const hist1 = [{ rol: "cliente", texto: "Hola, busco un departamento en alquiler de 2 ambientes en Chauvín" }, { rol: "asistente", texto: String(t1.json.respuesta ?? "") }];
  const t2 = await postAsistente({ mensaje: "Soy Sonda Web, mi teléfono es 223 555 0000. Quiero ver el de 2 ambientes en Chauvín, ¿me pasan más info?", historial: hist1, catalogo: CATALOGO, sesion: SESION });
  chequear("🌐 Segundo mensaje: Marina sigue (200)", t2.status === 200 && t2.json.respuesta, `HTTP ${t2.status}`);
  chequear("🧾 Con nombre y teléfono, Marina detecta la consulta (lead)", t2.json.lead && /223/.test(String(t2.json.lead.contacto ?? "")), JSON.stringify(t2.json.lead ?? null));
  chequear("…y el server la registra vinculada a la charla (leadId)", typeof t2.json.leadId === "string", t2.json.leadId ?? "sin leadId");
  if (t2.json.leadId) leadsCreados.push(t2.json.leadId);
  await espera(800);
  hilos = await leerConv(SESION);
  const { data: lead } = t2.json.leadId ? await sb.from("potente_leads").select("*").eq("id", t2.json.leadId).maybeSingle() : { data: null };
  chequear("📋 La consulta existe en Consultas, canal web, con lo que pidió en las notas",
    lead && lead.canal === "web" && /Pidió:/.test(lead.notas ?? "") && lead.estado === "nueva",
    lead ? `${lead.nombre} · ${lead.contacto} · ${String(lead.notas).slice(0, 70)}` : "no existe");
  chequear("🔗 El hilo quedó vinculado a la consulta (leadId) y con 4 mensajes",
    hilos.length === 1 && hilos[0].leadId === t2.json.leadId && hilos[0].mensajes.length === 4,
    `${hilos.length} hilo(s) · leadId=${hilos[0]?.leadId} · ${hilos[0]?.mensajes?.length} msgs`);
  chequear("…y el hilo lleva el nombre de la persona, no 'Visitante web'", hilos[0]?.nombre && hilos[0].nombre !== "Visitante web", hilos[0]?.nombre ?? "");

  // ── 3 · Instagram: un DM despierta a Marina; sin envío posible, avisa ──────
  const ig = await postManychat({ canal: "instagram", contacto: `@${IG}`, nombre: "Sonda Instagram", texto: "Hola! busco un depto en alquiler de 2 ambientes en Chauvín, ¿tienen algo?", subscriber_id: "999999999" });
  chequear("📸 Un DM de Instagram entra por ManyChat (200)", ig.status === 200 && ig.json.guardados === 1, `HTTP ${ig.status} · ${JSON.stringify(ig.json)}`);
  // Marina piensa (~3-8 s), intenta enviar a un id inventado, ManyChat lo rechaza → el hilo pasa a una persona con el motivo.
  let hiloIG = null;
  for (let i = 0; i < 12 && !(hiloIG?.estado === "vos"); i++) { await espera(2000); hiloIG = (await leerConv(IG))[0] ?? null; }
  chequear("🤖 Marina se despertó y, al no poder enviar, dejó el hilo en 'Te toca a vos' CON el motivo (nunca en silencio)",
    hiloIG && hiloIG.estado === "vos" && /no se pudo enviar|ManyChat/i.test(hiloIG.motivo ?? ""),
    hiloIG ? `estado=${hiloIG.estado} · motivo=${String(hiloIG.motivo ?? "").slice(0, 90)}` : "sin hilo");
  chequear("…y no dejó un mensaje 'ia' que no se envió", hiloIG && !hiloIG.mensajes.some((m) => m.de === "ia"), `${hiloIG?.mensajes?.length} msgs`);

  // ── 4 · WhatsApp: solo supervisión, Marina no interviene ──────────────────
  const wa = await postManychat({ canal: "whatsapp", contacto: TEL, nombre: "Sonda WA", texto: "Hola, consulto por un alquiler", subscriber_id: "999999998" });
  chequear("📱 Un WhatsApp entra (200)", wa.status === 200 && wa.json.guardados === 1, `HTTP ${wa.status}`);
  await espera(6000);
  const hiloWA = (await leerConv(TEL))[0];
  chequear("🔒 …y Marina NO interviene en WhatsApp (sigue en 'ia', sin motivo, 1 mensaje)",
    hiloWA && hiloWA.estado === "ia" && !hiloWA.motivo && hiloWA.mensajes.length === 1,
    hiloWA ? `estado=${hiloWA.estado} · ${hiloWA.mensajes.length} msgs` : "sin hilo");

  // ── 5 · El interruptor es real ────────────────────────────────────────────
  const { error: ePausa } = await sb.from("potente_ia_config").upsert({ id: true, cfg: { ...cfgOriginal, activa: false } });
  chequear("La dirección puede pausar a Marina (escribe la config)", !ePausa, ePausa?.message ?? "");
  await espera(21_000);                                   // la caché del server dura 20 s
  const pausada = await postAsistente({ mensaje: "Hola, busco un depto", historial: [], catalogo: CATALOGO });
  chequear("⏸️ En pausa, /api/asistente responde 200 hablado con pausada:true (no un error)",
    pausada.status === 200 && pausada.json.pausada === true && /WhatsApp/i.test(pausada.json.respuesta ?? ""),
    `HTTP ${pausada.status} · ${String(pausada.json.respuesta ?? "").slice(0, 70)}`);
} finally {
  if (cfgOriginal) {
    const { error } = await sb.from("potente_ia_config").upsert({ id: true, cfg: cfgOriginal });
    console.log(error ? `  🔴 NO SE PUDO RESTAURAR LA CONFIG: ${error.message}` : "  (config de Marina restaurada)");
  }
  await limpiar();
  console.log("  (sondas borradas)");
}
console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====\n`);
process.exit(fallos.length ? 1 : 0);
