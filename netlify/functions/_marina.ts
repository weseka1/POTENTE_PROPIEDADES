/**
 * MARINA FUERA DEL WIDGET — lo que el server hace alrededor de una respuesta.
 * ─────────────────────────────────────────────────────────────────────────────
 * 27-ago. Dos cosas que la web ya hacía a medias y los canales no hacían:
 *
 *   · INSTAGRAM: un DM entra por ManyChat a la bandeja; si el hilo está en manos
 *     de Marina (`estado = 'ia'`) y el interruptor del panel está prendido, ella
 *     contesta con la cartera viva y el cerebro guardado, y la respuesta sale por
 *     ManyChat al Instagram del contacto. Si una persona tomó el hilo, Marina se
 *     calla hasta que se lo devuelvan ("Devolver a Marina"). Si no puede
 *     contestar o no puede enviar, el hilo pasa a una persona CON el motivo:
 *     nunca un silencio.
 *     🔒 WhatsApp NO pasa por acá. Decisión de Juani (27-ago): «wpp no debe
 *     responder, lo van a manejar ellos». Es supervisión, no atención.
 *
 *   · WEB: la charla del widget queda en la bandeja (canal Web, un hilo por
 *     visita) y, cuando la persona deja contacto, la consulta nace VINCULADA a
 *     ese hilo. Es lo que pidió Mateo: abrir "Eric" y leer qué preguntó.
 *
 * Todo escribe por las funciones de la base con el token de ingesta (018 → 022).
 * Nada de service_role: este server corre en el hosting del cliente.
 */
import { createHash } from "node:crypto";
import { atenderAsistente } from "./_core";
import { catalogoDesdeLaBase } from "./_catalogo";
import { leerCerebro } from "./_iaconfig";
import { guardarMensajes } from "./_ingesta";
import { enviarTextoPorManychat } from "./_enviar";
import type { CampoLite } from "./_prompt";
import { SITIO, waUrl } from "../../src/config/marca";

type MensajeHilo = { id: string; de: "cliente" | "ia" | "humano"; texto: string; horaISO: string };
type Hilo = {
  id: string;
  canal: string;
  nombre: string;
  contacto: string;
  estado: "ia" | "vos" | "cerrada";
  mensajes: MensajeHilo[];
  externo?: Record<string, string> | null;
  propiedadId?: string | null;
  leadId?: string | null;
  borrador?: string | null;
};

