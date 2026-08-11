/**
 * El mapa de verdad. Va en su PROPIO chunk: lo carga `MapaPropiedad` con
 * `lazy()` y recién cuando el visitante scrollea hasta la ubicación.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ El `import` del CSS de Leaflet tiene que estar ACÁ ADENTRO. Si se pone en
 * `index.css`, Vite lo mete en la hoja de estilos principal y se lo baja TODO
 * visitante, incluso el que nunca abre una propiedad.
 */
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAPA, SOMBRAS_KEY } from "../../config/mapa";
import { EPOCAS_SOMBRA, fechaSombras, horaLegible, ventanaSolar, TERRENO_SHADEMAP, type EpocaSombra } from "../lib/sombras";

// La ciudad en 3D (MapLibre, ~230 KB gzip): SU PROPIO chunk, baja recién si
// el visitante toca "Ver en 3D". El video de Mateo, hecho feature.
const Mapa3DSombras = lazy(() => import("./Mapa3DSombras"));

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

/* ── Sombras (ShadeMap) ──────────────────────────────────────────────────────
 * "Que el cliente vea de qué lado le da el sol" — la obsesión de Mateo desde el
 * día uno, ahora con datos: terreno real (AWS Open Data) + los EDIFICIOS de
 * OpenStreetMap, así se ve la sombra que la torre de al lado tira sobre el
 * balcón a las 4 de la tarde. La key es de ShadeMap (la consiguió Mateo).
 * Épocas, fecha del sol y terreno viven en `../lib/sombras` — compartidos con
 * la vista 3D para que las dos digan lo mismo.
 *
 * Todo lo pesado (el simulador + el conversor de OSM) baja RECIÉN cuando el
 * visitante toca el botón: el que no lo usa no paga ni un byte.
 */

