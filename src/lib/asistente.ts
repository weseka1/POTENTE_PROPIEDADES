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
  oficina?: "chauvin" | "puntamogotes";
  precio?: string; // campos = "A consultar"; urbanas = precio real formateado
};

export type RespuestaAsistente = {
  respuesta: string;
  camposIds: string[];
  lead: { nombre: string; contacto: string } | null;
};

/**
 * 🔴 Reintento del lado del navegador (19-ago). El server ya reintenta contra
 * la API, pero entre el celular y el server hay una red móvil: un túnel, un
 * cambio de antena o el wifi que se cae dejaban la charla muerta con el cartel
 * de "no está disponible". Juani: «Marina no se puede romper NUNCA».
 * Dos intentos, con un respiro en el medio, y timeout propio para no dejar al
 * visitante mirando los puntitos para siempre.
 */
export async function consultarAsistente(
  mensaje: string,
  historial: ChatMsg[],
  catalogo: CampoLite[]
): Promise<RespuestaAsistente> {
  let ultimoError: unknown = null;

  for (let intento = 1; intento <= 2; intento++) {
    try {
      const corte = AbortSignal.timeout(30_000);
      const r = await fetch("/api/asistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensaje, historial, catalogo }),
        signal: corte,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "El asistente no está disponible.");
      return {
        respuesta: String(data.respuesta || ""),
        camposIds: Array.isArray(data.camposIds) ? data.camposIds : [],
        lead: data.lead && data.lead.contacto ? data.lead : null,
      };
    } catch (e) {
      ultimoError = e;
      if (intento === 1) await new Promise((r) => setTimeout(r, 900));
    }
  }

  throw ultimoError instanceof Error ? ultimoError : new Error("El asistente no está disponible.");
}
