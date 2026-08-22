/**
 * LA PUERTA DE ENTRADA DE LOS CANALES — WhatsApp e Instagram de Meta.
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo pidió Mateo (13-ago), textual:
 *
 *   "registrará los WhatsApp de su misma empresa, supervisará que no quede
 *    ningún mensaje colgado, verá cómo funciona la IA"
 *
 * Sus tres líneas viven en tres celulares distintos y él no ve nada. La bandeja
 * del panel está construida hace semanas y está VACÍA porque nada la alimenta.
 * Esto es lo que la alimenta.
 *
 * ── v1 SOLO ESCUCHA ──────────────────────────────────────────────────────────
 * Decisión de Juani (21-ago): el sistema LEE Y MUESTRA, no contesta. Acá no hay
 * un solo `POST` de vuelta a Meta, y es a propósito: elimina de un saque la
 * clase de riesgo que hizo caer a Bochile (que la IA le diga cualquier cosa al
 * cliente de un cliente), el costo por mensaje y la ventana de 24 h. El bot se
 * enchufa después sobre estas mismas tablas — el módulo que le falta es un
 * `enviar.ts` que hoy NO EXISTE.
 *
 * ── ESTE ARCHIVO NO IMPORTA EXPRESS, A PROPÓSITO ─────────────────────────────
 * Es el patrón de la casa (igual que `_core.ts` y `_geocodificar.ts`): el núcleo
 * es puro y lo comparten el server de Hostinger y las functions de Netlify. Los
 * envoltorios solo traducen request/response.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Un mensaje entrante, ya normalizado: WhatsApp e Instagram entran distinto y salen igual. */
export type MensajeEntrante = {
  canal: "whatsapp" | "instagram";
  /** El id único que da Meta (wamid / mid). Es la llave de la idempotencia. */
  mensajeId: string;
  /** Quién escribe: el teléfono en WhatsApp, el id de usuario en Instagram. */
  contacto: string;
  /** El nombre del perfil, si Meta lo manda. Puede venir vacío. */
  nombre: string;
  texto: string;
  hora: string;
};

/**
 * ¿La firma del pedido es de Meta?
 *
 * 🔴 Se calcula sobre el BODY CRUDO, byte por byte. Si alguien parsea el JSON
 * antes y vuelve a serializarlo, la firma no cierra nunca (un espacio de más
 * cambia el hash). Por eso la ruta del webhook usa `express.raw()` propio y va
 * ANTES del `express.json()` global del server.
 *
 * `timingSafeEqual` en vez de `===`: comparar hashes con `===` filtra, por el
 * tiempo que tarda, cuántos bytes coincidían. Es barato hacerlo bien.
 */
