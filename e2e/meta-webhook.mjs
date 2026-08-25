/**
 * LOS CANALES DE MATEO ENTRAN BIEN — y no entran dos veces.
 *
 * Prueba el webhook de Meta SIN Meta: se arman los payloads reales de WhatsApp e
 * Instagram y se firman con el mismo secreto que usa el server. Así la ingesta
 * se puede verificar hoy, meses antes de que Meta apruebe la conexión de las
 * cuentas del cliente.
 *
 * 🔴 La aserción que más importa es la de IDEMPOTENCIA: Meta REENVÍA el mismo
 * mensaje ante cualquier timeout nuestro. Sin eso, Mateo ve la misma consulta
 * dos y tres veces y deja de confiar en la bandeja.
 *
 *   APP=http://localhost:3000 node e2e/meta-webhook.mjs
 *
 * Necesita en el entorno (los lee del .env.local igual que el server):
 *   META_APP_SECRET · META_VERIFY_TOKEN
 * Si no están, la suite lo dice y se saltea en vez de dar un rojo que confunde.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP || "http://localhost:3000";

const env = {};
try {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (l.includes("=") && !l.trim().startsWith("#")) {
      const i = l.indexOf("=");
      env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    }
  }
} catch { /* sin .env.local: se usa process.env */ }
const leer = (k) => process.env[k] || env[k] || "";

const APP_SECRET = leer("META_APP_SECRET");
const VERIFY_TOKEN = leer("META_VERIFY_TOKEN");

let ok = 0;
const fallos = [];
const chequear = (nombre, cond, detalle = "") => {
  if (cond) { ok++; console.log(`PASS  ${nombre}${detalle ? ` :: ${detalle}` : ""}`); }
  else { fallos.push(`${nombre} — ${detalle}`); console.log(`FAIL  ${nombre} :: ${detalle}`); }
};

if (!APP_SECRET || !VERIFY_TOKEN) {
  console.log("\n⏭️  META_APP_SECRET / META_VERIFY_TOKEN sin configurar — la suite se saltea.");
  console.log("   (No es un fallo: sin esas dos, el webhook está apagado a propósito.)\n");
  process.exit(0);
}

/* Sello único por corrida: los ids de sonda no pueden chocar entre corridas ni
 * con datos reales. */
const SELLO = `E2E-${Date.now()}`;
const TEL_SONDA = `54900000${String(Date.now()).slice(-6)}`;
const TEL_SONDA_2 = `54900001${String(Date.now()).slice(-6)}`; // el número al que la oficina escribe primero
const TEL_OFICINA = "5492235129032"; // Chauvín: el `from` de los ecos
const IG_SONDA = `179000000${String(Date.now()).slice(-7)}`; // IGSID del visitante
const IG_NEGOCIO = "17841404222256569";      // @potentepropiedades

const firmar = (cuerpo) => "sha256=" + createHmac("sha256", APP_SECRET).update(cuerpo).digest("hex");

const postear = async (obj, firma) => {
  const cuerpo = JSON.stringify(obj);
  const r = await fetch(APP + "/api/meta/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": firma ?? firmar(cuerpo) },
    body: cuerpo,
    signal: AbortSignal.timeout(30_000),
  });
  return { status: r.status, texto: await r.text().catch(() => "") };
};

/** El payload real que manda WhatsApp Cloud API cuando alguien escribe. */
const payloadWhatsApp = (mensajeId, texto, tel = TEL_SONDA) => ({
  object: "whatsapp_business_account",
  entry: [{
    id: "SONDA",
    changes: [{
      field: "messages",
      value: {
        messaging_product: "whatsapp",
        contacts: [{ profile: { name: "Sonda E2E" }, wa_id: tel }],
        messages: [{ from: tel, id: mensajeId, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: texto } }],
      },
    }],
  }],
});

