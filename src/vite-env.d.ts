/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** ShadeMap (sombras del mapa). Sin ella, el botón de sombras no existe. */
  readonly VITE_SHADEMAP_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

