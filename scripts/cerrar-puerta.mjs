/**
 * POTENTE PROPIEDADES · Cerrar los tres candados que faltan
 * ─────────────────────────────────────────────────────────────────────────────
 * Los tres salieron de la auditoría del 7-ago-2026 y son los únicos que no se
 * pueden hacer por SQL ni desde el código:
 *
 *   1. Cerrar el registro público de Supabase (que nadie se cree una cuenta).
 *   2. Encender la protección de contraseñas filtradas (HaveIBeenPwned).
 *   3. Pasar el repositorio de GitHub a privado.
 *
 * Hace los tres y DESPUÉS verifica cada uno contra la API, así no queda en
 * "debería haber andado".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 LOS TOKENS NO SE GUARDAN EN NINGÚN LADO. Se pasan como variable de entorno
 *    en el momento de correrlo y mueren con el proceso. No los pongas en un
 *    archivo: son llaves de administración de toda la cuenta.
 *
 * USO (desde 03_IMPLEMENTACION/frontend):
 *
 *   SUPABASE_PAT=sbp_xxx GITHUB_PAT=github_pat_xxx node scripts/cerrar-puerta.mjs
 *
 *   Se puede correr con uno solo de los dos: hace lo que puede y avisa del resto.
 *   Es idempotente — correrlo dos veces no rompe nada.
 *
 * DÓNDE SE SACAN LOS TOKENS (30 segundos cada uno)
 *
 *   SUPABASE_PAT → https://supabase.com/dashboard/account/tokens
 *                  "Generate new token", nombre: "cierre-seguridad-potente".
 *                  Empieza con sbp_. Se ve UNA sola vez.
 *
 *   GITHUB_PAT   → https://github.com/settings/personal-access-tokens/new
 *                  Fine-grained. Repository access: "Only select repositories"
 *                  → POTENTE_PROPIEDADES. Permissions → Repository permissions
 *                  → **Administration: Read and write**. Expiración: 7 días.
 *
 *   Cuando termine, borrá los dos. Ya no hacen falta.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PROYECTO = "gqhpgexqbnqqqeynbucu";        // Supabase de Potente (São Paulo)
const REPO = "weseka1/POTENTE_PROPIEDADES";

const SB = process.env.SUPABASE_PAT?.trim();
const GH = process.env.GITHUB_PAT?.trim();

const ok = [];
const mal = [];
const salteado = [];

const linea = (s = "") => console.log(s);
const bien = (t, extra = "") => { ok.push(t); linea(`  ✅ ${t}${extra ? ` · ${extra}` : ""}`); };
const falla = (t, extra = "") => { mal.push(t); linea(`  ❌ ${t}${extra ? ` · ${extra}` : ""}`); };
const salto = (t, porque) => { salteado.push(t); linea(`  ⏭️  ${t} · ${porque}`); };

/** Nunca imprimir el cuerpo crudo de una respuesta de auth: puede traer datos. */
async function motivo(r) {
  try {
    const j = await r.json();
    return String(j?.message ?? j?.msg ?? j?.error ?? `HTTP ${r.status}`).slice(0, 160);
  } catch { return `HTTP ${r.status}`; }
}

// ══════════════════════════════════════════════════════════════════════════════
linea("\n═══ 1 y 2 · SUPABASE ═══\n");