export default function MapaLeaflet({ lat, lng, titulo }: { lat: number; lng: number; titulo: string }) {
  const caja = useRef<HTMLDivElement>(null);
  // Mapa ↔ Satélite (pedido de Juani, 11-ago: "que el cliente pueda ver también
  // el satélite"). Las dos capas viven creadas; el toggle las intercambia sin
  // recrear el mapa ni perder el zoom ni el centro.
  const [satelite, setSatelite] = useState(false);
  const capas = useRef<{ mapa: L.TileLayer; sat: L.TileLayer } | null>(null);
  const mapaRef = useRef<L.Map | null>(null);

  // Sombras: la capa viva, su estado y sus controles (hora + época).
  // ⚠️ En la variante Leaflet del plugin, sacar la capa es `onRemove()` — el
  // `remove()` del README es de la variante Mapbox (lo dice el .d.ts).
  const sombraRef = useRef<{ onRemove: () => void; setDate: (d: Date) => void } | null>(null);
  const [sombras, setSombras] = useState(false);
  const [cargandoSombras, setCargandoSombras] = useState(false);
  // Zona sin relevar (Mar del Sur: 1 edificio en OSM y terreno plano = cero
  // sombra a la vista): se dice en la barrita, no se deja pensar que está roto.
  const [sinEdificios, setSinEdificios] = useState(false);
  const [hora, setHora] = useState(15 * 60); // 15:00 — la hora a la que se visita
  const [epoca, setEpoca] = useState<EpocaSombra>("hoy");
  // Solo horas CON sol: pasada la puesta el simulador no dibuja "noche", dibuja
  // una placa rota (bug 11-ago). La ventana la da SunCalc para ESTE lugar.
  const ventana = ventanaSolar(epoca, lat, lng);
  useEffect(() => { setHora((h) => ventana.clamp(h)); }, [epoca, ventana.min, ventana.max]);
  // La ciudad en 3D (pantalla completa). Solo el flag: el componente es lazy.
  const [ver3D, setVer3D] = useState(false);
  // Los edificios de OSM por zona visible, para no pegarle a Overpass dos veces
  // por el mismo encuadre (su política pide moderación).
  const cacheEdificios = useRef<Map<string, unknown[]>>(new Map());

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

    const capaMapa = L.tileLayer(MAPA.mosaicos, { maxZoom: MAPA.zoomMax, attribution: MAPA.atribucion });
    const capaSat = L.tileLayer(MAPA.satelite, { maxZoom: MAPA.zoomMax, attribution: MAPA.atribucionSatelite });
    capaMapa.addTo(mapa);
    capas.current = { mapa: capaMapa, sat: capaSat };
    mapaRef.current = mapa;
    L.control.attribution({ prefix: false, position: "bottomright" }).addTo(mapa);
    L.marker([lat, lng], { icon: pinDeMarca(), title: titulo, keyboard: false }).addTo(mapa);

    // ⚠️ Leaflet mide el contenedor al crearse. Si el div todavía no terminó de
    // acomodarse (viene de un `Suspense`, o de una transición), mide 0 de ancho
    // y dibuja los mosaicos grises. `invalidateSize` lo vuelve a medir.
    const t = setTimeout(() => mapa.invalidateSize(), 80);

    return () => {
      clearTimeout(t);
      // La capa de sombras muere con el mapa (cambiar de propiedad recrea todo;
      // el canvas huérfano se va con `mapa.remove()`, que tira el DOM entero).
      sombraRef.current?.onRemove();
      sombraRef.current = null;
      setSombras(false);
      cacheEdificios.current.clear();
      mapa.remove();
      mapaRef.current = null;
      capas.current = null;
    };
  }, [lat, lng, titulo]);

  const alternar = () => {
    const m = mapaRef.current;
    const c = capas.current;
    if (!m || !c) return;
    if (satelite) {
      m.removeLayer(c.sat);
      c.mapa.addTo(m);
    } else {
      m.removeLayer(c.mapa);
      c.sat.addTo(m);
    }
    setSatelite((v) => !v);
  };

  /** Los edificios de OSM del encuadre visible, como GeoJSON con altura.
   *  Overpass es un servicio comunitario: se consulta UNA vez por encuadre y
   *  con timeout corto — si no contesta, quedan las sombras del terreno solo. */
  const edificiosOSM = async () => {
    const m = mapaRef.current;
    // Lejos no se distinguen edificios y la consulta se vuelve gigante.
    if (!m || m.getZoom() < 15) return [];
    const b = m.getBounds();
    const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
    const clave = bbox
      .split(",")
      .map((v) => Number(v).toFixed(3))
      .join(",");
    const guardado = cacheEdificios.current.get(clave);
    if (guardado) return guardado;
    try {
      const q = `[out:json][timeout:15];(way["building"](${bbox}););out body;>;out skel qt;`;
      const r = await fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q));
      // Sin respuesta (Overpass rate-limitea) = sombras de terreno solo: el
      // aviso va IGUAL — si no, la barrita parece muerta sin explicación.
      if (!r.ok) { setSinEdificios(true); return []; }
      const json = await r.json();
      const { default: osmtogeojson } = await import("osmtogeojson");
      const gj = osmtogeojson(json) as { features: Array<{ properties?: Record<string, unknown> }> };
      // Mismo umbral que la vista 3D: con menos de 15 edificios el encuadre
      // parece vacío aunque técnicamente haya alguno.
      setSinEdificios(gj.features.length < 15);
      for (const f of gj.features) {
        const p = (f.properties ??= {});
        // Altura: la declarada en OSM; si solo hay pisos, 3 m por piso; y si no
        // hay nada, 6 m (dos plantas) — en MdP subestimar la sombra del vecino
        // es prometer un sol que después no está, y eso no se hace.
        const pisos = Number(p["building:levels"]) || 0;
        const altura = Number(p.height) || (pisos ? pisos * 3 : 6);
        p.height = altura;
        p.render_height = altura;
      }
      cacheEdificios.current.set(clave, gj.features);
      return gj.features;
    } catch {
      setSinEdificios(true);
      return []; // sin edificios sigue habiendo sombra de terreno — nunca romper el mapa
    }
  };

  /** Apagar de verdad: `onRemove()` del plugin NO saca el <canvas> del DOM
   *  (medido con la suite de sombras: se ACUMULAN al prender y apagar). En
   *  este mapa el overlay pane es exclusivo del simulador, así que barrerlo
   *  entero es seguro. Si algún día se suma otra capa canvas, revisar acá. */
  const apagarSombras = () => {
    sombraRef.current?.onRemove();
    sombraRef.current = null;
    mapaRef.current?.getPanes().overlayPane.querySelectorAll("canvas").forEach((c) => c.remove());
    setSombras(false);
  };

  const alternarSombras = async () => {
    const m = mapaRef.current;
    if (!m || !SOMBRAS_KEY || cargandoSombras) return;
    if (sombraRef.current) {
      apagarSombras();
      return;
    }
    setCargandoSombras(true);
    try {
      const { default: ShadeMap } = await import("leaflet-shadow-simulator");
      const sombra = new ShadeMap({
        date: fechaSombras(epoca, hora),
        color: "#0b1a33", // el azul noche de la casa, no un negro plano
        opacity: 0.62,
        apiKey: SOMBRAS_KEY,
        terrainSource: TERRENO_SHADEMAP,
        getFeatures: edificiosOSM,
        // Sin esto, el primer montaje dibuja el canvas del tamaño de la VENTANA
        // (1440×900 medido) en vez del mapa: sombras corridas. Con el tamaño
        // del contenedor queda clavado.
        getSize: () => {
          const t = m.getSize();
          return { width: t.x, height: t.y };
        },
      });
      sombra.addTo(m);
      sombraRef.current = sombra;
      // A mano para las suites e2e (leer estado, nunca manejarlo) — mismo
      // criterio que window.__mapa3d en la vista 3D.
      (window as unknown as { __sombra2d?: unknown }).__sombra2d = sombra;
      setSombras(true);
    } catch {
      // Si ShadeMap no carga (sin red, key vencida), el mapa sigue intacto.
      sombraRef.current = null;
      setSombras(false);
    } finally {
      setCargandoSombras(false);
    }
  };

  // Mover el sol: la capa viva se actualiza sola al tocar hora o época.
  useEffect(() => {
    sombraRef.current?.setDate(fechaSombras(epoca, hora));
  }, [epoca, hora]);

  const pill =
    "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold shadow-card ring-1 backdrop-blur transition";

  // `data-lenis-prevent`: adentro del mapa manda el mapa, no el scroll suave.
  return (
    <div className="relative">
      <div ref={caja} className="h-[320px] w-full sm:h-[380px]" data-lenis-prevent />
      {/* Los toggles, estilo pastilla de vidrio de la casa. z-[500] queda por
          encima de los panes de Leaflet (los mosaicos van de 200 a 400). */}
      <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={alternar}
          aria-pressed={satelite}
          className={`${pill} bg-white/85 text-graph ring-graph/10 hover:ring-brand/40`}
        >
          {satelite ? "🗺 Mapa" : "🛰 Satélite"}
        </button>
        {SOMBRAS_KEY && (
          <button
            type="button"
            onClick={alternarSombras}
            aria-pressed={sombras}
            className={`${pill} ${sombras ? "bg-brand text-white ring-brand/40" : "bg-white/85 text-graph ring-graph/10 hover:ring-brand/40"}`}
          >
            {cargandoSombras ? "Calculando…" : "🌒 Sombras"}
          </button>
        )}
        {SOMBRAS_KEY && (
          <button
            type="button"
            onClick={() => setVer3D(true)}
            className={`${pill} bg-white/85 text-graph ring-graph/10 hover:ring-brand/40`}
          >
            🏙 Ver en 3D
          </button>
        )}
      </div>

      {/* La ciudad en 3D, pantalla completa (va por portal al body). */}
      {ver3D && (
        <Suspense fallback={null}>
          <Mapa3DSombras lat={lat} lng={lng} titulo={titulo} onCerrar={() => setVer3D(false)} />
        </Suspense>
      )}

      {/* La barrita del sol: aparece solo con las sombras prendidas. Vidrio de
          la casa, una línea: época + hora. Corrida del borde inferior derecho
          para no tapar la atribución. */}
      {sombras && (
        <div
          data-lenis-prevent
          className="absolute bottom-8 left-1/2 z-[500] w-[min(94%,520px)] -translate-x-1/2 rounded-2xl bg-white/80 px-4 py-3 shadow-card ring-1 ring-graph/10 backdrop-blur-xl backdrop-saturate-150"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {EPOCAS_SOMBRA.map((e) => (
                <button
                  key={e.k}
                  type="button"
                  onClick={() => setEpoca(e.k)}
                  aria-pressed={epoca === e.k}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    epoca === e.k ? "bg-brand text-white" : "text-graph-500 hover:text-graph"
                  }`}
                >
                  {e.l}
                </button>
              ))}
            </div>
            <span className="text-sm font-semibold tabular-nums text-graph">{horaLegible(hora)} h</span>
          </div>
          <input
            type="range"
            min={ventana.min}
            max={ventana.max}
            step={15}
            value={ventana.clamp(hora)}
            onChange={(e) => setHora(Number(e.target.value))}
            aria-label="Hora del día para ver las sombras"
            className="mt-2 w-full accent-brand"
          />
          {sinEdificios && (
            <p className="mt-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-medium text-brand-700">
              En esta zona los edificios todavía no están relevados: las sombras muestran solo el terreno.
            </p>
          )}
          <p className="mt-1 text-right text-[10px] text-graph-400">
            Sombras © <a href="https://shademap.app" target="_blank" rel="noopener" className="underline decoration-graph/20 hover:text-graph">ShadeMap</a> · edificios de OpenStreetMap
          </p>
        </div>
      )}
    </div>
  );
}
