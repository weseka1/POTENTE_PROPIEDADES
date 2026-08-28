/**
 * INSTAGRAM: traer los DM leyéndolos, en vez de esperar a que Meta los avise.
 * ─────────────────────────────────────────────────────────────────────────────
 * ── POR QUÉ EXISTE (cicatriz 25-ago, 13:47) ─────────────────────────────────
 * El webhook de Instagram quedó configurado y activo, la Página suscripta a
 * `messages`, la cuenta vinculada… y el dueño mandó un DM de prueba y NO LLEGÓ
 * NADA. Medido: la app está en modo desarrollo, y en ese modo Meta no entrega
 * los avisos de mensajes de Instagram de gente sin rol en la app. WhatsApp sí
 * funciona porque juega con otras reglas (números propios en el Business propio).
 *
 * Pero el mismo token que no recibe avisos SÍ PUEDE LEER las conversaciones:
 *   GET /{PAGE_ID}/conversations?platform=instagram   → 200 con los hilos reales
 * Está probado contra la cuenta del cliente: devuelve hilos, participantes con
 * su usuario de Instagram, y el texto de cada mensaje.
 *
 * Así que Instagram entra por lectura periódica. No es un parche: es la ruta
 * documentada de la API de Mensajería de Instagram, con el token de Página del
 * propio cliente, sobre su propia cuenta. Y aunque mañana el webhook se
 * encienda, esto se queda como RED: si Meta pierde un aviso, si el servidor se
 * está reiniciando por un deploy o si el aviso llega mientras la base está
 * caída, el mensaje del cliente entra igual en la pasada siguiente. La regla de
 * la casa es que no se pierde una consulta de un cliente, nunca.
 *
 * La repetición no duplica nada: cada mensaje entra por la misma puerta
 * (`potente_ingresar_mensaje`), que es idempotente por id de mensaje.
 *
 * 🔴 El token que usa es de PÁGINA (no el del usuario del sistema): vive acotado
 * a la página del cliente, en el servidor del cliente, para leer los mensajes
 * del cliente. No vence. Nunca se loguea ni se devuelve en una respuesta.
 */
import type { MensajeEntrante } from "./_meta";
import { guardarMensajes, type ResultadoIngesta } from "./_ingesta";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Momento en que arrancó el proceso, con 10 minutos de gracia hacia atrás.
 *  Todo lo ANTERIOR se guarda como histórico (entra a la bandeja pero no grita
 *  "no leído"); lo posterior es novedad de verdad. Sin esto, la primera pasada
 *  marcaría meses de conversaciones viejas como sin leer. Los 10 minutos cubren
 *  el hueco de un reinicio por deploy: un DM que llegó justo antes sigue siendo
 *  nuevo. */
const ARRANQUE = Date.now() - 10 * 60_000;

export type ResultadoSync = ResultadoIngesta & { hilos: number; leidos: number; error?: string };

// `conversaciones` viene de ResultadoIngesta (022): son los hilos que recibieron
// un mensaje nuevo, y es lo que usa el server para despertar a Marina.
const vacio = (): ResultadoSync => ({ guardados: 0, repetidos: 0, fallados: 0, conversaciones: [], hilos: 0, leidos: 0 });