if (!SB) {
  salto("Registro público y contraseñas filtradas", "falta SUPABASE_PAT");
} else if (!/^sbp_/.test(SB)) {
  falla("El token de Supabase no tiene la pinta correcta", "tiene que empezar con sbp_");
} else {
  const api = `https://api.supabase.com/v1/projects/${PROYECTO}/config/auth`;
  const cabeceras = { Authorization: `Bearer ${SB}`, "Content-Type": "application/json" };

  // Cómo estaba antes (para poder contarlo, y para poder volver atrás).
  const antes = await fetch(api, { headers: cabeceras });
  if (!antes.ok) {
    falla("No pude leer la configuración de auth", await motivo(antes));
  } else {
    const cfg = await antes.json();
    linea(`  · antes: registro ${cfg.disable_signup ? "cerrado" : "ABIERTO"} · ` +
          `contraseñas filtradas ${cfg.password_hibp_enabled ? "encendidas" : "APAGADAS"} · ` +
          `largo mínimo ${cfg.password_min_length ?? "?"}`);

    // ⚠️ VAN EN LLAMADAS SEPARADAS, no en un PATCH con los dos campos.
    // `password_hibp_enabled` es función de plan Pro, y la org de Potente está en
    // free: si fueran juntos, el rechazo de ese campo se llevaría puesto el
    // cierre del registro, que es el que de verdad importa.

    // ── (1) Cerrar el registro. Este tiene que salir sí o sí. ────────────────
    const p1 = await fetch(api, {
      method: "PATCH", headers: cabeceras,
      body: JSON.stringify({ disable_signup: true }),
    });
    if (!p1.ok) {
      falla("No pude cerrar el registro público", await motivo(p1));
    } else {
      const v = await (await fetch(api, { headers: cabeceras })).json();
      if (v.disable_signup === true) {
        bien("Registro público CERRADO");
        // Que nadie se asuste: cerrar el registro NO impide dar de alta gente
        // del equipo. El bloqueo vive solo en el endpoint público de signup
        // (devuelve 422 signup_disabled); crear usuarios desde el panel de
        // Supabase o por la Admin API sigue funcionando igual.
        linea("     (dar de alta gente del equipo desde el panel de Supabase sigue andando)");
      } else {
        falla("El registro público sigue abierto", "el PATCH pasó pero no quedó");
      }
    }

    // ── (2) Contraseñas filtradas. Puede rebotar por plan. ──────────────────
    const p2 = await fetch(api, {
      method: "PATCH", headers: cabeceras,
      body: JSON.stringify({ password_hibp_enabled: true }),
    });
    if (p2.ok) {
      const v = await (await fetch(api, { headers: cabeceras })).json();
      v.password_hibp_enabled === true
        ? bien("Protección de contraseñas filtradas ENCENDIDA")
        : falla("La protección de contraseñas sigue apagada", "el PATCH pasó pero no quedó");
    } else {
      const m = await motivo(p2);
      if (p2.status === 403 || /pro plan|not available|upgrade|subscription/i.test(m)) {
        salto("Protección de contraseñas filtradas", "es función de plan Pro y la org está en free");
        linea("     Sustituto gratis: correr esto con --reforzar-claves");
      } else {
        falla("No pude encender la protección de contraseñas", m);
      }
    }

    // ── (2b) El sustituto en plan free: exigir contraseñas fuertes ──────────
    // No se aplica solo: cambia lo que el equipo puede elegir de contraseña.
    // Las tres actuales (16 caracteres, mezcladas) ya lo cumplen.
    //
    // ⚠️ `password_required_characters` NO acepta cualquier cosa: es un enum
    // CERRADO de 5 valores. El de abajo es el miembro exacto "minúsculas +
    // mayúsculas + números". Existe uno más fuerte que además exige símbolos,
    // pero su valor lleva dos backslashes literales adentro y transcribirlo mal
    // devuelve 400. Para tres cuentas de administración con contraseñas
    // generadas, no vale la pena el riesgo de escape.
    if (process.argv.includes("--reforzar-claves")) {
      const p3 = await fetch(api, {
        method: "PATCH", headers: cabeceras,
        body: JSON.stringify({
          password_min_length: 12,
          password_required_characters:
            "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
        }),
      });
      if (p3.ok) {
        const v = await (await fetch(api, { headers: cabeceras })).json();
        v.password_min_length >= 12
          ? bien("Contraseñas: mínimo 12 y con mayúsculas, minúsculas y números")
          : falla("No quedó el mínimo de 12");
      } else {
        falla("No pude reforzar el requisito de contraseñas", await motivo(p3));
      }
    }
  }
}

