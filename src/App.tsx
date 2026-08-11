import { Routes, Route, useLocation, useParams, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense, type ReactNode } from "react";
import Home from "./site/Home";
import Catalogo from "./site/Catalogo";
import PropiedadDetalle from "./site/PropiedadDetalle";
import Temporada from "./site/Temporada";
import TemporadaBarrio from "./site/TemporadaBarrio";
import Favoritos from "./site/Favoritos";
import { AuthProvider } from "./site/context/AuthContext";
import { FavoritesProvider } from "./site/context/FavoritesContext";
import { DataProvider } from "./lib/DataProvider";

import { PanelAuthProvider, usePanelAuth } from "./panel/auth";
import Login from "./panel/Login";
import { ErrorBoundary } from "./ErrorBoundary";
import ChatAsistente from "./site/components/ChatAsistente";
import { subirYa } from "./site/lib/useLenis";

// El panel (con recharts) se carga solo cuando se entra a /panel.
const PanelApp = lazy(() => import("./panel/PanelApp"));

// Protege el panel: sin sesión → a la pantalla de login.
function RequirePanelAuth({ children }: { children: ReactNode }) {
  const { authed, loading } = usePanelAuth();
  if (loading) return <PanelFallback />;
  return authed ? <>{children}</> : <Navigate to="/ingresar" replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // 🔴 Vía Lenis, no window.scrollTo: el scroll suave pisaba el salto en el
    // frame siguiente y al navegar entre propiedades quedabas abajo de la
    // página nueva — parecía que el click no había tomado (bug del 11-ago).
    subirYa();
  }, [pathname]);
  return null;
}

function RedirectCampo() {
  const { id } = useParams();
  return <Navigate to={`/propiedad/${id}`} replace />;
}

function PanelFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F6F8FB", color: "#0D1521", fontFamily: "'General Sans', sans-serif" }}>
      Cargando panel…
    </div>
  );
}

// El asistente web sólo aparece en la web pública, nunca en el panel/login.
function SiteChat() {
  const { pathname } = useLocation();
  const enPanel = pathname.startsWith("/panel") || pathname.startsWith("/admin") || pathname === "/ingresar";
  if (enPanel) return null;
  return <ChatAsistente />;
}

export default function App() {
  return (
    <DataProvider>
    <AuthProvider>
      <FavoritesProvider>
      <PanelAuthProvider>
        <ScrollToTop />
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/propiedades" element={<Catalogo />} />
          <Route path="/propiedad/:id" element={<PropiedadDetalle />} />
          {/* alquiler de temporada (verano) — landing + páginas por barrio (SEO) */}
          <Route path="/temporada" element={<Temporada />} />
          <Route path="/temporada/:barrio" element={<TemporadaBarrio />} />
          <Route path="/favoritos" element={<Favoritos />} />
          {/* El registro público se sacó (pedido Mateo 3-ago): contacto por WhatsApp, sin cuentas. */}
          <Route path="/cuenta" element={<Navigate to="/" replace />} />
          {/* compatibilidad con rutas viejas */}
          <Route path="/campos" element={<Navigate to="/propiedades?cat=campo" replace />} />
          <Route path="/campo/:id" element={<RedirectCampo />} />
          {/* /ingresar = login del PANEL (equipo). El registro público es lo que se sacó. */}
          <Route path="/ingresar" element={<Login />} />
          <Route
            path="/panel/*"
            element={
              <RequirePanelAuth>
                <Suspense fallback={<PanelFallback />}>
                  <PanelApp />
                </Suspense>
              </RequirePanelAuth>
            }
          />
          {/* /admin es alias del panel; cualquier ruta desconocida vuelve al home (sin pantallas en blanco) */}
          <Route path="/admin/*" element={<Navigate to="/panel" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SiteChat />
        </ErrorBoundary>
      </PanelAuthProvider>
      </FavoritesProvider>
    </AuthProvider>
    </DataProvider>
  );
}
