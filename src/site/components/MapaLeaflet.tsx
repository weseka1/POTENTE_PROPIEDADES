/**
 * El mapa de verdad. Va en su PROPIO chunk: lo carga `MapaPropiedad` con
 * `lazy()` y recién cuando el visitante scrollea hasta la ubicación.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ El `import` del CSS de Leaflet tiene que estar ACÁ ADENTRO. Si se pone en
 * `index.css`, Vite lo mete en la hoja de estilos principal y se lo baja TODO
 * visitante, incluso el que nunca abre una propiedad.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAPA } from "../../config/mapa";

/**
 * El pin, dibujado a mano.
 *
 * ⚠️ No se usa el marcador que trae Leaflet: sus iconos son dos PNG que se
 * resuelven con rutas relativas al CSS y bajo un bundler dan 404 (es el bug más
 * conocido de Leaflet). Con un `divIcon` y un SVG inline no hay archivo que
 * pueda faltar, y de paso queda en el azul de la marca.
 */
const pinDeMarca = () =>
  L.divIcon({
    className: "",
    html:
      '<svg width="34" height="46" viewBox="0 0 34 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M17 1C8.7 1 2 7.7 2 16c0 10.5 12.4 25.6 14.1 27.7a1.2 1.2 0 0 0 1.8 0C19.6 41.6 32 26.5 32 16 32 7.7 25.3 1 17 1z" ' +
      'fill="#0C4DA2" stroke="#fff" stroke-width="2.5"/>' +
      '<circle cx="17" cy="16" r="5.2" fill="#fff"/></svg>',
    iconSize: [34, 46],
    iconAnchor: [17, 45],
  });

export default function MapaLeaflet({ lat, lng, titulo }: { lat: number; lng: number; titulo: string }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;

    const mapa = L.map(nodo, {
      center: [lat, lng],
      zoom: MAPA.zoomPropiedad,

      // La rueda HACE ZOOM (en escritorio). Primero lo habíamos apagado para
      // proteger el scroll de la página, y el cliente lo vetó con razón
      // (Juani, 10-ago: "si quiero hacer zoom en el maps me baja la página"):
      // el que apoya el mouse en un mapa espera que la rueda acerque, como en
      // Google Maps. El `data-lenis-prevent` del contenedor evita que el
      // scroll suave se pelee por el mismo evento. En el celular queda apagado
      // junto con el arrastre (ver abajo).
      scrollWheelZoom: !L.Browser.mobile,

      // 🔴 En el celular el mapa NO se arrastra ni zoomea. Un dedo adentro de
      // un mapa que ocupa el ancho de la pantalla deja al visitante atrapado:
      // no puede seguir bajando. Acá el mapa es una foto de referencia y el que
      // quiere moverlo toca "Cómo llegar" o "Abrir en Maps", que abre la app
      // nativa — que es lo que uno quiere hacer en el teléfono igual.
      dragging: !L.Browser.mobile,
      touchZoom: !L.Browser.mobile,

      // La atribución se agrega abajo sin el "Leaflet |" adelante.
      attributionControl: false,
      keyboard: false,
    });

    L.tileLayer(MAPA.mosaicos, { maxZoom: MAPA.zoomMax, attribution: MAPA.atribucion }).addTo(mapa);
    L.control.attribution({ prefix: false, position: "bottomright" }).addTo(mapa);
    L.marker([lat, lng], { icon: pinDeMarca(), title: titulo, keyboard: false }).addTo(mapa);

    // ⚠️ Leaflet mide el contenedor al crearse. Si el div todavía no terminó de
    // acomodarse (viene de un `Suspense`, o de una transición), mide 0 de ancho
    // y dibuja los mosaicos grises. `invalidateSize` lo vuelve a medir.
    const t = setTimeout(() => mapa.invalidateSize(), 80);

    return () => {
      clearTimeout(t);
      mapa.remove();
    };
  }, [lat, lng, titulo]);

  // `data-lenis-prevent`: adentro del mapa manda el mapa, no el scroll suave.
  return <div ref={caja} className="h-[320px] w-full sm:h-[380px]" data-lenis-prevent />;
}
