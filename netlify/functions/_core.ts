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

export async function atenderAsistente(body: any): Promise<ResultadoAsistente> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { status: 503, data: { error: "El asistente no está configurado (falta ANTHROPIC_API_KEY)." } };

  const mensaje = String(body?.mensaje ?? "").trim().slice(0, 2000);
  if (!mensaje) return { status: 400, data: { error: "Mensaje vacío." } };

  const historial = Array.isArray(body?.historial) ? body.historial.slice(-12) : [];
  const catalogo: CampoLite[] = Array.isArray(body?.catalogo) ? body.catalogo.slice(0, 60) : [];

  const messages = [
    ...historial
      .map((m: any) => ({
        role: (m?.rol === "asistente" ? "assistant" : "user") as "assistant" | "user",
        content: String(m?.texto ?? "").slice(0, 2000),
      }))
      .filter((m: any) => m.content),
    { role: "user" as const, content: mensaje },
  ];

  const client = new Anthropic({ apiKey });

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

    const respuesta =
      String(data?.respuesta ?? "").trim() ||
      "Perdón, no te entendí bien. ¿Me lo repetís? Contame qué buscás (una casa, un depto, un local…) y en qué zona.";
    const camposIds = Array.isArray(data?.campos_ids) ? data.campos_ids.map(String).slice(0, 3) : [];
    const contacto = String(data?.lead_contacto ?? "").trim();
    const lead = contacto ? { nombre: String(data?.lead_nombre ?? "").trim(), contacto } : null;

    return { status: 200, data: { respuesta, camposIds, lead } };
  } catch (e: any) {
    return { status: 502, data: { error: "El asistente no está disponible en este momento.", detail: String(e?.message ?? e) } };
  }
}
