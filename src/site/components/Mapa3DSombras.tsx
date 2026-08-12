/**
 * La CIUDAD EN 3D con el sol de verdad — la vista de shademap.app que Mateo
 * mostró en video (11-ago) pidiendo "si se puede acoplar, te hago un monumento".
 * ─────────────────────────────────────────────────────────────────────────────
 * Pantalla completa: edificios extruidos en 3D (los tiles de ShadeMap, cobertura
 * completa de MdP), sombras del simulador corriendo entre los edificios, y la
 * misma barrita de hora + época que la vista 2D. Se gira arrastrando con el
 * botón derecho / dos dedos.
 *
 * ⚠️ PESO: MapLibre GL son ~230 KB gzip. Este componente vive en su PROPIO
 * chunk (lazy desde MapaLeaflet) y se monta recién cuando el visitante toca
 * "Ver en 3D". El que no lo toca no baja nada.
 *
 * ⚠️ El overlay va por PORTAL al <body>: los `reveal` de la ficha usan
 * transforms, y un `position: fixed` adentro de un ancestro transformado queda
 * atrapado en él (fixed deja de ser relativo a la ventana).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// 🔴 El WORKER de MapLibre v6, BUNDLEADO por Vite (`?worker&url`). La saga:
// sin nada, la librería busca `/assets/maplibre-gl-worker.mjs`, el build no lo
// emite y nuestro server SPA contesta index.html con 200 → el worker traga
// HTML y muere SIN RUIDO (el mapa queda "Armando la ciudad…" para siempre).
// Con `?url` a secas tampoco: el archivo se copia VERBATIM y adentro importa
// `./maplibre-gl-shared.mjs`, otro hermano que no existe en /assets. Solo
// `?worker&url` resuelve los imports adentro de un bundle propio del worker.
import urlWorkerMapLibre from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(urlWorkerMapLibre);
import ShadeMap from "mapbox-gl-shadow-simulator";
import { SOMBRAS_KEY } from "../../config/mapa";
import { EPOCAS_SOMBRA, fechaSombras, horaLegible, ventanaSolar, TERRENO_SHADEMAP, type EpocaSombra } from "../lib/sombras";

/** Espera a que el mapa termine de dibujar (los tiles de edificios recién ahí
 *  se pueden consultar). Patrón del ejemplo oficial del plugin. */
const mapaQuieto = (m: maplibregl.Map) =>
  new Promise<void>((res) => {
    if (m.loaded() && m.areTilesLoaded()) res();
    else m.once("idle", () => res());
  });

