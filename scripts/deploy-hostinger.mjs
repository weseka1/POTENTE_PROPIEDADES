/**
 * DEPLOY A HOSTINGER — un solo comando: npm run deploy:hostinger
 * ─────────────────────────────────────────────────────────────────────────────
 * Reemplaza al hook de Render (18-ago-2026). El flujo replica al MCP oficial
 * de Hostinger, que es el único camino que pasa: Cloudflare rechaza el
 * multipart directo de curl, pero el trío credenciales→TUS→build JSON pasa.
 *
 *   1. Empaqueta el código TRACKEADO (git archive: sin node_modules, sin dist,
 *      sin basura) + inyecta los .env que el build y el server necesitan:
 *      Vite lee .env.production en build; server/index.mjs lee .env.local.
 *      🔒 SOLO viajan las claves de la app — jamás PANEL_*_PASS ni POTENTE_DB_*.
 *   2. Sube el ZIP por TUS al file server del hosting (credenciales efímeras).
 *   3. Dispara el build Node (express · Node 20 · build "build" ·
 *      entry server/index.mjs — la autodetección le pifia al entry) y muestra
 *      los logs hasta completed/failed.
 *
 * Necesita: HOSTINGER_API_TOKEN (en el entorno o en .env.local — gitignoreado;
 * este repo es PÚBLICO y acá no va ningún valor). Windows: usa tar.exe y
 * PowerShell Compress-Archive, que vienen con el sistema.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DOMINIO = "potentepropiedades.com";
const SITE_URL = `https://${DOMINIO}`;
const API = "https://developers.hostinger.com";
const UA = "hostinger-mcp-server/1.42.0"; // el que la API conoce y deja pasar
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

// ── credenciales ─────────────────────────────────────────────────────────────
const leerEnv = (ruta) => {
  const m = {};
  try {
    for (const l of readFileSync(ruta, "utf8").split("\n")) {
      const i = l.indexOf("=");
      if (i > 0 && !l.trim().startsWith("#")) m[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    }
  } catch { /* sin archivo: se sigue con process.env */ }
  return m;
};
const envLocal = leerEnv(path.join(RAIZ, ".env.local"));
const token = process.env.HOSTINGER_API_TOKEN || envLocal.HOSTINGER_API_TOKEN;
if (!token) { console.error("🔴 Falta HOSTINGER_API_TOKEN (entorno o .env.local)."); process.exit(1); }

