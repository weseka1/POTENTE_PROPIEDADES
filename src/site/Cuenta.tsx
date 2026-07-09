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

// Cómo se le muestra al visitante el estado interno de su consulta.
const ESTADO_PUBLICO: Record<string, { label: string; clase: string }> = {
  nueva:       { label: "Enviada",          clase: "bg-graph/[0.06] text-graph-500" },
  contactado:  { label: "Respondida",       clase: "bg-brand-50 text-brand" },
  visita:      { label: "Visita agendada",  clase: "bg-sea-50 text-sea" },
  negociacion: { label: "En gestión",       clase: "bg-amber-500/12 text-amber-700" },
  cerrado:     { label: "Cerrada",          clase: "bg-brand-950/[0.07] text-brand-950" },
  perdido:     { label: "Cerrada",          clase: "bg-graph/[0.06] text-graph-400" },
};

export default function Cuenta() {
  useLenis();
  const { user, salir } = useAuth();
  const { favoritos } = useFavorites();
  const { propiedades, leads } = useData();
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<"favoritos" | "consultas" | "datos">("favoritos");

  const favs = propiedades.filter((p) => favoritos.includes(p.id));

  // Las consultas del visitante son las que dejó desde la web o el asistente:
  // se identifican por el contacto (mail o teléfono) con el que se registró.
  const misConsultas = leads.filter((l) => {
    if (!user) return false;
    const c = (l.contacto || "").trim().toLowerCase();
    if (!c) return false;
    const mail = (user.email || "").trim().toLowerCase();
    const tel = (user.telefono || "").replace(/\D/g, "");
    return (mail && c === mail) || (tel.length >= 6 && c.replace(/\D/g, "").endsWith(tel.slice(-8)));
  });

  const tituloDe = (campoId: string | null) =>
    (campoId && propiedades.find((p) => p.id === campoId)?.titulo) || "Consulta general";

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

        {tab === "consultas" &&
          (misConsultas.length === 0 ? (
            <Empty texto="Todavía no nos hiciste ninguna consulta. Cuando escribas por una propiedad, la vas a ver acá." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-graph/10">
              {misConsultas.map((c, i) => {
                const e = ESTADO_PUBLICO[c.estado] ?? ESTADO_PUBLICO.nueva;
                return (
                  <div key={c.id} className={`flex flex-wrap items-center justify-between gap-3 p-5 ${i > 0 ? "border-t border-graph/10" : ""} bg-paper-100`}>
                    <div>
                      <p className="font-medium text-graph">{tituloDe(c.campoId)}</p>
                      <p className="text-sm text-graph-400">Consulta enviada el {fmtFecha(c.fechaISO)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${e.clase}`}>{e.label}</span>
                  </div>
                );
              })}
            </div>
          ))}

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
