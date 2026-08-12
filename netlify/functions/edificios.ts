import { pasaElCupo, ipDe, CABECERAS_SEGURIDAD } from "./_seguridad";

// Envoltorio Netlify del proxy de tiles de edificios (GET /api/edificios/x/y).
// El porqué vive en server/index.ts: el CDN de ShadeMap solo permite CORS desde
// sus dominios y localhost — server a server no hay CORS. Es PÚBLICO (lo usa el
// visitante que abre sombras/3D), con cupo por IP; el navegador cachea 30 días
// porque el archivo del proveedor es datado (inmutable).

const EDIFICIOS_ORIGEN = "https://cfw.shademap.app/buildings20260617";

function error(mensaje: string, status: number): Response {
  return new Response(JSON.stringify({ error: mensaje }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CABECERAS_SEGURIDAD },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "GET") return error("Method not allowed", 405);
  const cupo = pasaElCupo(ipDe(req.headers), "chat");
  if (!cupo.ok) return error("Muchos pedidos seguidos. Esperá un momento.", 429);

  // La ruta llega como /api/edificios/<x>/<y> (redirect de _redirects).
  const partes = new URL(req.url).pathname.split("/").filter(Boolean);
  const x = Number(partes[partes.length - 2]), y = Number(partes[partes.length - 1]);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 16384 || y >= 16384) {
    return error("Tile inválido.", 400);
  }
  try {
    const r = await fetch(`${EDIFICIOS_ORIGEN}/14/${x}/${y}.mlt`);
    if (!r.ok) return error("El proveedor de edificios no contestó.", 502);
    return new Response(await r.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "public, max-age=2592000, immutable",
        ...CABECERAS_SEGURIDAD,
      },
    });
  } catch {
    return error("El proveedor de edificios no contestó.", 502);
  }
};

export const config = { path: "/api/edificios/:x/:y" };
