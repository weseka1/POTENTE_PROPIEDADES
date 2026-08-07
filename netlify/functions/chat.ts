import { chatGenerico } from "./_core";
import { pasaElCupo, ipDe, tieneSesionDePanel, CABECERAS_SEGURIDAD } from "./_seguridad";

// Envoltorio Netlify para el chat genérico del panel (POST /api/chat → esta function).
//
// 🔒 CERRADO desde el 7-ago-2026. Esto es un chat con el system prompt libre y la
// clave de Anthropic del servidor: abierto, es una canilla para cualquiera. Ahora
// exige sesión de panel, igual que en Render.

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CABECERAS_SEGURIDAD },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!(await tieneSesionDePanel(req.headers.get("authorization") ?? undefined))) {
    return json({ error: "Hace falta entrar al panel para usar el Probador." }, 401);
  }

  const cupo = pasaElCupo(ipDe(req.headers), "chat");
  if (!cupo.ok) return json({ error: "Demasiadas pruebas seguidas. Esperá un momento." }, 429);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const { status, data } = await chatGenerico(body);
  return json(data, status);
};
