import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabase = Boolean(url && key);

// Si no hay credenciales (o falla la red), la app cae a los datos locales.
export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url as string, key as string, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
