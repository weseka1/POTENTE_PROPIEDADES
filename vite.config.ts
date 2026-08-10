import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { DOMINIO_POR_DEFECTO } from "./src/config/dominio.js";

// El dominio del sitio, garantizado ANTES del build. index.html usa
// %VITE_SITE_URL% (Vite reemplaza los %ENV% de index.html nativamente), pero si
// la variable no existe Vite deja el texto "%VITE_SITE_URL%" literal en el HTML
// — canonical y OG rotos en silencio. Con este default no hay build sin dominio.
process.env.VITE_SITE_URL ||= DOMINIO_POR_DEFECTO;

export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
