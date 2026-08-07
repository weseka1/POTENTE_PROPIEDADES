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

  const cupo = pasaElCupo(ipDe(req.headers), "asistente");
  if (!cupo.ok) return json({ error: "Vas muy rápido. Probá de nuevo en un momento." }, 429);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const { status, data } = await atenderAsistente(body);
  return json(data, status);
};
