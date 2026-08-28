/**
 * MANYCHAT → LA BANDEJA: el puente mientras Meta no habilita nuestra app.
 * ─────────────────────────────────────────────────────────────────────────────
 * ── POR QUÉ EXISTE (27-ago) ─────────────────────────────────────────────────
 * Nuestra app de Meta está esperando la verificación del negocio, y hasta que
 * salga Meta no entrega ni un DM de Instagram. ManyChat es Solution Partner con
 * app ya aprobada: conecta Instagram en dos minutos y WhatsApp por Coexistence.
 * Decisión de Juani: usar sus 14 días de prueba para que Mateo vea el sistema
 * andando con conversaciones reales. Pero las conversaciones tienen que verse
 * EN NUESTRO PANEL, no adentro de ManyChat — y para eso ManyChat nos las manda
 * acá, con su acción "External Request" en cada mensaje que le llega.
 *
 * ── CÓMO ENTRA ──────────────────────────────────────────────────────────────
 * ManyChat hace un POST con lo que sabe del contacto y el último texto. Acá se
 * normaliza a `MensajeEntrante` y se guarda por la MISMA puerta que Meta
 * (`potente_ingresar_mensaje`, migraciones 018/019/020): idempotente, con RLS,
 * sin service_role. Un mensaje que entre dos veces (ManyChat reintenta) no se
 * duplica: si no manda id, se fabrica uno estable con contacto + texto + minuto.
 *
 * ── LO QUE NO TRAE ──────────────────────────────────────────────────────────
 * ManyChat solo ve lo que le llega y lo que él mismo manda: las respuestas que
 * la oficina escribe desde la app de Instagram/WhatsApp NO pasan por acá. Esos
 * hilos van a parecer sin responder hasta que entre nuestra app propia (que sí
 * recibe los ecos). Es un puente, no el destino.
 *
 * 🔒 Lo protege un token PROPIO (MANYCHAT_TOKEN), distinto del de la ingesta de
 * la base: ManyChat es un tercero, y si ese token se filtra se rota solo ese.
 */
import { createHash } from "node:crypto";
import type { MensajeEntrante } from "./_meta";
import { guardarMensajes, type ResultadoIngesta } from "./_ingesta";
import { responderEnInstagram } from "./_marina";
import { identidadesDelSubscriber } from "./_enviar";

export type EntradaManychat = {
  canal?: unknown;        // "instagram" | "whatsapp"
  contacto?: unknown;     // usuario de Instagram o teléfono
  nombre?: unknown;
  texto?: unknown;
  mensaje_id?: unknown;   // opcional: si no viene, se fabrica uno estable
  hora?: unknown;         // opcional: ISO o epoch; si no viene, ahora
  subscriber_id?: unknown;
  /** Lo que ManyChat manda cuando el DM NO es texto (foto, audio, sticker,
   *  respuesta a una historia). Ver `textoDeEntrada`. */
  tipo?: unknown;
  adjunto?: unknown;
  attachment_type?: unknown;
};

/**
 * 🔴 UN DM QUE NO ES TEXTO NO PUEDE PERDERSE (28-ago).
 *
 * El webhook de Meta traduce los adjuntos hace semanas ("🎤 mensaje de voz",
 * "📷 foto") justamente porque una fila vacía en la bandeja es peor que no
 * tenerla: hace creer que la persona no escribió nada. Este puente no lo hacía:
 * un DM que fuera solo una foto o un audio se caía con 400 y **desaparecía sin
 * dejar rastro**. En Instagram, responder una historia o mandar un audio es de
 * lo más común que hay.
 */
function textoDeEntrada(entrada: EntradaManychat): string {
  const texto = limpio(entrada.texto);
  if (texto) return texto;
  const tipo = limpio(entrada.tipo ?? entrada.attachment_type ?? entrada.adjunto, 40).toLowerCase();
  const dic: Record<string, string> = {
    image: "📷 foto — miralas en Instagram",
    photo: "📷 foto — miralas en Instagram",
    audio: "🎤 mensaje de voz — escuchalo en Instagram",
    voice: "🎤 mensaje de voz — escuchalo en Instagram",
    video: "🎬 video — miralo en Instagram",
    file: "📄 archivo — abrilo en Instagram",
    sticker: "🙂 sticker",
    story_mention: "📲 te mencionó en una historia",
    story_reply: "📲 respondió a una historia",
    share: "🔗 compartió una publicación",
    reel: "🔗 compartió un reel",
  };
  if (dic[tipo]) return dic[tipo];
  return tipo ? `(${tipo}) — miralo en Instagram` : "";
}

export type ResultadoManychat = { status: number; ok: boolean; mensaje: string; resultado?: ResultadoIngesta };

const limpio = (v: unknown, max = 4000): string => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");

/** Contacto normalizado: teléfono → solo dígitos; Instagram → usuario sin @, en minúsculas. */
function contactoDe(canal: "instagram" | "whatsapp", crudo: string, subscriber: string): string {
  if (canal === "whatsapp") {
    const digitos = crudo.replace(/\D/g, "");
    return digitos.length >= 8 ? digitos : "";
  }
  const usuario = crudo.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9._]/g, "");
  return usuario || (subscriber ? `mc-${subscriber}` : "");
}

function horaDe(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return new Date(v > 1e11 ? v : v * 1000).toISOString();
  if (typeof v === "string" && v.trim()) {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return new Date(t).toISOString();
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return new Date(n > 1e11 ? n : n * 1000).toISOString();
  }
  return new Date().toISOString();
}

