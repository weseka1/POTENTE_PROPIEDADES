/**
 * RESPONDER DESDE EL PANEL — el envío por ManyChat.
 * ─────────────────────────────────────────────────────────────────────────────
 * 27-ago. Mateo: «no envía el mensaje desde el panel, quiere abrir Instagram;
 * debe poder laburarse desde el panel». Hasta hoy no había cómo: Meta no nos
 * deja mandar hasta el App Review. Con ManyChat en el medio sí: su API manda
 * un mensaje al contacto por el canal por el que escribió, dentro de la ventana
 * de 24 h que exige Meta. Y el contacto lo recibe en su Instagram/WhatsApp como
 * cualquier respuesta del negocio.
 *
 * ── QUIÉN PUEDE ─────────────────────────────────────────────────────────────
 * Solo una sesión del PANEL (JWT de Supabase), y solo sobre conversaciones que
 * esa sesión puede LEER: la conversación se busca con el token del usuario, así
 * que el RLS de la 015 decide (hoy: la dirección). Una oficina o un anónimo no
 * llegan ni a la llamada a ManyChat.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 * No manda nada solo. Cada envío nace de una persona apretando "Enviar" en el
 * panel. La decisión de Juani (WhatsApp no contesta por su cuenta) sigue intacta:
 * esto es una persona respondiendo, con el panel como teclado.
 *
 * ── DUPLICADOS ──────────────────────────────────────────────────────────────
 * La Respuesta predeterminada de ManyChat se dispara con mensajes DEL CONTACTO,
 * no con los nuestros: lo que mandamos por acá no vuelve por el puente. El panel
 * lo agrega al hilo él mismo, con `envio: 'enviado'`.
 */
const MANYCHAT = "https://api.manychat.com";

export type PedidoEnvio = { convId?: unknown; texto?: unknown };
export type ResultadoEnvio = { status: number; ok: boolean; mensaje: string; canal?: string };

type Conv = { id: string; canal: string; nombre: string; externo?: Record<string, string> | null; estado?: string };

/** Lee la conversación CON EL TOKEN DEL USUARIO: si el RLS no lo deja, no existe. */
async function leerConversacion(convId: string, jwt: string): Promise<Conv | null> {
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  const r = await fetch(`${base}/rest/v1/potente_conversaciones?id=eq.${encodeURIComponent(convId)}&select=id,canal,nombre,externo,estado`, {
    headers: { apikey: anon, Authorization: `Bearer ${jwt}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) return null;
  const filas = (await r.json().catch(() => [])) as Conv[];
  return filas[0] ?? null;
}

export async function enviarPorManychat(pedido: PedidoEnvio, authorization: string | undefined): Promise<ResultadoEnvio> {
  const jwt = (authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { status: 401, ok: false, mensaje: "Sin sesión del panel." };

  const apiKey = process.env.MANYCHAT_API_KEY;
  if (!apiKey) return { status: 503, ok: false, mensaje: "El envío por ManyChat no está configurado." };

  const convId = typeof pedido.convId === "string" ? pedido.convId.trim() : "";
  const texto = typeof pedido.texto === "string" ? pedido.texto.trim().slice(0, 1000) : "";
  if (!convId) return { status: 400, ok: false, mensaje: "Falta la conversación." };
  if (!texto) return { status: 400, ok: false, mensaje: "El mensaje está vacío." };

  const conv = await leerConversacion(convId, jwt);
  if (!conv) return { status: 404, ok: false, mensaje: "No se encontró la conversación (o no tenés permiso para verla)." };
  if (conv.estado === "cerrada") return { status: 409, ok: false, mensaje: "La conversación está cerrada. Reabrila para responder." };

  const subscriber = String(conv.externo?.manychat_subscriber_id ?? "").trim();
  if (!/^\d+$/.test(subscriber)) {
    return { status: 400, ok: false, mensaje: "Esta conversación no entró por ManyChat: no hay por dónde enviar. Usá 'Copiar y abrir'." };
  }
  const tipo = conv.canal === "instagram" ? "instagram" : conv.canal === "whatsapp" ? "whatsapp" : null;
  if (!tipo) return { status: 400, ok: false, mensaje: `Por ${conv.canal} no se envía desde acá.` };

  try {
    const r = await fetch(`${MANYCHAT}/fb/sending/sendContent`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriber_id: Number(subscriber),
        data: { version: "v2", content: { type: tipo, messages: [{ type: "text", text: texto }] } },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j?.status !== "success") {
      const detalle = j?.message || j?.details?.messages?.[0]?.message || `HTTP ${r.status}`;
      // Lo más común: pasaron más de 24 h desde el último mensaje del contacto.
      // Meta no deja escribirle; hay que esperar a que vuelva a escribir.
      const ventana = /24|window|hour|policy/i.test(String(detalle));
      console.warn(`Enviar · ManyChat rechazó (${conv.canal} · ${convId}): ${detalle}`);
      return {
        status: 502, ok: false, canal: conv.canal,
        mensaje: ventana
          ? "Pasaron más de 24 h desde su último mensaje: Instagram no permite escribirle hasta que vuelva a escribir."
          : `ManyChat no pudo enviarlo: ${String(detalle).slice(0, 120)}`,
      };
    }
    return { status: 200, ok: true, mensaje: `Enviado por ${conv.canal === "instagram" ? "Instagram" : "WhatsApp"}.`, canal: conv.canal };
  } catch (e: any) {
    console.error("Enviar · error hablando con ManyChat:", e?.message ?? e);
    return { status: 502, ok: false, mensaje: "No se pudo hablar con ManyChat. Probá de nuevo en un momento." };
  }
}
