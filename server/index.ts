import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atenderAsistente } from "../netlify/functions/_core";

// ── Server de producción para Render ──────────────────────────────────────────
// Sirve el build estático (dist/) + expone el asistente en POST /api/asistente.
// Se corre con `npm start` (tsx). En Netlify este server no se usa: ahí el
// asistente vive en netlify/functions y /api/asistente redirige a la function.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json({ limit: "256kb" }));

app.post("/api/asistente", async (req, res) => {
  const { status, data } = await atenderAsistente(req.body);
  res.status(status).json(data);
});

// Estáticos con cache larga para assets versionados por Vite.
app.use(
  express.static(DIST, {
    setHeaders: (res, file) => {
      if (/\.(js|css|woff2?|jpg|jpeg|png|webp|svg)$/.test(file)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);

// SPA fallback: cualquier ruta (ej. /propiedades, /panel) cae a index.html.
app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Potente Propiedades sirviendo en :${PORT} (dist: ${DIST})`);
});
