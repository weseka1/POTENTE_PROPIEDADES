import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, Bell, ChevronDown, Sparkles, Users, LogOut } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { useProfiles, Avatar } from "../profiles";
import { usePanelAuth } from "../auth";
import { canalLabel } from "../ui/estados";

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const { online, leads } = useData();
  const { activo, openGate } = useProfiles();
  const { signOut } = usePanelAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [noti, setNoti] = useState(false);
  const nuevas = leads.filter((l) => l.estado === "nueva");
  const salir = async () => { setMenu(false); await signOut(); navigate("/ingresar"); };
  const irAConsultas = () => { setNoti(false); navigate("/panel/leads"); };

  return (
    <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-x-0 border-t-0 border-b px-4 md:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-graph-500 transition hover:bg-graph/5 lg:hidden" aria-label="Menú">
        <Menu size={20} />
      </button>

      <div className="relative hidden max-w-md flex-1 md:block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graph-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar propiedades, clientes, consultas…"
          className="h-9 w-full rounded-xl border border-graph/15 bg-paper-100 pl-9 pr-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60 focus:bg-white focus:ring-2 focus:ring-brand/15"
        />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
        <span className="hidden items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand/20 lg:inline-flex">
          <Sparkles size={12} /> IA activa
        </span>

        {online ? (
          <span className="hidden items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand/20 sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            Datos en vivo
          </span>
        ) : (
          <span className="hidden items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-500/25 sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            Datos de prueba
          </span>
        )}

        <div className="relative">
          <button onClick={() => setNoti((v) => !v)} className="relative rounded-xl p-2 text-graph-500 transition hover:bg-graph/5 hover:text-graph" aria-label="Notificaciones">
            <Bell size={19} />
            {nuevas.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                {nuevas.length}
              </span>
            )}
          </button>
          {noti && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setNoti(false)} />
              <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-graph/10 bg-paper-100 shadow-[0_24px_60px_-24px_rgba(23,26,23,0.35)]">
                <div className="flex items-center justify-between border-b border-graph/[0.08] px-4 py-3">
                  <p className="text-sm font-semibold text-graph">Notificaciones</p>
                  {nuevas.length > 0 && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand-700">{nuevas.length} nuevas</span>}
                </div>
                {nuevas.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-medium text-graph">Estás al día 🎉</p>
                    <p className="mt-0.5 text-xs text-graph-400">No hay consultas nuevas sin ver.</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {nuevas.slice(0, 8).map((l) => (
                      <button key={l.id} onClick={irAConsultas} className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-graph/[0.04]">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-graph">{l.nombre}</span>
                          <span className="block truncate text-[12px] text-graph-400">Consulta nueva · {canalLabel[l.canal] || l.canal}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={irAConsultas} className="block w-full border-t border-graph/[0.06] px-4 py-2.5 text-center text-xs font-semibold text-brand transition hover:bg-graph/[0.04]">Ver todas las consultas</button>
              </div>
            </>
          )}
        </div>

        {/* cuenta / perfil */}
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition hover:bg-graph/5">
            <Avatar p={activo} size={36} />
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-sm font-semibold text-graph">{activo.nombre}</span>
              <span className="block text-[11px] text-graph-400">{activo.rol}</span>
            </span>
            <ChevronDown size={15} className={`hidden text-graph-400 transition md:block ${menu ? "rotate-180" : ""}`} />
          </button>

          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-graph/10 bg-paper-100 shadow-[0_24px_60px_-24px_rgba(23,26,23,0.35)]">
                <div className="flex items-center gap-3 border-b border-graph/[0.08] px-4 py-3.5">
                  <Avatar p={activo} size={42} />
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-graph">{activo.nombre}</p>
                    <p className="text-[11px] text-graph-400">{activo.rol}</p>
                  </div>
                </div>
                <button onClick={() => { setMenu(false); openGate(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-graph transition hover:bg-graph/[0.04]">
                  <Users size={16} className="text-brand" /> Cambiar de perfil
                </button>
                <button onClick={salir} className="flex w-full items-center gap-3 border-t border-graph/[0.06] px-4 py-2.5 text-sm font-medium text-graph-500 transition hover:bg-graph/[0.04]">
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
