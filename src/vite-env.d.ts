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

/** osmtogeojson no publica tipos: convierte la respuesta cruda de Overpass
 *  (edificios de OSM) en GeoJSON para el simulador de sombras. */
declare module "osmtogeojson" {
  const osmtogeojson: (json: unknown) => { features: Array<{ properties?: Record<string, unknown> }> };
  export default osmtogeojson;
}
