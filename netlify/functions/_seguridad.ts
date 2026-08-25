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
/* `global` (25-ago): el TECHO de todo el sitio junto, sin importar de qué IP
 * venga. Existe porque un cupo por IP, solo, protege la billetera únicamente
 * si la IP es de fiar — y la auditoría de hoy encontró que no lo era (ver
 * `ipDe`). Este tope no depende de ninguna cabecera: es la última línea que
 * separa a Anthropic de un script. Está holgado para el uso real (una
 * inmobiliaria de Mar del Plata no hace 120 consultas a Marina por minuto) y
 * corto para quien quiera quemar la cuenta. Agotarlo NO tira 429: los endpoints
 * ya contestan 200 "estoy ocupada" (cicatriz del 19-ago). */
const CUPOS = {
  asistente: { pedidos: 40, ventanaMs: 60_000, global: 120 },
  chat: { pedidos: 30, ventanaMs: 60_000, global: 600 },       // lo comparten los tiles del 3D (hasta 9 por vista)
  conectar: { pedidos: 10, ventanaMs: 60_000, global: 40 },   // /conectar: canjes de código de Meta, nunca en ráfaga
} as const;

type Balde = { hasta: number; usados: number };
const baldes = new Map<string, Balde>();

/** Limpieza perezosa: sin esto el Map crece para siempre con IPs viejas. */
function limpiar(ahora: number) {
  if (baldes.size < 5000) return;
  for (const [k, b] of baldes) if (b.hasta < ahora) baldes.delete(k);
}

/** Un balde: cuenta un pedido y dice si todavía entra. */
function entra(clave: string, pedidos: number, ventanaMs: number, ahora: number): { ok: true } | { ok: false; esperarS: number } {
  const b = baldes.get(clave);
  if (!b || b.hasta < ahora) {
    baldes.set(clave, { hasta: ahora + ventanaMs, usados: 1 });
    return { ok: true };
  }
  if (b.usados >= pedidos) return { ok: false, esperarS: Math.ceil((b.hasta - ahora) / 1000) };
  b.usados++;
  return { ok: true };
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
  const { pedidos, ventanaMs, global } = CUPOS[cual];
  const ahora = Date.now();
  limpiar(ahora);
  // Primero el techo global (no depende de la IP), después el de esta IP.
  const todos = entra(`${cual}:*`, global, ventanaMs, ahora);
  if (!todos.ok) return todos;
  return entra(`${cual}:${ip}`, pedidos, ventanaMs, ahora);
}

/** La IP del visitante, detrás del proxy del hosting.
 *
 * 🔴 25-ago · LA VERSIÓN ANTERIOR SE ESQUIVABA CON UNA CABECERA. Leía
 * `cf-connecting-ip`, `x-nf-client-connection-ip` y `x-real-ip` del pedido
 * crudo, "la que estuviera": bastaba mandar `cf-connecting-ip: 9.9.x.x` y
 * cambiarla en cada pedido para que cada uno cayera en un balde nuevo y el
 * cupo dejara de existir — medido contra producción: 36 pedidos rotando esa
 * cabecera, cero 429. Y ese cupo es lo que protege la cuenta de Anthropic.
 *
 * La regla ahora: se lee UNA sola cabecera, la que pone el proxy real de este
 * hosting (`IP_CABECERA`; en Hostinger es `x-real-ip`, y está medido que el
 * proxy la PISA aunque el cliente la mande). Ninguna otra se mira. Si no viene,
 * se toma la ÚLTIMA de `x-forwarded-for`: la que agregó el proxy, no la que
 * pudo inventar el cliente (que va primero). Y arriba de esto, el cupo global
 * de `CUPOS` cubre lo que cualquier truco de IP se salte. */
const IP_CABECERA = (process.env.IP_CABECERA || "x-real-ip").toLowerCase();

export function ipDe(cabeceras: Record<string, string | string[] | undefined> | Headers): string {
  const leer = (n: string): string => {
    if (cabeceras instanceof Headers) return cabeceras.get(n) ?? "";
    const v = cabeceras[n] ?? cabeceras[n.toLowerCase()];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };
  const delProxy = leer(IP_CABECERA).trim();
  if (delProxy) return delProxy;
  const cadena = leer("x-forwarded-for").split(",").map((x) => x.trim()).filter(Boolean);
  return cadena.length ? cadena[cadena.length - 1] : "sin-ip";
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
