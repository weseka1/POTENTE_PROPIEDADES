import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Instagram, Facebook, Clock } from "lucide-react";

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

        <div>
          <h4 className="eyebrow mb-5">Punta Mogotes</h4>
          <ul className="space-y-4 text-sm text-graph-500">
            <li className="flex gap-3"><MapPin size={18} className="shrink-0 text-brand" /> Av. de los Trabajadores 2439</li>
            <li className="flex gap-3"><Phone size={18} className="shrink-0 text-brand" /> 223 472-7416</li>
            <li className="flex gap-3"><Clock size={18} className="shrink-0 text-brand" /> Lun a Vie 9 a 18 · Sáb 9 a 12</li>
          </ul>
        </div>

        <div>
          <h4 className="eyebrow mb-5">Chauvín</h4>
          <ul className="space-y-4 text-sm text-graph-500">
            <li className="flex gap-3"><MapPin size={18} className="shrink-0 text-brand" /> Av. Colón 3537</li>
            <li className="flex gap-3"><Phone size={18} className="shrink-0 text-brand" /> 223 512-9032</li>
            <li className="flex gap-3"><Mail size={18} className="shrink-0 text-brand" /> info@potenteprop.com.ar</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-graph/10">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-6 text-xs text-graph-400 md:flex-row">
          <span>© {new Date().getFullYear()} Potente Propiedades · Todos los derechos reservados.</span>
          <span>
            Sitio + sistema desarrollado por{" "}
            <a href="https://www.wsk.com.ar" target="_blank" rel="noreferrer" className="text-brand hover:text-brand-700">
              WESEKA.IA
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
