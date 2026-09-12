#!/usr/bin/env node
/**
 * meta.mjs — el estado de Meta (WhatsApp) de Potente en UN comando, leído por API.
 *
 *   node scripts/meta.mjs estado                 → cuentas, números (platform/is_on_biz_app),
 *                                                  apps suscriptas y webhook de la app
 *   node scripts/meta.mjs sync <phone_number_id> → dispara la sincronización de contactos +
 *                                                  historial (Coexistence, ventana de 24 h)
 *
 * Lee de .env.local: META_ACCESS_TOKEN_POTENTE (system user) · META_APP_SECRET (solo para
 * leer el webhook de la app). Nunca imprime una clave. Solo lectura salvo `sync`.
 * 🔴 NO existe un subcomando `register`: los números Coexistence YA están registrados y
 * repetirlo los rompe (runbook Meta, _CEREBRO/Componentes).
 */
import { readFileSync } from "node:fs";

const env = {};
try {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = l.indexOf("=");
    if (i > 0 && !l.trim().startsWith("#")) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
} catch { /* sin .env.local */ }
const TOKEN = process.env.META_ACCESS_TOKEN_POTENTE || env.META_ACCESS_TOKEN_POTENTE;
/* 🔴 12-sep · NADA DE ESTO VA ESCRITO A MANO.
 * El día que el número se conecte, la cuenta de WhatsApp puede nacer en un
 * portfolio que hoy ni existe: Meta NO deja que el portfolio dueño de la app sea
 * el cliente del registro integrado (medido con captura el 11-sep), así que el
 * flujo real va a venir desde otro. Con el portfolio clavado acá, este comando
 * —que es nuestra única forma de mirar— habría impreso exactamente lo mismo que
 * hoy y habría dicho "⏳ falta el QR" con el QR ya escaneado. */
const APP_ID = process.env.META_APP_ID || env.META_APP_ID || "1760442511651410";
const NEGOCIOS = (process.env.META_BUSINESS_ID || env.META_BUSINESS_ID || "2973278776393967")
  .split(/[,;\s]+/).filter(Boolean);
const BUSINESS = NEGOCIOS[0];
const WABA_PRINCIPAL = process.env.META_WABA_ID || env.META_WABA_ID || "295097261637590";
const SECRET = process.env.META_APP_SECRET || env.META_APP_SECRET;
const G = "https://graph.facebook.com/v21.0";
if (!TOKEN) { console.error("Falta META_ACCESS_TOKEN_POTENTE en .env.local"); process.exit(1); }

