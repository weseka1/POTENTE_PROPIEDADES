import { defineConfig, loadEnv } from "vite";
import { execSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import path from "path";
import { DOMINIO_POR_DEFECTO } from "./src/config/dominio.js";

// El dominio del sitio, garantizado ANTES del build. index.html usa
// %VITE_SITE_URL% (Vite reemplaza los %ENV% de index.html nativamente), pero si
// la variable no existe Vite deja el texto "%VITE_SITE_URL%" literal en el HTML
// — canonical y OG rotos en silencio. Con este default no hay build sin dominio.
//
// 🔴 CICATRIZ 20-ago (la más cara de SEO del proyecto): acá antes decía
// `process.env.VITE_SITE_URL ||= DOMINIO_POR_DEFECTO` a secas, y en producción
// el canonical y el og:url salían apuntando a **onrender.com** — le estábamos
// diciendo a Google que la versión buena de potentepropiedades.com era el
// dominio de Render. El motivo es una sutileza de Vite: **los archivos .env se
// cargan DESPUÉS de evaluar este archivo**, así que `process.env` acá solo ve
// las variables del SHELL. El deploy a Hostinger sube un `.env` con el dominio
// correcto… que este archivo nunca llegaba a leer, y caía siempre al default.
// El sitemap y el robots SÍ salían bien porque los arma el server en runtime
// con el host real del pedido — por eso el bug era invisible salvo mirando el
// canonical del HTML servido. `loadEnv` lee los .env explícitamente y arregla
// las dos rutas (shell y archivo).

/* ── LA VERSIÓN QUE ESTÁ CORRIENDO ───────────────────────────────────────────
 * 27-ago. Mateo dejó el panel abierto todo el día; deployamos; su pestaña siguió
 * con el JavaScript viejo y el sistema "no andaba" — el botón nuevo no existía
 * en su navegador. Nadie tiene por qué darse cuenta de eso solo.
 * Se estampa el commit en el bundle Y en /version.json: si difieren, el panel
 * avisa que hay una versión nueva. */
/**
 * La marca de ESTE build.
 *
 * 🔴 Se resuelve DENTRO de defineConfig, con el `env` de `loadEnv`: vite no
 * vuelca los archivos .env en `process.env` para el propio config, así que
 * leerlo afuera daba siempre el fallback (medido: el primer deploy publicó
 * "build-mtbuzab5" en vez del commit).
 *
 * El build de producción corre EN EL HOSTING, donde no hay repositorio: el
 * deploy le pasa el commit en VITE_BUILD (ver scripts/deploy-hostinger.mjs).
 * Local se lee de git. Sin ninguno de los dos, cualquier valor sirve mientras
 * cambie en cada build: lo único que importa es que dos builds no compartan marca.
 */
function marcaDeBuild(env: Record<string, string>): string {
  if (env.VITE_BUILD) return env.VITE_BUILD.trim().slice(0, 40);
  try { return execSync("git rev-parse --short HEAD").toString().trim(); }
  catch { return "build-" + Date.now().toString(36); }
}

/** Deja /version.json en el dist, con la misma marca que viaja en el bundle. */
const versionPlugin = (build: string) => ({
  name: "wsk-version",
  generateBundle(this: any) {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build }) });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env.VITE_SITE_URL = env.VITE_SITE_URL || process.env.VITE_SITE_URL || DOMINIO_POR_DEFECTO;
  const BUILD = marcaDeBuild(env);

  return {
    plugins: [react(), versionPlugin(BUILD)],
    // La misma marca viaja adentro del bundle: el panel compara lo que ESTÁ
    // corriendo contra lo que hay publicado.
    define: { __BUILD__: JSON.stringify(BUILD) },
    base: "/",
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
  };
});
