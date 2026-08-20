import { atenderAsistente } from "./_core";
import { pasaElCupo, ipDe, CABECERAS_SEGURIDAD } from "./_seguridad";

// Envoltorio Netlify: traduce Request/Response web estándar al núcleo del asistente.
// (En Render el mismo núcleo se sirve desde server/index.ts en /api/asistente.)
//
// Este SÍ es público: lo usa cualquier visitante de la web. Por eso no se le pide
// clave, se le pone cupo por IP.

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CABECERAS_SEGURIDAD },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Espejo EXACTO de server/index.ts (19-ago): agotar el cupo no rompe a Marina,
  // le hace contestar como una persona ocupada. Si los dos entornos degradan
  // distinto, el respaldo se rompe de una forma que nadie probó.
  const cupo = pasaElCupo(ipDe(req.headers), "asistente");
  if (!cupo.ok) {
    return json({
      respuesta:
        "Perdón, estoy atendiendo a varias personas a la vez. Dame unos segundos y repetime el mensaje, o si preferís seguimos por WhatsApp y un asesor te atiende ya.",
      camposIds: [],
      lead: null,
      degradado: true,
    }, 200);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const { status, data } = await atenderAsistente(body);
  return json(data, status);
};
