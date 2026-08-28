/**
 * ENVIAR POR MANYCHAT — lo que sale del sistema hacia Instagram/WhatsApp.
 * ─────────────────────────────────────────────────────────────────────────────
 * 27-ago. Mateo: «no envía el mensaje desde el panel, quiere abrir Instagram;
 * debe poder laburarse desde el panel». Hasta hoy no había cómo: Meta no nos
 * deja mandar hasta el App Review. Con ManyChat en el medio sí: su API manda
 * un mensaje al contacto por el canal por el que escribió, dentro de la ventana
 * de 24 h que exige Meta. Y el contacto lo recibe en su Instagram/WhatsApp como
 * cualquier respuesta del negocio.
 *
 * Dos usos, un solo envío (`enviarTextoPorManychat`):
 *   · una persona del panel contesta un hilo (`enviarPorManychat`, con sesión);
 *   · Marina contesta sola un DM de Instagram (`_marina.ts`).
 *
 * ── QUIÉN PUEDE (desde el panel) ────────────────────────────────────────────
 * Solo una sesión del PANEL (JWT de Supabase), y solo sobre conversaciones que
 * esa sesión puede LEER: la conversación se busca con el token del usuario, así
 * que el RLS de la 015 decide (hoy: la dirección). Una oficina o un anónimo no
 * llegan ni a la llamada a ManyChat.
 *
 * ── DUPLICADOS ──────────────────────────────────────────────────────────────
 * La Respuesta predeterminada de ManyChat se dispara con mensajes DEL CONTACTO,
 * no con los nuestros: lo que mandamos por acá no vuelve por el puente. Quien
 * envía lo agrega al hilo él mismo (`envio: 'enviado'` desde el panel, `de: 'ia'`
 * cuando es Marina).
 */
const MANYCHAT = "https://api.manychat.com";
/** Instagram corta los mensajes largos: se parte por párrafo antes de ese tope. */
const TOPE_POR_MENSAJE = 950;

export type CanalManychat = "instagram" | "whatsapp";
export type PedidoEnvio = { convId?: unknown; texto?: unknown };
export type ResultadoEnvio = { status: number; ok: boolean; mensaje: string; canal?: string };

type Conv = { id: string; canal: string; nombre: string; contacto: string; externo?: Record<string, string> | null; estado?: string };

/** Un texto largo, en trozos que ManyChat acepta, cortando en los párrafos. */
export function partirParaEnviar(texto: string, tope = TOPE_POR_MENSAJE): string[] {
  const partes: string[] = [];
  let actual = "";
  for (const parrafo of texto.split(/\n{2,}/)) {
    const p = parrafo.trim();
    if (!p) continue;
    if (!actual) actual = p.slice(0, tope);
    else if ((actual + "\n\n" + p).length <= tope) actual += "\n\n" + p;
    else { partes.push(actual); actual = p.slice(0, tope); }
  }
  if (actual) partes.push(actual);
  return partes.length ? partes : [texto.slice(0, tope)];
}

/**
 * El envío en sí. No tira: devuelve el motivo para que quien llama decida qué
 * hacer (el panel lo muestra; Marina deja el hilo en manos de una persona).
 */
export async function enviarTextoPorManychat(
  subscriber: string,
  canal: CanalManychat,
  texto: string,
): Promise<{ ok: true } | { ok: false; mensaje: string; ventana: boolean }> {
  const apiKey = process.env.MANYCHAT_API_KEY;
  if (!apiKey) return { ok: false, mensaje: "El envío por ManyChat no está configurado.", ventana: false };
  if (!/^\d+$/.test(subscriber)) return { ok: false, mensaje: "Contacto sin id de ManyChat.", ventana: false };

  try {
    const r = await fetch(`${MANYCHAT}/fb/sending/sendContent`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriber_id: Number(subscriber),
        data: { version: "v2", content: { type: canal, messages: partirParaEnviar(texto).map((t) => ({ type: "text", text: t })) } },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j?.status !== "success") {
      const detalle = j?.message || j?.details?.messages?.[0]?.message || `HTTP ${r.status}`;
      // Lo más común: pasaron más de 24 h desde el último mensaje del contacto.
      // Meta no deja escribirle; hay que esperar a que vuelva a escribir.
      const ventana = /24|window|hour|policy/i.test(String(detalle));
      console.warn(`Enviar · ManyChat rechazó (${canal} · ${subscriber}): ${detalle}`);
      return {
        ok: false,
        ventana,
        mensaje: ventana
          ? "Pasaron más de 24 h desde su último mensaje: Instagram no permite escribirle hasta que vuelva a escribir."
          : `ManyChat no pudo enviarlo: ${String(detalle).slice(0, 120)}`,
      };
    }
    return { ok: true };
  } catch (e: any) {
    console.error("Enviar · error hablando con ManyChat:", e?.message ?? e);
    return { ok: false, mensaje: "No se pudo hablar con ManyChat. Probá de nuevo en un momento.", ventana: false };
  }
}

