/**
 * CONECTAR UN WHATSAPP EXISTENTE AL PANEL — el lado server del registro integrado.
 * ─────────────────────────────────────────────────────────────────────────────
 * ── POR QUÉ EXISTE (cicatriz del 25-ago, 04:00) ──────────────────────────────
 * Los dos números de Potente viven en la app WhatsApp Business de cada oficina.
 * Para que sus mensajes lleguen al panel hay que conectarlos a la plataforma
 * SIN sacarlos de la app ("Coexistence"). Meta ofrece ese flujo —el del QR—
 * ÚNICAMENTE dentro del registro integrado (Embedded Signup): un botón oficial
 * de Meta en una página nuestra. El "Agregar número" del panel de la app y del
 * WhatsApp Manager registra números NUEVOS por SMS, que es justo lo que rompe
 * la app del celular. Juani lo buscó a las 4 AM y no estaba: no está.
 *
 * ── QUÉ HACE ─────────────────────────────────────────────────────────────────
 * La página `/conectar` corre el flujo de Meta y nos manda un `code` de un solo
 * uso (vence a los 30 s). Acá:
 *   1. se canjea por un token acotado al negocio que hizo el flujo;
 *   2. 🔒 el candado: ese token tiene que poder leer NUESTRO negocio
 *      (META_BUSINESS_ID). Un desconocido que corra el flujo con su propio
 *      Facebook obtiene un token que no ve a Potente → 403 y nada se toca;
 *   3. se suscribe la app a la cuenta de WhatsApp (sin esto los webhooks no
 *      llegan y falla en silencio: el fallo nº1 reportado);
 *   4. se devuelve el estado real de cada número: conectado = CLOUD_API + en la app.
 *
 * 🔴 NUNCA se registra el número (`/register`): en Coexistence ya está
 * registrado y repetirlo rompe el flujo. Este módulo no tiene esa llamada a
 * propósito, y no debe ganarla.
 *
 * 🔴 Ningún token de larga vida vive en este server (corre en el hosting del
 * cliente). El token canjeado se usa en esta misma petición y se descarta. La
 * verificación "de verdad" la hace Claude desde afuera: `scripts/meta.mjs estado`.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export type NumeroConectado = {
  id: string;
  numero: string;
  conectado: boolean;
  plataforma: string;
  enApp: boolean;
  estado: string;
};

export type ResultadoConexion = {
  status: number;
  ok: boolean;
  mensaje: string;
  numeros?: NumeroConectado[];
  cuentas?: { id: string; nombre: string }[];
};

async function graph(ruta: string, token?: string, init?: { method?: "GET" | "POST" }) {
  const sep = ruta.includes("?") ? "&" : "?";
  const url = `${GRAPH}/${ruta}${token ? `${sep}access_token=${encodeURIComponent(token)}` : ""}`;
  try {
    const r = await fetch(url, { method: init?.method ?? "GET", signal: AbortSignal.timeout(15_000) });
    const json: any = await r.json().catch(() => ({}));
    return { ok: r.ok && !json?.error, json };
  } catch (e) {
    return { ok: false, json: { error: { message: (e as Error).message } } };
  }
}

export async function conectarCuenta(entrada: { code?: unknown; wabaId?: unknown }): Promise<ResultadoConexion> {
  const appId = process.env.META_APP_ID;
  const secreto = process.env.META_APP_SECRET;
  const negocio = process.env.META_BUSINESS_ID;
  if (!appId || !secreto || !negocio) {
    return { status: 503, ok: false, mensaje: "La conexión todavía no está configurada en el servidor." };
  }

  const code = typeof entrada.code === "string" ? entrada.code.trim() : "";
  const wabaPedida = typeof entrada.wabaId === "string" && /^\d{5,25}$/.test(entrada.wabaId) ? entrada.wabaId : "";
  if (!code || code.length > 4096) return { status: 400, ok: false, mensaje: "Falta el código que devuelve Meta." };

  // 1 · el canje: un code de un solo uso por un token acotado al negocio del flujo.
  const canje = await graph(
    `oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(secreto)}&code=${encodeURIComponent(code)}`,
  );
  const token: string | undefined = canje.json?.access_token;
  if (!token) {
    console.warn("Conectar · Meta rechazó el código:", canje.json?.error?.message ?? "sin detalle");
    return { status: 400, ok: false, mensaje: "Meta no aceptó el código (vence a los 30 segundos). Vuelva a intentar." };
  }

  // 2 · 🔒 el candado: solo sirve un token que vea el negocio de Potente.
  const propio = await graph(`${negocio}?fields=id`, token);
  if (!propio.ok || propio.json?.id !== negocio) {
    console.warn("Conectar · token que no pertenece al negocio; se descarta.");
    return { status: 403, ok: false, mensaje: "Esa cuenta de Facebook no administra Potente Propiedades." };
  }

  // 3 · las cuentas de WhatsApp del negocio: la allow-list.
  const cuentasRes = await graph(`${negocio}/owned_whatsapp_business_accounts?fields=id,name`, token);
  let cuentas: { id: string; nombre: string }[] = (cuentasRes.json?.data ?? []).map((w: any) => ({ id: String(w.id), nombre: String(w.name ?? "") }));
  if (!cuentasRes.ok && wabaPedida) {
    // Sin permiso para listar: se acepta la cuenta del flujo solo si el token la lee.
    const una = await graph(`${wabaPedida}?fields=id,name`, token);
    if (una.ok) cuentas = [{ id: String(una.json.id), nombre: String(una.json.name ?? "") }];
  }
  const objetivo = wabaPedida ? cuentas.filter((w) => w.id === wabaPedida) : cuentas;
  if (!objetivo.length) {
    return { status: 403, ok: false, mensaje: "La cuenta de WhatsApp no pertenece a Potente Propiedades." };
  }

  // 4 · suscribir la app y leer el estado real de cada número. Sin `/register`.
  const numeros: NumeroConectado[] = [];
  for (const w of objetivo) {
    const sub = await graph(`${w.id}/subscribed_apps`, token, { method: "POST" });
    if (!sub.ok) console.warn(`Conectar · no se pudo suscribir la app a ${w.id}:`, sub.json?.error?.message);
    const nums = await graph(`${w.id}/phone_numbers?fields=id,display_phone_number,platform_type,is_on_biz_app,status`, token);
    for (const n of nums.json?.data ?? []) {
      numeros.push({
        id: String(n.id),
        numero: String(n.display_phone_number ?? ""),
        conectado: n.platform_type === "CLOUD_API" && n.is_on_biz_app === true,
        plataforma: String(n.platform_type ?? ""),
        enApp: n.is_on_biz_app === true,
        estado: String(n.status ?? ""),
      });
    }
  }

  const conectados = numeros.filter((n) => n.conectado).length;
  console.log(`Conectar · ${objetivo.length} cuenta(s) · ${numeros.length} número(s) · ${conectados} conectado(s) a la plataforma`);
  return {
    status: 200,
    ok: true,
    mensaje: conectados
      ? `${conectados} número${conectados > 1 ? "s" : ""} conectado${conectados > 1 ? "s" : ""} a la plataforma.`
      : "El flujo terminó, pero ningún número figura todavía conectado a la plataforma. Puede tardar un minuto: vuelva a consultar el estado.",
    numeros,
    cuentas: objetivo,
  };
}
