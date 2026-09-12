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
 * ── 🔴 POR QUÉ SE REESCRIBIÓ EL CANDADO (12-sep) ─────────────────────────────
 * El candado original exigía que el token devuelto por Meta pudiera leer
 * `META_BUSINESS_ID`, el portfolio de siempre. Parecía sensato y era una bomba:
 *
 *   · Meta NO deja que el portfolio DUEÑO DE LA APP sea el cliente del registro
 *     integrado —medido con captura el 11-sep: sale gris, "This Meta Business
 *     Account owns the app"—, así que el flujo real va a venir SIEMPRE desde
 *     otro portfolio, y el token de ese flujo es del portfolio del cliente.
 *   · O sea: el candado habría cortado con 403 **después** del QR, con el
 *     celular de la oficina ya tocado de forma irreversible y la bandeja igual
 *     de vacía, sin un solo error en ningún log nuestro. Nunca se ejecutó en la
 *     vida real, así que nadie lo vio fallar.
 *   · Y el rescate de más abajo solo disparaba cuando el listado FALLABA. Si el
 *     listado contestaba bien pero VACÍO —el caso exacto de un portfolio
 *     distinto— no disparaba, y caía igual en el 403.
 *
 * El candado ahora es otro, y es el correcto: **el token tiene que llegar a un
 * teléfono que sea de Potente**. Los teléfonos salen de `src/config/marca.ts`,
 * que ya es la fuente de verdad de las oficinas (y se pueden sumar más por
 * `META_TELEFONOS_CLIENTE` sin tocar código). Un desconocido que corra el flujo
 * con su propio Facebook llega a SUS números, que no están en la lista → 403 y
 * no se toca nada. Y funciona sin importar en qué portfolio nazca la cuenta,
 * que es justo lo que no sabemos de antemano.
 *
 * 🔴 NUNCA se registra el número (`/register`): en Coexistence ya está
 * registrado y repetirlo rompe la app del celular de la oficina. Este módulo no
 * tiene esa llamada a propósito, y no debe ganarla.
 *
 * 🔴 Ningún token de larga vida vive en este server (corre en el hosting del
 * cliente). Por eso TODO lo que necesita ese token pasa en ESTA MISMA petición:
 * suscribir la app y disparar la sincronización del historial. Meta da 24 h
 * para sincronizar o hay que desconectar el número y rehacer el flujo entero —
 * y nuestro único token durable es de otro portfolio y no llegaría. Se hace
 * acá o no se hace nunca.
 */
import { OFICINAS } from "../../src/config/marca.js";

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

/* ── El candado, en frío ──────────────────────────────────────────────────────
 * Puro y exportado a propósito: es la parte que decide si se toca algo o no, y
 * con un `code` real no se puede probar (vence a los 30 s y es de un solo uso).
 * Se prueba con `npm run verificar-conectar`. */

export function soloDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D+/g, "");
}

/**
 * Los últimos 10 dígitos: área + número.
 *
 * 🔴 El mismo teléfono argentino se escribe de cuatro formas según quién lo
 * mande — "+54 9 223 512-9032", "5492235129032", "542235129032", "2235129032"—
 * y comparar los strings enteros da distinto siempre. La cola de 10 es lo único
 * estable entre todas.
 */
export function colaTelefono(v: unknown): string {
  const d = soloDigitos(v);
  return d.length >= 10 ? d.slice(-10) : "";
}

/** Los teléfonos que este server acepta conectar: las oficinas + lo que sume el entorno. */
export function telefonosDelCliente(extra?: string): string[] {
  const desdeMarca = OFICINAS.map((o) => o.whatsapp);
  const desdeEnv = String(extra ?? "").split(/[,;\s]+/).filter(Boolean);
  const colas = [...desdeMarca, ...desdeEnv].map(colaTelefono).filter(Boolean);
  return [...new Set(colas)];
}

