import { chatGenerico } from "./_core";

// Envoltorio Netlify para el chat genérico del panel (POST /api/chat → esta function).

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
  const { status, data } = await chatGenerico(body);
  return json(data, status);
};
