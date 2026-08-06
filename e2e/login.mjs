// Login real para los tests, compartido por todas las suites.
//
// Con base de datos, el panel exige una sesión de Supabase de verdad (el atajo
// "potente_demo_auth" quedó desactivado a propósito, ver src/panel/auth.tsx).
// Acá se pide el token por API y se deja en localStorage con la misma clave que
// usa supabase-js, así la app arranca ya logueada sin pasar por el formulario.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "https://gqhpgexqbnqqqeynbucu.supabase.co";
const KEY = process.env.SUPABASE_KEY ?? "sb_publishable_LQ_JxpWjM__E0uO2s3hcUA_L_hLFJgw";
const REF = URL.replace("https://", "").split(".")[0];

export const CUENTAS = {
  mateo:   { email: "mateo@potenteprop.com.ar",   password: "Potente.Mateo.2026" },
  chauvin: { email: "chauvin@potenteprop.com.ar", password: "Potente.Chauvin.2026" },
  mogotes: { email: "mogotes@potenteprop.com.ar", password: "Potente.Mogotes.2026" },
};

/** Pide una sesión real. Reintenta: el endpoint de login corta si le llegan
 *  varios pedidos seguidos desde la misma IP. */
export async function pedirSesion(quien = "mateo") {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  for (let i = 1; i <= 5; i++) {
    const { data, error } = await sb.auth.signInWithPassword(CUENTAS[quien]);
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
