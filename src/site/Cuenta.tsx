import { useState } from "react";
import { Link } from "react-router-dom";
import { User, Heart, MessageSquare, LogOut, Mail, Phone } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PropiedadCard from "./components/PropiedadCard";
import AuthModal from "./components/AuthModal";
import { useLenis } from "./lib/useLenis";
import { useAuth } from "./context/AuthContext";
import { useFavorites } from "./context/FavoritesContext";
import { useData } from "@/lib/DataProvider";
import { fmtFecha } from "@/lib/format";

// Consultas de ejemplo del usuario logueado
const misConsultas = [
  { id: "C-1", propiedad: "Establecimiento agrícola 1.240 ha — Coronel Dorrego", fecha: "2026-06-22", estado: "Respondida" },
  { id: "C-2", propiedad: "Casa en venta — 19 de Mayo al 500", fecha: "2026-06-20", estado: "En gestión" },
];

export default function Cuenta() {
  useLenis();
  const { user, salir } = useAuth();
  const { favoritos } = useFavorites();
  const { propiedades } = useData();
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<"favoritos" | "consultas" | "datos">("favoritos");

  const favs = propiedades.filter((p) => favoritos.includes(p.id));

  if (!user) {
    return (
      <div className="min-h-screen bg-paper text-graph">
        <div className="grain" />
        <Navbar variant="solid" />
        <div className="container-x grid min-h-[70vh] place-items-center">
          <div className="max-w-md rounded-2xl border border-graph/10 bg-paper-100 p-10 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand">
              <User size={30} />
            </span>
            <h1 className="mt-5 font-display text-2xl text-graph">Ingresá a tu cuenta</h1>
            <p className="mt-2 text-graph-500">Para ver tus favoritos y el estado de tus consultas.</p>
            <button onClick={() => setAuthOpen(true)} className="btn-primary mt-7 w-full">Ingresar / Registrarme</button>
          </div>
        </div>
        <Footer />
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  const tabs = [
    { key: "favoritos" as const, label: "Favoritos", icon: Heart, n: favs.length },
    { key: "consultas" as const, label: "Mis consultas", icon: MessageSquare, n: misConsultas.length },
    { key: "datos" as const, label: "Mis datos", icon: User },
  ];

  return (
    <div className="min-h-screen bg-paper text-graph">
      <div className="grain" />
      <Navbar variant="solid" />

      <header className="container-x pt-32 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-brand font-display text-xl font-bold text-white">
              {user.nombre.charAt(0).toUpperCase()}
            </span>
            <div>
              <h1 className="font-display text-3xl text-graph">Hola, {user.nombre.split(" ")[0]}</h1>
              <p className="text-sm text-graph-500">{user.email}</p>
            </div>
          </div>
          <button onClick={salir} className="btn-ghost"><LogOut size={16} /> Cerrar sesión</button>
        </div>
      </header>

      <div className="container-x">
        <div className="flex gap-2 border-b border-graph/10">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === t.key ? "border-brand text-brand" : "border-transparent text-graph-500 hover:text-graph"
              }`}
            >
              <t.icon size={16} /> {t.label}
              {"n" in t && <span className="rounded-full bg-graph/5 px-2 text-xs">{t.n}</span>}
            </button>
          ))}
        </div>
      </div>

      <section className="container-x py-10">
        {tab === "favoritos" &&
          (favs.length === 0 ? (
            <Empty texto="Todavía no guardaste propiedades." />
          ) : (
            <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {favs.map((p) => (
                <PropiedadCard key={p.id} p={p} />
              ))}
            </div>
          ))}

        {tab === "consultas" && (
          <div className="overflow-hidden rounded-2xl border border-graph/10">
            {misConsultas.map((c, i) => (
              <div key={c.id} className={`flex flex-wrap items-center justify-between gap-3 p-5 ${i > 0 ? "border-t border-graph/10" : ""} bg-paper-100`}>
                <div>
                  <p className="font-medium text-graph">{c.propiedad}</p>
                  <p className="text-sm text-graph-400">Consulta enviada el {fmtFecha(c.fecha)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.estado === "Respondida" ? "bg-brand-50 text-brand" : "bg-brand-50 text-brand"}`}>
                  {c.estado}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "datos" && (
          <div className="max-w-lg space-y-4 rounded-2xl border border-graph/10 bg-paper-100 p-7">
            <Dato icon={User} label="Nombre" valor={user.nombre} />
            <Dato icon={Mail} label="Email" valor={user.email} />
            <Dato icon={Phone} label="Teléfono" valor={user.telefono || "—"} />
            <p className="pt-2 text-xs text-graph-400">Para modificar tus datos, escribinos por WhatsApp.</p>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

function Empty({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-graph/10 bg-paper-100 py-20 text-center">
      <p className="text-graph-500">{texto}</p>
      <Link to="/propiedades" className="btn-primary mt-6">Ver el catálogo</Link>
    </div>
  );
}

function Dato({ icon: Icon, label, valor }: { icon: any; label: string; valor: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand"><Icon size={18} /></span>
      <div>
        <p className="text-xs uppercase tracking-widest2 text-graph-400">{label}</p>
        <p className="text-graph">{valor}</p>
      </div>
    </div>
  );
}
