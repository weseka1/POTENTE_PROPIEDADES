import { Link } from "react-router-dom";
import { MapPin, Phone, MessageCircle, Instagram, Facebook, Clock } from "lucide-react";
import { OFICINAS, waUrl } from "@/config/marca";

export default function Footer() {
  return (
    <footer className="border-t border-graph/10 bg-paper text-graph">
      <div className="container-x grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link to="/" className="flex items-center gap-3">
            <img src="/img/marca/pp-azul.png" alt="" className="h-11 w-auto" />
            <span className="font-display text-xl font-semibold">
              Potente <span className="text-brand">Propiedades</span>
            </span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-graph-500">
            Tu inmobiliaria en Mar del Plata. Más de 50 años y tres generaciones
            dedicadas a la venta y el alquiler de casas, departamentos, locales y
            lotes. Tasaciones profesionales con informe escrito.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href="https://www.facebook.com/potente.propiedades"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook de Potente Propiedades"
              className="grid h-10 w-10 place-items-center rounded-full border border-graph/15 transition hover:border-brand hover:text-brand"
            >
              <Facebook size={18} />
            </a>
            <a
              href="https://www.instagram.com/potentepropiedades"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram de Potente Propiedades"
              className="grid h-10 w-10 place-items-center rounded-full border border-graph/15 transition hover:border-brand hover:text-brand"
            >
              <Instagram size={18} />
            </a>
          </div>
        </div>

        <div>
          <h4 className="eyebrow mb-5">Navegación</h4>
          <ul className="space-y-3 text-sm text-graph-500">
            <li><Link to="/propiedades?operacion=venta" className="hover:text-brand">Propiedades en venta</Link></li>
            <li><Link to="/propiedades?operacion=alquiler" className="hover:text-brand">Alquileres</Link></li>
            <li><a href="/#servicios" className="hover:text-brand">Servicios</a></li>
            <li><a href="/#tasaciones" className="hover:text-brand">Tasaciones</a></li>
            <li><a href="/#nosotros" className="hover:text-brand">Nosotros</a></li>
            <li><Link to="/panel" className="hover:text-brand">Panel (acceso interno)</Link></li>
          </ul>
        </div>

        {OFICINAS.map((o) => (
          <div key={o.id}>
            <h4 className="eyebrow mb-5">Oficina {o.numero} · {o.nombre}</h4>
            <ul className="space-y-4 text-sm text-graph-500">
              <li className="flex gap-3"><MapPin size={18} className="shrink-0 text-brand" /> {o.direccion}</li>
              <li className="flex gap-3"><Phone size={18} className="shrink-0 text-brand" /> {o.telefono}</li>
              <li>
                <a href={waUrl(o.id)} target="_blank" rel="noreferrer" className="flex gap-3 transition hover:text-brand">
                  <MessageCircle size={18} className="shrink-0 text-brand" /> WhatsApp
                </a>
              </li>
              <li className="flex gap-3"><Clock size={18} className="shrink-0 text-brand" /> {o.horario}</li>
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-graph/10">
        <div className="container-x flex flex-col items-center justify-between gap-4 py-6 text-xs text-graph-400 md:flex-row">
          <span>© {new Date().getFullYear()} Potente Propiedades · Todos los derechos reservados.</span>

          {/* ── La firma del estudio ──────────────────────────────────────────
              Monograma + wordmark, discreta pero inconfundible: cada web que
              entregamos es la vidriera de la próxima. El monograma va como SVG
              inline (nítido en cualquier pantalla, cero peso) con la W y la ola
              de WESEKA. Deriva a wsk.com.ar. */}
          <a
            href="https://wsk.com.ar"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WESEKA — estudio de software e inteligencia artificial"
            className="group inline-flex items-center gap-2.5"
          >
            <span className="transition group-hover:text-graph-500">Sitio y sistema por</span>
            <svg
              width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"
              className="shrink-0 transition-transform duration-300 group-hover:scale-110"
            >
              <rect width="22" height="22" rx="6" fill="#022352" />
              <polyline points="5,6 8,13.2 11,8 14,13.2 17,6" fill="none" stroke="#F6F8FB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 17.2c2-1.4 4-1.4 6 0s4 1.4 6 0" fill="none" stroke="#1495D8" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="font-display text-[13px] font-semibold tracking-[0.22em] text-graph-500 transition group-hover:text-navy">
              WESEKA
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