export function firmaValida(crudo: Buffer, cabecera: string | undefined, appSecret: string | undefined): boolean {
  if (!appSecret) return false;              // sin secreto configurado no se acepta nada (fail-closed)
  if (!cabecera?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", appSecret).update(crudo).digest("hex");
  const recibida = cabecera.slice("sha256=".length);
  // Longitudes distintas hacen que timingSafeEqual TIRE, no que devuelva false.
  if (recibida.length !== esperada.length) return false;
  return timingSafeEqual(Buffer.from(recibida, "hex"), Buffer.from(esperada, "hex"));
}

/** La verificación inicial: Meta pega un GET y espera SU challenge de vuelta, en texto plano. */
export function respuestaDeVerificacion(
  query: Record<string, unknown>,
  verifyToken: string | undefined,
): { status: number; texto: string } {
  const modo = String(query["hub.mode"] ?? "");
  const token = String(query["hub.verify_token"] ?? "");
  const challenge = String(query["hub.challenge"] ?? "");
  if (!verifyToken) return { status: 503, texto: "webhook sin configurar" };
  if (modo === "subscribe" && token === verifyToken) return { status: 200, texto: challenge };
  return { status: 403, texto: "no" };
}

/**
 * De lo que manda Meta a nuestra lista de mensajes.
 *
 * Devuelve SIEMPRE un array (vacío si el evento no era un mensaje). Meta manda
 * por el mismo webhook muchas cosas que no son mensajes —acuses de entrega,
 * "leído", cambios de perfil— y todas esas hay que ignorarlas en silencio y
 * responder 200: si contestás un error, Meta reintenta para siempre.
 */
export function parsearEntrada(cuerpo: any): MensajeEntrante[] {
  const salida: MensajeEntrante[] = [];
  const entradas = Array.isArray(cuerpo?.entry) ? cuerpo.entry : [];

  for (const entrada of entradas) {
    // ── WhatsApp Cloud API ──────────────────────────────────────────────────
    for (const cambio of Array.isArray(entrada?.changes) ? entrada.changes : []) {
      const valor = cambio?.value;
      const perfiles = new Map<string, string>();
      for (const c of Array.isArray(valor?.contacts) ? valor.contacts : []) {
        if (c?.wa_id) perfiles.set(String(c.wa_id), String(c?.profile?.name ?? ""));
      }
      for (const m of Array.isArray(valor?.messages) ? valor.messages : []) {
        const de = String(m?.from ?? "");
        if (!m?.id || !de) continue;
        salida.push({
          canal: "whatsapp",
          mensajeId: String(m.id),
          contacto: de,
          nombre: perfiles.get(de) ?? "",
          texto: textoDeWhatsApp(m),
          hora: horaDe(m?.timestamp),
        });
      }
    }

    // ── Instagram Messaging ─────────────────────────────────────────────────
    for (const ev of Array.isArray(entrada?.messaging) ? entrada.messaging : []) {
      const m = ev?.message;
      const de = String(ev?.sender?.id ?? "");
      if (!m?.mid || !de) continue;
      // `is_echo` son NUESTROS propios mensajes rebotando. Sin este filtro, cada
      // respuesta del vendedor se guardaría como si la hubiera escrito el cliente.
      if (m?.is_echo) continue;
      salida.push({
        canal: "instagram",
        mensajeId: String(m.mid),
        contacto: de,
        nombre: String(ev?.sender?.username ?? ""),
        texto: String(m?.text ?? "") || descripcionDeAdjunto(m?.attachments?.[0]?.type),
        hora: horaDe(ev?.timestamp),
      });
    }
  }
  return salida;
}

/**
 * Un mensaje de WhatsApp no siempre es texto.
 *
 * 🔴 Cuando llega un audio o una foto, NO se guarda vacío: se deja dicho qué
 * era. Una fila en blanco en la bandeja de Mateo es peor que no tenerla — lo
 * hace creer que el cliente no escribió nada. La regla de la casa es la misma
 * de siempre: los datos que faltan se dicen, no se esconden.
 */
function textoDeWhatsApp(m: any): string {
  if (m?.text?.body) return String(m.text.body);
  if (m?.button?.text) return String(m.button.text);
  if (m?.interactive?.button_reply?.title) return String(m.interactive.button_reply.title);
  if (m?.interactive?.list_reply?.title) return String(m.interactive.list_reply.title);
  if (m?.location) return `📍 ubicación (${m.location.latitude}, ${m.location.longitude})`;
  return descripcionDeAdjunto(m?.type);
}

function descripcionDeAdjunto(tipo: unknown): string {
  const t = String(tipo ?? "");
  const dic: Record<string, string> = {
    audio: "🎤 mensaje de voz — escuchalo en WhatsApp",
    voice: "🎤 mensaje de voz — escuchalo en WhatsApp",
    image: "📷 foto — miralas en el canal",
    video: "🎬 video — miralo en el canal",
    document: "📄 documento — abrilo en el canal",
    sticker: "🙂 sticker",
    contacts: "👤 contacto compartido",
    share: "🔗 contenido compartido",
    story_mention: "📲 te mencionó en una historia",
  };
  return dic[t] ?? (t ? `(${t}) — miralo en el canal` : "(mensaje sin texto)");
}

/** Meta manda epoch en SEGUNDOS (WhatsApp) o milisegundos (Instagram). */
function horaDe(ts: unknown): string {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n > 1e11 ? n : n * 1000).toISOString();
}
