/**
 * EL CATÁLOGO DEL LADO DEL SERVER — para cuando Marina atiende sin navegador.
 * ─────────────────────────────────────────────────────────────────────────────
 * En la web el catálogo lo manda el widget (ya lo tiene cargado). En Instagram
 * no hay widget: el server tiene que leer la cartera él mismo. Lee la MISMA
 * vista pública que ve un visitante (`potente_propiedades_web`, sin la ficha
 * interna ni las tarifas de temporada) y la reduce con el MISMO mapeo que el
 * widget (`src/lib/catalogoLite.ts`). Una sola fuente: si Mateo carga un
 * dormitorio, Marina lo ve en los dos canales.
 *
 * Caché de un minuto: Mateo edita la cartera a diario, pero un DM no necesita
 * el segundo exacto, y pegarle a la base por cada mensaje es gastar de más.
 * Si la base no responde, se sirve lo último que se tenía (o vacío): Marina
 * sigue atendiendo, aunque sea diciendo que confirma por WhatsApp.
 */
import { catalogoParaMarina } from "../../src/lib/catalogoLite";
import type { CampoLite } from "./_prompt";

const TTL_MS = 60_000;
let cache: { hasta: number; datos: CampoLite[] } | null = null;

export async function catalogoDesdeLaBase(): Promise<CampoLite[]> {
  const ahora = Date.now();
  if (cache && cache.hasta > ahora) return cache.datos;

  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) {
    console.error("Catálogo · sin base configurada: Marina atiende sin cartera");
    return cache?.datos ?? [];
  }

  try {
    const r = await fetch(`${base}/rest/v1/potente_propiedades_web?select=*&limit=400`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const filas = (await r.json()) as Parameters<typeof catalogoParaMarina>[0];
    const datos = catalogoParaMarina(filas);
    cache = { hasta: ahora + TTL_MS, datos };
    return datos;
  } catch (e: any) {
    console.error("Catálogo · no se pudo leer la vista pública:", e?.message ?? e);
    return cache?.datos ?? [];
  }
}
