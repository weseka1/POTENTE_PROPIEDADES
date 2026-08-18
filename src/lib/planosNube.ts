import { supabase } from "./supabase";

/* Los planos dibujados viajan a la nube (tabla potente_planos, migración 016).
 *
 * Acá solo viaja el payload del editor SIN la imagen de fondo: el calco es una
 * ayuda local (una satelital en base64 pesa MB) y el check de la base rebota
 * cualquier payload de más de 512 KB. Quitarle el bg es responsabilidad del
 * que llama — este módulo es la cañería, no el criterio. */

export type PlanoNube = { data: Record<string, unknown>; updated_at: string };

export async function guardarPlanoNube(id: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  // Sin base (modo demo del enlatado) no se finge el guardado: se dice.
  if (!supabase) return { ok: false, error: "sin base configurada" };
  const { error } = await supabase.from("potente_planos").upsert({ id, data: payload });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function cargarPlanoNube(id: string): Promise<PlanoNube | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("potente_planos")
    .select("data, updated_at")
    .eq("id", id)
    .maybeSingle();
  // Un error de red o de permisos NO es "no hay plano": si acá devolviéramos
  // null, el que llama podría "curar" la nube pisándola con un local viejo.
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { data: (data.data ?? {}) as Record<string, unknown>, updated_at: data.updated_at as string };
}
