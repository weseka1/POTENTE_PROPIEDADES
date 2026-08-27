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
 * 🔴 La prueba de la PAUSA apaga a Marina de verdad (~25 s: la caché del server dura
 * 20 s). Contra PRODUCCIÓN no se corre: es el sitio de un cliente que la usa a
 * diario, y además dejaba en falso rojo a cualquier suite que corriera detrás
 * (`marina.mjs` acusó 3 fallos por esto el 27-ago). Va solo en local, o con
 * `PERMITIR_PAUSA=1` a sabiendas.
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

/* El cupo del asistente es por IP y por minuto, y lo COMPARTEN todas las suites:
 * `marina.mjs` lo agota a propósito para probar que agotarlo no rompe la atención.
 * Si esta corre detrás, Marina contesta el mensaje de "estoy atendiendo a varias
 * personas" — que es lo correcto, no un bug. Se espera el minuto y se reintenta;
 * la pausa (`pausada:true`) NO se reintenta: esa sí es una respuesta válida. */
const postAsistente = async (body, reintentos = 2) => {
  const r = await fetch(`${APP}/api/asistente`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await r.json().catch(() => ({}));
  if (json?.degradado && !json?.pausada && reintentos > 0) {
    console.log("   (cupo compartido agotado: espero el minuto y reintento)");
    await new Promise((x) => setTimeout(x, 62_000));
    return postAsistente(body, reintentos - 1);
  }
  return { status: r.status, json };
};
const postManychat = (body) => fetch(`${APP}/api/ingesta/manychat`, { method: "POST", headers: { "content-type": "application/json", "x-manychat-token": env.MANYCHAT_TOKEN }, body: JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
const leerConv = async (contacto) => (await sb.from("potente_conversaciones").select("id,canal,nombre,contacto,estado,motivo,mensajes,leadId,propiedadId,borrador,externo").eq("contacto", contacto)).data ?? [];

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
let seTocoLaConfig = false;
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

  // ── 4b · 023 · EL MODO MANDA (solo local: cambiar el modo afecta al cliente) ─
  // En supervisado Marina redacta y NO envía: deja el borrador y pasa el hilo a
  // una persona. Es el pedido textual de Juani del 27-ago.
  const localModo = /localhost|127\.0\.0\.1/.test(APP);
  if (!localModo && process.env.PERMITIR_PAUSA !== "1") {
    console.log("⏭️  La prueba del modo supervisado se saltea contra producción (cambiaría el modo del cliente ~20 s).");
  } else {
    const IG2 = `sonda_sup_${SELLO}`;
    try {
      seTocoLaConfig = true;
      await sb.from("potente_ia_config").upsert({ id: true, cfg: { ...cfgOriginal, activa: true, modo: "supervisado" } });
      await espera(21_000);                                  // la caché del cerebro dura 20 s
      const dm = await postManychat({ canal: "instagram", contacto: `@${IG2}`, nombre: "Sonda Supervisada", texto: "Hola, ¿tienen algo en alquiler en Chauvín?", subscriber_id: "999999997" });
      chequear("📸 En supervisado, el DM entra igual", dm.status === 200 && dm.json.guardados === 1, `HTTP ${dm.status}`);
      let hiloSup = null;
      for (let i = 0; i < 12 && !hiloSup?.borrador; i++) { await espera(2000); hiloSup = (await leerConv(IG2))[0] ?? null; }
      chequear("✍️  Marina REDACTA y deja el borrador esperando el OK",
        Boolean(hiloSup?.borrador && hiloSup.borrador.length > 20), `borrador: ${String(hiloSup?.borrador ?? "").slice(0, 70)}`);
      chequear("…y NO envía nada (ningún mensaje de la IA en el hilo)",
        hiloSup && !hiloSup.mensajes.some((m) => m.de === "ia"), `mensajes: ${hiloSup?.mensajes?.map((m) => m.de).join(",")}`);
      chequear("…y el hilo queda en manos de una persona, con el motivo",
        hiloSup?.estado === "vos" && /supervisado|OK/i.test(hiloSup?.motivo ?? ""), `estado=${hiloSup?.estado} · ${String(hiloSup?.motivo ?? "").slice(0, 60)}`);

      /* 🔴 La derivación por oficina (pedido de Juani): si Marina recomienda una
       * propiedad, el DM tiene que llevar el WhatsApp de la oficina QUE LA
       * ATIENDE. Se afirma la invariante, no un número fijo: la cartera es viva
       * y no se sabe de antemano qué va a recomendar. */
      const borrador = String(hiloSup?.borrador ?? "");
      const recomienda = /\/propiedad\//.test(borrador);
      const OFICIALES = ["5492235129032", "5492235851198", "5492233029591"];   // Chauvín · Mogotes · central
      const wa = borrador.match(/wa\.me\/(\d+)/g)?.map((x) => x.replace("wa.me/", "")) ?? [];
      chequear("📞 Si recomienda una propiedad, el DM lleva WhatsApp para derivar",
        !recomienda || wa.length > 0, recomienda ? `wa: ${wa.join(", ") || "NINGUNO"}` : "no recomendó (no aplica)");
      chequear("…y es un número REAL de Potente, nunca uno inventado",
        wa.every((n) => OFICIALES.includes(n)), `wa: ${wa.join(", ") || "sin links"}`);
    } finally {
      for (const f of await leerConv(IG2)) await sb.from("potente_conversaciones").delete().eq("id", f.id);
      await sb.from("potente_ia_config").upsert({ id: true, cfg: cfgOriginal });
    }
  }

  // ── 4c · Un contacto SIN enlazar avisa por qué; nunca "abre Instagram" ─────
  // Se siembra un hilo de Instagram sin subscriber_id (como los que entraron
  // antes de la 021): el server lo busca en ManyChat, no lo encuentra, y lo dice.
  {
    const SIN = `sonda_sin_${SELLO}`;
    try {
      await postManychat({ canal: "instagram", contacto: `@${SIN}`, nombre: "Sonda Sin Enlace", texto: "hola" });
      await espera(1000);
      const hilo = (await leerConv(SIN))[0];
      chequear("El hilo de sonda entró sin id de ManyChat (como los viejos)",
        Boolean(hilo) && !hilo.externo?.manychat_subscriber_id, JSON.stringify(hilo?.externo ?? null));
      const { data: { session: s2 } } = await sb.auth.getSession();
      const r = await fetch(`${APP}/api/enviar`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${s2.access_token}` },
        body: JSON.stringify({ convId: hilo.id, texto: "hola" }),
      });
      const j = await r.json().catch(() => ({}));
      chequear("🔗 Sin el contacto enlazado: 409 explicando por qué (jamás un genérico)",
        r.status === 409 && /enlazad/i.test(j.mensaje ?? ""), `HTTP ${r.status} · ${j.mensaje}`);
    } finally {
      for (const f of await leerConv(SIN)) await sb.from("potente_conversaciones").delete().eq("id", f.id);
    }
  }

  // ── 5 · El interruptor es real ────────────────────────────────────────────
  // 🔴 Apagar a Marina en el sitio del cliente, aunque sean 25 s, no se hace por
  // una prueba: se corre en local (o forzado a mano).
  const local = /localhost|127\.0\.0\.1/.test(APP);
  if (!local && process.env.PERMITIR_PAUSA !== "1") {
    console.log("⏭️  La prueba de la pausa se saltea contra producción (apagaría a Marina ~25 s). Correla en local.");
  } else {
  seTocoLaConfig = true;
  const { error: ePausa } = await sb.from("potente_ia_config").upsert({ id: true, cfg: { ...cfgOriginal, activa: false } });
  chequear("La dirección puede pausar a Marina (escribe la config)", !ePausa, ePausa?.message ?? "");
  await espera(21_000);                                   // la caché del server dura 20 s
  const pausada = await postAsistente({ mensaje: "Hola, busco un depto", historial: [], catalogo: CATALOGO });
  chequear("⏸️ En pausa, /api/asistente responde 200 hablado con pausada:true (no un error)",
    pausada.status === 200 && pausada.json.pausada === true && /WhatsApp/i.test(pausada.json.respuesta ?? ""),
    `HTTP ${pausada.status} · ${String(pausada.json.respuesta ?? "").slice(0, 70)}`);
  }
} finally {
  if (cfgOriginal && seTocoLaConfig) {
    const { error } = await sb.from("potente_ia_config").upsert({ id: true, cfg: cfgOriginal });
    console.log(error ? `  🔴 NO SE PUDO RESTAURAR LA CONFIG: ${error.message}` : "  (config de Marina restaurada)");
    /* 🔴 Y se espera a que el server la vea. La caché del cerebro dura 20 s: sin
     * esta espera, la suite siguiente le pregunta a una Marina todavía apagada y
     * se pone roja acusando a un código sano (pasó el 27-ago con marina.mjs y con
     * consultas.mjs). Quien apaga algo, lo deja andando antes de irse. */
    for (let i = 0; i < 15; i++) {
      const r = await fetch(`${APP}/api/asistente`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensaje: "hola", historial: [], catalogo: [] }),
      }).then((x) => x.json()).catch(() => ({}));
      if (!r?.pausada) { console.log("  (Marina volvió a atender)"); break; }
      await espera(3000);
    }
  }
  await limpiar();
  console.log("  (sondas borradas)");
}
console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====\n`);
process.exit(fallos.length ? 1 : 0);
