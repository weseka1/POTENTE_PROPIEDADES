/**
 * /conectar — la página del registro integrado de Meta y su endpoint.
 * ─────────────────────────────────────────────────────────────────────────────
 *   APP=http://localhost:3000 node e2e/conectar.mjs
 *   APP=https://potentepropiedades.com node e2e/conectar.mjs
 *
 * No corre el flujo de Meta (eso exige un humano con el celular): prueba que la
 * página se sirva bien, que el endpoint no explote con basura y que rechace lo
 * que tiene que rechazar sin tocar nada. Sin Chrome: puro fetch.
 */
import { readFileSync } from "node:fs";

const APP = process.env.APP || "http://localhost:3000";
const env = {};
try {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = l.indexOf("=");
    if (i > 0 && !l.trim().startsWith("#")) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
} catch { /* sin .env.local */ }
const APP_ID = process.env.META_APP_ID || env.META_APP_ID || "";

let pass = 0, fail = 0;
const ok = (cond, titulo, detalle = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${titulo}${detalle ? " :: " + detalle : ""}`); };

console.log(`\n🔗 /conectar contra ${APP}\n`);

// ── la página ────────────────────────────────────────────────────────────────
const pag = await fetch(`${APP}/conectar`, { redirect: "manual" });
const html = await pag.text();
ok(pag.status === 200, "GET /conectar responde 200", `HTTP ${pag.status}`);
ok(/noindex/i.test(pag.headers.get("x-robots-tag") || "") && /noindex/i.test(html), "…no se indexa (cabecera + meta)", pag.headers.get("x-robots-tag") || "sin cabecera");
ok(/no-store/.test(pag.headers.get("cache-control") || ""), "…y no se cachea", pag.headers.get("cache-control") || "");
ok(/Conectar el WhatsApp/.test(html), "…es la página de conexión");
ok(APP_ID ? html.includes(`"${APP_ID}"`) : /APP_ID = "\d+"/.test(html), "…lleva el id de la app de Potente", APP_ID || "(sin META_APP_ID local: se acepta cualquier id)");
ok(/whatsapp_business_app_onboarding/.test(html), "…y pide el flujo de la app existente (Coexistence), no el de número nuevo");
ok(!/\/register\b/.test(html), "…sin ninguna llamada a /register en el cliente");
ok(!/__CONFIG_ID__|__APP_ID__/.test(html), "…con los marcadores reemplazados (sin __X__ sueltos)");

// ── el endpoint ──────────────────────────────────────────────────────────────
const post = (body) => fetch(`${APP}/api/meta/conectar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const vacio = await post({});
ok([400, 503].includes(vacio.status), "POST sin código → 400 (o 503 si el server no tiene las claves), nunca 500", `HTTP ${vacio.status}`);
const jv = await vacio.json().catch(() => ({}));
ok(typeof jv.mensaje === "string" && jv.mensaje.length > 0 && jv.ok === false, "…con un mensaje humano y ok:false", jv.mensaje);

const basura = await post({ code: "esto-no-es-un-codigo", wabaId: "295097261637590" });
ok([400, 503].includes(basura.status), "🔴 Un código inventado se rechaza (Meta no lo canjea) sin tocar nada", `HTTP ${basura.status} · ${(await basura.json().catch(() => ({}))).mensaje ?? ""}`);

const gigante = await post({ code: "x".repeat(5000) });
ok([400, 503].includes(gigante.status), "…y uno de 5.000 caracteres también", `HTTP ${gigante.status}`);

const noJson = await fetch(`${APP}/api/meta/conectar`, { method: "POST", headers: { "content-type": "text/plain" }, body: "hola" });
ok(noJson.status >= 400 && noJson.status < 500, "…y un body que no es JSON no tira 500", `HTTP ${noJson.status}`);

// ── el resto del sitio no se movió ───────────────────────────────────────────
const r404 = await fetch(`${APP}/conectar-cualquier-cosa`);
ok(r404.status === 404, "Una ruta inexistente sigue dando 404 (el catch-all no se rompió)", `HTTP ${r404.status}`);

console.log(`\n==== ${pass} PASS / ${fail} FAIL ====\n`);
process.exit(fail ? 1 : 0);
