import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Map,
  Inbox,
  Users,
  KanbanSquare,
  CalendarDays,
  Calculator,
  FileSignature,
  BarChart3,
  Sprout,
  LogOut,
  Sparkles,
  UploadCloud,
  Sun,
  FileText,
  ChevronsLeft,
} from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { cn } from "../ui/cn";
import { useProfiles, canAccess } from "../profiles";
import { usePanelAuth } from "../auth";

export default function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { kpis, sugerenciasPendientes } = useData();
  const { activo } = useProfiles();
  const { signOut } = usePanelAuth();
  const navigate = useNavigate();
  const cerrarSesion = async () => { await signOut(); navigate("/ingresar"); };
  const nav = [
    { to: "/panel", end: true, key: "inicio", label: "Inicio", icon: LayoutDashboard },
    { to: "/panel/asistente", key: "asistente", label: "Asistente IA", icon: Sparkles, badge: sugerenciasPendientes, ia: true },
    { to: "/panel/cartera", key: "cartera", label: "Cartera", icon: Map },
    { to: "/panel/fichas", key: "fichas", label: "Fichas", icon: FileText },
    { to: "/panel/cargar", key: "cargar", label: "Cargar propiedad", icon: UploadCloud },
    { to: "/panel/temporada", key: "temporada", label: "Temporada", icon: Sun },
    { to: "/panel/leads", key: "leads", label: "Consultas", icon: Inbox, badge: kpis.leadsNuevos },
    { to: "/panel/crm", key: "crm", label: "Clientes", icon: Users },
    { to: "/panel/pipeline", key: "pipeline", label: "Embudo de ventas", icon: KanbanSquare },
    { to: "/panel/agenda", key: "agenda", label: "Agenda de visitas", icon: CalendarDays },
    { to: "/panel/tasaciones", key: "tasaciones", label: "Tasaciones", icon: Calculator },
    { to: "/panel/arrendamientos", key: "arrendamientos", label: "Alquileres", icon: FileSignature },
    { to: "/panel/reportes", key: "reportes", label: "Reportes", icon: BarChart3 },
  ].filter((i) => canAccess(activo, i.key));
  // En desktop colapsado, el texto se oculta (lg:hidden) pero en el drawer mobile siempre se ve.
  const hideOnCollapse = collapsed ? "lg:hidden" : "";

  return (
    <>
      {/* overlay mobile */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-graph/30 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      {/* sidebar glass flotante (Apple) */}
      <aside
        className={cn(
          "glass-strong fixed inset-y-3 left-3 z-40 flex flex-col rounded-[26px] text-graph transition-[transform,width] duration-300 ease-out lg:translate-x-0",
          "shadow-[0_24px_60px_-30px_rgba(23,26,23,0.40)]",
          collapsed ? "w-[248px] lg:w-[76px]" : "w-[248px]",
          open ? "translate-x-0" : "-translate-x-[112%]"
        )}
      >
        {/* toggle colapsar (solo desktop, sobre el borde) */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="absolute -right-3 top-[72px] z-50 hidden h-6 w-6 place-items-center rounded-full border border-graph/10 bg-paper-100 text-graph-500 shadow-md transition hover:text-brand lg:grid"
        >
          <ChevronsLeft size={14} className={cn("transition-transform", collapsed && "rotate-180")} />
        </button>

        {/* logo */}
        <div className={cn("flex items-center gap-3 px-5 py-5", collapsed && "lg:justify-center lg:px-0")}>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-brand font-display text-base font-bold text-white shadow-[0_8px_20px_-8px_rgba(12,77,162,0.7)]">
            P
          </div>
          <div className={cn("leading-tight", hideOnCollapse)}>
            <p className="font-display text-base font-semibold tracking-tight text-graph">Potente <span className="text-brand">Propiedades</span></p>
            <p className="text-[10px] uppercase tracking-widest2 text-brand">Inmobiliaria · Mar del Plata</p>
          </div>
        </div>

        {/* nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                    collapsed && "lg:justify-center lg:px-0",
                    isActive
                      ? "bg-brand text-white shadow-[0_10px_24px_-10px_rgba(12,77,162,0.7)]"
                      : "text-graph-500 hover:bg-graph/[0.05] hover:text-graph"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} strokeWidth={2} className={isActive ? "text-white" : "text-graph-400 group-hover:text-graph"} />
                    <span className={cn("flex-1", hideOnCollapse)}>{item.label}</span>
                    {item.badge ? (
                      <>
                        <span
                          className={cn(
                            "min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold",
                            hideOnCollapse,
                            isActive ? "bg-white/25 text-white" : "bg-brand text-white"
                          )}
                        >
                          {item.badge}
                        </span>
                        {/* puntito en modo colapsado */}
                        <span className={cn("absolute right-2 top-2 hidden h-1.5 w-1.5 rounded-full bg-brand", collapsed && "lg:block")} />
                      </>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* footer */}
        <div className="border-t border-graph/[0.08] px-3 py-3">
          <div className={cn("mb-2 flex items-center gap-2 rounded-2xl bg-graph/[0.04] px-3 py-2.5", collapsed && "lg:justify-center lg:px-0")}>
            <Sprout size={16} className="shrink-0 text-brand" />
            <div className={cn("leading-tight", hideOnCollapse)}>
              <p className="text-xs font-semibold text-graph">Potente Propiedades · 3 generaciones</p>
              <p className="text-[10px] text-graph-400">Inmobiliaria · Mar del Plata</p>
            </div>
          </div>
          <button
            onClick={cerrarSesion}
            title={collapsed ? "Cerrar sesión" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-graph-400 transition hover:bg-graph/[0.05] hover:text-graph",
              collapsed && "lg:justify-center lg:px-0"
            )}
          >
            <LogOut size={18} strokeWidth={2} className="shrink-0" />
            <span className={hideOnCollapse}>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