/** Lo que manda Meta cuando la oficina contesta DESDE LA APP (Coexistence). */
const payloadEco = (mensajeId, texto, tel = TEL_SONDA) => ({
  object: "whatsapp_business_account",
  entry: [{
    id: "SONDA",
    changes: [{
      field: "smb_message_echoes",
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: TEL_OFICINA, phone_number_id: "961292850997751" },
        message_echoes: [{ from: TEL_OFICINA, to: tel, id: mensajeId, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: texto } }],
      },
    }],
  }],
});

/** Un trozo de historial: mensajes viejos de un hilo, en el orden que a Meta se le ocurra. */
const payloadHistoria = (mensajes, tel = TEL_SONDA) => ({
  object: "whatsapp_business_account",
  entry: [{
    id: "SONDA",
    changes: [{
      field: "history",
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: TEL_OFICINA, phone_number_id: "961292850997751" },
        history: [{
          metadata: { phase: "0", chunk_order: "1", progress: "100" },
          threads: [{ id: tel, messages: mensajes.map((m) => ({ from: m.deOficina ? TEL_OFICINA : tel, to: m.deOficina ? tel : TEL_OFICINA, id: m.id, timestamp: String(m.ts), type: "text", text: { body: m.texto }, history_context: { status: "read" } })) }],
        }],
      },
    }],
  }],
});

/** Un DM de Instagram. `eco: true` = lo que la oficina responde desde la app de IG:
 *  ahí el que manda es el negocio y el hilo es del DESTINATARIO. */
const payloadIG = (mid, texto, { eco = false } = {}) => ({
  object: "instagram",
  entry: [{
    id: IG_NEGOCIO,
    time: Date.now(),
    messaging: [{
      sender: { id: eco ? IG_NEGOCIO : IG_SONDA, ...(eco ? {} : { username: "sonda_ig" }) },
      recipient: { id: eco ? IG_SONDA : IG_NEGOCIO },
      timestamp: Date.now(),
      message: { mid, text: texto, ...(eco ? { is_echo: true } : {}) },
    }],
  }],
});

// ── Cliente de base para VERIFICAR lo guardado (entra como la dirección) ─────
const sb = createClient(leer("VITE_SUPABASE_URL"), leer("VITE_SUPABASE_ANON_KEY"));
const { error: eLogin } = await sb.auth.signInWithPassword({
  email: "mateo@potenteprop.com.ar",
  password: leer("PANEL_MATEO_PASS"),
});
if (eLogin) { console.log(`\n⏭️  No se pudo entrar como la dirección (${eLogin.message}) — la suite se saltea.\n`); process.exit(0); }

const convsDeLaSonda = async () => {
  const { data } = await sb.from("potente_conversaciones").select("id,canal,nombre,contacto,mensajes,estado,noLeida").eq("contacto", TEL_SONDA);
  return data ?? [];
};
const convsDeIG = async () => {
  const { data } = await sb.from("potente_conversaciones").select("id,canal,nombre,contacto,mensajes,estado,noLeida").eq("contacto", IG_SONDA);
  return data ?? [];
};
const convsDeLaSonda2 = async () => {
  const { data } = await sb.from("potente_conversaciones").select("id,canal,nombre,contacto,mensajes,estado,noLeida").eq("contacto", TEL_SONDA_2);
  return data ?? [];
};

/** Barrido: al arrancar Y en el finally. Una corrida cortada no puede dejar
 *  basura en la bandeja de un cliente que la mira todos los días. */
const limpiar = async () => {
  const filas = [...(await convsDeLaSonda()), ...(await convsDeLaSonda2()), ...(await convsDeIG())];
  for (const f of filas) await sb.from("potente_conversaciones").delete().eq("id", f.id);
};

console.log(`\n📨 Webhook de canales contra ${APP}\n`);

