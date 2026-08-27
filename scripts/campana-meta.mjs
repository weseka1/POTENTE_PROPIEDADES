/**
 * ARMA LA CAMPAÑA DE META CON LAS PUBLICACIONES QUE YA EXISTEN.
 * ─────────────────────────────────────────────────────────────────────────────
 *   node scripts/campana-meta.mjs --dry     mira y no crea nada
 *   node scripts/campana-meta.mjs           crea todo EN PAUSA
 *
 * 27-ago. Mateo pidió una campaña con varios creativos, todo con publicaciones
 * existentes (no piezas nuevas: los posts que ya tiene, con sus likes y sus
 * comentarios). Y Juani quiere promocionar el reel donde se muestra la web.
 *
 * ── POR QUÉ UN SCRIPT Y NO CLICKS ───────────────────────────────────────────
 * Regla de la casa: Meta siempre por API. Un script se lee, se repite, se
 * corrige y deja escrito QUÉ se creó — un recorrido de 40 clicks no.
 *
 * ── LO QUE HACE ─────────────────────────────────────────────────────────────
 *   Campaña 1 · "La web"        → tráfico a potentepropiedades.com
 *   Campaña 2 · "Consultas IG"  → mensajes al Instagram (caen en el panel, y
 *                                 Marina deriva al WhatsApp de la oficina)
 * Cada una con su conjunto (Mar del Plata + 25 km) y un anuncio por publicación.
 *
 * 🔴 TODO NACE EN PAUSA. Nada entrega hasta que alguien lo active a mano, y la
 * cuenta encima no tiene medio de pago todavía: no hay forma de que gaste sola.
 * 🔴 Y NO se crea nada dos veces: antes de crear busca por nombre. Correrlo de
 * nuevo no duplica campañas.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const API = "https://graph.facebook.com/v21.0";

// ── Config ───────────────────────────────────────────────────────────────────
const CUENTA = "act_1005502392515666";        // Potente Publicidad
const GEO_MDP = "87974";                       // Mar del Plata, Buenos Aires
const DIARIO = 500000;                         // ARS 5.000 en centavos (la cuenta es ARS)
const SITIO = "https://potentepropiedades.com";

/** Las publicaciones a promocionar. Los ids salen de /{ig}/media (ver README). */
const CREATIVOS = {
  web: [
    { id: "17902740117329683", nota: "Reel 19-ago · la web nueva (52 likes, el mejor de la cuenta)" },
  ],
  propiedades: [
    { id: "17966496825153594", nota: "Reel 7-ago · 2 amb frente a Plaza Güemes (38)" },
    { id: "18081137675647880", nota: "Reel 26-jun · ¿vendés o alquilás? — captación (36)" },
    { id: "18105886858858905", nota: "Reel 24-jul · más que un lugar para vivir (22)" },
    { id: "18132723268592154", nota: "Reel 4-jul · media cuadra de la costa (17)" },
  ],
};

