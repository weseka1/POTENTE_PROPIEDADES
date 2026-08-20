import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "./_config";
import { buildSystem, type CampoLite } from "./_prompt";

// ── Núcleo del asistente, agnóstico de plataforma ─────────────────────────────
// Lo usan: netlify/functions/asistente.ts (Netlify) y server/index.ts (Render).
// Acá vive TODA la lógica; los envoltorios solo traducen request/response.

// Structured output: la IA responde SIEMPRE este JSON (Haiku 4.5 soporta structured outputs).
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["respuesta", "campos_ids", "lead_nombre", "lead_contacto"],
  properties: {
    respuesta: { type: "string", description: "Lo que le decís al visitante (2-4 oraciones)." },
    campos_ids: {
      type: "array",
      items: { type: "string" },
      description: "IDs de propiedades del catálogo a recomendar (0 a 3).",
    },
    lead_nombre: { type: "string", description: "Nombre si lo dio, si no cadena vacía." },
    lead_contacto: { type: "string", description: "Teléfono o email si lo dio, si no cadena vacía." },
  },
} as const;

// Extrae el primer objeto JSON válido de la respuesta del modelo (tolera fences o texto extra/cortado).
function extractJson(text: string): any {
  if (!text) return null;
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(t); } catch { /* seguimos intentando */ }
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i >= 0 && j > i) {
    try { return JSON.parse(t.slice(i, j + 1)); } catch { /* nada */ }
  }
  return null;
}

export type ResultadoAsistente = { status: number; data: Record<string, unknown> };

// Chat genérico con system prompt libre (lo usa el Probador del panel).
// La key vive en el servidor; el navegador no la ve.
export async function chatGenerico(body: any): Promise<ResultadoAsistente> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { status: 503, data: { error: "El asistente no está configurado en el servidor (falta ANTHROPIC_API_KEY)." } };

  const system = String(body?.system ?? "").slice(0, 8000);
  const raw = Array.isArray(body?.messages) ? body.messages.slice(-16) : [];
  const messages = raw
    .map((m: any) => ({
      role: (m?.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: String(m?.content ?? "").slice(0, 4000),
    }))
    .filter((m: any) => m.content);
  if (!messages.length) return { status: 400, data: { error: "Sin mensajes." } };

  const client = new Anthropic({ apiKey });
  try {
    const resp = await client.messages.create({ model: "claude-haiku-4-5", max_tokens: 700, system, messages });
    const text = (resp.content.find((b: any) => b.type === "text") as any)?.text ?? "";
    return { status: 200, data: { text } };
  } catch (e: any) {
    return { status: 502, data: { error: String(e?.message ?? e) } };
  }
}

export async function atenderAsistente(body: any): Promise<ResultadoAsistente> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { status: 503, data: { error: "El asistente no está configurado (falta ANTHROPIC_API_KEY)." } };

  const mensaje = String(body?.mensaje ?? "").trim().slice(0, 2000);
  if (!mensaje) return { status: 400, data: { error: "Mensaje vacío." } };

  const historial = Array.isArray(body?.historial) ? body.historial.slice(-12) : [];
  // 🔴 Cicatriz 18-ago: el tope era 60 y la cartera real ya pasaba las 100
  // activas — Marina estaba CIEGA de ~40 propiedades y las recomendaba como si
  // no existieran. 160 cubre la cartera con margen; en tokens es ruido para el
  // modelo (una línea por propiedad) y el tope sigue existiendo como fusible
  // contra un body malicioso gigante, no como límite del negocio.
  const catalogo: CampoLite[] = Array.isArray(body?.catalogo) ? body.catalogo.slice(0, 160) : [];

  const messages = [
    ...historial
      .map((m: any) => ({
        role: (m?.rol === "asistente" ? "assistant" : "user") as "assistant" | "user",
        content: String(m?.texto ?? "").slice(0, 2000),
      }))
      .filter((m: any) => m.content),
    { role: "user" as const, content: mensaje },
  ];

  // 🔴 `maxRetries` del SDK + reintento propio (19-ago). Mateo vio a Marina
  // caerse EN MEDIO de una conversación que venía bien: la llamada no tenía
  // reintentos ni timeout, así que cualquier hipo transitorio de la API
  // (sobrecarga 529, un 429, un corte de red) llegaba tal cual al visitante
  // como "el asistente no está disponible". Juani: «Marina no se puede romper
  // NUNCA. Pero NUNCA».
  const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 25_000 });

  let ultimoError: any = null;
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const resp = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: buildSystem(CONFIG, catalogo),
        messages,
        // structured outputs (cuando aplica) + el formato JSON también va explícito en el prompt
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
      } as any);

      const text = (resp.content.find((b: any) => b.type === "text") as any)?.text ?? "";
      const data = extractJson(text) ?? {};

      // Si el JSON vino cortado o mal formado pero el modelo SÍ escribió algo
      // útil, se usa ese texto en vez de tirar la respuesta a la basura: para
      // el visitante, una respuesta sin ficha adjunta es infinitamente mejor
      // que un "no te entendí" (o peor, un error).
      const respuesta =
        String((data as any)?.respuesta ?? "").trim() ||
        (text.trim().startsWith("{") ? "" : text.trim()) ||
        "Perdón, no te entendí bien. ¿Me lo repetís? Contame qué buscás (una casa, un depto, un local…) y en qué zona.";

      // Los IDs se VALIDAN contra el catálogo real: si el modelo devuelve uno
      // que no existe, se descarta acá y no viaja al navegador.
      const idsValidos = new Set(catalogo.map((c) => c.id));
      const camposIds = (Array.isArray((data as any)?.campos_ids) ? (data as any).campos_ids : [])
        .map(String)
        .filter((id: string) => idsValidos.has(id))
        .slice(0, 3);

      const contacto = String((data as any)?.lead_contacto ?? "").trim();
      const lead = contacto ? { nombre: String((data as any)?.lead_nombre ?? "").trim(), contacto } : null;

      return { status: 200, data: { respuesta, camposIds, lead } };
    } catch (e: any) {
      ultimoError = e;
      // El detalle del error va al log del servidor, NO al navegador: los
      // mensajes de la API traen nombres de modelo, ids de organización y
      // estado de la cuenta. Eso no tiene por qué verlo un visitante.
      console.error(`Asistente · intento ${intento} falló:`, e?.status ?? "", e?.message ?? e);
      if (intento === 1) await new Promise((r) => setTimeout(r, 700));
    }
  }

  // Agotados los reintentos: Marina NO se rompe de cara al visitante. Contesta
  // como una persona a la que se le cortó la línea, mantiene viva la charla y
  // ofrece el camino humano. Status 200 a propósito: un 502 hace que el widget
  // pinte el cartel de error y la conversación muere ahí.
  console.error("Asistente · agotados los reintentos:", ultimoError?.message ?? ultimoError);
  return {
    status: 200,
    data: {
      respuesta:
        "Uy, se me cortó la conexión un segundo y no llegué a procesar eso. ¿Me lo repetís? Si preferís, seguimos por WhatsApp y un asesor te atiende al toque.",
      camposIds: [],
      lead: null,
      degradado: true,
    },
  };
}
