/**
 * UBICACIÓN Y ORIENTACIÓN — el mapa del formulario de carga.
 * ─────────────────────────────────────────────────────────────────────────────
 * El pedido de Mateo, textual (audio 7-ago): "que me muestre el mapita y yo
 * pueda —si detecta la ubicación automática la pongo automática, y si no la
 * detecta o pone cualquier cosa— seleccionar con el cosito rojo dónde quiero
 * que se muestre".
 *
 * CÓMO FUNCIONA:
 * · Al salir del campo Dirección (y SOLO si todavía no hay coordenadas) se busca
 *   sola. La búsqueda va al servidor (/api/geocodificar): registro oficial de
 *   calles del Estado (georef) + OpenStreetMap de segunda opinión.
 * · georef da la CUADRA, no la puerta (interpola sobre el segmento). Por eso la
 *   corrección manual no es el plan B: es el evento principal. Mateo arrastra el
 *   pin (escritorio) o mueve el mapa bajo un pin fijo (celular) y listo.
 * · Si el pin se puso a mano, NINGUNA búsqueda automática lo vuelve a pisar.
 *   Solo el botón "Volver a buscar automática", que es explícito.
 *
 * LA BRÚJULA (el agregado que desbloquea "Orientación y sol" en la web):
 * con el mapa a la vista, marcar hacia dónde da el frente es UN clic — se ve la
 * calle en el mapa, se toca el pétalo que apunta a la calle. Cargarlo con un
 * desplegable a ciegas es como el CMO advirtió: la gente confunde NE con N, y
 * una orientación mal cargada hace que la web afirme un dato falso con total
 * seguridad. La brújula además devuelve al toque lo que significa: "Frente al
 * NE → sol de mañana y mediodía".
 *
 * ⚠️ El CSS de Leaflet se importa ACÁ ADENTRO: este componente ya carga dentro
 * del chunk del panel (PanelApp), que el visitante público no baja nunca.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, Search, Undo2, X, Compass } from "lucide-react";
import { MAPA, CENTRO_MDP } from "@/config/mapa";
import { supabase } from "@/lib/supabase";
import type { Orientacion } from "@/data/propiedadTypes";

/* ── Tipos que comparte con el formulario ───────────────────────────────────── */

export interface Ubicado {
  lat: number;
  lng: number;
  origen: "auto" | "manual";
  fuente?: string;
}

interface Encontrada {
  lat: number;
  lng: number;
  etiqueta: string;
  fuente: "georef" | "nominatim";
}

/* ── El pin, según quién lo puso ────────────────────────────────────────────── */

// Azul de marca = lo encontró la búsqueda. Terracota = lo puso Mateo a mano.
// Dos colores a propósito: se tiene que ver de un vistazo si la ubicación es
// "lo que dijo el mapa" o "lo que dijo la persona que conoce la propiedad".
const pin = (color: string) =>
  L.divIcon({
    className: "",
    html:
      '<svg width="34" height="46" viewBox="0 0 34 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      `<path d="M17 1C8.7 1 2 7.7 2 16c0 10.5 12.4 25.6 14.1 27.7a1.2 1.2 0 0 0 1.8 0C19.6 41.6 32 26.5 32 16 32 7.7 25.3 1 17 1z" fill="${color}" stroke="#fff" stroke-width="2.5"/>` +
      '<circle cx="17" cy="16" r="5.2" fill="#fff"/></svg>',
    iconSize: [34, 46],
    iconAnchor: [17, 45],
  });
const PIN_AUTO = "#0C4DA2";
const PIN_MANUAL = "#C2410C";

/* ── La brújula ─────────────────────────────────────────────────────────────── */

const PUNTOS: { o: Orientacion; angulo: number }[] = [
  { o: "N", angulo: 0 }, { o: "NE", angulo: 45 }, { o: "E", angulo: 90 },
  { o: "SE", angulo: 135 }, { o: "S", angulo: 180 }, { o: "SO", angulo: 225 },
  { o: "O", angulo: 270 }, { o: "NO", angulo: 315 },
];

/** Qué significa cada orientación acá, en el hemisferio sur. Es el feedback
 *  inmediato que evita cargar cualquier cosa: si Mateo toca "S" y lee "sin sol
 *  directo" para una casa que él sabe soleada, se da cuenta al instante de que
 *  marcó el pétalo equivocado. */
const LEYENDA: Record<Orientacion, string> = {
  N: "sol prácticamente todo el día",
  NE: "sol de mañana y mediodía",
  E: "sol de mañana",
  SE: "sol temprano, más en verano",
  S: "luz pareja, sin sol directo",
  SO: "sol de tarde, más en verano",
  O: "sol de tarde",
  NO: "sol de mediodía y tarde",
};

