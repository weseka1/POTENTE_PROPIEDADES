// Cliente fino del asistente web: habla con POST /api/asistente
// (en Render lo sirve server/index.ts; en Netlify redirige a la function).
export type ChatMsg = { rol: "cliente" | "asistente"; texto: string };

export type CampoLite = {
  id: string;
  titulo: string;
  zona: string;
  categoria: string;
  hectareas?: number;
  aptitud?: string;
  operacion?: string;
  precio?: string; // campos = "A consultar"; urbanas = precio real formateado
};

// WhatsApp al que deriva el asistente: Potente Propiedades (Mateo).
// Solo dígitos, formato internacional: +54 9 2233 02-9591 → 5492233029591.
export const WHATSAPP = "5492233029591";

export function linkWhatsApp(texto: string): string {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

export type RespuestaAsistente = {
  respuesta: string;
  camposIds: string[];
  lead: { nombre: string; contacto: string } | null;
};

export async function consultarAsistente(
  mensaje: string,
  historial: ChatMsg[],
  catalogo: CampoLite[]
): Promise<RespuestaAsistente> {
  const r = await fetch("/api/asistente", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mensaje, historial, catalogo }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "El asistente no está disponible.");
  return {
    respuesta: String(data.respuesta || ""),
    camposIds: Array.isArray(data.camposIds) ? data.camposIds : [],
    lead: data.lead && data.lead.contacto ? data.lead : null,
  };
}