export function normalizarManychat(entrada: EntradaManychat): { ok: true; mensaje: MensajeEntrante } | { ok: false; error: string } {
  const canalCrudo = limpio(entrada.canal, 20).toLowerCase();
  const canal: "instagram" | "whatsapp" | null =
    canalCrudo.startsWith("insta") || canalCrudo === "ig" ? "instagram" : canalCrudo.startsWith("whats") || canalCrudo === "wa" ? "whatsapp" : null;
  if (!canal) return { ok: false, error: "canal tiene que ser instagram o whatsapp" };

  const subscriber = limpio(entrada.subscriber_id, 64);
  const contacto = contactoDe(canal, limpio(entrada.contacto, 120), subscriber);
  if (!contacto) return { ok: false, error: "falta el contacto (usuario de Instagram o teléfono)" };

  const texto = textoDeEntrada(entrada);
  if (!texto) return { ok: false, error: "el mensaje llegó sin texto ni tipo de adjunto reconocible" };

  const hora = horaDe(entrada.hora);
  let mensajeId = limpio(entrada.mensaje_id, 120);
  if (!mensajeId) {
    // Estable por contacto + texto + minuto: un reintento de ManyChat repite
    // el mismo id y la base lo descarta; dos mensajes iguales en minutos
    // distintos entran los dos.
    const minuto = hora.slice(0, 16);
    mensajeId = "mc-" + createHash("sha1").update(`${canal}|${contacto}|${texto}|${minuto}`).digest("hex").slice(0, 24);
  }

  // Lo que hace falta para RESPONDER después por ManyChat (021): su id de
  // contacto. Sin esto el panel solo puede "copiar y abrir".
  const externo: Record<string, string> = {};
  if (/^\d+$/.test(subscriber)) externo.manychat_subscriber_id = subscriber;
  if (canal === "instagram") externo.ig_username = contacto; else externo.telefono = contacto;

  return {
    ok: true,
    mensaje: { canal, mensajeId, contacto, nombre: limpio(entrada.nombre, 120), texto, hora, de: "cliente", externo, fuente: "manychat" },
  };
}

/**
 * 🔴 NINGÚN MENSAJE SE DESCARTA EN SILENCIO (28-ago).
 *
 * Un DM de Juani no llegó al panel y se fueron horas para saber si ManyChat no
 * lo había mandado o si lo habíamos rechazado nosotros: esta ruta tenía cuatro
 * salidas —token, texto, canal, cupo— y ninguna dejaba una línea. No se puede
 * depurar lo que no se anota, y es la misma regla que los errores de base que
 * ya costaron leads dos veces.
 *
 * Se loguea CON QUÉ y POR QUÉ, nunca el texto del mensaje (es de un cliente de
 * Mateo) ni el token.
 */
function rechazo(motivo: string, entrada: EntradaManychat): void {
  const canal = limpio(entrada.canal, 20) || "?";
  const contacto = limpio(entrada.contacto, 60) || "?";
  const sub = limpio(entrada.subscriber_id, 40) || "-";
  console.error(`ManyChat · DESCARTADO (${motivo}) · canal=${canal} contacto=${contacto} subscriber=${sub}`);
}

export async function ingresarDesdeManychat(entrada: EntradaManychat, tokenDado: string | undefined): Promise<ResultadoManychat> {
  const esperado = process.env.MANYCHAT_TOKEN;
  if (!esperado) {
    rechazo("el puente no está configurado (falta MANYCHAT_TOKEN en el server)", entrada);
    return { status: 503, ok: false, mensaje: "El puente con ManyChat no está configurado." };
  }
  if (!tokenDado || tokenDado !== esperado) {
    rechazo(tokenDado ? "token distinto del configurado" : "vino sin token", entrada);
    return { status: 401, ok: false, mensaje: "No autorizado." };
  }

  const n = normalizarManychat(entrada);
  if (!n.ok) {
    rechazo(n.error, entrada);
    return { status: 400, ok: false, mensaje: n.error };
  }

  /* 024 · Antes de guardar, se le pregunta a ManyChat cómo se llama esta persona
   * del lado de Meta (`ig_id`). Con eso, el mensaje que después llegue por el
   * webhook de Meta —que usa ese id— cae en el MISMO hilo en vez de abrir uno
   * nuevo. Es una llamada por contacto, cacheada 6 h. */
  const subscriber = String(n.mensaje.externo?.manychat_subscriber_id ?? "");
  if (subscriber) {
    const otras = await identidadesDelSubscriber(subscriber);
    if (Object.keys(otras).length) n.mensaje.externo = { ...(n.mensaje.externo ?? {}), ...otras };
  }

  const resultado = await guardarMensajes([n.mensaje]);
  if (resultado.fallados) {
    rechazo("la base rechazó el mensaje", entrada);
    return { status: 502, ok: false, mensaje: "La base rechazó el mensaje.", resultado };
  }
  console.log(`ManyChat · ${resultado.repetidos ? "repetido" : "ENTRÓ"} · ${n.mensaje.canal} · ${n.mensaje.contacto}`);

  // 27-ago · Marina contesta los DM de Instagram que entraron NUEVOS (no los
  // repetidos: ManyChat reintenta, y a nadie se le escribe dos veces). Corre
  // DESPUÉS de responderle a ManyChat, para no colgar su timeout; WhatsApp no
  // pasa por acá (`_marina.ts` lo filtra: es supervisión, no atención).
  for (const id of resultado.conversaciones) {
    setImmediate(() => responderEnInstagram(id).catch((e) => console.error("Marina · Instagram:", e?.message ?? e)));
  }
  return { status: 200, ok: true, mensaje: resultado.repetidos ? "Ya estaba." : "Guardado.", resultado };
}