function Brujula({ valor, onElegir }: { valor?: Orientacion | ""; onElegir: (o: Orientacion) => void }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[132px] w-[132px] shrink-0">
        {/* El aro */}
        <div className="absolute inset-[14px] rounded-full border border-graph/15 bg-white/70" />
        {PUNTOS.map(({ o, angulo }) => {
          const rad = ((angulo - 90) * Math.PI) / 180;
          const x = 66 + Math.cos(rad) * 52;
          const y = 66 + Math.sin(rad) * 52;
          const activo = valor === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onElegir(o)}
              aria-label={`Frente al ${o}`}
              aria-pressed={activo}
              className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] font-bold transition ${
                activo
                  ? "bg-brand text-white shadow-[0_4px_10px_-3px_rgba(12,77,162,0.6)]"
                  : "bg-white text-graph-500 ring-1 ring-graph/15 hover:text-brand hover:ring-brand/40"
              }`}
              style={{ left: x, top: y }}
            >
              {o}
            </button>
          );
        })}
        <Compass size={18} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-graph-300" aria-hidden />
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-graph">¿Hacia dónde da el frente?</p>
        {valor ? (
          <p className="mt-1 text-graph-500">
            Frente al <span className="font-semibold text-brand-700">{valor}</span> — {LEYENDA[valor as Orientacion]}.
          </p>
        ) : (
          <p className="mt-1 text-graph-400">
            Mirá la calle en el mapa y tocá el punto que apunta hacia ella. Con esto
            la web le muestra al comprador cuándo recibe sol la propiedad.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── El componente ──────────────────────────────────────────────────────────── */

export default function MapaUbicacion({
  lat,
  lng,
  origen,
  orientacion,
  direccion,
  zona,
  onUbicar,
  onQuitar,
  onOrientacion,
}: {
  lat: string;
  lng: string;
  origen?: "auto" | "manual";
  orientacion?: Orientacion | "";
  direccion: string;
  zona: string;
  onUbicar: (u: Ubicado) => void;
  onQuitar: () => void;
  onOrientacion: (o: Orientacion) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [encontrada, setEncontrada] = useState<string | null>(null);
  // La hoja a pantalla completa del celular (ahí el mapa inline no se arrastra).
  const [hoja, setHoja] = useState(false);
  const esCelular = typeof window !== "undefined" && window.innerWidth < 768;

  const nLat = Number(lat);
  const nLng = Number(lng);
  const hayPin = Boolean(lat && lng && Number.isFinite(nLat) && Number.isFinite(nLng));

  /* El mapa inline. En el celular va SIN gestos: un mapa arrastrable del ancho de
     la pantalla deja al pulgar atrapado — no se puede seguir bajando el
     formulario. Para corregir ahí está la hoja a pantalla completa. */
  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const m = L.map(nodo, {
      center: hayPin ? [nLat, nLng] : [CENTRO_MDP.lat, CENTRO_MDP.lng],
      zoom: hayPin ? MAPA.zoomPropiedad : 12,
      // La rueda hace zoom en escritorio, igual que la web pública: apoyar el
      // mouse en un mapa y rodar tiene que acercar, como en Google Maps.
      scrollWheelZoom: !esCelular,
      dragging: !esCelular,
      touchZoom: !esCelular,
      attributionControl: false,
      keyboard: false,
    });
    L.tileLayer(MAPA.mosaicos, { maxZoom: MAPA.zoomMax, attribution: MAPA.atribucion }).addTo(m);
    L.control.attribution({ prefix: false, position: "bottomright" }).addTo(m);

    // Tocar el mapa pone el pin ahí. Es el "cosito rojo" del pedido, literal.
    if (!esCelular) {
      m.on("click", (e: L.LeafletMouseEvent) => {
        onUbicar({ lat: e.latlng.lat, lng: e.latlng.lng, origen: "manual" });
      });
    }

    const t = setTimeout(() => m.invalidateSize(), 80);
    mapa.current = m;
    return () => {
      clearTimeout(t);
      m.remove();
      mapa.current = null;
      marcador.current = null;
    };
    // Se crea una sola vez: el pin y el centro se actualizan en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* El pin sigue al formulario (y no al revés): una sola fuente de verdad. */
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!hayPin) {
      marcador.current?.remove();
      marcador.current = null;
      return;
    }
    const color = origen === "manual" ? PIN_MANUAL : PIN_AUTO;
    if (!marcador.current) {
      const mk = L.marker([nLat, nLng], { icon: pin(color), draggable: !esCelular, keyboard: false }).addTo(m);
      mk.on("dragend", () => {
        const p = mk.getLatLng();
        onUbicar({ lat: p.lat, lng: p.lng, origen: "manual" });
      });
      marcador.current = mk;
    } else {
      marcador.current.setLatLng([nLat, nLng]);
      marcador.current.setIcon(pin(color));
    }
    m.setView([nLat, nLng], Math.max(m.getZoom(), MAPA.zoomPropiedad));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nLat, nLng, hayPin, origen]);

  /* La búsqueda. SIN autocompletado a propósito (la política de Nominatim lo
     prohíbe del lado del cliente, y un geocoder que interpola por cuadra no
     tiene nada útil para decir mientras tipeás "Córd…"). Botón explícito. */
  const buscar = async () => {
    if (buscando) return;
    setBuscando(true);
    setMensaje(null);
    try {
      const { data: s } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = s?.session?.access_token;
      const r = await fetch("/api/geocodificar", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ direccion, zona }),
      });
      const j = await r.json().catch(() => ({}));
      const primera: Encontrada | undefined = j?.resultados?.[0];
      if (primera) {
        onUbicar({ lat: primera.lat, lng: primera.lng, origen: "auto", fuente: primera.fuente });
        // La confirmación en su idioma: es el momento en que Mateo detecta el
        // error de calle, que es TODO el motivo de este módulo.
        setEncontrada(primera.etiqueta);
      } else {
        setEncontrada(null);
        setMensaje(j?.aviso ?? j?.error ?? "No la encontré. Tocá en el mapa dónde está.");
        // Un "no encontrado" igual deja un mapa usable, centrado en la ciudad.
        mapa.current?.setView([CENTRO_MDP.lat, CENTRO_MDP.lng], 12);
      }
    } catch {
      setMensaje("No se pudo buscar (¿sin conexión?). Podés poner el pin a mano igual.");
    } finally {
      setBuscando(false);
    }
  };

  /* Un solo disparo automático: cuando la dirección quedó escrita y todavía no
     hay coordenadas. La re-edición de una propiedad ya ubicada NUNCA busca sola
     — esa es la regla de "no pisar lo manual" hecha comportamiento. */
  const buscoSolo = useRef(false);
  useEffect(() => {
    if (buscoSolo.current || hayPin || direccion.trim().length < 6) return;
    const t = setTimeout(() => {
      buscoSolo.current = true;
      void buscar();
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direccion, hayPin]);

  /* Pegar coordenadas: "-38.0155, -57.5599". Diez líneas que valen mucho: Mateo
     abre Google Maps, copia, pega → la precisión de Google sin la cuenta de
     Google. */
  const pegarCoordenadas = (texto: string) => {
    const m = texto.match(/(-?\d{1,2}[.,]\d+)[\s,;]+(-?\d{1,3}[.,]\d+)/);
    if (!m) return false;
    const la = Number(m[1].replace(",", "."));
    const lo = Number(m[2].replace(",", "."));
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return false;
    onUbicar({ lat: la, lng: lo, origen: "manual" });
    return true;
  };

  return (
    <div className="space-y-3">
      {/* La botonera */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={buscar}
          disabled={buscando || direccion.trim().length < 4}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          <Search size={13} />
          {buscando ? "Buscando…" : "Buscar en el mapa"}
        </button>
        {hayPin && origen === "manual" && (
          <button
            type="button"
            onClick={buscar}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-graph-500 ring-1 ring-graph/15 transition hover:text-brand hover:ring-brand/40"
          >
            <Undo2 size={13} /> Volver a buscar automática
          </button>
        )}
        {hayPin && (
          <button
            type="button"
            onClick={() => { setEncontrada(null); setMensaje(null); onQuitar(); }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-graph-500 ring-1 ring-graph/15 transition hover:text-red-600 hover:ring-red-300"
          >
            <X size={13} /> Quitar ubicación
          </button>
        )}
        {esCelular && (
          <button
            type="button"
            onClick={() => setHoja(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-brand ring-1 ring-brand/30"
          >
            <LocateFixed size={13} /> Corregir ubicación
          </button>
        )}
      </div>

      {/* El estado, dicho con palabras (y con el color del pin) */}
      {encontrada && origen !== "manual" && (
        <p className="text-xs text-graph-500">
          Encontré: <span className="font-medium text-graph">{encontrada}</span>. La
          búsqueda ubica la cuadra — si el pin no cayó justo, {esCelular ? "tocá «Corregir ubicación»" : "arrastralo o tocá el mapa"}.
        </p>
      )}
      {hayPin && origen === "manual" && (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-700">
          <MapPin size={13} /> Ubicación puesta por vos ✓ — ninguna búsqueda la va a pisar.
        </p>
      )}
      {mensaje && <p className="text-xs font-medium text-amber-700">{mensaje}</p>}

      {/* El mapa */}
      <div className="overflow-hidden rounded-xl ring-1 ring-graph/10">
        <div ref={caja} className="h-[300px] w-full" data-mapa-panel />
      </div>

      {/* …o pegá las coordenadas */}
      <input
        type="text"
        placeholder="…o pegá las coordenadas de Google Maps: -38.0155, -57.5599"
        className="h-9 w-full rounded-lg border border-graph/15 bg-white px-3 text-xs text-graph placeholder:text-graph-300 focus:border-brand focus:outline-none"
        onPaste={(e) => {
          if (pegarCoordenadas(e.clipboardData.getData("text"))) {
            e.preventDefault();
            (e.target as HTMLInputElement).value = "";
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const el = e.target as HTMLInputElement;
            if (pegarCoordenadas(el.value)) el.value = "";
          }
        }}
      />

      {/* La brújula — recién cuando hay pin: la orientación se marca MIRANDO la
          calle en el mapa, no de memoria. */}
      {hayPin && (
        <div className="rounded-xl border border-graph/10 bg-graph/[0.02] p-3">
          <Brujula valor={orientacion} onElegir={onOrientacion} />
        </div>
      )}

      {/* La hoja a pantalla completa del celular: el mapa es dueño de TODOS los
          gestos (no hay nada detrás) y el pin va FIJO AL CENTRO — se mueve el
          mapa bajo el pin, patrón Uber/Airbnb. Arrastrar un marcador de 30 px
          con el dedo lo tapa justo cuando necesitás ver dónde lo apoyás. */}
      {hoja && (
        <HojaCelular
          lat={hayPin ? nLat : CENTRO_MDP.lat}
          lng={hayPin ? nLng : CENTRO_MDP.lng}
          zoom={hayPin ? MAPA.zoomPropiedad : 12}
          onListo={(la, lo) => {
            onUbicar({ lat: la, lng: lo, origen: "manual" });
            setHoja(false);
          }}
          onCerrar={() => setHoja(false)}
        />
      )}
    </div>
  );
}

/* ── La hoja del celular ────────────────────────────────────────────────────── */

function HojaCelular({
  lat, lng, zoom, onListo, onCerrar,
}: { lat: number; lng: number; zoom: number; onListo: (lat: number, lng: number) => void; onCerrar: () => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const m = L.map(nodo, {
      center: [lat, lng],
      zoom,
      attributionControl: false,
      keyboard: false,
    });
    L.tileLayer(MAPA.mosaicos, { maxZoom: MAPA.zoomMax, attribution: MAPA.atribucion }).addTo(m);
    L.control.attribution({ prefix: false, position: "bottomright" }).addTo(m);
    // ⚠️ Montado en un contenedor recién aparecido: sin re-medir dibuja gris.
    const t = setTimeout(() => m.invalidateSize(), 120);
    mapa.current = m;
    return () => {
      clearTimeout(t);
      m.remove();
      document.body.style.overflow = antes;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-paper" role="dialog" aria-modal="true" aria-label="Corregir ubicación">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold text-graph">Mové el mapa hasta que el pin quede sobre la propiedad</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-graph-400">
          <X size={19} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={caja} className="h-full w-full" data-mapa-hoja />
        {/* El pin fijo al centro. `pointer-events-none` para que el dedo hable
            siempre con el mapa. El -100% de Y apoya la PUNTA en el centro. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
          <svg width="38" height="52" viewBox="0 0 34 46" aria-hidden="true">
            <path d="M17 1C8.7 1 2 7.7 2 16c0 10.5 12.4 25.6 14.1 27.7a1.2 1.2 0 0 0 1.8 0C19.6 41.6 32 26.5 32 16 32 7.7 25.3 1 17 1z" fill="#C2410C" stroke="#fff" strokeWidth="2.5" />
            <circle cx="17" cy="16" r="5.2" fill="#fff" />
          </svg>
        </div>
      </div>
      <div className="p-4">
        <button
          type="button"
          onClick={() => {
            const c = mapa.current?.getCenter();
            if (c) onListo(c.lat, c.lng);
          }}
          className="h-12 w-full rounded-xl bg-brand text-sm font-semibold text-white active:bg-brand-600"
        >
          Usar esta ubicación
        </button>
      </div>
    </div>
  );
}
