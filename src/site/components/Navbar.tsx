import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Heart, User, LogOut, Search, ChevronDown } from "lucide-react";
import { useFavorites } from "../context/FavoritesContext";

import WhatsAppCTA from "./WhatsAppCTA";

// Menú resumido (pedido Mateo 5-ago): fuera Casas/Deptos (viven como filtros del
// catálogo), entran Nosotros (la historia, 3 generaciones) y Contacto (formulario).
const cats = [
  { to: "/propiedades?operacion=venta", label: "En venta" },
  { to: "/propiedades?operacion=alquiler", label: "Alquileres" },
  { to: "/temporada", label: "Temporada" },
  { to: "/#tasaciones", label: "Tasaciones" },
  { to: "/#nosotros", label: "Nosotros" },
  { to: "/#contacto", label: "Contacto" },
];

export default function Navbar({ variant = "overlay" }: { variant?: "overlay" | "solid" }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { count } = useFavorites();
  const navigate = useNavigate();
  useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Con el menú mobile abierto la barra tiene que ser sólida sí o sí: si no, los
  // links quedan flotando sobre el hero y no se lee nada.
  const solid = variant === "solid" || scrolled || open;

  // Cerrar el menú al pasar a escritorio y con Escape; bloquear el scroll de fondo.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth >= 1024 && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      {/* velo detrás del menú mobile: separa el menú del contenido */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-brand-950/40 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      )}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          solid ? "border-b border-graph/10 bg-paper/95 py-3 backdrop-blur-xl" : "bg-gradient-to-b from-paper/80 to-transparent py-4"
        }`}
      >
        <nav className="container-x flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <img src="/img/marca/pp-azul.png" alt="" className="h-10 w-auto" />
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
                <a key={c.to} href={c.to} className="link-underline whitespace-nowrap text-sm font-medium text-graph-500 hover:text-graph">
                  {c.label}
                </a>
              ) : (
                <Link key={c.to} to={c.to} className="link-underline whitespace-nowrap text-sm font-medium text-graph-500 hover:text-graph">
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

            <WhatsAppCTA className="btn-primary !px-5 !py-2 hidden lg:inline-flex">Consultar por WhatsApp</WhatsAppCTA>

            <button onClick={() => setOpen((v) => !v)} className="text-graph lg:hidden" aria-label="Menú">
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </nav>

        {/* ── Menú móvil: LIQUID GLASS de verdad ──────────────────────────────
            Rediseñado el 11-ago (pedido de Juani: "que no parezca Windows 98").
            · Hoja de vidrio (blur + saturación, la misma receta del catálogo),
              despegada del borde y con las puntas redondeadas — es una pieza,
              no un cajón que se abre.
            · Entra deslizándose con la curva de la casa, y los ítems aparecen
              en cascada (cada uno 40 ms después del anterior).
            · Ítems altos (48px = dedo cómodo), con la flechita de "esto lleva a
              algún lado". El activo no existe acá: son 6 destinos, sin estados.
            La animación de entrada usa la MISMA técnica del catálogo: solo
            opacity/transform, nada que mueva layout. */}
        {open && (
          <div className="mt-2 px-3 lg:hidden">
            <div
              className="max-h-[calc(100vh-6.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-white/40 bg-paper-100/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_30px_70px_-24px_rgba(2,35,82,0.45)] backdrop-blur-2xl backdrop-saturate-150 motion-safe:animate-[menuGlass_.45s_cubic-bezier(0.16,1,0.3,1)_both]"
              data-lenis-prevent
            >
              {cats.map((c, i) => {
                const clase =
                  "flex min-h-[48px] items-center justify-between rounded-2xl px-4 text-[15px] font-medium text-graph transition active:bg-brand/[0.06] motion-safe:animate-[menuItem_.4s_cubic-bezier(0.16,1,0.3,1)_both]";
                const demora = { animationDelay: `${60 + i * 40}ms` } as const;
                const flecha = <ChevronDown size={16} className="-rotate-90 text-graph-300" aria-hidden />;
                return c.to.includes("#") ? (
                  <a key={c.to} href={c.to} onClick={() => setOpen(false)} className={clase} style={demora}>
                    {c.label} {flecha}
                  </a>
                ) : (
                  <Link key={c.to} to={c.to} onClick={() => setOpen(false)} className={clase} style={demora}>
                    {c.label} {flecha}
                  </Link>
                );
              })}
              <div className="mt-2 border-t border-graph/10 pt-3 motion-safe:animate-[menuItem_.4s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: `${60 + cats.length * 40}ms` }}>
                <WhatsAppCTA className="btn-primary w-full">Consultar por WhatsApp</WhatsAppCTA>
              </div>
            </div>
          </div>
        )}
      </header>

    </>
  );
}