async function traer(ruta: string, token: string): Promise<any> {
  const url = `${GRAPH}/${ruta}${ruta.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const j: any = await r.json().catch(() => ({}));
  if (j?.error) throw new Error(`${j.error.code}: ${j.error.message}`);
  return j;
}

/** Un DM sin texto (una historia respondida, una foto, un audio) NO puede quedar
 *  vacío en la bandeja: una fila en blanco le hace creer al dueño que no
 *  escribieron nada. Misma regla que en el parser del webhook. */
const textoDe = (m: any): string =>
  String(m?.message ?? "").trim() ||
  (m?.story ? "📲 respondió una historia — miralo en Instagram" : "(mensaje sin texto — miralo en Instagram)");

/**
 * Lee los DM recientes de Instagram y los mete en la bandeja.
 * NUNCA tira: se lo llama desde un intervalo y desde un endpoint; un error acá
 * no puede voltear el servidor del cliente. Se loguea y se cuenta.
 */
export async function sincronizarInstagram(opciones: { horas?: number; tope?: number } = {}): Promise<ResultadoSync> {
  const pageId = process.env.META_PAGE_ID;
  const igId = process.env.META_IG_ID;
  const token = process.env.META_PAGE_TOKEN;
  if (!pageId || !igId || !token) return { ...vacio(), error: "sin configurar" };

  const horas = Math.max(1, Math.min(720, opciones.horas ?? 48));
  const tope = Math.max(1, Math.min(500, opciones.tope ?? 200));
  const desde = Date.now() - horas * 3_600_000;

  try {
    const hilos = await traer(`${pageId}/conversations?platform=instagram&fields=id,updated_time&limit=25`, token);
    const recientes = (hilos?.data ?? []).filter((h: any) => {
      const t = Date.parse(h?.updated_time ?? "");
      return Number.isFinite(t) && t >= desde;
    });

    const mensajes: MensajeEntrante[] = [];
    for (const hilo of recientes) {
      if (mensajes.length >= tope) break;
      const det = await traer(
        `${encodeURIComponent(hilo.id)}?fields=${encodeURIComponent("participants,messages.limit(20){id,created_time,from,message,story}")}`,
        token,
      );

      // El contacto es el participante que NO es la cuenta del negocio.
      const otro = (det?.participants?.data ?? []).find((p: any) => String(p?.id) !== igId);
      const contacto = String(otro?.id ?? "");
      if (!contacto) continue; // hilo raro (o consigo mismo): se saltea, no se inventa
      const nombre = String(otro?.username ?? otro?.name ?? "");

      for (const m of det?.messages?.data ?? []) {
        const cuando = Date.parse(m?.created_time ?? "");
        if (!m?.id || !Number.isFinite(cuando) || cuando < desde) continue;
        mensajes.push({
          canal: "instagram",
          mensajeId: String(m.id),
          contacto,
          nombre,
          texto: textoDe(m),
          hora: new Date(cuando).toISOString(),
          // Quién lo escribió: si sale de la cuenta del negocio, lo escribió una
          // persona de la oficina desde Instagram.
          de: String(m?.from?.id ?? "") === igId ? "humano" : "cliente",
          historico: cuando < ARRANQUE,
        });
      }
    }

    const res = await guardarMensajes(mensajes);
    return { ...res, hilos: recientes.length, leidos: mensajes.length };
  } catch (e: any) {
    // 🔴 Nunca en silencio: si esto se rompe, dejan de entrar los DM del cliente.
    console.error("Instagram · sincronización falló:", e?.message ?? e);
    return { ...vacio(), error: String(e?.message ?? e).slice(0, 200) };
  }
}

/** El latido: lo arranca el server si están las tres claves. Devuelve el timer
 *  para poder apagarlo en las pruebas. */
export function arrancarSincronizacionInstagram(segundos = 120): NodeJS.Timeout | null {
  if (!process.env.META_PAGE_ID || !process.env.META_IG_ID || !process.env.META_PAGE_TOKEN) {
    console.log("Instagram · sincronización APAGADA (faltan META_PAGE_ID / META_IG_ID / META_PAGE_TOKEN)");
    return null;
  }
  const cada = Math.max(30, segundos) * 1000;
  const tic = async () => {
    const r = await sincronizarInstagram();
    if (r.error) return; // ya se logueó
    if (r.guardados || r.fallados) {
      console.log(`Instagram · ${r.hilos} hilos · ${r.guardados} nuevos · ${r.repetidos} repetidos · ${r.fallados} fallados`);
    }
  };
  void tic(); // una pasada al arrancar, para no esperar el primer intervalo
  const t = setInterval(tic, cada);
  t.unref?.(); // que no impida apagar el proceso
  console.log(`Instagram · sincronización cada ${cada / 1000}s`);
  return t;
}
