import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Heart, X, Expand } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   GALERÍA DE PROPIEDAD — deslizar como en el iPhone
   ───────────────────────────────────────────────────────────────────────────
   Qué la hace sentir bien (y no un carrusel más):

   · La foto SIGUE AL DEDO. No espera a que sueltes para decidir: se mueve
     contigo, uno a uno. Eso es el 80% de la sensación.
   · Al soltar decide por VELOCIDAD, no solo por distancia: un envión corto y
     rápido pasa de foto, igual que en el teléfono.
   · En la primera y la última hay RESISTENCIA (goma): se puede tirar, pero
     cuesta y vuelve. Comunica "no hay más" sin un frenazo seco.
   · La animación usa una curva expo — arranca rápido y frena suave. Es la
     diferencia entre "programado" y "natural".
   · Tocar la foto la abre a pantalla completa, con el mismo gesto adentro.

   Accesibilidad: flechas del teclado, Escape para cerrar, foco visible, y si
   el sistema pide menos movimiento, las transiciones se acortan.
   ═══════════════════════════════════════════════════════════════════════════ */

const NO_IMG =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='300'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23e7e8e3'/%3E%3C/svg%3E";

/** Curva de Apple: sale rápido y se posa. La misma de los botones del sitio. */
const CURVA = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Cuánto cede el borde cuando ya no hay más fotos (goma). */
const resistencia = (exceso: number) => Math.sign(exceso) * Math.pow(Math.abs(exceso), 0.72) * 0.5;

type Props = {
  fotos: string[];
  titulo: string;
  favorito?: boolean;
  onToggleFavorito?: () => void;
};

export default function GaleriaPropiedad({ fotos, titulo, favorito, onToggleFavorito }: Props) {
  const imagenes = fotos.length ? fotos : [NO_IMG];
  const [i, setI] = useState(0);
  const [ampliada, setAmpliada] = useState(false);

  useEffect(() => { setI(0); }, [fotos]);

  return (
    <>
      <Riel
        imagenes={imagenes}
        titulo={titulo}
        i={i}
        setI={setI}
        onAmpliar={() => setAmpliada(true)}
        favorito={favorito}
        onToggleFavorito={onToggleFavorito}
      />

      {/* Tira de miniaturas: la activa se agranda apenas y se centra sola. */}
      {imagenes.length > 1 && <Tira imagenes={imagenes} i={i} setI={setI} />}

      {ampliada && (
        <Visor imagenes={imagenes} titulo={titulo} i={i} setI={setI} onCerrar={() => setAmpliada(false)} />
      )}
    </>
  );
}

/* ── El riel deslizable ───────────────────────────────────────────────────── */