/** ¿Este número es de Potente? Sin lista, NADIE pasa (la puerta cierra sola). */
export function esDelCliente(numero: unknown, permitidos: string[]): boolean {
  const cola = colaTelefono(numero);
  return !!cola && permitidos.includes(cola);
}

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
  if (!appId || !secreto) {
    return { status: 503, ok: false, mensaje: "La conexión todavía no está configurada en el servidor." };
  }

  const permitidos = telefonosDelCliente(process.env.META_TELEFONOS_CLIENTE);
  if (!permitidos.length) {
    // Fail-closed: sin lista de teléfonos no se conecta nada. Nunca "por las dudas sí".
    console.error("Conectar · no hay teléfonos permitidos configurados; se rechaza todo.");
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

  /* 2 · las cuentas candidatas.
   * Primero la que devolvió el propio flujo —es la que el cliente acaba de
   * elegir o crear, y puede vivir en un portfolio que nosotros no conocemos—.
   * El listado de los negocios conocidos es el complemento, no el filtro: si
   * vuelve vacío o falla, NO se descarta nada todavía. Quien decide es el
   * candado de teléfonos del paso 3. */
  const candidatas = new Map<string, string>();
  if (wabaPedida) {
    const una = await graph(`${wabaPedida}?fields=id,name`, token);
    if (una.ok && una.json?.id) candidatas.set(String(una.json.id), String(una.json.name ?? ""));
    else console.warn(`Conectar · el token no pudo leer la cuenta ${wabaPedida}:`, una.json?.error?.message ?? "sin detalle");
  }
  for (const negocio of String(process.env.META_BUSINESS_ID ?? "").split(/[,;\s]+/).filter(Boolean)) {
    const lista = await graph(`${negocio}/owned_whatsapp_business_accounts?fields=id,name`, token);
    for (const w of lista.json?.data ?? []) candidatas.set(String(w.id), String(w?.name ?? ""));
  }
  if (!candidatas.size) {
    console.warn("Conectar · el token no llegó a ninguna cuenta de WhatsApp.");
    return { status: 403, ok: false, mensaje: "No pudimos ver la cuenta de WhatsApp que elegiste. Volvé a intentar." };
  }

  /* 3 · 🔒 EL CANDADO: la cuenta tiene que tener un teléfono de Potente.
   * Leer los números es además lo que necesitamos para el paso 4, así que no
   * cuesta una llamada de más. */
  const numeros: NumeroConectado[] = [];
  const aceptadas: { id: string; nombre: string }[] = [];
  const paraSincronizar: string[] = [];
  for (const [id, nombre] of candidatas) {
    const nums = await graph(`${id}/phone_numbers?fields=id,display_phone_number,platform_type,is_on_biz_app,status`, token);
    const filas = (nums.json?.data ?? []) as any[];
    if (!filas.some((n) => esDelCliente(n?.display_phone_number, permitidos))) continue;
    aceptadas.push({ id, nombre });
    for (const n of filas) {
      /* Solo viajan los números de Potente: si el cliente tiene otros en la
       * misma cuenta, no son asunto de este panel y no se muestran. */
      if (!esDelCliente(n?.display_phone_number, permitidos)) continue;
      numeros.push({
        id: String(n.id),
        numero: String(n.display_phone_number ?? ""),
        conectado: n.platform_type === "CLOUD_API" && n.is_on_biz_app === true,
        plataforma: String(n.platform_type ?? ""),
        enApp: n.is_on_biz_app === true,
        estado: String(n.status ?? ""),
      });
      if (n.is_on_biz_app === true) paraSincronizar.push(String(n.id));
    }
  }
  if (!aceptadas.length) {
    console.warn("Conectar · ninguna cuenta alcanzada tiene un teléfono de Potente; se descarta el token.");
    return { status: 403, ok: false, mensaje: "Esa cuenta de WhatsApp no es la de Potente Propiedades." };
  }

  // 4 · suscribir la app: sin esto Meta no entrega los webhooks, y falla en silencio.
  for (const w of aceptadas) {
    const sub = await graph(`${w.id}/subscribed_apps`, token, { method: "POST" });
    if (!sub.ok) console.error(`Conectar · NO se pudo suscribir la app a ${w.id}:`, sub.json?.error?.message ?? "sin detalle");
    else console.log(`Conectar · app suscripta a ${w.id}`);
  }

  /* 5 · 🔴 LA SINCRONIZACIÓN, ACÁ MISMO Y NO DESPUÉS.
   * Meta da 24 h desde el alta para pedir el historial; pasadas, hay que
   * desconectar el número y rehacer todo, y el historial no se recupera. El
   * único token que puede pedirlo es este, que vive lo que dura esta petición.
   * Primero el estado de la app, después el historial: ese orden lo pide Meta.
   * Si falla, se loguea fuerte pero NO se rompe la respuesta: el número ya
   * quedó conectado y eso es lo que el cliente tiene que ver. */
  let sincronizados = 0;
  for (const phoneId of paraSincronizar) {
    for (const tipo of ["smb_app_state_sync", "history"]) {
      const s = await graph(`${phoneId}/smb_app_data?sync_type=${tipo}`, token, { method: "POST" });
      if (s.ok) { if (tipo === "history") sincronizados++; }
      else console.error(`Conectar · falló la sincronización ${tipo} de ${phoneId}:`, s.json?.error?.message ?? "sin detalle");
    }
  }

  const conectados = numeros.filter((n) => n.conectado).length;
  console.log(
    `Conectar · ${aceptadas.length} cuenta(s) · ${numeros.length} número(s) de Potente · ` +
    `${conectados} en la plataforma · ${sincronizados} historial(es) pedido(s)`,
  );
  return {
    status: 200,
    ok: true,
    mensaje: conectados
      ? `${conectados} número${conectados > 1 ? "s" : ""} conectado${conectados > 1 ? "s" : ""} a la plataforma.`
      : "El flujo terminó, pero ningún número figura todavía conectado a la plataforma. Puede tardar un minuto: vuelva a consultar el estado.",
    numeros,
    cuentas: aceptadas,
  };
}
