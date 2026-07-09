import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Heart, User, LogOut, Search, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import AuthModal from "./AuthModal";

const WHATSAPP = "https://wa.me/5492233029591";

const cats = [
  { to: "/propiedades?operacion=venta", label: "En venta" },
  { to: "/propiedades?operacion=alquiler", label: "Alquileres" },
  { to: "/temporada", label: "Temporada" },
  { to: "/propiedades?cat=casa", label: "Casas" },
  { to: "/propiedades?cat=departamento", label: "Deptos" },
  { to: "/#tasaciones", label: "Tasaciones" },
];

export default function Navbar({ variant = "overlay" }: { variant?: "overlay" | "solid" }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [auth, setAuth] = useState<{ open: boolean; modo: "ingresar" | "registrar" }>({
    open: false,
    modo: "ingresar",
  });
  const { user, salir } = useAuth();
  const { count } = useFavorites();
  const navigate = useNavigate();
  useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = variant === "solid" || scrolled;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          solid ? "border-b border-graph/10 bg-paper/85 py-3 backdrop-blur-xl" : "bg-gradient-to-b from-paper/80 to-transparent py-4"
        }`}
      >
        <nav className="container-x flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-950 font-display text-base font-semibold text-white">
              P
            </span>
            <span className="leading-none">
              <span className="block font-display text-lg font-semibold tracking-tight text-graph">
                Potente <span className="text-brand">Propiedades</span>
              </span>
              <span className="hidden text-[10px] uppercase tracking-widest2 text-graph-400 sm:block">
                Mar del Plata · 3 generaciones
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {cats.map((c) =>
              c.to.includes("#") ? (
                <a key={c.to} href={c.to} className="link-underline text-sm font-medium text-graph-500 hover:text-graph">
                  {c.label}
                </a>
              ) : (
                <Link key={c.to} to={c.to} className="link-underline text-sm font-medium text-graph-500 hover:text-graph">
                  {c.label}
                </Link>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Lleva al catálogo y deja el cursor en el buscador (si ya estamos ahí, solo enfoca).
                navigate("/propiedades");
                setTimeout(() => document.getElementById("buscador-catalogo")?.focus(), 350);
              }}
              aria-label="Buscar"
              className="grid h-10 w-10 place-items-center rounded-full text-graph-500 transition hover:bg-graph/5 hover:text-brand"
            >
              <Search size={19} />
            </button>

            <Link
              to="/favoritos"
              aria-label="Favoritos"
              className="relative grid h-10 w-10 place-items-center rounded-full text-graph-500 transition hover:bg-graph/5 hover:text-brand"
            >
              <Heart size={19} />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>

            {user ? (
              <div className="relative hidden lg:block">
                <button
                  onClick={() => setUserMenu((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-graph/15 py-1.5 pl-1.5 pr-3 text-sm text-graph transition hover:border-brand"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                    {user.nombre.charAt(0).toUpperCase()}
                  </span>
                  {user.nombre.split(" ")[0]}
                  <ChevronDown size={14} />
                </button>
                {userMenu && (
                  <div
                    className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-graph/10 bg-paper-100 py-1 shadow-card"
                    onMouseLeave={() => setUserMenu(false)}
                  >
                    <Link to="/cuenta" onClick={() => setUserMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-graph-500 hover:bg-graph/5">
                      <User size={15} /> Mi cuenta
                    </Link>
                    <Link to="/favoritos" onClick={() => setUserMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-graph-500 hover:bg-graph/5">
                      <Heart size={15} /> Mis favoritos
                    </Link>
                    <button onClick={() => { setUserMenu(false); salir(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-graph-500 hover:bg-graph/5">
                      <LogOut size={15} /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <button
                  onClick={() => setAuth({ open: true, modo: "ingresar" })}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-graph-500 transition hover:text-brand"
                >
                  Ingresar
                </button>
                <button
                  onClick={() => setAuth({ open: true, modo: "registrar" })}
                  className="btn-primary !px-5 !py-2"
                >
                  Registrarme
                </button>
              </div>
            )}

            <button onClick={() => setOpen((v) => !v)} className="text-graph lg:hidden" aria-label="Menú">
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </nav>

        {open && (
          <div className="container-x mt-3 flex flex-col gap-1 border-t border-graph/10 pt-3 lg:hidden">
            {cats.map((c) =>
              c.to.includes("#") ? (
                <a key={c.to} href={c.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-graph-500 hover:bg-graph/5">
                  {c.label}
                </a>
              ) : (
                <Link key={c.to} to={c.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-graph-500 hover:bg-graph/5">
                  {c.label}
                </Link>
              )
            )}
            <div className="mt-2 flex gap-2">
              {user ? (
                <>
                  <Link to="/cuenta" onClick={() => setOpen(false)} className="btn-ghost flex-1">Mi cuenta</Link>
                  <button onClick={() => { setOpen(false); salir(); }} className="btn-ghost flex-1">Salir</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setOpen(false); setAuth({ open: true, modo: "ingresar" }); }} className="btn-ghost flex-1">Ingresar</button>
                  <button onClick={() => { setOpen(false); setAuth({ open: true, modo: "registrar" }); }} className="btn-primary flex-1">Registrarme</button>
                </>
              )}
            </div>
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn-primary mt-2">Consultar por WhatsApp</a>
          </div>
        )}
      </header>

      <AuthModal open={auth.open} onClose={() => setAuth({ ...auth, open: false })} modoInicial={auth.modo} />
    </>
  );
}