const env = {};
for (const l of readFileSync(path.join(RAIZ, ".env.local"), "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const TOKEN = env.META_ACCESS_TOKEN_POTENTE;
const PAGE = env.META_PAGE_ID;
const IG = env.META_IG_ID;
if (!TOKEN || !PAGE || !IG) { console.error("🔴 Faltan META_ACCESS_TOKEN_POTENTE / META_PAGE_ID / META_IG_ID en .env.local"); process.exit(1); }

// ── Graph ────────────────────────────────────────────────────────────────────
async function graph(ruta, campos, metodo = "POST") {
  const cuerpo = new URLSearchParams({ ...campos, access_token: TOKEN });
  const url = metodo === "GET" ? `${API}/${ruta}?${cuerpo}` : `${API}/${ruta}`;
  const r = await fetch(url, metodo === "GET" ? {} : { method: "POST", body: cuerpo });
  const j = await r.json().catch(() => ({}));
  if (j.error) {
    const e = j.error;
    throw new Error(`${e.error_user_title || e.message}${e.error_user_msg ? ` — ${e.error_user_msg}` : ""}`);
  }
  return j;
}

/** Crea solo si no existe uno con ese nombre (correrlo dos veces no duplica). */
async function crear(coleccion, nombre, campos) {
  const ya = await graph(`${CUENTA}/${coleccion}`, { fields: "id,name", limit: "200" }, "GET");
  const previo = (ya.data ?? []).find((x) => x.name === nombre);
  if (previo) { console.log(`   = ya existía: ${nombre} (${previo.id})`); return previo.id; }
  if (DRY) { console.log(`   + [dry] ${coleccion}: ${nombre}`); return `dry-${coleccion}`; }
  const { id } = await graph(`${CUENTA}/${coleccion}`, { name: nombre, ...campos });
  console.log(`   + ${nombre} → ${id}`);
  return id;
}

// ── Las piezas ───────────────────────────────────────────────────────────────
const campania = (nombre, objetivo) =>
  crear("campaigns", nombre, {
    objective: objetivo,
    status: "PAUSED",
    special_ad_categories: "[]",
    // Meta lo exige desde v21: false = cada conjunto maneja su propio presupuesto.
    is_adset_budget_sharing_enabled: "false",
  });

/** Mar del Plata y 25 km a la redonda: la zona real donde opera Potente. */
const publico = {
  geo_locations: { cities: [{ key: GEO_MDP, radius: 25, distance_unit: "kilometer" }] },
  age_min: 25,
  age_max: 65,
  targeting_relaxation_types: { lookalike: 0, custom_audience: 0 },
};

const conjunto = (nombre, campaignId, extra) =>
  crear("adsets", nombre, {
    campaign_id: campaignId,
    daily_budget: String(DIARIO),
    billing_event: "IMPRESSIONS",
    // 🔴 Meta EXIGE decir cómo se puja. "El costo más bajo, sin tope" es lo que
    // corresponde para empezar: Meta gasta el presupuesto buscando el resultado
    // más barato, sin que nadie tenga que adivinar un valor por click. Poner un
    // tope acá, a ciegas y sin histórico, es la forma clásica de que un anuncio
    // no entregue y parezca que "no funciona".
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify(publico),
    status: "PAUSED",
    ...extra,
  });

/**
 * Un anuncio con una publicación de Instagram QUE YA EXISTE: no se recrea la
 * pieza, se promociona el post tal cual, así conserva sus likes y comentarios
 * (la prueba social es parte de lo que vende).
 */
const faltaron = [];

async function anuncio(nombre, adsetId, mediaId, cta) {
  /* 🔴 La forma que Meta acepta para un post de IG existente (medida el 27-ago
   * probando las tres variantes con `validate_only`):
   *   · `instagram_user_id` en la RAÍZ + `source_instagram_media_id` + el CTA.
   *   · Con `object_story_spec.page_id` encima → "el campo link es obligatorio".
   *   · Con `link_data` → "el objeto que intentás promocionar es ambiguo".
   * El link del destino va DENTRO del call_to_action, no suelto. */
  const creativo = {
    instagram_user_id: IG,
    source_instagram_media_id: mediaId,
    ...(cta ? { call_to_action: JSON.stringify(cta) } : {}),
  };
  if (DRY) { console.log(`   + [dry] anuncio: ${nombre}`); return; }
  try {
    const { id: creativeId } = await graph(`${CUENTA}/adcreatives`, { name: `${nombre} · creativo`, ...creativo });
    await crear("ads", nombre, { adset_id: adsetId, creative: JSON.stringify({ creative_id: creativeId }), status: "PAUSED" });
  } catch (e) {
    /* 🔴 27-ago, medido: promocionar una publicación de Instagram por API exige
     * que LA APP esté publicada. La nuestra sigue en modo desarrollo esperando la
     * verificación del negocio — el mismo portón que frena WhatsApp. Los conjuntos
     * quedan creados y los anuncios se agregan con "Usar publicación existente"
     * desde el Administrador, o por acá el día que la app salga a producción.
     * No se traga el error: se dice cuál es y se sigue con los demás. */
    const modoDev = /modo de desarrollo|development mode/i.test(e.message);
    console.log(`   ! ${nombre}: ${modoDev ? "la app sigue en modo desarrollo (falta la verificación de Meta)" : e.message.slice(0, 90)}`);
    faltaron.push(nombre);
  }
}

// ── Manos a la obra ──────────────────────────────────────────────────────────
console.log(`\n📣 Campaña de Potente en ${CUENTA}${DRY ? "  (SIMULACIÓN)" : ""}\n`);

try {
  // 1 · La web
  console.log("1/2 · Tráfico a la web");
  const c1 = await campania("POTENTE · La web", "OUTCOME_TRAFFIC");
  const a1 = await conjunto("Mar del Plata · 25-65 · web", c1, {
    optimization_goal: "LANDING_PAGE_VIEWS",
    destination_type: "WEBSITE",
  });
  for (const [i, c] of CREATIVOS.web.entries()) {
    await anuncio(`Web · ${i + 1} · ${c.nota.slice(0, 40)}`, a1, c.id, { type: "LEARN_MORE", value: { link: SITIO } });
  }

  // 2 · Consultas por Instagram (caen en el panel; Marina deriva al WhatsApp de la oficina)
  console.log("\n2/2 · Consultas por Instagram");
  const c2 = await campania("POTENTE · Consultas por Instagram", "OUTCOME_ENGAGEMENT");
  const a2 = await conjunto("Mar del Plata · 25-65 · mensajes", c2, {
    optimization_goal: "CONVERSATIONS",
    destination_type: "INSTAGRAM_DIRECT",
    promoted_object: JSON.stringify({ page_id: PAGE }),
  });
  for (const [i, c] of CREATIVOS.propiedades.entries()) {
    await anuncio(`IG · ${i + 1} · ${c.nota.slice(0, 40)}`, a2, c.id, { type: "MESSAGE_PAGE" });
  }

  /* El resumen dice lo que REALMENTE quedó. Un "listo" con anuncios faltando es
   * la clase de mentira que hace que alguien active una campaña vacía. */
  console.log(`\n${faltaron.length ? "⚠️" : "✅"}  Estructura ${DRY ? "simulada (no se creó nada)" : "creada, TODO EN PAUSA"}.`);
  if (!DRY && faltaron.length) {
    console.log(`\n🔴 ${faltaron.length} anuncios NO se pudieron crear por API: la app de Meta sigue en modo`);
    console.log("   desarrollo (es el mismo portón que frena WhatsApp: falta la verificación del negocio).");
    console.log("   Dos salidas:");
    console.log("     · agregarlos a mano: entrar al conjunto → Crear anuncio → 'Usar publicación existente';");
    console.log("     · o volver a correr este script el día que Meta apruebe — no duplica lo ya creado.");
  }
  if (!DRY) {
    console.log("\n   Y para que entregue falta el medio de pago en la cuenta (hoy: ninguno).");
    console.log(`   https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${CUENTA.replace("act_", "")}`);
  }
} catch (e) {
  console.error(`\n🔴 ${e.message}`);
  console.error("   Lo que se creó antes del error queda EN PAUSA; correr de nuevo no lo duplica (busca por nombre).");
  process.exit(1);
}
