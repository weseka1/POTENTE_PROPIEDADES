// ── Puerta de entrada de los endpoints de IA ─────────────────────────────────
//
// POR QUÉ EXISTE ESTE ARCHIVO (7-ago-2026, auditoría):
// `/api/chat` era un proxy ABIERTO a Anthropic. Cualquiera en internet podía
// mandarle un `curl`, poner el system prompt que quisiera y gastar la cuenta de
// Anthropic de WESEKA. Se verificó en producción: un pedido anónimo respondió
// 200. No es teórico — hay bots que barren internet buscando exactamente esto.
//
// `/api/asistente` tiene que seguir siendo público (es Marina, la atiende
// cualquier visitante), así que ahí no se puede pedir clave: se limita por IP.
//
// Lo usan los dos entornos: server/index.ts (Render) y netlify/functions/*.

/** Cuántos pedidos y en qué ventana.
 *
 * 🔴 19-ago: era 12/min y ESE fue el bug que Mateo fotografió como "Marina no
 * funciona". El cupo cuenta por IP, y una oficina sale a internet por UNA sola
 * IP: Mateo, las dos chicas y cualquier visitante detrás del mismo NAT comparten
 * el balde. Con eso, dos personas conversando a la vez lo agotan en un minuto y
 * el 429 le llegaba al visitante como "el asistente no está disponible" — justo
 * en medio de una charla que venía bien.
 *
 * 40/min sigue siendo corto para un script que quiera quemar la cuenta de
 * Anthropic (que es para lo que existe este cupo) y holgado para una oficina
 * entera charlando. Y desde hoy, además, agotarlo YA NO ROMPE a Marina: el
 * endpoint contesta 200 con un mensaje humano (ver server/index.ts). */
const CUPOS = {
  asistente: { pedidos: 40, ventanaMs: 60_000 },
  chat: { pedidos: 30, ventanaMs: 60_000 },
} as const;

type Balde = { hasta: number; usados: number };
const baldes = new Map<string, Balde>();

/** Limpieza perezosa: sin esto el Map crece para siempre con IPs viejas. */
function limpiar(ahora: number) {
  if (baldes.size < 5000) return;
  for (const [k, b] of baldes) if (b.hasta < ahora) baldes.delete(k);
}

/**
 * ¿Este pedido entra en el cupo? Devuelve los segundos de espera si no.
 *
 * El contador vive en memoria del proceso. En Render (una sola instancia) eso
 * alcanza. En Netlify cada function puede arrancar en frío, así que el límite
 * es "mejor esfuerzo": ahí el candado de verdad es el token del panel, y el
 * techo real del gasto es el límite mensual de la cuenta de Anthropic.
 */
export function pasaElCupo(ip: string, cual: keyof typeof CUPOS): { ok: true } | { ok: false; esperarS: number } {
  const { pedidos, ventanaMs } = CUPOS[cual];
  const ahora = Date.now();
  limpiar(ahora);

  const clave = `${cual}:${ip}`;
  const b = baldes.get(clave);
  if (!b || b.hasta < ahora) {
    baldes.set(clave, { hasta: ahora + ventanaMs, usados: 1 });
    return { ok: true };
  }
  if (b.usados >= pedidos) return { ok: false, esperarS: Math.ceil((b.hasta - ahora) / 1000) };
  b.usados++;
  return { ok: true };
}

/** La IP del visitante detrás de Cloudflare / Render / Netlify.
 *  Se toma la PRIMERA de x-forwarded-for: las que siguen las puede poner el
 *  cliente y servirían para saltear el límite. */
export function ipDe(cabeceras: Record<string, string | string[] | undefined> | Headers): string {
  const leer = (n: string): string => {
    if (cabeceras instanceof Headers) return cabeceras.get(n) ?? "";
    const v = cabeceras[n] ?? cabeceras[n.toLowerCase()];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };
  const directa = leer("cf-connecting-ip") || leer("x-nf-client-connection-ip") || leer("x-real-ip");
  if (directa) return directa.trim();
  const cadena = leer("x-forwarded-for");
  return (cadena.split(",")[0] || "sin-ip").trim();
}

/**
 * ¿El que pide tiene sesión de panel?
 *
 * Se le pregunta a Supabase si el token sirve, en vez de validar la firma acá:
 * así no hace falta guardar ningún secreto de JWT en el servidor, y si a alguien
 * le cierran la sesión deja de funcionar en el acto.
 */
export async function tieneSesionDePanel(authorization: string | undefined): Promise<boolean> {
  const token = (authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  // Sin base configurada no hay forma de verificar. Se rechaza: el Probador es
  // una herramienta interna, prefiero que no ande a que quede abierto.
  if (!url || !anon) return false;

  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Cabeceras de seguridad para TODA respuesta (las mismas en Render y Netlify). */
export const CABECERAS_SEGURIDAD: Record<string, string> = {
  // Que el navegador nunca vuelva a entrar por http.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  // Que no adivine el tipo de archivo (un .txt no se ejecuta como script).
  "X-Content-Type-Options": "nosniff",
  // Nadie puede meter el panel dentro de un iframe suyo y robar clicks.
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  // No filtrar la ruta completa (que puede llevar el id de una propiedad) al salir.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // La web no usa cámara, micrófono ni ubicación: se apagan.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};