/**
 * El id de ManyChat de un contacto de Instagram, cuando el hilo no lo trae.
 *
 * Pasa con los hilos que entraron antes de la 021 y con los que ManyChat manda
 * sin `subscriber_id`. ManyChat no deja buscar por usuario de Instagram
 * (`findBySystemField` solo acepta telefono o mail), pero `findByName` devuelve
 * contactos con su `ig_username`: se busca y se toma el que coincide EXACTO.
 * Si no hay coincidencia clara devuelve null, y entonces el panel dice por que
 * no puede enviar — nunca abre Instagram por la espalda.
 */
export async function buscarSubscriber(igUsername: string, nombre: string): Promise<string | null> {
  const apiKey = process.env.MANYCHAT_API_KEY;
  const usuario = (igUsername || "").trim().toLowerCase();
  if (!apiKey || !usuario) return null;
  for (const consulta of [nombre, usuario].map((x) => (x ?? "").trim()).filter(Boolean)) {
    try {
      const r = await fetch(`${MANYCHAT}/fb/subscriber/findByName?name=${encodeURIComponent(consulta)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) continue;
      const j: any = await r.json().catch(() => ({}));
      const hallado = (j?.data ?? []).find((s: any) => String(s?.ig_username ?? "").toLowerCase() === usuario);
      if (hallado?.id) return String(hallado.id);
    } catch (e: any) {
      console.error("Enviar · buscando el contacto en ManyChat:", e?.message ?? e);
    }
  }
  return null;
}

/* ── LAS IDENTIDADES DE UN CONTACTO (024) ────────────────────────────────────
 * Una misma persona llega con dos nombres distintos: ManyChat la manda por su
 * usuario de Instagram y el webhook de Meta por su id interno. Si no sabemos que
 * son la misma, se abren dos hilos y la charla se parte al medio — que fue
 * exactamente lo que pasó el 28-ago en la primera prueba real.
 * ManyChat conoce las dos: se le pregunta una vez por contacto y se cachea.
 * Si no contesta, no se rompe nada: simplemente no se agrega esa identidad. */
const cacheIdentidades = new Map<string, { ids: Record<string, string>; hasta: number }>();
const TTL_IDENTIDAD = 6 * 60 * 60 * 1000;   // 6 h: el usuario de IG casi no cambia

export async function identidadesDelSubscriber(subscriberId: string): Promise<Record<string, string>> {
  const apiKey = process.env.MANYCHAT_API_KEY;
  if (!apiKey || !/^\d+$/.test(subscriberId)) return {};
  const cacheado = cacheIdentidades.get(subscriberId);
  if (cacheado && cacheado.hasta > Date.now()) return cacheado.ids;
  try {
    const r = await fetch(`${MANYCHAT}/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(subscriberId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return {};
    const j: any = await r.json().catch(() => ({}));
    const d = j?.data ?? {};
    const ids: Record<string, string> = {};
    if (d.ig_id) ids.ig_id = String(d.ig_id);
    if (d.ig_username) ids.ig_username = String(d.ig_username).toLowerCase();
    cacheIdentidades.set(subscriberId, { ids, hasta: Date.now() + TTL_IDENTIDAD });
    return ids;
  } catch (e: any) {
    console.error("Identidades · no se pudo preguntarle a ManyChat:", e?.message ?? e);
    return {};
  }
}

/** Lee la conversación CON EL TOKEN DEL USUARIO: si el RLS no lo deja, no existe. */
async function leerConversacion(convId: string, jwt: string): Promise<Conv | null> {
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  const r = await fetch(`${base}/rest/v1/potente_conversaciones?id=eq.${encodeURIComponent(convId)}&select=id,canal,nombre,contacto,externo,estado`, {
    headers: { apikey: anon, Authorization: `Bearer ${jwt}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) return null;
  const filas = (await r.json().catch(() => [])) as Conv[];
  return filas[0] ?? null;
}

/** Escribe en el hilo por la puerta del server (RPC con el token de ingesta). */
async function tocarHilo(convId: string, params: Record<string, unknown>): Promise<void> {
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const token = process.env.POTENTE_INGESTA_TOKEN;
  if (!base || !anon || !token) { console.error("Enviar · sin credenciales para tocar el hilo"); return; }
  try {
    const r = await fetch(`${base}/rest/v1/rpc/potente_conversacion_actualizar`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token, p_id: convId, ...params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) console.error(`Enviar · la base rechazo tocar ${convId}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  } catch (e: any) {
    console.error("Enviar · error tocando el hilo:", e?.message ?? e);
  }
}

const guardarSubscriber = (convId: string, subscriber: string) =>
  tocarHilo(convId, { p_externo: { manychat_subscriber_id: subscriber } });

/** 023 · Cadena vacia = LIMPIAR (asi se distingue de "no toques"). */
const limpiarBorrador = (convId: string) => tocarHilo(convId, { p_borrador: "" });

/** Una persona del panel responde un hilo. Cada envío nace de alguien apretando "Enviar". */
export async function enviarPorManychat(pedido: PedidoEnvio, authorization: string | undefined): Promise<ResultadoEnvio> {
  const jwt = (authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { status: 401, ok: false, mensaje: "Sin sesión del panel." };
  if (!process.env.MANYCHAT_API_KEY) return { status: 503, ok: false, mensaje: "El envío por ManyChat no está configurado." };

  const convId = typeof pedido.convId === "string" ? pedido.convId.trim() : "";
  const texto = typeof pedido.texto === "string" ? pedido.texto.trim().slice(0, 2000) : "";
  if (!convId) return { status: 400, ok: false, mensaje: "Falta la conversación." };
  if (!texto) return { status: 400, ok: false, mensaje: "El mensaje está vacío." };

  const conv = await leerConversacion(convId, jwt);
  if (!conv) return { status: 404, ok: false, mensaje: "No se encontró la conversación (o no tenés permiso para verla)." };
  if (conv.estado === "cerrada") return { status: 409, ok: false, mensaje: "La conversación está cerrada. Reabrila para responder." };

  /* 🔒 El server tiene el MISMO candado que el panel: WhatsApp es supervisión
   * (decisión 27-ago). Si el botón alguna vez se equivoca, acá no sale igual. */
  const canal: CanalManychat | null = conv.canal === "instagram" ? "instagram" : null;
  if (!canal) {
    return {
      status: 400, ok: false, canal: conv.canal,
      mensaje: conv.canal === "whatsapp"
        ? "WhatsApp es solo supervisión: las respuestas las mandan las oficinas desde su celular."
        : `Por ${conv.canal} no se envía desde acá.`,
    };
  }

  let subscriber = String(conv.externo?.manychat_subscriber_id ?? "").trim();
  if (!/^\d+$/.test(subscriber)) {
    // Segunda chance antes de rendirse: buscarlo en ManyChat y dejarlo guardado
    // para la próxima. Recién si no aparece se dice que no se puede.
    const hallado = canal === "instagram"
      ? await buscarSubscriber(String(conv.externo?.ig_username ?? conv.contacto ?? ""), conv.nombre ?? "")
      : null;
    if (!hallado) {
      return {
        status: 409, ok: false, canal: conv.canal,
        mensaje: "Todavía no puedo escribirle por acá: este contacto no está enlazado en ManyChat. Se enlaza solo cuando la persona vuelve a escribirte.",
      };
    }
    subscriber = hallado;
    await guardarSubscriber(conv.id, subscriber);
  }

  const envio = await enviarTextoPorManychat(subscriber, canal, texto);
  if (!envio.ok) return { status: 502, ok: false, canal: conv.canal, mensaje: envio.mensaje };
  // Enviado: si venía de un borrador de Marina, ya no hay nada pendiente.
  await limpiarBorrador(conv.id);
  return { status: 200, ok: true, mensaje: `Enviado por ${canal === "instagram" ? "Instagram" : "WhatsApp"}.`, canal: conv.canal };
}
