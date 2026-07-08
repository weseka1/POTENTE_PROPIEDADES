import { atenderAsistente } from "./_core";

// Envoltorio Netlify: traduce Request/Response web estándar al núcleo del asistente.
// (En Render el mismo núcleo se sirve desde server/index.ts en /api/asistente.)

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const { status, data } = await atenderAsistente(body);
  return json(data, status);
};
