/**
 * GUARDAR UN MENSAJE ENTRANTE — el puente entre Meta y la bandeja de Mateo.
 * ─────────────────────────────────────────────────────────────────────────────
 * ── POR QUÉ ESTO LLAMA A UNA FUNCIÓN DE LA BASE Y NO ESCRIBE DIRECTO ─────────
 * La tabla `potente_conversaciones` está reservada a la dirección autenticada
 * (migración 015: Mateo no quiere que las oficinas se lean entre sí). Un webhook
 * no tiene sesión, así que necesita otra llave.
 *
 * La salida fácil sería la `service_role`… que es la LLAVE MAESTRA: saltea TODO
 * el RLS, incluidos los tres candados que costaron tres migraciones (012 la
 * ficha interna, 013 las tarifas de temporada, 015 estas conversaciones). Y este
 * server corre en el hosting DEL CLIENTE, que él lee por File Manager y por SSH.
 * Poner la llave maestra ahí es regalar por atrás lo que se cerró por adelante.
 *
 * Por eso escribe a través de `potente_ingresar_mensaje` (migración 018): una
 * función que solo sabe appendear un mensaje entrante. No lee fichas internas,
 * no toca tarifas, no borra. Si el token se filtrara, lo peor posible es que
 * alguien meta mensajes falsos en la bandeja — molesto, no catastrófico.
 *
 * ── LA IDEMPOTENCIA LA DECIDE LA BASE ───────────────────────────────────────
 * Meta reenvía el mismo mensaje ante cualquier timeout nuestro. La función
 * devuelve `null` cuando el mensaje ya había entrado, y acá eso se trata como
 * éxito silencioso: Mateo no puede ver la misma consulta dos veces.
 */
import type { MensajeEntrante } from "./_meta";

export type ResultadoIngesta = {
  guardados: number;
  repetidos: number;
  fallados: number;
};

/**
 * Mete los mensajes en la base. NUNCA tira: un webhook que explota hace que Meta
 * reintente en loop. Los problemas se loguean del lado del servidor y se cuentan.
 */
export async function guardarMensajes(mensajes: MensajeEntrante[]): Promise<ResultadoIngesta> {
  const res: ResultadoIngesta = { guardados: 0, repetidos: 0, fallados: 0 };

  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const token = process.env.POTENTE_INGESTA_TOKEN;

  if (!base || !anon || !token) {
    // 🔴 Nunca en silencio: si falta configuración, los mensajes de los clientes
    // de Mateo se estarían perdiendo. Es exactamente el modo de falla que ya
    // costó leads dos veces (IAGRO 14-jul, Potente 6/7-ago).
    console.error("Ingesta · SIN CONFIGURAR (falta url/anon/POTENTE_INGESTA_TOKEN): se pierden mensajes");
    res.fallados = mensajes.length;
    return res;
  }

  for (const m of mensajes) {
    try {
      const r = await fetch(`${base}/rest/v1/rpc/potente_ingresar_mensaje`, {
        method: "POST",
        headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_token: token,
          p_canal: m.canal,
          p_contacto: m.contacto,
          p_nombre: m.nombre,
          p_mensaje_id: m.mensajeId,
          p_texto: m.texto,
          p_hora: m.hora,
        }),
      });

      if (!r.ok) {
        console.error(`Ingesta · la base rechazó ${m.mensajeId}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
        res.fallados++;
        continue;
      }

      // La función devuelve el id de la conversación, o null si era repetido.
      const conv = await r.json().catch(() => null);
      if (conv === null) res.repetidos++;
      else res.guardados++;
    } catch (e: any) {
      console.error(`Ingesta · error guardando ${m.mensajeId}:`, e?.message ?? e);
      res.fallados++;
    }
  }
  return res;
}