try {
  await limpiar();

  /* 1 · La verificación inicial de Meta (el GET con hub.challenge) */
  const okVerif = await fetch(`${APP}/api/meta/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY_TOKEN)}&hub.challenge=${SELLO}`, { signal: AbortSignal.timeout(20_000) });
  const textoVerif = await okVerif.text();
  chequear("🔑 La verificación de Meta devuelve el challenge en texto plano",
    okVerif.status === 200 && textoVerif.trim() === SELLO, `HTTP ${okVerif.status} · "${textoVerif.slice(0, 40)}"`);

  const malVerif = await fetch(`${APP}/api/meta/webhook?hub.mode=subscribe&hub.verify_token=token-que-no-es&hub.challenge=${SELLO}`, { signal: AbortSignal.timeout(20_000) });
  chequear("…y con un token que no es el nuestro, 403",
    malVerif.status === 403, `HTTP ${malVerif.status}`);

  /* 2 · 🔴 FIRMA INVÁLIDA: se rechaza Y no se escribe NADA */
  const rMal = await postear(payloadWhatsApp(`${SELLO}-MAL`, "mensaje sin firmar"), "sha256=" + "0".repeat(64));
  chequear("🔴 Un pedido con firma inválida se rechaza (401)", rMal.status === 401, `HTTP ${rMal.status}`);
  await new Promise((r) => setTimeout(r, 1500));
  chequear("🔴 …y NO escribió nada en la base", (await convsDeLaSonda()).length === 0,
    `quedaron ${(await convsDeLaSonda()).length} conversaciones`);

  /* 3 · Un mensaje legítimo entra y crea la conversación */
  const r1 = await postear(payloadWhatsApp(`${SELLO}-1`, "Hola, vi una casa en Punta Mogotes"));
  chequear("Un mensaje firmado se acepta (200 inmediato)", r1.status === 200, `HTTP ${r1.status}`);
  await new Promise((r) => setTimeout(r, 2500));
  let convs = await convsDeLaSonda();
  chequear("📥 Aparece UNA conversación nueva en la bandeja", convs.length === 1, `hay ${convs.length}`);
  chequear("…con el canal, el nombre del perfil y el texto correctos",
    convs[0]?.canal === "whatsapp" && convs[0]?.nombre === "Sonda E2E" && convs[0]?.mensajes?.[0]?.texto?.includes("Punta Mogotes"),
    JSON.stringify({ canal: convs[0]?.canal, nombre: convs[0]?.nombre, msgs: convs[0]?.mensajes?.length }));
  chequear("…marcada como NO leída (para que Mateo la vea)", convs[0]?.noLeida !== false, `noLeida=${convs[0]?.noLeida}`);

  /* 4 · 🔴 LA PRUEBA QUE MÁS IMPORTA: el mismo mensaje dos veces = uno solo.
   * Meta reenvía ante cualquier timeout nuestro. */
  const r2 = await postear(payloadWhatsApp(`${SELLO}-1`, "Hola, vi una casa en Punta Mogotes"));
  chequear("Un reenvío de Meta también se acusa con 200", r2.status === 200, `HTTP ${r2.status}`);
  await new Promise((r) => setTimeout(r, 2500));
  convs = await convsDeLaSonda();
  chequear("🔴 IDEMPOTENCIA: el mismo mensaje dos veces NO se duplica",
    convs.length === 1 && convs[0]?.mensajes?.length === 1,
    `${convs.length} conversaciones · ${convs[0]?.mensajes?.length} mensajes`);

  /* 5 · Un segundo mensaje del mismo contacto se suma al MISMO hilo */
  await postear(payloadWhatsApp(`${SELLO}-2`, "¿Sigue disponible?"));
  await new Promise((r) => setTimeout(r, 2500));
  convs = await convsDeLaSonda();
  chequear("💬 El segundo mensaje se agrega al mismo hilo, no abre otro",
    convs.length === 1 && convs[0]?.mensajes?.length === 2,
    `${convs.length} conversaciones · ${convs[0]?.mensajes?.length} mensajes`);

  /* 6 · Los eventos que NO son mensajes se ignoran sin romper nada */
  const rAcuse = await postear({
    object: "whatsapp_business_account",
    entry: [{ id: "SONDA", changes: [{ field: "messages", value: { messaging_product: "whatsapp", statuses: [{ id: "wamid.x", status: "delivered" }] } }] }],
  });
  chequear("Un acuse de entrega se ignora en silencio (200, sin escribir)", rAcuse.status === 200, `HTTP ${rAcuse.status}`);
  await new Promise((r) => setTimeout(r, 1500));
  chequear("…y la bandeja quedó igual", (await convsDeLaSonda())[0]?.mensajes?.length === 2, "sin cambios");

  /* 7 · Un audio no entra vacío: se dice qué era */
  await postear({
    object: "whatsapp_business_account",
    entry: [{ id: "SONDA", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      contacts: [{ profile: { name: "Sonda E2E" }, wa_id: TEL_SONDA }],
      messages: [{ from: TEL_SONDA, id: `${SELLO}-AUDIO`, timestamp: String(Math.floor(Date.now() / 1000)), type: "audio", audio: { id: "x" } }],
    } }] }],
  });
  await new Promise((r) => setTimeout(r, 2500));
  const ultimo = (await convsDeLaSonda())[0]?.mensajes?.slice(-1)[0]?.texto ?? "";
  chequear("🎤 Un audio no queda vacío: dice que era un mensaje de voz",
    /voz|audio/i.test(ultimo), `"${ultimo.slice(0, 50)}"`);

  /* 8 · Las oficinas siguen sin ver nada (la 015 intacta) */
  const sbOf = createClient(leer("VITE_SUPABASE_URL"), leer("VITE_SUPABASE_ANON_KEY"));
  const { error: eOf } = await sbOf.auth.signInWithPassword({ email: "chauvin@potenteprop.com.ar", password: leer("PANEL_CHAUVIN_PASS") });
  if (!eOf) {
    const { data: dOf } = await sbOf.from("potente_conversaciones").select("id").eq("contacto", TEL_SONDA);
    chequear("🔒 Una oficina NO ve la conversación que acaba de entrar", (dOf ?? []).length === 0, `leyó ${(dOf ?? []).length}`);
    await sbOf.auth.signOut();
  } else {
    console.log("      (no se pudo probar la oficina: sin PANEL_CHAUVIN_PASS)");
  }
  /* 7 · 🔴 ECOS (019): lo que la oficina contesta desde la app entra al MISMO hilo como 'humano' */
  await postear(payloadEco(`${SELLO}-ECO`, "Sí, sigue disponible. ¿Cuándo le queda cómodo verla?"));
  await new Promise((r) => setTimeout(r, 2500));
  convs = await convsDeLaSonda();
  const eco = convs[0]?.mensajes?.find((m) => m.id === `${SELLO}-ECO`);
  chequear("💬 La respuesta de la oficina desde la app (eco) entra al MISMO hilo como 'humano'",
    convs.length === 1 && eco?.de === "humano" && eco?.texto?.includes("disponible"),
    `${convs.length} conversaciones · de=${eco?.de ?? "no entró"}`);
  chequear("…y la conversación pasa a 'vos' (la está atendiendo una persona)", convs[0]?.estado === "vos", `estado=${convs[0]?.estado}`);

  /* 8 · Un eco a un número NUEVO (la oficina escribe primero) abre la conversación LEÍDA */
  await postear(payloadEco(`${SELLO}-ECO-NUEVO`, "Buen día, le escribo por la tasación", TEL_SONDA_2));
  await new Promise((r) => setTimeout(r, 2500));
  const convs2 = await convsDeLaSonda2();
  chequear("📤 Un eco a un número nuevo abre su conversación, en 'vos' y sin marcar no leída",
    convs2.length === 1 && convs2[0]?.estado === "vos" && convs2[0]?.noLeida === false && convs2[0]?.mensajes?.[0]?.de === "humano",
    JSON.stringify({ n: convs2.length, estado: convs2[0]?.estado, noLeida: convs2[0]?.noLeida }));

  /* 9 · 🔴 HISTORIAL (019): entra con su fecha real, ordenado, y no cuenta como novedad */
  const hace30d = Math.floor(Date.now() / 1000) - 30 * 86400;
  await sb.from("potente_conversaciones").update({ noLeida: false }).eq("id", convs[0].id);
  await postear(payloadHistoria([
    { id: `${SELLO}-H2`, ts: hace30d + 600, texto: "Le paso las fotos por acá", deOficina: true },
    { id: `${SELLO}-H1`, ts: hace30d, texto: "Hola, ¿tienen algo en Playa Grande?", deOficina: false },
  ]));
  await new Promise((r) => setTimeout(r, 3000));
  convs = await convsDeLaSonda();
  const ids = (convs[0]?.mensajes ?? []).map((m) => m.id);
  const h1 = convs[0]?.mensajes?.find((m) => m.id === `${SELLO}-H1`);
  chequear("🕰️ El historial entra con su fecha real (hace 30 días), no con la de hoy",
    h1 && Math.abs(new Date(h1.horaISO).getTime() / 1000 - hace30d) < 5 && h1.de === "cliente",
    h1 ? `${h1.horaISO} · de=${h1.de}` : "no entró");
  chequear("…queda ORDENADO por hora aunque Meta lo mande desordenado (H1 antes que H2, y ambos antes que lo de hoy)",
    ids.indexOf(`${SELLO}-H1`) === 0 && ids.indexOf(`${SELLO}-H2`) === 1 && ids.indexOf(`${SELLO}-1`) > 1,
    ids.join(" → "));
  chequear("…y NO marca la conversación como no leída (es pasado, no novedad)", convs[0]?.noLeida === false, `noLeida=${convs[0]?.noLeida}`);
  /* 10 · 📸 INSTAGRAM: un DM entra a la bandeja como cualquier consulta */
  await postear(payloadIG(`${SELLO}-IG1`, "Hola! vi el depto de Playa Grande en el feed"));
  await new Promise((r) => setTimeout(r, 2500));
  let ig = await convsDeIG();
  chequear("📸 Un DM de Instagram entra a la bandeja, marcado como del cliente",
    ig.length === 1 && ig[0]?.canal === "instagram" && ig[0]?.mensajes?.[0]?.de === "cliente" && ig[0]?.noLeida === true,
    JSON.stringify({ n: ig.length, canal: ig[0]?.canal, de: ig[0]?.mensajes?.[0]?.de, noLeida: ig[0]?.noLeida }));
  chequear("…con el usuario de Instagram como nombre", ig[0]?.nombre === "sonda_ig", `nombre=${ig[0]?.nombre}`);

  /* 11 · 🔴 El eco de IG (la oficina contesta desde Instagram) va al MISMO hilo */
  await postear(payloadIG(`${SELLO}-IG2`, "¡Hola! Sí, sigue disponible. Te paso los valores por acá.", { eco: true }));
  await new Promise((r) => setTimeout(r, 2500));
  ig = await convsDeIG();
  const igEco = ig[0]?.mensajes?.find((m) => m.id === `${SELLO}-IG2`);
  chequear("🔴 La respuesta desde Instagram (eco) entra al MISMO hilo como 'humano', no abre otro",
    ig.length === 1 && igEco?.de === "humano" && ig[0]?.estado === "vos",
    `${ig.length} conversaciones · de=${igEco?.de ?? "no entró"} · estado=${ig[0]?.estado}`);

} finally {
  await limpiar();
  console.log("  (conversaciones de sonda borradas)");
  await sb.auth.signOut();
}

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
if (fallos.length) { console.log("FALLARON:"); fallos.forEach((f) => console.log(" - " + f)); }
process.exit(fallos.length ? 1 : 0);
