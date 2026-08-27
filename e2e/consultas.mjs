/**
 * CONSULTAS ABIERTAS + MARINA REAL EN PANTALLA (27-ago) — por CDP, como Mateo.
 * ─────────────────────────────────────────────────────────────────────────────
 *   APP=http://localhost:3011 node e2e/consultas.mjs        (Chrome CDP en :9222)
 *   CAPTURAS=<carpeta> para guardar las capturas PNG y mirarlas.
 *
 * Siembra una charla REAL por /api/asistente (Marina contesta de verdad y
 * detecta el contacto), y después verifica EN LA PANTALLA:
 *   · Consultas: la tarjeta se abre y el drawer muestra la charla y la propiedad;
 *   · "Abrir en la bandeja" lleva al hilo con ?conv= y lo deja seleccionado;
 *   · Canales: Instagram dice lo que la bandeja real dice (y que Marina responde);
 *   · Probador: es la Marina real (responde con el endpoint público);
 *   · Ficha pública: el botón de compartir existe, a 390 px no hay scroll
 *     horizontal, y en escritorio abre el menú con WhatsApp y copiar link.
 * Borra lo suyo en el `finally`.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";
import { pedirSesion, guionSesion } from "./login.mjs";

const APP = process.env.APP || "http://localhost:3000";
const CAPTURAS = process.env.CAPTURAS || "";
const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
if (!env.PANEL_MATEO_PASS) { console.log("⏭️  Sin PANEL_MATEO_PASS: la suite se saltea."); process.exit(0); }

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const SELLO = String(Date.now()).slice(-7);
const SESION = `visita-ui${SELLO}`;
const NOMBRE = `Sonda Pantalla ${SELLO}`;

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: eLogin } = await sb.auth.signInWithPassword({ email: "mateo@potenteprop.com.ar", password: env.PANEL_MATEO_PASS });
if (eLogin) { console.log(`⏭️  No se pudo entrar como la dirección (${eLogin.message}).`); process.exit(0); }

// Una propiedad REAL publicada, para la ficha y para que Marina tenga algo que recomendar.
const { data: pubs } = await sb.from("potente_propiedades_web").select("id,titulo,zona,categoria,operacion,oficina,precioUSD,dormitorios,ambientes").eq("estado", "activa").limit(20);
const real = (pubs ?? []).find((p) => p.operacion === "venta") ?? pubs?.[0];
if (!real) { console.log("⏭️  No hay propiedades publicadas: la suite se saltea."); process.exit(0); }
const CATALOGO = [{ id: real.id, titulo: real.titulo, zona: real.zona, categoria: real.categoria, operacion: real.operacion, oficina: real.oficina, precio: real.precioUSD ? `U$S ${real.precioUSD}` : "A consultar", dormitorios: real.dormitorios, ambientes: real.ambientes }];

const postAsistente = (body) => fetch(`${APP}/api/asistente`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

let leadId = null;
const limpiar = async () => {
  const { data } = await sb.from("potente_conversaciones").select("id").eq("contacto", SESION);
  for (const f of data ?? []) await sb.from("potente_conversaciones").delete().eq("id", f.id);
  if (leadId) await sb.from("potente_leads").delete().eq("id", leadId);
};

const { send, evaluar, ir, cerrar, metrica } = await nuevaPestania();
const captura = async (nombre) => {
  if (!CAPTURAS) return;
  mkdirSync(CAPTURAS, { recursive: true });
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${CAPTURAS}/${nombre}.png`, Buffer.from(data, "base64"));
};
const clickTexto = (sel, texto) => evaluar(`const b = [...document.querySelectorAll('${sel}')].find(x => (x.textContent||'').trim().includes(${JSON.stringify(texto)})); if (!b) return 0; b.click(); return 1;`);

console.log(`\n🗂️  Consultas y Marina en pantalla contra ${APP}\n`);
try {
  await limpiar();

  // ── Siembra: una charla real con contacto ──────────────────────────────────
  const pregunta = `Hola, me interesa ${real.titulo} en ${real.zona}, ¿sigue disponible?`;
  const t1 = await postAsistente({ mensaje: pregunta, historial: [], catalogo: CATALOGO, sesion: SESION });
  chequear("Marina contesta la primera consulta", t1.status === 200 && t1.json.respuesta && !t1.json.degradado, `HTTP ${t1.status}`);
  const t2 = await postAsistente({ mensaje: `Soy ${NOMBRE}, mi teléfono es 223 555 0${SELLO.slice(-3)}. ¿Me pasan más info?`, historial: [{ rol: "cliente", texto: pregunta }, { rol: "asistente", texto: String(t1.json.respuesta ?? "") }], catalogo: CATALOGO, sesion: SESION });
  leadId = typeof t2.json.leadId === "string" ? t2.json.leadId : null;
  chequear("…y con el teléfono nace la consulta vinculada (leadId)", Boolean(leadId), leadId ?? JSON.stringify(t2.json.lead ?? null));
  if (!leadId) throw new Error("sin leadId no hay qué abrir");
  await espera(1200);

  // ── Entrar como Mateo ──────────────────────────────────────────────────────
  await metrica(1280, 860);
  await ir(APP + "/", 900);
  await evaluar(guionSesion(await pedirSesion("mateo")));

  // ── Consultas: la tarjeta se abre ──────────────────────────────────────────
  await ir(APP + "/panel/leads", 5000);
  const tarjeta = await evaluar(`const t = document.querySelector('[data-consulta=${JSON.stringify(leadId)}]'); return t ? (t.textContent||'').trim().slice(0,120) : '';`);
  chequear("📋 La consulta está en Consultas con lo que pidió", tarjeta.includes(NOMBRE) && /Pidió/.test(tarjeta), tarjeta.slice(0, 90));
  await evaluar(`document.querySelector('[data-consulta=${JSON.stringify(leadId)}]').click(); return 1;`);
  await espera(900);
  const drawer = await evaluar(`const d = document.querySelector('[data-consulta-drawer]'); if (!d) return null; return { texto: (d.innerText||''), conv: Boolean(d.querySelector('[data-consulta-conversacion]')), burbujas: d.querySelectorAll('[data-consulta-conversacion] > div').length };`);
  chequear("🗂️ Se abre el drawer de la consulta", Boolean(drawer), drawer ? "sí" : "no apareció");
  chequear("…con la charla entera (4 burbujas: 2 del visitante, 2 de Marina)", drawer?.conv && drawer.burbujas === 4, `burbujas: ${drawer?.burbujas}`);
  chequear("…se lee lo que preguntó, textual", Boolean(drawer?.texto?.includes("sigue disponible")), "");
  chequear("…y la propiedad por la que consultó", Boolean(drawer?.texto?.includes(real.titulo)), real.titulo);
  chequear("…y cómo seguirla (WhatsApp / Llamar)", /WhatsApp/.test(drawer?.texto ?? "") && /Llamar/.test(drawer?.texto ?? ""), "");
  await captura("consulta-drawer");

  // ── Abrir en la bandeja ────────────────────────────────────────────────────
  const fue = await clickTexto("[data-consulta-drawer] button", "Abrir en la bandeja");
  chequear("Hay botón 'Abrir en la bandeja'", fue === 1, "");
  await espera(4500);
  const urlBandeja = await evaluar(`return location.pathname + location.search;`);
  chequear("…lleva a /panel/asistente?conv=<id>", /\/panel\/asistente\?conv=CONV-/.test(urlBandeja), urlBandeja);
  const hiloAbierto = await evaluar(`return (document.body.innerText||'').includes(${JSON.stringify("sigue disponible")}) && (document.body.innerText||'').includes(${JSON.stringify(NOMBRE)});`);
  chequear("🧵 …y el hilo de esa persona queda abierto (se lee su primera pregunta)", hiloAbierto === true, "");
  await captura("bandeja-desde-consulta");

  // ── Canales: Instagram según la bandeja real, y Marina responde ────────────
  const hayIG = ((await sb.from("potente_conversaciones").select("id").eq("canal", "instagram").limit(1)).data ?? []).length > 0;
  await clickTexto("button", "Canales");
  await espera(800);
  const chipIG = await evaluar(`
    const t = [...document.querySelectorAll('.pcard')].find(x => ((x.querySelector('p')?.textContent) || '').trim().startsWith('Instagram'));
    const e = t?.querySelector('[data-canal-estado]');
    return e ? { estado: e.getAttribute('data-canal-estado'), texto: (e.textContent||'').trim() } : null;
  `);
  chequear(`📡 Instagram figura ${hayIG ? "'Conectado'" : "'A conectar'"} porque eso dice la bandeja real`, chipIG?.estado === (hayIG ? "conectado" : "pendiente"), JSON.stringify(chipIG));
  if (hayIG) chequear("…y el chip dice que Marina responde ahí", /Marina responde/.test(chipIG?.texto ?? ""), chipIG?.texto ?? "");
  await captura("canales");

  // ── Probador: la Marina real ───────────────────────────────────────────────
  await clickTexto("button", "Probar");
  await espera(800);
  const cabecera = await evaluar(`return (document.body.innerText||'').includes('Es exactamente la que atiende en tu web y en Instagram');`);
  chequear("🧪 El Probador avisa que es la Marina real", cabecera === true, "");
  await evaluar(`
    const i = document.querySelector('input[placeholder="Escribí una consulta…"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(i, 'Hola, ¿qué tienen en venta en ${real.zona.replace(/'/g, "")}?');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return 1;`);
  await espera(200);
  await evaluar(`document.querySelector('input[placeholder="Escribí una consulta…"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1;`);
  let respondio = false;
  for (let i = 0; i < 15 && !respondio; i++) { await espera(1500); respondio = await evaluar(`return [...document.querySelectorAll('.pcard .whitespace-pre-wrap')].some(b => b.className.includes('bg-paper-100') && (b.textContent||'').trim().length > 20);`); }
  chequear("…y responde de verdad (burbuja de Marina con texto)", respondio === true, "");
  await captura("probador");

  // ── Ficha pública: compartir, y a 390 px sin scroll horizontal ────────────
  await metrica(390, 800);
  await ir(`${APP}/propiedad/${real.id}`, 4500);
  const movil = await evaluar(`return { desborde: document.documentElement.scrollWidth - window.innerWidth, boton: Boolean(document.querySelector('button[aria-label="Compartir esta propiedad"]')) };`);
  chequear("📱 A 390 px la ficha no tiene scroll horizontal", movil.desborde === 0, `desborde: ${movil.desborde}px`);
  chequear("📤 …y tiene el botón de compartir", movil.boton === true, "");
  await evaluar(`document.querySelector('button[aria-label="Compartir esta propiedad"]').scrollIntoView({ block: 'center' }); return 1;`);
  await espera(600);
  await captura("ficha-390-compartir");

  await metrica(1280, 860);
  await ir(`${APP}/propiedad/${real.id}`, 4000);
  await evaluar(`const b = document.querySelector('button[aria-label="Compartir esta propiedad"]'); b.scrollIntoView({ block: 'center' }); b.click(); return 1;`);
  await espera(500);
  const menu = await evaluar(`const m = document.querySelector('[role=menu]'); return m ? (m.innerText||'') : '';`);
  chequear("🖥️ En escritorio abre el menú con WhatsApp y copiar el link", /WhatsApp/.test(menu) && /Copiar el link/.test(menu), menu.replace(/\n/g, " · ").slice(0, 80));
  const enlace = await evaluar(`return document.querySelector('[role=menu] a')?.getAttribute('href') || '';`);
  chequear("…y el WhatsApp lleva el link canónico de la ficha", enlace.includes(encodeURIComponent(`/propiedad/${real.id}`)) || enlace.includes(`/propiedad/${real.id}`), enlace.slice(0, 90));
  await captura("ficha-compartir-menu");
} finally {
  await limpiar();
  await cerrar();
  console.log("  (sondas borradas)");
}
resumen();