// Prueba independiente, sin token: es la misma sonda que usa `npm run verificar-db`.
// Contraseña de una letra a propósito — Supabase mira si el registro está
// permitido ANTES que la contraseña, así que responde sin crear ninguna cuenta.
linea("\n  Comprobación desde afuera (como un desconocido):");
try {
  const { readFileSync } = await import("node:fs");
  const env = Object.fromEntries(
    readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
  const r = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "sonda.verificacion@potenteprop.com.ar", password: "a" }),
  });
  const codigo = String((await r.json().catch(() => ({})))?.error_code ?? "");
  /signup_disabled|not_allowed/i.test(codigo)
    ? bien("Confirmado: un desconocido NO puede crearse una cuenta")
    : falla("Un desconocido todavía puede registrarse", codigo || `HTTP ${r.status}`);
} catch (e) {
  falla("No pude hacer la comprobación desde afuera", String(e?.message ?? e).slice(0, 120));
}

// ══════════════════════════════════════════════════════════════════════════════
linea("\n═══ 3 · GITHUB ═══\n");

if (!GH) {
  salto("Pasar el repositorio a privado", "falta GITHUB_PAT");
} else {
  const api = `https://api.github.com/repos/${REPO}`;
  const cabeceras = {
    Authorization: `Bearer ${GH}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    // GitHub rechaza los pedidos sin User-Agent. fetch de Node no manda ninguno.
    "User-Agent": "weseka-cierre-seguridad",
  };

  // Antes de tocar nada: si alguien lo forkeó, el código ya se copió y pasarlo a
  // privado no lo devuelve. Conviene saberlo.
  const info = await fetch(api, { headers: cabeceras });
  if (!info.ok) {
    falla("No pude leer el repositorio", await motivo(info));
  } else {
    const r = await info.json();
    linea(`  · antes: ${r.private ? "privado" : "PÚBLICO"} · ${r.forks_count} forks · ${r.stargazers_count} estrellas`);
    if (r.forks_count > 0) {
      linea(`  ⚠️  Hay ${r.forks_count} fork(s): esas copias quedan afuera de tu control.`);
    }

    if (r.private) {
      bien("Ya estaba privado", "no hice nada");
    } else {
      const patch = await fetch(api, { method: "PATCH", headers: cabeceras, body: JSON.stringify({ private: true }) });
      if (!patch.ok) {
        falla("No pude pasarlo a privado", await motivo(patch));
        linea("     (el token necesita el permiso 'Administration: Read and write' sobre ESTE repo)");
      } else {
        // Verificación sin token: si de verdad quedó privado, desde afuera da 404.
        const desdeAfuera = await fetch(api, {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "weseka-cierre-seguridad" },
        });
        desdeAfuera.status === 404
          ? bien("Repositorio PRIVADO", "desde afuera ya da 404")
          : falla("Sigue viéndose desde afuera", `HTTP ${desdeAfuera.status}`);

        // Y que el código viejo deje de bajarse: era el link que exponía la
        // clave de IAGRO en un commit de julio.
        const raw = await fetch(
          "https://raw.githubusercontent.com/weseka1/POTENTE_PROPIEDADES/7721e9960e471513de3622bc444c17ad5a91f268/scripts/seed.ts",
        );
        raw.status === 404
          ? bien("Los commits viejos ya no se bajan de internet")
          : falla("Todavía se puede bajar un commit viejo", `HTTP ${raw.status}`);
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
linea(`\n${"═".repeat(58)}`);
linea(`  ${ok.length} listos · ${mal.length} fallaron · ${salteado.length} salteados`);
if (mal.length) { linea("\n  FALLARON:"); mal.forEach((t) => linea(`   · ${t}`)); }
if (salteado.length) { linea("\n  SALTEADOS:"); salteado.forEach((t) => linea(`   · ${t}`)); }
linea(`${"═".repeat(58)}`);
linea("\n  Después: `npm run verificar-db` tiene que dar 37/37.");
linea("  Y borrá los dos tokens, ya no hacen falta.\n");

process.exitCode = mal.length ? 1 : 0;