async function api(path, { method = "GET", body, token = TOKEN } = {}) {
  const url = `${G}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const r = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error(`${path} → (${j.error.code}) ${j.error.message}`);
  return j;
}

async function estado() {
  const yo = await api("me?fields=id,name");
  console.log(`\n🔑 token: ${yo.name} (${yo.id})`);
  /* 🔴 LAS DOS PUNTAS. `owned` son las cuentas del portfolio; `client` las que un
   * portfolio ajeno le compartió a nuestra app. Una cuenta creada por el registro
   * integrado desde el portfolio del cliente aparece SOLO en la segunda: mirar
   * únicamente `owned` es quedarse ciego justo el día que funcione. */
  const vistas = new Set();
  for (const negocio of NEGOCIOS) {
    for (const rel of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
      let wabas;
      try { wabas = await api(`${negocio}/${rel}?fields=id,name,account_review_status`); }
      catch (e) { console.log(`   (no se pudo leer ${rel} de ${negocio}: ${e.message})`); continue; }
      for (const w of wabas.data ?? []) {
        if (vistas.has(w.id)) continue;
        vistas.add(w.id);
        const donde = rel.startsWith("client") ? " · compartida por el cliente" : "";
        console.log(`\n📱 ${w.name}  [${w.id}]  ${w.account_review_status}${donde}`);
        const nums = await api(`${w.id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,platform_type,is_on_biz_app,status,code_verification_status`);
        for (const n of nums.data ?? []) {
          /* ⚠️ `status` OSCILA (medido: 5 lecturas en 24 s dieron DISCONNECTED y luego
           * CONNECTED cuatro veces). El semáforo es platform_type + is_on_biz_app. */
          const ok = n.platform_type === "CLOUD_API" && n.is_on_biz_app === true;
          console.log(`   ${ok ? "✅" : "⏳"} ${n.display_phone_number}  id=${n.id}  platform=${n.platform_type}  en_app=${n.is_on_biz_app}  calidad=${n.quality_rating}${n.status ? "  estado=" + n.status : ""}`);
        }
        if (!(nums.data ?? []).length) console.log("   (sin números todavía)");
        const apps = await api(`${w.id}/subscribed_apps`);
        const nombres = (apps.data ?? []).map((a) => a.whatsapp_business_api_data?.name).filter(Boolean);
        console.log(`   apps suscriptas: ${nombres.length ? nombres.join(", ") : "🔴 NINGUNA (los webhooks no llegan)"}`);
      }
    }
  }
  if (!vistas.size) console.log("\n🔴 ninguna cuenta de WhatsApp visible con este token");
  if (SECRET) {
    const subs = await api(`${APP_ID}/subscriptions`, { token: `${APP_ID}|${SECRET}` });
    console.log("\n🪝 webhook de la app:");
    for (const s of subs.data ?? []) {
      console.log(`   ${s.active ? "✅" : "🔴"} ${s.object} → ${s.callback_url}  campos: ${(s.fields ?? []).map((f) => f.name).join(", ")}`);
    }
    if (!(subs.data ?? []).length) console.log("   🔴 sin configurar");
  } else {
    console.log("\n(sin META_APP_SECRET: no se puede leer el webhook de la app)");
  }
  console.log("\nLeyenda: ✅ = conectado a Cloud API con la app del celular (Coexistence). ⏳ = falta el QR.\n");
}

async function sync(id) {
  if (!/^\d+$/.test(id ?? "")) { console.error("Uso: node scripts/meta.mjs sync <phone_number_id>"); process.exit(1); }
  for (const sync_type of ["smb_app_state_sync", "history"]) {
    try {
      const r = await api(`${id}/smb_app_data`, { method: "POST", body: { messaging_product: "whatsapp", sync_type } });
      console.log(`✅ ${sync_type}: ${JSON.stringify(r)}`);
    } catch (e) {
      console.log(`🔴 ${sync_type}: ${e.message}`);
    }
  }
  console.log("Los datos llegan por el webhook (campos smb_app_state_sync / history), no en esta respuesta.");
}

/**
 * ¿Ya nos habilitó Meta? Todo el conector quedó esperando UNA cosa (25-ago): la
 * verificación del negocio del cliente. Mientras está en `pending`, el registro
 * integrado no incorpora números, el botón "Añadir número" sale gris y los
 * webhooks de Instagram no se entregan. Este comando contesta eso en 3 segundos,
 * sin entrar a ningún panel.
 */
async function verificacion() {
  const neg = await api(`${BUSINESS}?fields=name,verification_status`);
  const waba = await api(`${WABA_PRINCIPAL}?fields=name,business_verification_status,account_review_status,health_status`);
  const listo = neg.verification_status === "verified";
  console.log(`\n🏢 ${neg.name}: verificacion = ${neg.verification_status} ${listo ? "✅" : "⏳"}`);
  console.log(`📱 cuenta de WhatsApp: ${waba.business_verification_status} · revision ${waba.account_review_status}`);
  for (const e of waba.health_status?.entities ?? []) {
    if (e.entity_type !== "WABA") continue;
    for (const err of e.errors ?? []) console.log(`   ⚠️  ${err.error_code}: ${err.error_description}`);
  }
  console.log(listo
    ? "\n✅ HABILITADO: ya se pueden escanear los QR en potentepropiedades.com/conectar\n"
    : "\n⏳ Todavia no. Mientras siga en pending, ninguna pantalla de Meta va a dejar conectar un numero.\n");
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === "estado") await estado();
  else if (cmd === "verificacion") await verificacion();
  else if (cmd === "sync") await sync(arg);
  else { console.log("Uso: node scripts/meta.mjs estado | verificacion | sync <phone_number_id>"); process.exit(1); }
} catch (e) {
  console.error("🔴", e.message);
  process.exit(1);
}