export default function Mapa3DSombras({ lat, lng, titulo, onCerrar }: { lat: number; lng: number; titulo: string; onCerrar: () => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const sombraRef = useRef<{ setDate: (d: Date) => void; remove: () => void } | null>(null);
  const [listo, setListo] = useState(false);
  // Si el aparato no puede (WebGL viejo) o la red no llega, se DICE — un
  // spinner eterno es la peor respuesta posible. null = todo bien.
  const [fallo, setFallo] = useState<string | null>(null);
  // Zonas sin relevar: OSM no tiene edificios en pueblos chicos (Mar del Sur
  // tiene CERO) y la vista parece rota si no se explica. Se mide y se dice.
  const [sinEdificios, setSinEdificios] = useState(false);
  const [hora, setHora] = useState(15 * 60);
  const [epoca, setEpoca] = useState<EpocaSombra>("hoy");
  // La fecha vigente como ref: la usan los callbacks del mapa (cargar
  // edificios en moveend) sin arrastrar closures viejos.
  const fechaActual = useRef(fechaSombras("hoy", 15 * 60));
  // El slider solo recorre horas CON sol (bug del 11-ago: pasada la puesta,
  // el simulador dibuja una placa rota en vez de noche).
  const ventana = ventanaSolar(epoca, lat, lng);
  useEffect(() => { setHora((h) => ventana.clamp(h)); }, [epoca, ventana.min, ventana.max]);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo || !SOMBRAS_KEY) return;

    // La página de atrás no scrollea mientras la ciudad está abierta.
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Un aparato sin WebGL2 (celulares viejos) no puede crear el mapa: MapLibre
    // tira al construirse. Sin este catch quedaba el spinner PARA SIEMPRE.
    let mapa: maplibregl.Map;
    try {
      mapa = new maplibregl.Map({
        container: nodo,
        // Basemap vectorial de OpenFreeMap: gratis, sin key, sin registro.
        // "positron" = gris claro, el mismo clima visual del video de Mateo.
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [lng, lat],
        zoom: 16.2,
        pitch: 58, // inclinada: se ven los frentes, no los techos
        bearing: -17,
        // 🔴 minZoom 15: más lejos que esto la textura de sombras no cubre el
        // encuadre y SE LE VE EL RECTÁNGULO (bug que encontró Juani alejando el
        // mapa en producción). A 15 todavía se ve el barrio entero.
        minZoom: 15,
        maxZoom: 18.5,
        attributionControl: false,
      });
    } catch {
      setFallo("Este dispositivo no puede mostrar la ciudad en 3D. El mapa y las sombras de la ficha funcionan igual.");
      return () => { document.body.style.overflow = overflowAntes; };
    }

    // Y si la red no llega (o el estilo no carga), a los 45 s se dice en vez
    // de esperar eternamente. En un navegador normal carga en 2-5 s.
    const guardian = setTimeout(() => {
      setFallo((f) => f ?? "La ciudad en 3D no cargó. Revisá la conexión y probá de nuevo.");
    }, 45_000);
    mapa.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    new maplibregl.Marker({ color: "#0C4DA2" }).setLngLat([lng, lat]).addTo(mapa);

    // Los errores del mapa van a la consola (MapLibre no los tira solo) y el
    // mapa queda a mano para las suites e2e (leer estado, nunca manejarlo).
    mapa.on("error", (e) => console.error("[mapa3d]", e.error?.message || e));
    (window as unknown as { __mapa3d?: unknown }).__mapa3d = mapa;

    let sombra: InstanceType<typeof ShadeMap> | null = null;
    // Los edificios VIVOS del encuadre (dataset ShadeMap decodificado): los
    // consumen la capa de extrusión (fuente GeoJSON) y el simulador de
    // sombras — mismos polígonos, mismas alturas, un solo criterio.
    const edificiosVivos: { lista: import("../lib/edificiosMlt").EdificioGeoJSON[] } = { lista: [] };
    mapa.on("load", () => {
      const primeraDeTexto = mapa.getStyle().layers.find((c) => c.type === "symbol")?.id;

      // EDIFICIOS con cobertura TOTAL (pedido Juani 11-ago: "debe verse en
      // TODAS"): el dataset satelital de ShadeMap decodificado de sus tiles
      // .mlt (ver edificiosMlt.ts). Si el archivo datado desaparece o falla,
      // RESPALDO: la capa de OSM del propio estilo (cobertura parcial).
      mapa.addSource("edificios", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapa.addLayer(
        {
          id: "edificios-3d",
          source: "edificios",
          type: "fill-extrusion",
          paint: {
            "fill-extrusion-color": "#cdd1d9",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.94,
          },
        },
        // Debajo de la primera capa de texto: los nombres de calles quedan legibles.
        primeraDeTexto,
      );

      const usarRespaldoOSM = () => {
        if (mapa.getLayer("edificios-3d-osm")) return;
        mapa.addLayer(
          {
            id: "edificios-3d-osm",
            source: "openmaptiles",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#cdd1d9",
              "fill-extrusion-height": ["max", 3, ["coalesce", ["to-number", ["get", "render_height"]], 6]],
              "fill-extrusion-base": ["coalesce", ["to-number", ["get", "render_min_height"]], 0],
              "fill-extrusion-opacity": 0.94,
            },
          },
          primeraDeTexto,
        );
      };

      const cargarEdificios = async () => {
        const b = mapa.getBounds();
        const { edificiosEnBbox } = await import("../lib/edificiosMlt");
        const feats = await edificiosEnBbox(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
        if (feats.length > 0) {
          edificiosVivos.lista = feats;
          (mapa.getSource("edificios") as maplibregl.GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: feats } as GeoJSON.FeatureCollection);
          setSinEdificios(false);
          // Nueva geometría en escena → las sombras se recalculan (misma fecha).
          sombraRef.current?.setDate(fechaActual.current);
        } else {
          usarRespaldoOSM();
          // Con el respaldo OSM el aviso se decide mirando lo dibujado.
          mapa.once("idle", () => {
            try { setSinEdificios(mapa.queryRenderedFeatures({ layers: ["edificios-3d-osm"] }).length < 15); } catch { /* sin aviso */ }
          });
        }
        return feats;
      };
      void cargarEdificios();
      mapa.on("moveend", () => void cargarEdificios()); // barato: cache por tile

      sombra = new ShadeMap({
        apiKey: SOMBRAS_KEY,
        date: fechaSombras("hoy", 15 * 60),
        color: "#0b1a33",
        opacity: 0.62,
        terrainSource: TERRENO_SHADEMAP,
        getFeatures: async () => {
          await mapaQuieto(mapa);
          if (edificiosVivos.lista.length > 0) {
            // De abajo hacia arriba: si no, la base de una torre puede pisar
            // la punta de otra al rasterizar (nota del ejemplo oficial).
            return [...edificiosVivos.lista].sort((a, b) => a.properties.height - b.properties.height);
          }
          // Respaldo OSM (el dataset completo no está disponible).
          const deOSM = mapa.querySourceFeatures("openmaptiles", { sourceLayer: "building" });
          for (const f of deOSM) f.properties.height = Number(f.properties.render_height) || 6;
          deOSM.sort((a, b) => a.properties.height - b.properties.height);
          return deOSM;
        },
      }).addTo(mapa);
      sombraRef.current = sombra;
      clearTimeout(guardian); // llegó: el guardián de los 45 s ya no hace falta
      setListo(true);
    });

    return () => {
      clearTimeout(guardian);
      document.body.style.overflow = overflowAntes;
      sombra?.remove();
      sombraRef.current = null;
      mapa.remove();
    };
  }, [lat, lng]);

  // El sol se mueve en vivo al tocar la hora o la época.
  useEffect(() => {
    fechaActual.current = fechaSombras(epoca, hora);
    sombraRef.current?.setDate(fechaActual.current);
  }, [epoca, hora]);

  // Cerrar con Escape, como la galería.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  if (!SOMBRAS_KEY) return null;

  return createPortal(
    // ⚠️ z-[1200]: los panes de Leaflet del mapa de atrás van de 200 a 700 y
    // compiten a nivel RAÍZ (ningún ancestro suyo crea stacking context) — con
    // menos que esto, el mapa de la página perfora el overlay (pasó: z-100).
    <div className="fixed inset-0 z-[1200] bg-graph" data-lenis-prevent role="dialog" aria-label={`${titulo} — ciudad en 3D con sombras del sol`}>
      {/* 🔴 El div del mapa NO lleva `absolute inset-0`: la hoja de MapLibre le
          pone `position: relative` a `.maplibregl-map` (pisa la clase) y el
          inset deja de estirar → contenedor de ALTO CERO y un mapa que jamás
          termina de cargar (pasó: canvas 1440×0). Envuelto + h-full es inmune. */}
      <div className="absolute inset-0">
        <div ref={caja} className="h-full w-full" />
      </div>

      {/* Mientras la ciudad se arma — y si no puede, se DICE (nada de spinner eterno) */}
      {!listo && (
        <div className="absolute inset-0 grid place-items-center bg-paper-100">
          {fallo ? (
            <div className="max-w-sm px-8 text-center">
              <p className="font-display text-xl font-semibold text-graph">No pudimos armar el 3D</p>
              <p className="mt-2 text-sm text-graph-500">{fallo}</p>
              <button
                type="button"
                onClick={onCerrar}
                className="mt-6 inline-flex h-10 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Volver a la ficha
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <p className="mt-4 text-sm font-medium text-graph-500">Armando la ciudad en 3D…</p>
            </div>
          )}
        </div>
      )}

      {/* Cerrar */}
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar la vista 3D"
        className="absolute right-4 top-4 z-10 inline-flex h-10 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-semibold text-graph shadow-card ring-1 ring-graph/10 backdrop-blur transition hover:ring-brand/40"
      >
        ✕ Cerrar
      </button>

      {/* Cómo girar (se muestra siempre: es lo primero que se pregunta cualquiera) */}
      <p className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-graph/70 px-3.5 py-1.5 text-[11px] font-medium text-white backdrop-blur sm:text-xs">
        Girá la ciudad arrastrando con dos dedos o con el botón derecho
      </p>

      {/* Zona sin edificios relevados: se dice, no se deja pensar que está roto. */}
      {listo && sinEdificios && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 w-[min(92%,440px)] -translate-x-1/2 rounded-2xl bg-white/85 px-4 py-3 text-center shadow-card ring-1 ring-graph/10 backdrop-blur-xl">
          <p className="text-sm font-semibold text-graph">En esta zona los edificios todavía no están relevados</p>
          <p className="mt-1 text-xs text-graph-500">Las sombras muestran el terreno. En el centro de Mar del Plata la ciudad se ve completa en 3D.</p>
        </div>
      )}

      {/* La misma barrita del sol que la vista 2D */}
      <div className="absolute bottom-6 left-1/2 z-10 w-[min(94%,560px)] -translate-x-1/2 rounded-2xl bg-white/85 px-4 py-3 shadow-card ring-1 ring-graph/10 backdrop-blur-xl backdrop-saturate-150">
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
        <p className="mt-1 text-right text-[10px] text-graph-400">
          Sombras y edificios © <a href="https://shademap.app" target="_blank" rel="noopener" className="underline decoration-graph/20 hover:text-graph">ShadeMap</a>
        </p>
      </div>
    </div>,
    document.body,
  );
}