function Riel({
  imagenes, titulo, i, setI, onAmpliar, favorito, onToggleFavorito, altura = "aspect-[4/3]",
}: {
  imagenes: string[];
  titulo: string;
  i: number;
  setI: (n: number) => void;
  onAmpliar?: () => void;
  favorito?: boolean;
  onToggleFavorito?: () => void;
  altura?: string;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const [arrastre, setArrastre] = useState(0);
  const gesto = useRef<{ x0: number; t0: number; ultimaX: number; ultimoT: number; activo: boolean; movio: boolean } | null>(null);

  const ancho = () => marco.current?.clientWidth || 1;
  const ir = useCallback((n: number) => setI(Math.max(0, Math.min(imagenes.length - 1, n))), [imagenes.length, setI]);

  // Mientras el dedo está apoyado no hay transición: la foto va pegada al gesto.
  const arrastrando = Boolean(gesto.current?.activo);
  const estilo = {
    transform: `translate3d(${-i * 100}%, 0, 0) translate3d(${arrastre}px, 0, 0)`,
    transition: arrastrando ? "none" : `transform 620ms ${CURVA}`,
  } as const;

  // ── El detalle que lo hace sentir iPhone ──────────────────────────────────
  // La foto que sale se ACHICA y la que entra CRECE, en tiempo real mientras
  // arrastrás. Para eso hace falta la posición fraccionaria: no "estoy en la 2"
  // sino "estoy en la 2,37". De ahí sale cuánto escalar cada una.
  const posicion = i - arrastre / ancho();
  const profundidad = (n: number) => {
    const d = Math.min(Math.abs(n - posicion), 1); // 0 = centrada · 1 = ya afuera
    return {
      transform: `scale(${1 - d * 0.12})`,
      opacity: 1 - d * 0.4,
      transition: arrastrando ? "none" : `transform 620ms ${CURVA}, opacity 620ms ${CURVA}`,
    };
  };

  const alApoyar = (e: React.PointerEvent) => {
    if (imagenes.length < 2) return;

    // 🔴 Si el toque NACE en un control, no se arranca el gesto.
    //
    // Las flechas, el corazón y el botón de pantalla completa viven adentro de
    // este marco. Al hacer `setPointerCapture` en el marco, el navegador
    // re-dirige al marco todos los eventos de puntero siguientes Y el `click`
    // que viene después — así que el botón NUNCA recibía su click y las flechas
    // quedaban muertas con un mouse de verdad.
    //
    // Lo raro del bug: con `.click()` por código funcionaba igual (un click
    // sintético no pasa por el mismo camino), así que solo se veía usándolo. Lo
    // encontró Juani. La prueba nueva usa Input.dispatchMouseEvent para que no
    // vuelva a pasar desapercibido.
    if ((e.target as HTMLElement | null)?.closest("button")) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesto.current = { x0: e.clientX, t0: performance.now(), ultimaX: e.clientX, ultimoT: performance.now(), activo: true, movio: false };
  };

  const alMover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g?.activo) return;
    const dx = e.clientX - g.x0;
    if (Math.abs(dx) > 6) g.movio = true;
    g.ultimaX = e.clientX;
    g.ultimoT = performance.now();

    // En los extremos, el riel cede pero se resiste: no se despega del borde.
    const enElBorde = (i === 0 && dx > 0) || (i === imagenes.length - 1 && dx < 0);
    setArrastre(enElBorde ? resistencia(dx) * 3 : dx);
  };

  const alSoltar = (cancelado = false) => {
    const g = gesto.current;
    if (!g?.activo) return;
    const dx = g.ultimaX - g.x0;
    const ms = Math.max(1, g.ultimoT - g.t0);
    const velocidad = dx / ms; // px por milisegundo

    // Pasa de foto si recorriste un cuarto del ancho O si fue un envión rápido.
    const suficiente = Math.abs(dx) > ancho() * 0.25 || Math.abs(velocidad) > 0.45;
    if (suficiente && Math.abs(dx) > 10) ir(i + (dx < 0 ? 1 : -1));

    gesto.current = { ...g, activo: false };
    setArrastre(0);

    // 🔴 EL TOQUE QUE AMPLÍA SE DETECTA ACÁ, no con onClick en la imagen.
    //
    // Mismo mecanismo del bug de las flechas: al capturar el puntero en el
    // marco, el navegador le entrega también el `click` posterior AL MARCO — el
    // onClick de la <img> no se dispara nunca cuando hay 2+ fotos. "Tocá la
    // foto para ampliarla" estuvo muerto en producción hasta el 10-ago y ningún
    // test lo vio porque todos usaban `.click()` sintético.
    //
    // Un toque = soltó sin haber arrastrado. `cancelado` distingue el
    // pointercancel (el navegador cortó el gesto: scroll táctil, etc.) — eso NO
    // es un toque y no puede abrir el visor.
    if (!cancelado && !g.movio) onAmpliar?.();

    // El navegador dispara "click" justo después de soltar. Mientras la marca de
    // "hubo deslizamiento" siga puesta, ese click se ignora (si no, terminar un
    // arrastre abriría la pantalla completa sin querer). Se limpia en el tick
    // siguiente, cuando ese click ya pasó, para que el próximo toque sí abra.
    setTimeout(() => { if (gesto.current) gesto.current.movio = false; }, 0);
  };

  // Precargar la siguiente y la anterior: al deslizar ya están listas.
  useEffect(() => {
    [i + 1, i - 1].forEach((n) => {
      if (n >= 0 && n < imagenes.length) { const img = new Image(); img.src = imagenes[n]; }
    });
  }, [i, imagenes]);

  return (
    <div
      ref={marco}
      // El marco no dibuja nada: cada foto trae su propia placa de vidrio.
      className={`group relative select-none overflow-hidden ${altura}`}
      onPointerDown={alApoyar}
      onPointerMove={alMover}
      onPointerUp={() => alSoltar(false)}
      onPointerCancel={() => alSoltar(true)}
      style={{ touchAction: "pan-y" }}
    >
      <div ref={pista} className="flex h-full w-full" style={estilo}>
        {imagenes.map((src, n) => (
          // El hueco entre placas se ve al deslizar, como en Fotos del iPhone.
          <div key={`${src}-${n}`} className="h-full w-full shrink-0 grow-0 basis-full px-1">
            {/* La placa: vidrio con puntas bien redondeadas. El borde clarito y
                el reflejo de arriba son lo que le da el aire de cristal. */}
            <div
              style={profundidad(n)}
              className="relative h-full w-full overflow-hidden rounded-[1.75rem] shadow-[0_20px_60px_-24px_rgba(13,21,33,0.55)] ring-1 ring-white/25"
            >
              <img
                src={src}
                onError={(e) => { e.currentTarget.src = NO_IMG; }}
                alt={n === 0 ? titulo : ""}
                draggable={false}
                loading={n === 0 ? "eager" : "lazy"}
                decoding="async"
                // Con 2+ fotos este onClick NO llega a dispararse: la captura de
                // puntero le entrega el click al marco, y el toque lo detecta
                // `alSoltar`. Queda como respaldo para el caso de UNA sola foto
                // (ahí no se arranca gesto ni hay captura). Si un navegador no
                // re-dirigiera el click, lo peor es abrir el visor dos veces,
                // que es idempotente.
                onClick={() => { if (!gesto.current?.movio) onAmpliar?.(); }}
                className="h-full w-full cursor-zoom-in object-cover"
              />
              {/* Reflejo de vidrio: una luz muy tenue en el borde superior. */}
              <div
                className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-gradient-to-b from-white/15 via-transparent to-transparent"
                aria-hidden
              />
            </div>
          </div>
        ))}
      </div>

      {/* Sombra suave abajo: los controles se leen sobre cualquier foto. */}
      {/* Sombra suave abajo, redondeada como la placa: los controles se leen
          sobre cualquier foto sin taparle las puntas. */}
      <div className="pointer-events-none absolute inset-x-1 bottom-0 h-24 rounded-b-[1.75rem] bg-gradient-to-t from-graph/50 to-transparent" aria-hidden />

      {onToggleFavorito && (
        <button
          onClick={onToggleFavorito}
          aria-label={favorito ? "Quitar de favoritos" : "Guardar en favoritos"}
          className={`absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full backdrop-blur transition duration-300 hover:scale-105 ${
            favorito ? "bg-brand text-white" : "bg-graph/50 text-white hover:bg-graph/70"
          }`}
        >
          <Heart size={20} fill={favorito ? "currentColor" : "none"} />
        </button>
      )}

      {onAmpliar && (
        <button
          onClick={onAmpliar}
          aria-label="Ver en pantalla completa"
          // `max-md:opacity-100`: en el celular NO hay hover, así que un botón
          // que solo aparece al pasar el mouse ahí es un botón que no existe.
          className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-graph/50 text-white opacity-0 backdrop-blur transition duration-300 hover:scale-105 hover:bg-graph/70 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
        >
          <Expand size={18} />
        </button>
      )}

      {imagenes.length > 1 && (
        <>
          <Flecha lado="izq" oculta={i === 0} onClick={() => ir(i - 1)} />
          <Flecha lado="der" oculta={i === imagenes.length - 1} onClick={() => ir(i + 1)} />

          {/* Puntitos: hasta 8, si hay más se muestra el contador. */}
          {imagenes.length <= 8 ? (
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
              {imagenes.map((_, n) => (
                <button
                  key={n}
                  onClick={() => ir(n)}
                  aria-label={`Foto ${n + 1}`}
                  className={`h-1.5 rounded-full bg-white transition-all duration-500 ${
                    n === i ? "w-6 opacity-100" : "w-1.5 opacity-50 hover:opacity-80"
                  }`}
                />
              ))}
            </div>
          ) : (
            <span className="absolute bottom-4 right-4 rounded-full bg-graph/60 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur">
              {i + 1} / {imagenes.length}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function Flecha({ lado, oculta, onClick }: { lado: "izq" | "der"; oculta: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={oculta}
      aria-label={lado === "izq" ? "Foto anterior" : "Foto siguiente"}
      className={`absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-graph shadow-card backdrop-blur transition duration-300 hover:scale-105 hover:bg-white
        ${lado === "izq" ? "left-3" : "right-3"}
        ${oculta ? "pointer-events-none opacity-0" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}
        max-md:opacity-100`}
    >
      {lado === "izq" ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
    </button>
  );
}

/* ── Miniaturas ───────────────────────────────────────────────────────────── */

function Tira({ imagenes, i, setI }: { imagenes: string[]; i: number; setI: (n: number) => void }) {
  const cinta = useRef<HTMLDivElement>(null);

  // La miniatura activa siempre a la vista, sin que el usuario tenga que buscarla.
  useLayoutEffect(() => {
    const activa = cinta.current?.children[i] as HTMLElement | undefined;
    activa?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [i]);

  // La rueda del mouse sobre la tira la desplaza HORIZONTALMENTE (es una fila:
  // no hay otro scroll con sentido acá), en vez de dejar que el scroll suave se
  // lleve la página. Nativo y no-pasivo a propósito: el onWheel de React es
  // pasivo y su preventDefault no funciona — sin él, riel y página scrollean a
  // la vez.
  useEffect(() => {
    const el = cinta.current;
    if (!el) return;
    const alRodar = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 2) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!delta) return;
      e.preventDefault();
      el.scrollLeft += delta;
    };
    el.addEventListener("wheel", alRodar, { passive: false });
    return () => el.removeEventListener("wheel", alRodar);
  }, []);

  return (
    <div
      ref={cinta}
      data-lenis-prevent
      className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {imagenes.map((f, n) => (
        <button
          key={`${f}-${n}`}
          onClick={() => setI(n)}
          aria-label={`Ver foto ${n + 1}`}
          aria-current={n === i}
          className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg transition-all duration-500 md:h-20 md:w-28 ${
            n === i ? "ring-2 ring-brand" : "opacity-60 ring-1 ring-graph/10 hover:opacity-100"
          }`}
          style={{ transitionTimingFunction: CURVA }}
        >
          <img
            src={f}
            onError={(e) => { e.currentTarget.src = NO_IMG; }}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}

/* ── Pantalla completa ────────────────────────────────────────────────────── */

function Visor({
  imagenes, titulo, i, setI, onCerrar,
}: {
  imagenes: string[];
  titulo: string;
  i: number;
  setI: (n: number) => void;
  onCerrar: () => void;
}) {
  // Entrada: aparece con un respiro, no de golpe.
  const [entrando, setEntrando] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEntrando(false), 20);
    return () => clearTimeout(t);
  }, []);

  // Teclado y scroll de fondo.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") setI(Math.min(imagenes.length - 1, i + 1));
      if (e.key === "ArrowLeft") setI(Math.max(0, i - 1));
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", alTeclear);
    };
  }, [i, imagenes.length, onCerrar, setI]);

  return createPortal(
    <div
      role="dialog"
      aria-label={`Fotos de ${titulo}`}
      onClick={onCerrar}
      className={`fixed inset-0 z-[100] flex flex-col justify-center bg-graph/95 backdrop-blur-xl transition-opacity duration-500 ${
        entrando ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionTimingFunction: CURVA }}
    >
      <button
        onClick={onCerrar}
        aria-label="Cerrar"
        className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:scale-105 hover:bg-white/20"
      >
        <X size={20} />
      </button>

      <span className="absolute left-5 top-6 z-10 text-sm font-medium tabular-nums text-white/60">
        {i + 1} / {imagenes.length}
      </span>

      {/* El mismo riel adentro: se desliza igual que afuera. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`mx-auto w-full max-w-5xl px-4 transition-transform duration-500 ${entrando ? "scale-[0.97]" : "scale-100"}`}
        style={{ transitionTimingFunction: CURVA }}
      >
        <Riel imagenes={imagenes} titulo={titulo} i={i} setI={setI} altura="aspect-[4/3] max-h-[82vh]" />
      </div>
    </div>,
    document.body
  );
}