const sha = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 24);
const idCorto = (prefijo: string) => `${prefijo}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

// ── La base, siempre por RPC con el token ────────────────────────────────────
function credenciales() {
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const token = process.env.POTENTE_INGESTA_TOKEN;
  return base && anon && token ? { base, anon, token } : null;
}

async function rpc<T>(nombre: string, params: Record<string, unknown>): Promise<T | undefined> {
  const c = credenciales();
  if (!c) { console.error(`Marina · ${nombre}: sin base configurada`); return undefined; }
  try {
    const r = await fetch(`${c.base}/rest/v1/rpc/${nombre}`, {
      method: "POST",
      headers: { apikey: c.anon, Authorization: `Bearer ${c.anon}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: c.token, ...params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) { console.error(`Marina · ${nombre}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); return undefined; }
    return (await r.json()) as T;
  } catch (e: any) {
    console.error(`Marina · ${nombre}:`, e?.message ?? e);
    return undefined;
  }
}

export const leerHilo = (id: string) => rpc<Hilo | null>("potente_conversacion_leer", { p_id: id });

export const actualizarHilo = (
  id: string,
  patch: {
    leadId?: string; propiedadId?: string; estado?: "ia" | "vos" | "cerrada"; motivo?: string; nombre?: string;
    externo?: Record<string, string>;
    /** 023 · La propuesta de Marina sin enviar. Cadena vacía = limpiarla. */
    borrador?: string;
  },
) =>
  rpc<boolean>("potente_conversacion_actualizar", {
    p_id: id,
    p_lead_id: patch.leadId ?? null,
    p_propiedad_id: patch.propiedadId ?? null,
    p_estado: patch.estado ?? null,
    p_motivo: patch.motivo ?? null,
    p_nombre: patch.nombre ?? null,
    p_externo: patch.externo ?? null,
    p_borrador: patch.borrador ?? null,
  });

export const registrarLead = (l: { id: string; nombre: string; contacto: string; canal: "web" | "instagram"; campoId?: string | null; notas: string }) =>
  rpc<string>("potente_lead_registrar", {
    p_id: l.id, p_nombre: l.nombre, p_contacto: l.contacto, p_canal: l.canal, p_campo_id: l.campoId ?? null, p_notas: l.notas,
  });

// ── Lo que Marina dice en un canal (texto plano, con los links) ─────────────
/**
 * En la web las fichas se pintan como tarjetas; en Instagram son links. Y el
 * WhatsApp que se ofrece es el de la OFICINA que atiende la propiedad
 * recomendada (misma regla que la ficha pública, 21-ago). Sin propiedad no se
 * inventa un número: el central es el personal de Mateo.
 */
export function textoParaCanal(respuesta: string, camposIds: string[], catalogo: CampoLite[]): string {
  const fichas = camposIds
    .map((id) => catalogo.find((c) => c.id === id))
    .filter((c): c is CampoLite => Boolean(c))
    .slice(0, 3);
  const partes = [respuesta.trim()];

  /* 🔴 27-ago, pedido de Juani: desde Instagram se deriva al WhatsApp de la
   * OFICINA QUE ATIENDE ESA PROPIEDAD. Antes el link se adjuntaba SOLO si la
   * respuesta mencionaba la palabra "WhatsApp", o sea que dependía de cómo
   * redactara Marina ese día: la mitad de los DM salían sin número.
   *
   * Y si las recomendadas son de oficinas DISTINTAS, el número va pegado a cada
   * una: un solo link al final le daría el teléfono equivocado para las otras.
   * Misma regla que la ficha pública (21-ago). Sin propiedad no se inventa un
   * número: el central es el personal de Mateo. */
  const oficinas = [...new Set(fichas.map((f) => f.oficina).filter(Boolean))] as ("chauvin" | "puntamogotes")[];
  const unaSola = oficinas.length === 1;

  for (const f of fichas) {
    const linea = `${f.titulo}${f.precio ? ` · ${f.precio}` : ""}\n${SITIO}/propiedad/${f.id}`;
    partes.push(!unaSola && f.oficina ? `${linea}\nConsultas: ${waUrl(f.oficina)}` : linea);
  }

  if (unaSola) {
    partes.push(`Para coordinar una visita o pedir más detalles, escribinos por WhatsApp: ${waUrl(oficinas[0])}`);
  }
  return partes.join("\n\n");
}

/** El hilo, en el formato que entiende el motor (sin el último mensaje, que es la consulta). */
function historialDe(mensajes: MensajeHilo[]): { rol: "cliente" | "asistente"; texto: string }[] {
  return mensajes.slice(-13, -1).map((m) => ({ rol: m.de === "cliente" ? "cliente" : "asistente", texto: m.texto }));
}

function notaDeConsulta(canal: "web" | "instagram", contacto: string, pedido: string, titulo?: string): string {
  const donde = canal === "web" ? "Consultó a Marina en la web" : `Consultó por Instagram (@${contacto})`;
  return `${donde}. Pidió: «${pedido.slice(0, 220)}»${titulo ? ` · Le interesó: ${titulo}` : ""}`;
}

// ── INSTAGRAM: Marina contesta el DM ─────────────────────────────────────────
export async function responderEnInstagram(convId: string): Promise<void> {
  const hilo = await leerHilo(convId);
  if (!hilo) return;
  if (hilo.canal !== "instagram") return;                 // WhatsApp: solo supervisión (27-ago)
  if (hilo.estado !== "ia") return;                       // una persona tiene el hilo
  const ultimo = hilo.mensajes[hilo.mensajes.length - 1];
  if (!ultimo || ultimo.de !== "cliente") return;

  const cerebro = await leerCerebro();
  if (!cerebro.activa) { console.log(`Marina · en pausa desde el panel: no contesta ${convId}`); return; }

  /* 023 · En SUPERVISADO no hace falta poder enviar: Marina redacta y una
   * persona decide. El id de ManyChat solo se exige en automático, que es el
   * modo en el que ella misma manda. */
  const subscriber = String(hilo.externo?.manychat_subscriber_id ?? "");
  if (cerebro.modo === "automatico" && !/^\d+$/.test(subscriber)) {
    await actualizarHilo(convId, { estado: "vos", motivo: "Marina no puede responder este hilo: todavía no tiene el contacto enlazado en ManyChat." });
    return;
  }

  const catalogo = await catalogoDesdeLaBase();
  const r = await atenderAsistente({ mensaje: ultimo.texto, historial: historialDe(hilo.mensajes), catalogo, canal: "instagram" });
  const data = r.data as { respuesta?: string; camposIds?: string[]; lead?: { nombre: string; contacto: string } | null; degradado?: boolean };
  if (r.status !== 200 || data.degradado || !data.respuesta) {
    await actualizarHilo(convId, { estado: "vos", motivo: "Marina no pudo responder este mensaje. Te toca a vos." });
    return;
  }

  const camposIds = Array.isArray(data.camposIds) ? data.camposIds : [];
  const texto = textoParaCanal(data.respuesta, camposIds, catalogo);
  const propiedadId = camposIds[0];

  /* ── SUPERVISADO: propone, no manda ────────────────────────────────────────
   * Pedido de Juani (27-ago): «cuando está en automático que responda en
   * automático» — y en supervisado, que la respuesta la mande una persona desde
   * el panel, sin abrir Instagram. Así que acá Marina deja el borrador, pasa el
   * hilo a manos de una persona y dice por qué. NO se guarda como mensaje del
   * hilo: el hilo es lo que realmente se dijo. */
  if (cerebro.modo === "supervisado") {
    await actualizarHilo(convId, {
      estado: "vos",
      motivo: `${cerebro.nombre} redactó una respuesta y espera tu OK (modo supervisado).`,
      borrador: texto,
      propiedadId,
    });
    return;
  }

  const envio = await enviarTextoPorManychat(subscriber, "instagram", texto);
  if (!envio.ok) {
    // No se pudo mandar: queda como borrador para que una persona lo mande.
    await actualizarHilo(convId, {
      estado: "vos",
      motivo: `${cerebro.nombre} redactó una respuesta pero no se pudo enviar por Instagram: ${envio.mensaje}`,
      borrador: texto,
    });
    return;
  }

  // Lo que dijo queda en el hilo, como 'ia'. Id estable por mensaje del cliente:
  // si algo reintenta, la base lo descarta.
  await guardarMensajes([{
    canal: "instagram", mensajeId: `ia-${sha(`${convId}|${ultimo.id}`)}`, contacto: hilo.contacto, nombre: "",
    texto, hora: new Date().toISOString(), de: "ia",
  }]);

  if (data.lead?.contacto) {
    const leadId = idCorto("IG");
    const titulo = catalogo.find((c) => c.id === propiedadId)?.titulo;
    const nombre = data.lead.nombre?.trim() || hilo.nombre;
    const ok = await registrarLead({ id: leadId, nombre, contacto: data.lead.contacto, canal: "instagram", campoId: propiedadId ?? hilo.propiedadId ?? null, notas: notaDeConsulta("instagram", hilo.contacto, ultimo.texto, titulo) });
    if (ok) await actualizarHilo(convId, { leadId, propiedadId, nombre: data.lead.nombre?.trim() || undefined });
  } else if (propiedadId && !hilo.propiedadId) {
    await actualizarHilo(convId, { propiedadId });
  }
}

// ── WEB: la charla del widget queda en la bandeja ────────────────────────────
export type RegistroWeb = { conversacionId?: string; leadId?: string };

/**
 * Se llama DESPUÉS de que Marina respondió. Guarda el par (lo que preguntó, lo
 * que contestó) en el hilo de esa visita y, si dejó contacto, crea la consulta
 * vinculada. Nunca tira: si la base falla, el visitante igual recibe su
 * respuesta y el error queda en el log.
 */
export async function registrarCharlaWeb(body: any, data: Record<string, unknown>): Promise<RegistroWeb> {
  const sesion = String(body?.sesion ?? "");
  if (!/^visita-[a-z0-9]{6,16}$/.test(sesion)) return {};
  const mensaje = String(body?.mensaje ?? "").trim();
  const respuesta = String(data?.respuesta ?? "").trim();
  if (!mensaje || !respuesta || data?.degradado === true) return {};

  try {
    const turno = Array.isArray(body?.historial) ? body.historial.length : 0;
    const ahora = Date.now();
    const res = await guardarMensajes([
      { canal: "web", mensajeId: `web-${sha(`${sesion}|${turno}|${mensaje}`)}`, contacto: sesion, nombre: "Visitante web", texto: mensaje, hora: new Date(ahora).toISOString(), de: "cliente" },
      { canal: "web", mensajeId: `web-${sha(`${sesion}|${turno}|ia|${respuesta}`)}`, contacto: sesion, nombre: "", texto: respuesta, hora: new Date(ahora + 1000).toISOString(), de: "ia" },
    ]);
    const conversacionId = res.conversaciones[0];
    if (!conversacionId) return {};

    const camposIds = Array.isArray(data?.camposIds) ? (data.camposIds as string[]) : [];
    const propiedadId = camposIds[0];
    const lead = data?.lead as { nombre?: string; contacto?: string } | null | undefined;

    if (lead?.contacto) {
      const leadId = idCorto("WEB");
      const titulo = propiedadId ? (await catalogoDesdeLaBase()).find((c) => c.id === propiedadId)?.titulo : undefined;
      const nombre = lead.nombre?.trim() || "Consulta web";
      const ok = await registrarLead({ id: leadId, nombre, contacto: lead.contacto, canal: "web", campoId: propiedadId ?? null, notas: notaDeConsulta("web", sesion, mensaje, titulo) });
      if (!ok) return { conversacionId };
      await actualizarHilo(conversacionId, { leadId, propiedadId, nombre: lead.nombre?.trim() || undefined });
      return { conversacionId, leadId };
    }
    if (propiedadId) await actualizarHilo(conversacionId, { propiedadId });
    return { conversacionId };
  } catch (e: any) {
    console.error("Marina · no se pudo registrar la charla de la web:", e?.message ?? e);
    return {};
  }
}
