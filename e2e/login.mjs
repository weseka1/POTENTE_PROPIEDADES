// Login real para los tests, compartido por todas las suites.
//
// Con base de datos, el panel exige una sesión de Supabase de verdad (el atajo
// "potente_demo_auth" quedó desactivado a propósito, ver src/panel/auth.tsx).
// Acá se pide el token por API y se deja en localStorage con la misma clave que
// usa supabase-js, así la app arranca ya logueada sin pasar por el formulario.
//
// 🔒 LAS CONTRASEÑAS NO VAN ACÁ. Este repositorio es público: cualquier clave
// escrita en el código queda publicada y, peor, sobrevive en el historial de git
// aunque después se borre. Se leen de `.env.local`, que está fuera del control de
// versiones. (El 7-ago-2026 hubo que rotar las tres claves justamente por esto.)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Lee .env.local sin dependencias: son cuatro líneas de CLAVE=valor. */
function leerEnvLocal() {
  try {
    const texto = readFileSync(resolve(AQUI, "..", ".env.local"), "utf8");
    return Object.fromEntries(
      texto
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
    );
  } catch {
    return {};
  }
}

const env = { ...leerEnvLocal(), ...process.env };

const URL = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const REF = (URL ?? "").replace("https://", "").split(".")[0];

export const CUENTAS = {
  mateo:   { email: env.PANEL_MATEO_EMAIL   ?? "mateo@potenteprop.com.ar",   password: env.PANEL_MATEO_PASS },
  chauvin: { email: env.PANEL_CHAUVIN_EMAIL ?? "chauvin@potenteprop.com.ar", password: env.PANEL_CHAUVIN_PASS },
  mogotes: { email: env.PANEL_MOGOTES_EMAIL ?? "mogotes@potenteprop.com.ar", password: env.PANEL_MOGOTES_PASS },
};

/** Pide una sesión real. Reintenta: el endpoint de login corta si le llegan
 *  varios pedidos seguidos desde la misma IP. */
export async function pedirSesion(quien = "mateo") {
  const cuenta = CUENTAS[quien];
  if (!cuenta?.password) {
    throw new Error(
      `Falta la contraseña de "${quien}". Agregá PANEL_${quien.toUpperCase()}_PASS a frontend/.env.local ` +
      `(las claves están en 02_INFRA/credenciales/, nunca en el código).`
    );
  }
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  for (let i = 1; i <= 5; i++) {
    const { data, error } = await sb.auth.signInWithPassword(cuenta);
    if (!error && data.session) return data.session;
    if (i === 5) throw new Error(`login de ${quien} falló: ${error?.message || "sin mensaje"}`);
    await new Promise((r) => setTimeout(r, 3000 * i));
  }
}

/** Deja la sesión en el navegador. Llamar DESPUÉS de navegar al sitio (para
 *  estar en el origin correcto) y recargar para que la app la tome. */
export function guionSesion(session) {
  return `
    localStorage.clear();
    localStorage.setItem(${JSON.stringify(`sb-${REF}-auth-token`)}, ${JSON.stringify(JSON.stringify(session))});
    localStorage.setItem("potente_perfil_activo", "mateo");
    return 1;
  `;
}
