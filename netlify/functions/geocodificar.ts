import { geocodificar } from "./_geocodificar";
import { pasaElCupo, ipDe, tieneSesionDePanel, CABECERAS_SEGURIDAD } from "./_seguridad";

// Envoltorio Netlify del geocodificador (POST /api/geocodificar → esta function).
// El núcleo vive en _geocodificar.ts y es EL MISMO que usa el server de Render:
// una sola lógica, dos puertas — el patrón espejo de asistente/chat.
//
// 🔒 Exige sesión: lo usa el que carga propiedades en el panel, no el visitante.
// Sin el candado seríamos un proxy gratis a Nominatim para cualquiera, y su
// política (1 pedido/segundo) la pagaríamos con la IP del hosting bloqueada.

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CABECERAS_SEGURIDAD },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!(await tieneSesionDePanel(req.headers.get("authorization") ?? undefined))) {
    return json({ error: "Hace falta entrar al panel." }, 401);
  }

  const cupo = pasaElCupo(ipDe(req.headers), "chat");
  if (!cupo.ok) return json({ error: "Muchas búsquedas seguidas. Esperá un momento." }, 429);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  return json(await geocodificar(body));
};
