#!/usr/bin/env node
/**
 * meta-video.mjs — las llamadas que piden los VIDEOS del App Review, en un comando.
 *
 * 1-sep-2026: el flujo "Hacerte proveedor de tecnología" exige dos videos:
 *   · whatsapp_business_messaging  → que se vea TU aplicación enviando un mensaje a un
 *     número de WhatsApp, y la interfaz de WhatsApp donde llega.
 *   · whatsapp_business_management → llamadas de prueba a la API y el proceso de CREAR
 *     una plantilla de mensaje.
 *
 * Todo corre contra el WABA DE PRUEBA de la app (el sandbox de Meta existe justo para
 * esto): no toca la cuenta real de Potente ni manda nada a clientes.
 *
 *   node scripts/meta-video.mjs plantilla            → crea una plantilla UTILITY nueva
 *                                                      (nombre único por corrida) y lista
 *                                                      las plantillas del WABA de prueba
 *   node scripts/meta-video.mjs enviar <numero>      → manda la plantilla hello_world desde
 *                                                      el número de prueba al <numero>
 *                                                      (54922312345678, sin + ni espacios)
 *
 * ⚠️ El número DESTINO tiene que estar en la lista de destinatarios del número de prueba
 * (consola de la app → WhatsApp → Paso 1 "Probar" → agregar número y verificar el código).
 * Meta solo deja hasta 5, y es a mano — no hay API para eso.
 *
 * Lee META_ACCESS_TOKEN_POTENTE de .env.local. Nunca imprime la clave.
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
if (!TOKEN) { console.error("Falta META_ACCESS_TOKEN_POTENTE en .env.local"); process.exit(1); }

const G = "https://graph.facebook.com/v21.0";
const WABA_PRUEBA = "1717595812687808";      // "Test WhatsApp Business Account" de la app
const NUMERO_PRUEBA = "1260203483845197";    // phone_number_id del +1 555-677-6560

async function api(metodo, ruta, body) {
  const r = await fetch(`${G}/${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (j.error) throw new Error(`${metodo} ${ruta.split("?")[0]} → ${j.error.message}`);
  return j;
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === "plantilla") {
  // Nombre único por corrida: así la verificación de hoy y la toma del video no chocan.
  const nombre = `confirmacion_visita_${Date.now().toString(36)}`;
  console.log(`\n📋 Creando la plantilla "${nombre}" en el WABA de prueba…`);
  const creada = await api("POST", `${WABA_PRUEBA}/message_templates`, {
    name: nombre,
    category: "UTILITY",
    language: "es_AR",
    components: [
      { type: "BODY",
        text: "Hola {{1}}, le confirmamos la visita a la propiedad {{2}} el día {{3}} a las {{4}} hs. Ante cualquier duda, responda este mensaje.",
        example: { body_text: [["Carlos", "POT-123456", "viernes 5", "15:00"]] } },
      { type: "FOOTER", text: "Potente Propiedades · Mar del Plata" },
    ],
  });
  console.log(`   ✅ creada · id=${creada.id} · estado=${creada.status}`);
  console.log("\n📚 Plantillas del WABA de prueba:");
  const lista = await api("GET", `${WABA_PRUEBA}/message_templates?fields=name,status,category&limit=10`);
  for (const t of lista.data) console.log(`   · ${t.name}  [${t.category}]  ${t.status}`);
  console.log("");
} else if (cmd === "enviar") {
  if (!arg) { console.error("Uso: node scripts/meta-video.mjs enviar 549223XXXXXXX"); process.exit(1); }
  console.log(`\n📤 Enviando hello_world desde el número de prueba a +${arg}…`);
  const r = await api("POST", `${NUMERO_PRUEBA}/messages`, {
    messaging_product: "whatsapp",
    to: arg,
    type: "template",
    template: { name: "hello_world", language: { code: "en_US" } },
  });
  console.log(`   ✅ aceptado por la API · message_id=${r.messages?.[0]?.id ?? "?"}`);
  console.log("   → Ahora mirá el WhatsApp de ese número: el mensaje tiene que estar llegando.\n");
} else {
  console.log("Uso: node scripts/meta-video.mjs plantilla | enviar <numero>");
}
