// Cliente fino del asistente web: habla con POST /api/asistente
// (en Render lo sirve server/index.ts; en Netlify redirige a la function).
import { corteEn } from "./corte";

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
  /* 🔴 21-ago — los datos por los que la gente BUSCA. Marina decía "no tengo
   * alquileres de 2 dormitorios" con uno en pantalla: los dormitorios no
   * viajaban en el catálogo y solo podía leerlos si el título los mencionaba
   * de casualidad (video de Mateo, el PH de San José). El prompt encima le
   * pedía filtrar por ambientes — un dato que no podía ver. */
  ambientes?: number;
  dormitorios?: number;
  banos?: number;
  m2?: number;
};

export type RespuestaAsistente = {
  respuesta: string;
  camposIds: string[];
  lead: { nombre: string; contacto: string } | null;
  /** 27-ago · Si el server ya registró la consulta (vinculada a la charla), su id. */
  leadId?: string;
  conversacionId?: string;
  /** Marina está en pausa desde el panel: la respuesta es el aviso, no una atención. */
  pausada?: boolean;
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
  catalogo: CampoLite[],
  /** Id de la visita (widget): con él la charla entera cae en un solo hilo de la bandeja. */
  sesion?: string,
): Promise<RespuestaAsistente> {
  let ultimoError: unknown = null;

  for (let intento = 1; intento <= 2; intento++) {
    try {
      const corte = corteEn(30_000);   // compat: AbortSignal.timeout no existe en iOS 15 (ver lib/corte.ts)
      const r = await fetch("/api/asistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensaje, historial, catalogo, ...(sesion ? { sesion } : {}) }),
        signal: corte,
      });
      /* Lo que manda el server, declarado. Todo opcional a propósito: esto viene
       * de la red, y cada campo se valida abajo antes de usarse — un `any` acá
       * apagaría justamente el chequeo que hace falta cuando el contrato cambie
       * de un lado y no del otro. */
      const data = (await r.json().catch(() => ({}))) as {
        respuesta?: unknown;
        camposIds?: unknown;
        lead?: { nombre?: string; contacto?: string } | null;
        leadId?: unknown;
        conversacionId?: unknown;
        pausada?: unknown;
        error?: unknown;
      };
      if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : "El asistente no está disponible.");
      return {
        respuesta: String(data.respuesta || ""),
        camposIds: Array.isArray(data.camposIds) ? data.camposIds.map(String) : [],
        lead: data.lead?.contacto ? { nombre: data.lead.nombre ?? "", contacto: data.lead.contacto } : null,
        leadId: typeof data.leadId === "string" ? data.leadId : undefined,
        conversacionId: typeof data.conversacionId === "string" ? data.conversacionId : undefined,
        pausada: data.pausada === true,
      };
    } catch (e) {
      ultimoError = e;
      if (intento === 1) await new Promise((r) => setTimeout(r, 900));
    }
  }

  throw ultimoError instanceof Error ? ultimoError : new Error("El asistente no está disponible.");
}
