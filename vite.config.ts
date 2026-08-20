import { defineConfig, loadEnv } from "vite";
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
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env.VITE_SITE_URL = env.VITE_SITE_URL || process.env.VITE_SITE_URL || DOMINIO_POR_DEFECTO;

  return {
    plugins: [react()],
    base: "/",
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
  };
});
