/**
 * Credenciales para los scripts — LEÍDAS, NUNCA ESCRITAS ACÁ.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 REGLA: en este repositorio no se escribe ninguna contraseña. Es público, y
 * además el historial de git conserva todo lo que alguna vez se commiteó, aunque
 * después se borre. El 7-ago-2026 hubo que rotar las tres claves del panel
 * justamente por haberlas dejado en scripts de prueba.
 *
 * Las claves viven en `frontend/.env.local` (fuera del control de versiones) y
 * en `02_INFRA/credenciales/`. Si falta una, el script se detiene y lo dice.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Lee .env.local sin dependencias: son unas pocas líneas de CLAVE=valor. */
function leerEnvLocal(): Record<string, string> {
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

const env = { ...leerEnvLocal(), ...process.env } as Record<string, string>;

export const SUPABASE_URL = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_KEY = env.SUPABASE_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "";

export type Cuenta = { email: string; password: string };

/** Devuelve una cuenta del panel, o corta el script explicando qué falta. */
export function cuenta(quien: "mateo" | "chauvin" | "mogotes"): Cuenta {
  const email = env[`PANEL_${quien.toUpperCase()}_EMAIL`] ?? `${quien}@potenteprop.com.ar`;
  const password = env[`PANEL_${quien.toUpperCase()}_PASS`];
  if (!password) {
    console.error(
      `\n❌ Falta la contraseña de "${quien}".\n` +
      `   Agregá PANEL_${quien.toUpperCase()}_PASS a frontend/.env.local\n` +
      `   (las claves están en 02_INFRA/credenciales/ — nunca en el código).\n`
    );
    process.exit(1);
  }
  return { email, password };
}

/** Corta si falta la conexión a la base. */
export function exigirBase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "\n❌ Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en frontend/.env.local\n"
    );
    process.exit(1);
  }
}
