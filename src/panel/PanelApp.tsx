import { useState, useEffect } from "react";
import { usePanelAuth } from "./auth";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { cn } from "./ui/cn";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import ProfileGate from "./components/ProfileGate";
import { ProfilesProvider, useProfiles, canAccess } from "./profiles";
import { DataScope } from "@/lib/DataProvider";
import { ToastProvider } from "./components/Toast";

// Si el perfil activo no puede ver la sección actual, lo manda a la primera permitida.
function PermGuard() {
  const { activo } = useProfiles();
  // 🔒 El permiso lo decide el TOKEN, no el perfil guardado en el navegador:
  // `activo.admin` sale de localStorage y lo puede editar cualquiera con las
  // herramientas del navegador. Ver canAccess() en profiles.tsx.
  const { esDireccion } = usePanelAuth();
  const { pathname } = useLocation();
  const seg = pathname.replace(/^\/panel\/?/, "");
  const key = seg === "" ? "inicio" : seg.split("/")[0];
  if (canAccess(activo, key, esDireccion)) return null;
  const order = ["leads", "crm", "agenda", "cargar", "tasaciones", "reportes"];
  const puedeInicio = canAccess(activo, "inicio", esDireccion);
  const landing = puedeInicio
    ? "/panel"
    : "/panel/" + (order.find((k) => canAccess(activo, k, esDireccion)) || "leads");
  return <Navigate to={landing} replace />;
}

import Dashboard from "./pages/Dashboard";
import Asistente from "./pages/Asistente";
import CargarPropiedad from "./pages/CargarPropiedad";
import Fichas from "./pages/Fichas";
import Planos from "./pages/Planos";
import Temporada from "./pages/Temporada";
import Cartera from "./pages/Cartera";
import Leads from "./pages/Leads";
import CRM from "./pages/CRM";
import Pipeline from "./pages/Pipeline";
import Agenda from "./pages/Agenda";
import Tasaciones from "./pages/Tasaciones";
import Arrendamientos from "./pages/Arrendamientos";
import Reportes from "./pages/Reportes";

// Estilos propios del panel (keyframes para modal/toast).
const panelStyles = `
@keyframes fadeIn { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: scale(1) } }
@keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
`;


// El panel entero ve los datos por el ojo de su perfil: una oficina ve SOLO lo suyo,
// Mateo (central) ve todo. Es el corazón del modelo orquestador.
function ScopeDatosPorPerfil({ children }: { children: React.ReactNode }) {
  const { activo } = useProfiles();
  return <DataScope oficina={activo?.oficina}>{children}</DataScope>;
}

export default function PanelApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("potente_panel_collapsed") === "1"; } catch { return false; }
  });
  const toggleCollapse = () =>
    setCollapsed((c) => {
      const n = !c;
      try { localStorage.setItem("potente_panel_collapsed", n ? "1" : "0"); } catch {}
      return n;
    });

  // ESC: solo cierra el menú mobile si está abierto. NO saca del panel (eso molestaba).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  return (
    <ToastProvider>
      <ProfilesProvider>
        <ScopeDatosPorPerfil>
        <style>{panelStyles}</style>
        <div className="panel-bg min-h-screen font-sans text-graph antialiased">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={collapsed} onToggleCollapse={toggleCollapse} />

          <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[100px]" : "lg:pl-[276px]")}>
            <Topbar onMenu={() => setSidebarOpen(true)} />
            <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
              <PermGuard />
              <Routes>
                <Route path="" element={<Dashboard />} />
                <Route path="asistente" element={<Asistente />} />
                <Route path="cargar" element={<CargarPropiedad />} />
                <Route path="fichas" element={<Fichas />} />
                <Route path="planos" element={<Planos />} />
                <Route path="temporada" element={<Temporada />} />
                <Route path="cartera" element={<Cartera />} />
                <Route path="leads" element={<Leads />} />
                <Route path="crm" element={<CRM />} />
                <Route path="pipeline" element={<Pipeline />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="tasaciones" element={<Tasaciones />} />
                <Route path="arrendamientos" element={<Arrendamientos />} />
                <Route path="reportes" element={<Reportes />} />
                <Route path="*" element={<Navigate to="/panel" replace />} />
              </Routes>
            </main>
          </div>
        </div>
        <ProfileGate />
        </ScopeDatosPorPerfil>
      </ProfilesProvider>
    </ToastProvider>
  );
}
