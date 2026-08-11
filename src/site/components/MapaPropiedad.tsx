/**
 * La sección "Ubicación" de la ficha pública.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 POR QUÉ SE DEJÓ DE USAR EL IFRAME DE OPENSTREETMAP (10-ago, lo vio Juani):
 * el embed de `openstreetmap.org/export/embed.html` trae puesta, abajo, la
 * barrita de OSM: "Reportar un problema · © Colaboradores de OpenStreetMap ·
 * Hacer una donación · Términos del sitio web y de la API". Adentro de un
 * iframe eso NO se puede sacar, y en la web de una inmobiliaria queda como si
 * le pidiéramos plata al que está mirando una casa. Textual de Juani: "acá pide
 * donación, no sé qué poronga... no me resulta tan prolijo para el cliente".
 *
 * Con Leaflet el mapa es nuestro: queda el crédito que exige la licencia
 * (© OpenStreetMap, un renglón) y nada más.
 *
 * Y se suma la fila de acciones que ya tiene la web de Bochile y a esta le
 * faltaba — "Cómo llegar" es la que importa: en el celular abre la app de Maps
 * con la ruta armada desde donde está parado el que consulta.
 */
import { Component, Suspense, lazy, type ReactNode } from "react";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { linkComoLlegar, linkEnMaps } from "@/config/mapa";

/**
 * Leaflet va en su propio chunk (~46 KB gzip, fuera del bundle principal), pero
 * se empieza a descargar APENAS SE ABRE LA FICHA, no cuando el visitante llega
 * scrolleando a la sección.
 *
 * 🔴 Antes se montaba recién al entrar en pantalla (IntersectionObserver) y
 * Juani lo vio gris en producción (10-ago): si el chunk tarda —server frío,
 * conexión lenta, o un deploy en el medio que cambió el nombre del archivo— el
 * visitante ya está PARADO mirando el hueco vacío. Arrancar la descarga con la
 * página esconde toda esa latencia: para cuando alguien scrollea hasta
 * "Ubicación", el mapa hace rato que está listo.
 *
 * Y si el chunk igual falla (la ventana de un deploy purga los assets viejos),
 * se reintenta UNA vez con cache-bust; si tampoco, el recuadro lo dice y los
 * botones de Maps siguen andando — nunca un gris mudo.
 */
const cargarMapa = () =>
  import("./MapaLeaflet").catch(
    () => new Promise<typeof import("./MapaLeaflet")>((res, rej) => {
      setTimeout(() => import("./MapaLeaflet").then(res, rej), 1200);
    }),
  );
const MapaLeaflet = lazy(cargarMapa);

/** Si Leaflet no pudo cargar, el recuadro lo dice en vez de quedarse gris. */
class RedDeSeguridad extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div className="grid h-[320px] w-full place-items-center bg-paper-200 px-6 text-center sm:h-[380px]">
        <p className="text-sm text-graph-500">
          No se pudo cargar el mapa. Use «Cómo llegar» o «Abrir en Maps» aquí arriba.
        </p>
      </div>
    );
  }
}

export default function MapaPropiedad({
  lat, lng, direccion, zona, titulo,
}: { lat: number; lng: number; direccion?: string; zona?: string; titulo: string }) {

  // ⚠️ Dos botones, no tres. Falta "Ver la calle" (Street View) A PROPÓSITO:
  // Google no tiene cobertura en todas las localidades de la costa —Mar del Sur,
  // por ejemplo— y saber si la hay antes de mostrar el botón exige la Street
  // View Static API, que es paga y con tarjeta. Un botón que a veces cae en "no
  // hay imágenes de esta zona" es justo lo que no queremos en la web del
  // cliente. Desde "Abrir en Maps" el que quiere igual llega a Street View.
  const acciones = [
    { href: linkComoLlegar(lat, lng), icon: Navigation, texto: "Cómo llegar", principal: true },
    { href: linkEnMaps(lat, lng), icon: ExternalLink, texto: "Abrir en Maps", principal: false },
  ];

  return (
    <div className="mt-10">
      <h2 className="font-display text-2xl text-graph">Ubicación</h2>

      <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-graph/10">
        {/* Encabezado: la dirección y los botones. Va arriba del mapa para que en
            el celular se vean sin tener que pasar por encima del mapa. */}
        <div className="flex flex-col gap-3 border-b border-graph/10 bg-paper-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="flex items-start gap-2 text-sm text-graph-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <span>{[direccion, zona].filter(Boolean).join(" · ") || "Mar del Plata"}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {acciones.map((a) => (
              <a
                key={a.texto}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition ${
                  a.principal
                    ? "bg-brand text-white hover:bg-brand-700"
                    : "ring-1 ring-graph/15 text-graph-600 hover:bg-paper-200 hover:text-graph"
                }`}
              >
                <a.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {a.texto}
              </a>
            ))}
          </div>
        </div>

        <RedDeSeguridad>
          <Suspense fallback={<div className="h-[320px] w-full animate-pulse bg-paper-200 sm:h-[380px]" />}>
            <MapaLeaflet lat={lat} lng={lng} titulo={titulo} />
          </Suspense>
        </RedDeSeguridad>
      </div>

      {/* Honesto y a propósito: las coordenadas de las propiedades importadas
          salen del portal y ubican la cuadra, no la puerta. Decir "referencia"
          es lo que corresponde, y además la dirección exacta es una pregunta
          que conviene que llegue por WhatsApp: ese mensaje es un lead. */}
      <p className="mt-2.5 text-xs text-graph-400">
        Ubicación de referencia. Consulte la dirección exacta por WhatsApp.
      </p>
    </div>
  );
}
