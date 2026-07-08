import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// URLs limpias (/panel, /admin, /propiedades). En estático necesita el rewrite SPA:
// Netlify lo resuelve con public/_redirects (/* -> /index.html 200). Local (vite dev) ya hace el fallback.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