const api = async (metodo, ruta, body, extraHeaders = {}) => {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, "User-Agent": UA, ...(body ? { "Content-Type": "application/json" } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta} → HTTP ${r.status}: ${texto.slice(0, 300)}`);
  try { return JSON.parse(texto); } catch { return texto; }
};

// ── 1 · el ZIP ────────────────────────────────────────────────────────────────
console.log("1/4 · Empaquetando el código trackeado…");
const CLAVES_APP = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "ANTHROPIC_API_KEY", "VITE_SHADEMAP_API_KEY"];
const faltan = CLAVES_APP.filter((k) => !envLocal[k]);
if (faltan.length) { console.error(`🔴 Faltan en .env.local: ${faltan.join(", ")}`); process.exit(1); }
const contenidoEnv = CLAVES_APP.map((k) => `${k}=${envLocal[k]}`).join("\n") + `\nVITE_SITE_URL=${SITE_URL}\n`;

const staging = mkdtempSync(path.join(tmpdir(), "potente-deploy-"));
const tarTmp = path.join(staging, "_src.tar");
execFileSync("git", ["archive", "--format=tar", "-o", tarTmp, "HEAD"], { cwd: RAIZ });
const appDir = path.join(staging, "app");
// 🔴 tar con cwd y rutas RELATIVAS: el tar de GNU en Windows interpreta
// "C:\..." como host remoto ("Cannot connect to C:") — cazado en el primer
// uso real del script. Sin letras de unidad no hay ambigüedad.
execFileSync("tar", ["-xf", "_src.tar", "--one-top-level=app"], { cwd: staging });
rmSync(tarTmp);
writeFileSync(path.join(appDir, ".env.production"), contenidoEnv);
writeFileSync(path.join(appDir, ".env.local"), contenidoEnv);
const NOMBRE = "potente_deploy.zip";
const zipPath = path.join(staging, NOMBRE);
execFileSync("powershell.exe", ["-NoProfile", "-Command",
  `Compress-Archive -Path '${appDir.replaceAll("/", "\\")}\\*' -DestinationPath '${zipPath.replaceAll("/", "\\")}' -Force`]);
const bytes = statSync(zipPath).size;
console.log(`   ZIP: ${(bytes / 1048576).toFixed(1)} MB (tope 50)`);
if (bytes > 50 * 1048576) { console.error("🔴 El ZIP pasa los 50 MB del endpoint."); process.exit(1); }

// ── 2 · subir por TUS ────────────────────────────────────────────────────────
console.log("2/4 · Subiendo por TUS…");
const sitios = await api("GET", `/api/hosting/v1/websites?domain=${DOMINIO}`);
const username = sitios?.data?.[0]?.username;
if (!username) { console.error("🔴 No encontré el website en la cuenta."); process.exit(1); }
const cred = await api("POST", "/api/hosting/v1/files/upload-urls", { username, domain: DOMINIO });
const destino = `${cred.url.replace(/\/$/, "")}/${NOMBRE}?override=true`;
const tusHeaders = { "X-Auth": cred.auth_key, "X-Auth-Rest": cred.rest_auth_key };
const pre = await fetch(destino, { method: "POST", headers: { ...tusHeaders, "upload-length": String(bytes), "upload-offset": "0" } });
if (pre.status !== 201) { console.error(`🔴 Pre-upload → HTTP ${pre.status}`); process.exit(1); }
const patch = await fetch(destino, {
  method: "PATCH",
  headers: { ...tusHeaders, "Tus-Resumable": "1.0.0", "Upload-Offset": "0", "Content-Type": "application/offset+octet-stream" },
  body: readFileSync(zipPath),
});
if (patch.status !== 204 && patch.status !== 200) { console.error(`🔴 TUS PATCH → HTTP ${patch.status}: ${(await patch.text()).slice(0, 200)}`); process.exit(1); }
console.log("   Subido ✓");
rmSync(staging, { recursive: true, force: true }); // el ZIP local (con claves) no sobrevive al deploy

// ── 3 · disparar el build ────────────────────────────────────────────────────
console.log("3/4 · Disparando el build (express · Node 20 · entry server/index.mjs)…");
const build = await api("POST", `/api/hosting/v1/accounts/${username}/websites/${DOMINIO}/nodejs/builds`, {
  app_type: "express", node_version: 20, build_script: "build", entry_file: "server/index.mjs",
  package_manager: "npm", source_type: "archive", source_options: { archive_path: NOMBRE },
});
console.log(`   build ${build.uuid} → ${build.state}`);

// ── 4 · esperar y mostrar logs ───────────────────────────────────────────────
console.log("4/4 · Esperando el build…");
let estado = build.state, vueltas = 0;
while (estado !== "completed" && estado !== "failed" && vueltas < 60) {
  await new Promise((r) => setTimeout(r, 15000));
  vueltas++;
  const lista = await api("GET", `/api/hosting/v1/accounts/${username}/websites/${DOMINIO}/nodejs/builds?per_page=5`);
  estado = (lista.data ?? lista).find((b) => b.uuid === build.uuid)?.state ?? estado;
  process.stdout.write(`\r   [${vueltas}] ${estado}   `);
}
console.log();
const logs = await api("GET", `/api/hosting/v1/accounts/${username}/websites/${DOMINIO}/nodejs/builds/${build.uuid}/logs`);
const textoLogs = typeof logs === "string" ? logs : JSON.stringify(logs);
console.log(textoLogs.slice(-1200));
if (estado !== "completed") { console.error(`\n🔴 Build ${estado}. Los logs de arriba tienen el porqué.`); process.exit(1); }
console.log(`\n✅ Deploy completo → ${SITE_URL}`);
console.log("   Verificá: curl -sI " + SITE_URL + " · /sitemap.xml · y la batería e2e si el cambio lo amerita.");
