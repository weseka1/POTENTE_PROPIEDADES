import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, SlidersHorizontal } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PropiedadCard from "./components/PropiedadCard";
import { useLenis } from "./lib/useLenis";
import { useDisolverAlBajar } from "./lib/useDisolverAlBajar";
import RielHorizontal from "./components/RielHorizontal";
import { useSEO } from "./lib/seo";
import UISelect from "@/components/Select";
import { fmtUSD, fmtARS } from "@/lib/format";

import WhatsAppCTA from "./components/WhatsAppCTA";
import { useReveal } from "@/lib/hooks";
import { useData } from "@/lib/DataProvider";
import { CATEGORIAS, ESTADOS_CERRADOS, type OperacionProp } from "@/data/propiedadTypes";

/* ── Las operaciones que ofrece el catálogo general ──────────────────────────
   UNA sola lista, leída por el desplegable de escritorio Y por el del celular.
   Estaban escritas dos veces, y por eso `arrendamiento` —una operación que no
   usaba ninguna propiedad— sobrevivió en las DOS hasta el 14-ago: una lista
   duplicada es una lista que alguien va a actualizar a medias.

   Temporada NO está acá, y es una decisión de producto, no un olvido: ver el
   filtro de `propiedades` abajo. Tipada como OperacionProp para que un valor
   inventado no compile. */
const OPERACIONES_CATALOGO: OperacionProp[] = ["venta", "alquiler"];

export default function Catalogo() {
  useLenis();
  useSEO({
    titulo: "Propiedades en venta y alquiler en Mar del Plata · Potente Propiedades",
    descripcion:
      "Catálogo completo de Potente Propiedades: casas, departamentos, PH, locales y lotes en Mar del Plata. Filtrá por zona, tipo y operación.",
    path: "/propiedades",
  });
  const { propiedades: cartera } = useData();

  /* ── El catálogo general muestra VENTA y ALQUILER. Temporada queda afuera ───
     Mateo, 14-ago-2026: «cuando yo entro a venta, que aparezcan solo las que
     tengo en venta; cuando entro a alquiler, solo las de alquiler; cuando entro
     a temporada, solo las de temporada». Temporada es una operación con vida
     propia —ficha propia, tarifas por quincena, disponibilidad, y se da de baja
     entera cuando pasa el verano— y por eso tiene su propia página (/temporada)
     con su propio flujo. Mezclarlas acá rompe las dos puntas: el que entra a
     comprar se topa con un departamento que solo se alquila en enero, y el que
     busca verano ve una tarjeta con precio de venta y sin una sola tarifa.

     Se filtra UNA vez, acá arriba, y no adentro de `resultados`: de esta lista
     salen TAMBIÉN los contadores de las pestañas de categoría, las zonas del
     desplegable, el tope del slider de precio y los chips de características.
     Filtrando solo abajo quedaba el pecado clásico de contador mentiroso — la
     pestaña "Departamentos (12)" abriendo una lista de 9. */
  const propiedades = useMemo(() => cartera.filter((p) => p.operacion !== "temporada"), [cartera]);

  const zonas = [...new Set(propiedades.map((p) => p.zona))].sort();
  const cuenta = (cat: string) => propiedades.filter((p) => p.categoria === cat).length;
  const tabs = [
    { key: "", label: "Todas", n: propiedades.length },
    ...CATEGORIAS.map((c) => ({ key: c.key, label: c.plural, n: cuenta(c.key) })).filter((t) => t.n > 0),
  ];
  const [params, setParams] = useSearchParams();
  // En el celular los filtros viven en una hoja: pegados arriba tapaban media
  // pantalla (la barra medía 435 px en un iPhone).
  const [hojaFiltros, setHojaFiltros] = useState(false);

  /* ── El control del catálogo, en dos capas ─────────────────────────────────
     El riel queda pegado arriba y su alto no cambia nunca; el bloque de filtros
     se va con la página y se disuelve por debajo. Todo el por qué está en el
     comentario del JSX y en `useDisolverAlBajar`. */
  const riel = useRef<HTMLDivElement>(null);
  const bloque = useRef<HTMLDivElement>(null);
  useDisolverAlBajar(bloque, riel);

  // Con la hoja abierta se congela el scroll de la página: si no, el dedo arrastra
  // la lista de atrás y la hoja a la vez, y se siente roto. Se cierra con Escape.
  useEffect(() => {
    if (!hojaFiltros) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setHojaFiltros(false); };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", esc);
    };
  }, [hojaFiltros]);

  const [f, setF] = useState({
    cat: params.get("cat") || "",
    operacion: params.get("operacion") || "",
    zona: params.get("zona") || "",
    amb: params.get("amb") || "",
    dorm: params.get("dorm") || "",
    banos: params.get("banos") || "",
    min: params.get("min") || "",
    max: params.get("max") || "",
    q: params.get("q") || "",
    caract: (params.get("caract") || "").split(",").filter(Boolean),
    // Sin filtros, lo NUEVO primero (pedido Mateo 12-ago: "que se muestren
    // primero las últimas cargadas"). Destacados y precio quedan como opciones.
    orden: "recientes",
  });

  // Sincronizar con la URL: el buscador del inicio llega con todo puesto acá.
  useEffect(() => {
    setF((p) => ({
      ...p,
      cat: params.get("cat") || "",
      operacion: params.get("operacion") || p.operacion,
      zona: params.get("zona") || p.zona,
      amb: params.get("amb") || "",
      max: params.get("max") || "",
      q: params.get("q") || p.q,
    }));
  }, [params]);

  // ── Búsqueda por palabras clave (pedido Mateo 5-ago, estilo Bochile) ─────────
  // "pileta" tiene que encontrar la casa con pileta: el buscador mira título, zona,
  // dirección, descripción, características, mejoras y servicios de la ficha.
  // Sin acentos y por palabras: "guemes pileta" = las dos cosas a la vez.
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const blobs = useMemo(
    () =>
      new Map(
        propiedades.map((p) => [
          p.id,
          norm(
            [
              p.titulo, p.zona, p.direccion || "", p.descripcion, p.categoria, p.id,
              ...(p.caracteristicas || []),
              ...(p.ficha?.mejorasUrbanas || []),
              ...(p.ficha?.servicios || []),
              p.ficha?.barrio || "",
            ].join(" · ")
          ),
        ])
      ),
    [propiedades]
  );

  // Sinónimos criollos: el cliente escribe "pileta", los datos dicen "piscina".
  // Un token matchea si CUALQUIER sinónimo de su grupo aparece en la propiedad.
  const SINONIMOS: string[][] = [
    ["pileta", "piscina"],
    ["cochera", "garage", "garaje"],
    ["depto", "departamento"],
    ["balcon", "terraza"],
    ["quincho", "parrilla"],
  ];
  const variantes = (token: string): string[] => {
    const grupo = SINONIMOS.find((g) => g.some((s) => token.startsWith(s.slice(0, 5)) || s.startsWith(token)));
    return grupo ? [...new Set([token, ...grupo])] : [token];
  };

  // Chips de UN TOQUE: lo que un comprador pide de verdad (curado, no "Luz" ni
  // "Agua corriente"). Solo se muestran los que existen en la cartera.
  const CHIPS_CARACT = [
    { label: "Pileta", term: "piscina" },
    { label: "Cochera", term: "cochera" },
    { label: "Quincho", term: "quincho" },
    { label: "Parrilla", term: "parrilla" },
    { label: "Patio", term: "patio" },
    { label: "Jardín", term: "jardin" },
    { label: "Balcón", term: "balcon" },
    { label: "Vista al mar", term: "vista al mar" },
    { label: "Apto crédito", term: "apto credito" },
    { label: "Frente al mar", term: "frente al mar" },
  ];
  const caractsTop = useMemo(() => {
    const cuantas = (term: string) => {
      let n = 0;
      for (const blob of blobs.values()) if (blob.includes(norm(term))) n++;
      return n;
    };
    return CHIPS_CARACT.map((c) => ({ ...c, n: cuantas(c.term) })).filter((c) => c.n >= 2);
  }, [blobs]);

  // ── Precio como slider doble (pedido Mateo 5-ago, tipo Airbnb/Bochile) ──────
  // Tope = la propiedad MÁS CARA de la cartera + ~10% de aire "por si les
  // ingresa algo" (Juani 5-ago), redondeado a un número lindo. Más allá del
  // tope el rango queda abierto ("Cualquiera"). Alquileres en PESOS.
  const moneda: "USD" | "ARS" = f.operacion === "alquiler" ? "ARS" : "USD";
  const pasoPrecio = moneda === "USD" ? 10_000 : 50_000;
  const precioDe = (p: (typeof propiedades)[number]) => (moneda === "ARS" ? p.precioARS ?? null : p.precioUSD ?? null);
  // Piso del tope: aunque hoy la cartera sea chica, la barra tiene que dar aire
  // (Juani 5-ago: en alquiler tiene que pasar holgado del millón de pesos).
  const TOPE_MINIMO = { USD: 500_000, ARS: 2_000_000 } as const;
  const topePrecio = useMemo(() => {
    const vals = propiedades
      .filter((p) => (f.operacion ? p.operacion === f.operacion : p.operacion === "venta"))
      .map((p) => (moneda === "ARS" ? p.precioARS : p.precioUSD))
      .filter((n): n is number => typeof n === "number" && n > 0);
    const redondeo = moneda === "USD" ? 50_000 : 100_000;
    const conAire = vals.length ? Math.ceil((Math.max(...vals) * 1.1) / redondeo) * redondeo : 0;
    return Math.max(TOPE_MINIMO[moneda], conAire);
  }, [propiedades, f.operacion, moneda]);

  // Cambió la operación → cambia la moneda/escala: el rango vuelve a cero.
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return; }
    setF((p) => ({ ...p, min: "", max: "" }));
  }, [f.operacion]);

  const resultados = useMemo(() => {
    // "4+" en ambientes/dormitorios/baños significa "o más".
    const cumpleNum = (valor: number | undefined, filtro: string) => {
      if (!filtro) return true;
      const n = valor || 0;
      return filtro.endsWith("+") ? n >= Number(filtro.slice(0, -1)) : n === Number(filtro);
    };
    const min = Number(f.min) || 0;
    const max = Number(f.max) || 0;
    const tokens = norm(f.q).split(/\s+/).filter(Boolean);
    // Ojo: `propiedades` ya viene SIN las de temporada (se filtran una sola vez
    // arriba, con el porqué escrito ahí). Acá no se vuelve a chequear a propósito.
    let r = propiedades.filter((p) => {
      const blob = blobs.get(p.id) || "";
      const precio = precioDe(p);
      return (
        // Lo que ya no se ofrece NO va en el catálogo. Antes una propiedad vendida
        // seguía apareciendo con su precio grande y el botón "Consultar por
        // WhatsApp": confunde al comprador, quema consultas y le hace parecer a
        // Potente que tiene stock que no tiene. La ficha sigue accesible por su
        // link (sirve de prueba social y no rompe lo que ya se compartió).
        !ESTADOS_CERRADOS.includes(p.estado) &&
        (!f.cat || p.categoria === f.cat) &&
        (!f.operacion || p.operacion === f.operacion) &&
        (!f.zona || p.zona === f.zona) &&
        cumpleNum(p.ambientes, f.amb) &&
        cumpleNum(p.dormitorios, f.dorm) &&
        cumpleNum(p.banos, f.banos) &&
        (!min || (precio != null && precio >= min)) &&
        (!max || (precio != null && precio <= max)) &&
        f.caract.every((c) => blob.includes(norm(c))) &&
        tokens.every((t) => variantes(t).some((v) => blob.includes(norm(v))))
      );
    });
    // "Más recientes": por fecha de carga, la de hoy arriba de todo. En el modo
    // demo los seeds no traen created_at → todas empatan y el sort ESTABLE deja
    // el orden del archivo: nunca rompe, solo mejora cuando el dato existe.
    if (f.orden === "recientes") r = [...r].sort((a, b) => (b.created_at ? Date.parse(b.created_at) : 0) - (a.created_at ? Date.parse(a.created_at) : 0));
    if (f.orden === "destacados") r = [...r].sort((a, b) => Number(b.destacado) - Number(a.destacado));
    // ⚠️ Se ordena por `precioDe`, que respeta la moneda de la operación elegida.
    // Antes ordenaba solo por `precioUSD`, así que con el filtro en "alquiler"
    // —donde los precios están en pesos y precioUSD es null— el orden no hacía
    // absolutamente nada: el visitante tocaba "Menor precio" y la lista quedaba igual.
    if (f.orden === "precio_asc") r = [...r].sort((a, b) => (precioDe(a) ?? 9e15) - (precioDe(b) ?? 9e15));
    if (f.orden === "precio_desc") r = [...r].sort((a, b) => (precioDe(b) ?? 0) - (precioDe(a) ?? 0));
    return r;
  }, [f, propiedades, blobs]);

  useReveal();

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const toggleCaract = (c: string) =>
    setF((p) => ({ ...p, caract: p.caract.includes(c) ? p.caract.filter((x) => x !== c) : [...p.caract, c] }));
  const setCat = (cat: string) => {
    setF((p) => ({ ...p, cat }));
    const np = new URLSearchParams(params);
    if (cat) np.set("cat", cat);
    else np.delete("cat");
    setParams(np, { replace: true });
  };
  const limpiar = () => {
    setF({ cat: f.cat, operacion: "", zona: "", amb: "", dorm: "", banos: "", min: "", max: "", q: "", caract: [], orden: "recientes" });
    const np = new URLSearchParams();
    if (f.cat) np.set("cat", f.cat);
    setParams(np, { replace: true });
  };
  const hayFiltros = Boolean(f.operacion || f.zona || f.q || f.amb || f.dorm || f.banos || f.min || f.max || f.caract.length);

  // Lo que se está aplicando, a la vista y removible de a uno.
  const precioChip = (n: number) =>
    moneda === "ARS" ? `${fmtARS(n, { short: true })} ARS` : fmtUSD(n, { short: true });
  type FiltroKey = "operacion" | "zona" | "amb" | "dorm" | "banos" | "min" | "max" | "q";
  const quitar = (k: FiltroKey) => {
    setF((p) => ({ ...p, [k]: "" }));
    const np = new URLSearchParams(params);
    np.delete(k);
    setParams(np, { replace: true });
  };
  const chips: { k: FiltroKey | `c:${string}`; label: string }[] = [
    ...(f.operacion ? [{ k: "operacion" as const, label: f.operacion === "venta" ? "En venta" : "En alquiler" }] : []),
    ...(f.zona ? [{ k: "zona" as const, label: f.zona }] : []),
    ...(f.amb ? [{ k: "amb" as const, label: `${f.amb} amb` }] : []),
    ...(f.dorm ? [{ k: "dorm" as const, label: `${f.dorm} dorm` }] : []),
    ...(f.banos ? [{ k: "banos" as const, label: `${f.banos} baño${f.banos === "1" ? "" : "s"}` }] : []),
    // Con moneda explícita: "$500k ARS" nunca se confunde con "U$S 500K".
    ...(f.min ? [{ k: "min" as const, label: `desde ${precioChip(Number(f.min))}` }] : []),
    ...(f.max ? [{ k: "max" as const, label: `hasta ${precioChip(Number(f.max))}` }] : []),
    ...f.caract.map((c) => ({ k: `c:${c}` as const, label: CHIPS_CARACT.find((x) => x.term === c)?.label ?? c })),
    ...(f.q ? [{ k: "q" as const, label: `“${f.q}”` }] : []),
  ];
  const quitarChip = (k: string) => (k.startsWith("c:") ? toggleCaract(k.slice(2)) : quitar(k as FiltroKey));

  return (
    <div className="min-h-screen bg-paper text-graph">
      <div className="grain" />
      <Navbar variant="solid" />

      <header className="relative overflow-hidden pt-32 pb-10">
        <div className="absolute inset-0">
          <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: "url(/img/props/depto2.jpg)" }} />
          <div className="absolute inset-0 bg-brand-950/85" />
        </div>
        <div className="container-x relative z-10">
          <p className="eyebrow">Catálogo de propiedades</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-white md:text-6xl">
            Encontrá tu próxima propiedad
          </h1>
          <p className="mt-4 max-w-xl text-white/70">
            Casas, departamentos, PH, locales y lotes en toda Mar del Plata.
          </p>

          {/* Buscador */}
          <div className="mt-7 flex max-w-xl items-center gap-3 rounded-xl border border-white/15 bg-graph/40 px-4 backdrop-blur">
            <Search size={18} className="text-white/50" />
            <input
              id="buscador-catalogo"
              value={f.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Buscá lo que quieras: pileta, Güemes, esquina, quincho…"
              className="h-12 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
            {f.q && (
              <button onClick={() => set("q", "")} className="text-white/50 hover:text-white">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ═══ Control del catálogo — DOS CAPAS, y es a propósito ═══════════════════
          · RIEL (sticky): una sola fila que SIEMPRE está, con las categorías, el
            botón de filtros, el orden y el contador. Su caja NUNCA cambia de
            tamaño mientras se scrollea. Por eso no hay salto.
          · BLOQUE (NO sticky): los filtros grandes. No acompañan a las
            propiedades: se van con la página y se disuelven entrando por debajo
            del riel (`useDisolverAlBajar`).

          🔴 QUÉ HABÍA ANTES Y POR QUÉ ESTABA MAL.
          Las filas 2 y 3 pasaban a `hidden` al cruzar 220 px de scroll. `hidden`
          es `display:none`: saca 201 px DEL FLUJO, el documento se acorta de golpe
          y todo lo de abajo pega un salto instantáneo de 201 px hacia arriba, con
          las tarjetas ya en pantalla. Ese era el "choca" del video que mandó Mateo
          el 10-ago — un salto de layout, no un fade que faltaba. Animar la altura
          no lo arregla: reparte el mismo salto en 300 ms y se siente peor, como si
          la lista se deslizara para arriba peleando contra tu scroll.
          Y de paso, con la barra colapsada, en escritorio NO quedaba ninguna forma
          de tocar un filtro: las filas estaban `hidden` y el botón "Filtros" era
          `lg:hidden`. Ahora el botón está en todas las medidas y abre el panel
          completo sin perder la posición del scroll.

          ⚠️ El `top` va por breakpoint porque el nav mide distinto: 72 px en el
          celular y 64 en escritorio.

          🔴 Y OJO CON ESTO, que ya me morí una vez: el riel y el bloque son
          HERMANOS SUELTOS, sin ningún `div` que los envuelva. Un elemento
          `sticky` solo se pega DENTRO de su contenedor: envueltos en un `div`
          propio (que mide riel + bloque, unos 260 px), pasado ese punto el riel
          se despega y se va con la página — y ahí perdés las categorías y el
          botón de filtros, que es el mismo bug funcional por otra puerta. Sin
          envoltorio, el contenedor del riel es la página entera y se queda
          pegado siempre. */}
        {/* ── RIEL ──
            LIQUID GLASS, y por qué cada número:
            el bug de que se leyera el precio de la tarjeta a través de la barra NO
            era falta de opacidad. Era que `.reveal` tenía `will-change`
            permanente, así que cada tarjeta vivía en su propia capa de composición
            y quedaba FUERA del alcance del `backdrop-filter`: el blur no la veía.
            Está arreglado en `index.css`. Subir el fondo a /95, como hice primero,
            era cambiar el vidrio por una pared.
            · /72 + `saturate-150` es la receta de Apple: la SATURACIÓN es lo que
              hace que parezca vidrio y no vidrio empañado.
            · `supports-[backdrop-filter]` deja /94 opaco donde no hay blur
              (Firefox con el flag apagado), si no quedaría transparente.
            · `isolate transform-gpu` mete el riel en el mismo camino de
              composición que lo que tiene que difuminar.
            · La sombra proyectada aparece SOLO cuando el bloque ya se fue
              (`data-flotando`): sin scroll el riel es parte de la página; con el
              bloque ido, flota. Es el único cambio binario visible, y por eso el
              hook le pone histéresis. */}
        <div
          ref={riel}
          data-riel="filtros"
          data-flotando="false"
          className="sticky top-[72px] z-30 isolate transform-gpu bg-paper-200/[0.94] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[20px] backdrop-saturate-150 transition-shadow duration-300 ease-out supports-[backdrop-filter]:bg-paper-200/[0.72] data-[flotando=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_0_0_rgba(13,21,33,0.10),0_18px_32px_-24px_rgba(2,35,82,0.55)] lg:top-[64px]"
        >
          <div className="container-x flex flex-col gap-2 py-2.5">
            <div className="flex items-center gap-2">
              {/* RielHorizontal y no un overflow pelado: cuando las categorías no
                  entran, el degradé muestra que hay más (antes "Oficinas" quedaba
                  cortada a secas y parecía la última habiendo tres atrás), y la
                  rueda del mouse desplaza el riel en vez de bajar la página. */}
              <RielHorizontal className="gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setCat(t.key)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                      f.cat === t.key
                        ? "bg-brand text-white shadow-[0_6px_16px_-6px_rgba(12,77,162,0.55)]"
                        : "bg-white/75 text-graph-500 ring-1 ring-graph/10 hover:bg-white hover:text-graph"
                    }`}
                  >
                    {t.label} <span className="opacity-60">({t.n})</span>
                  </button>
                ))}
              </RielHorizontal>

              {/* En TODAS las medidas: es la única puerta a los filtros una vez que
                  el bloque se fue, y no te hace perder la posición del scroll. */}
              <button
                onClick={() => setHojaFiltros(true)}
                aria-expanded={hojaFiltros}
                className="relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/85 px-4 text-sm font-semibold text-graph ring-1 ring-graph/15 transition hover:bg-white hover:ring-brand/40"
              >
                <SlidersHorizontal size={15} /> Filtros
                {chips.length > 0 && (
                  <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                    {chips.length}
                  </span>
                )}
              </button>

              {/* Ordenar por precio es exactamente lo que uno quiere hacer estando
                  en la propiedad número catorce. Antes moría con el colapso. */}
              <div className="hidden shrink-0 lg:block">
                <FSelect
                  value={f.orden}
                  onChange={(v) => set("orden", v)}
                  options={[
                    { v: "recientes", l: "Más recientes" },
                    { v: "destacados", l: "Destacados" },
                    { v: "precio_desc", l: "Mayor precio" },
                    { v: "precio_asc", l: "Menor precio" },
                  ]}
                  ph="Ordenar"
                  noEmpty
                />
              </div>

              {/* El contador: es el feedback de los filtros. Saco uno y el número
                  reacciona. `tabular-nums` para que al pasar de 9 a 10 la palabra
                  "propiedades" no baile de costado, y el `key` remonta el nodo para
                  que se note el cambio. */}
              <p
                key={resultados.length}
                className="hidden shrink-0 animate-[fadeIn_.32s_cubic-bezier(0.16,1,0.3,1)] tabular-nums text-sm text-graph-500 sm:block"
              >
                <span className="font-semibold text-brand-700">{resultados.length}</span>{" "}
                {resultados.length === 1 ? "propiedad" : "propiedades"}
              </p>
            </div>

            {/* "Buscando:" se queda en el riel: es una línea, dice por qué salen
                esos resultados y cada chip se saca de a uno sin abrir nada.
                ⚠️ `flex-nowrap` + scroll horizontal a propósito: así el riel tiene
                un alto DETERMINISTA (nunca envuelve), y de eso depende que la
                disolución arranque siempre en el mismo punto. */}
            {chips.length > 0 && (
              <RielHorizontal className="flex-nowrap items-center gap-2 pb-0.5">
                <span className="shrink-0 text-xs text-graph-400">Buscando:</span>
                {chips.map((c) => (
                  <button
                    key={c.k}
                    onClick={() => quitarChip(c.k)}
                    className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand/25 bg-brand/[0.07] py-1 pl-3 pr-2 text-xs font-medium text-brand-700 transition hover:border-brand/50 hover:bg-brand/[0.12]"
                    title="Quitar este filtro"
                  >
                    {c.label}
                    <X size={13} className="text-brand/50 transition group-hover:text-brand" />
                  </button>
                ))}
                <button
                  onClick={limpiar}
                  className="ml-1 shrink-0 whitespace-nowrap text-xs text-graph-400 underline decoration-graph/20 underline-offset-2 transition hover:text-brand hover:decoration-brand/40"
                >
                  Limpiar todo
                </button>
              </RielHorizontal>
            )}
          </div>
        </div>

        {/* ── BLOQUE ──
            NO es sticky, y no lleva NINGUNA clase condicionada al scroll: de eso
            depende que el alto del documento no se mueva nunca. Mismo fondo que el
            riel, así en reposo se leen como una sola barra.
            Mateo, 5-ago: "la mayor cantidad de filtros posible". En el celular
            estos filtros viven en la hoja (`lg:block`): acá arriba sumaban otra
            fila a una barra que ya tapaba media pantalla. */}
        <div
          ref={bloque}
          data-bloque="filtros"
          className="relative z-10 hidden border-b border-graph/10 bg-paper-200/[0.94] supports-[backdrop-filter]:bg-paper-200/[0.72] lg:block"
        >
          <div className="container-x flex flex-col gap-3 pb-4 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-xs font-medium text-graph-400">
                <SlidersHorizontal size={14} /> Filtros
              </span>
              <FSelect value={f.operacion} onChange={(v) => set("operacion", v)} options={OPERACIONES_CATALOGO} ph="Operación" />
              <FSelect value={f.zona} onChange={(v) => set("zona", v)} options={zonas} ph="Zona" />
              <FSelect value={f.amb} onChange={(v) => set("amb", v)} options={[{ v: "1", l: "1 ambiente" }, { v: "2", l: "2 ambientes" }, { v: "3", l: "3 ambientes" }, { v: "4", l: "4 ambientes" }, { v: "5+", l: "5 o más" }]} ph="Ambientes" />
              <FSelect value={f.dorm} onChange={(v) => set("dorm", v)} options={[{ v: "1", l: "1 dormitorio" }, { v: "2", l: "2 dormitorios" }, { v: "3", l: "3 dormitorios" }, { v: "4+", l: "4 o más" }]} ph="Dormitorios" />
              <FSelect value={f.banos} onChange={(v) => set("banos", v)} options={[{ v: "1", l: "1 baño" }, { v: "2", l: "2 baños" }, { v: "3+", l: "3 o más" }]} ph="Baños" />
              <RangoPrecio
                min={Number(f.min) || 0}
                max={Number(f.max) || 0}
                tope={topePrecio}
                paso={pasoPrecio}
                moneda={moneda}
                // Sin operación elegida el precio se lee en dólares (las ventas): decirlo.
                nota={moneda === "ARS" ? "por mes" : f.operacion ? "" : "en venta"}
                onChange={(lo, hi) =>
                  setF((p) => ({ ...p, min: lo <= 0 ? "" : String(lo), max: hi >= topePrecio ? "" : String(hi) }))
                }
              />
              {hayFiltros && (
                <button onClick={limpiar} className="ml-auto flex items-center gap-1 text-xs text-graph-500 hover:text-brand">
                  <X size={14} /> Limpiar
                </button>
              )}
            </div>

            {/* Características de un toque: pileta, cochera, parrilla… */}
            {caractsTop.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {caractsTop.map((c) => {
                  const activa = f.caract.includes(c.term);
                  return (
                    <button
                      key={c.term}
                      onClick={() => toggleCaract(c.term)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ring-1 transition ${
                        activa
                          ? "bg-brand text-white ring-brand"
                          : "bg-white/75 text-graph-500 ring-graph/10 hover:bg-white hover:text-brand hover:ring-brand/40"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      {/* ═══ Panel de filtros ═════════════════════════════════════════════════
          En el celular sube desde abajo como hoja; en escritorio es una tarjeta
          centrada. En los dos casos el alto se limita en vh y el contenido
          scrollea adentro, con los botones fijos al pie (en el celular, en la zona
          del pulgar). Mientras está abierto se bloquea el scroll de la página, así
          el dedo no arrastra las dos cosas a la vez.

          En escritorio es LA PUERTA a los filtros una vez que el bloque se fue con
          el scroll, así que no puede ser `lg:hidden` como era hasta el 10-ago. */}
      {hojaFiltros && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Filtros">
          <button
            aria-label="Cerrar filtros"
            onClick={() => setHojaFiltros(false)}
            className="absolute inset-0 bg-navy/45 backdrop-blur-sm motion-safe:animate-[fadeIn_.18s_ease-out]"
          />
          {/* Hoja desde abajo en el celular; tarjeta centrada en escritorio. En los
              dos casos el alto se limita en vh y el contenido scrollea adentro: a
              1366×768 el alto es el recurso escaso. */}
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-paper-100 shadow-[0_-20px_60px_-20px_rgba(2,35,82,0.45)] lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:max-h-[86vh] lg:w-[min(56rem,92vw)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:shadow-[0_40px_90px_-30px_rgba(2,35,82,0.5)] lg:motion-safe:animate-[fadeIn_.18s_ease-out]">
            {/* Manija: le dice al dedo que esto se puede cerrar. En escritorio no
                va — ahí se cierra con el fondo, la X o Escape. */}
            <div className="shrink-0 px-5 pb-1 pt-3 lg:hidden">
              <div className="mx-auto h-1.5 w-11 rounded-full bg-graph/20" />
            </div>
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-2">
              <h2 className="font-display text-lg font-semibold text-graph">Filtros</h2>
              <button
                onClick={() => setHojaFiltros(false)}
                aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center rounded-full text-graph-400 transition hover:bg-graph/5 hover:text-graph"
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <FSelect value={f.operacion} onChange={(v) => set("operacion", v)} options={OPERACIONES_CATALOGO} ph="Operación" />
                <FSelect value={f.zona} onChange={(v) => set("zona", v)} options={zonas} ph="Zona" />
                <FSelect value={f.amb} onChange={(v) => set("amb", v)} options={[{ v: "1", l: "1 ambiente" }, { v: "2", l: "2 ambientes" }, { v: "3", l: "3 ambientes" }, { v: "4", l: "4 ambientes" }, { v: "5+", l: "5 o más" }]} ph="Ambientes" />
                <FSelect value={f.dorm} onChange={(v) => set("dorm", v)} options={[{ v: "1", l: "1 dormitorio" }, { v: "2", l: "2 dormitorios" }, { v: "3", l: "3 dormitorios" }, { v: "4+", l: "4 o más" }]} ph="Dormitorios" />
                <FSelect value={f.banos} onChange={(v) => set("banos", v)} options={[{ v: "1", l: "1 baño" }, { v: "2", l: "2 baños" }, { v: "3+", l: "3 o más" }]} ph="Baños" />
                <FSelect
                  value={f.orden}
                  onChange={(v) => set("orden", v)}
                  options={[
                    { v: "recientes", l: "Más recientes" },
                    { v: "destacados", l: "Destacados" },
                    { v: "precio_desc", l: "Mayor precio" },
                    { v: "precio_asc", l: "Menor precio" },
                  ]}
                  ph="Ordenar"
                  noEmpty
                />
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest2 text-graph-400">Precio</p>
                <RangoPrecio
                  min={Number(f.min) || 0}
                  max={Number(f.max) || 0}
                  tope={topePrecio}
                  paso={pasoPrecio}
                  moneda={moneda}
                  nota={moneda === "ARS" ? "por mes" : f.operacion ? "" : "en venta"}
                  onChange={(lo, hi) =>
                    setF((p) => ({ ...p, min: lo <= 0 ? "" : String(lo), max: hi >= topePrecio ? "" : String(hi) }))
                  }
                />
              </div>

              {caractsTop.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest2 text-graph-400">Con…</p>
                  <div className="flex flex-wrap gap-2">
                    {caractsTop.map((c) => {
                      const activa = f.caract.includes(c.term);
                      return (
                        <button
                          key={c.term}
                          onClick={() => toggleCaract(c.term)}
                          className={`rounded-full px-3.5 py-2 text-sm font-medium ring-1 transition ${
                            activa ? "bg-brand text-white ring-brand" : "bg-white/75 text-graph-500 ring-graph/10"
                          }`}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Pie fijo: los botones quedan siempre al alcance del pulgar. */}
            <div
              className="shrink-0 flex gap-3 border-t border-graph/10 bg-paper-100 px-5 pt-3"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
            >
              {hayFiltros && (
                <button
                  onClick={limpiar}
                  className="h-12 flex-1 rounded-xl border border-graph/15 text-sm font-semibold text-graph-500 transition active:bg-graph/5"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={() => setHojaFiltros(false)}
                className="h-12 flex-[2] rounded-xl bg-brand text-sm font-semibold text-white transition active:bg-brand-600"
              >
                Ver {resultados.length} {resultados.length === 1 ? "propiedad" : "propiedades"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fondo gris suave: las tarjetas blancas ganan relieve (nada de blanco sobre blanco). */}
      <section className="bg-paper-200/60 py-12">
        <div className="container-x">
          {/* Solo celular. De sm para arriba el contador vive en el riel, donde
              queda a la vista mientras se scrollea; tenerlo en los dos lados era
              el mismo número repetido. En el celular el riel no tiene lugar (las
              categorías ya scrollean de costado), así que va acá. */}
          <p className="mb-6 text-sm tabular-nums text-graph-500 sm:hidden">
            {resultados.length} {resultados.length === 1 ? "propiedad" : "propiedades"}
          </p>
          {resultados.length === 0 ? (
            <div className="mx-auto max-w-lg py-20 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand">
                <Search size={28} />
              </span>
              <p className="mt-5 font-display text-2xl text-graph">No encontramos nada con esa búsqueda</p>
              <p className="mt-2 text-graph-500">
                Probá sacando algún filtro, o escribinos y te buscamos nosotros: conocemos propiedades que todavía no están publicadas.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <button onClick={limpiar} className="btn-ghost">Ver todas las propiedades</button>
                <WhatsAppCTA mensaje="Hola Potente Propiedades, no encuentro lo que busco en el catálogo y quiero que me ayuden.">
                  Consultar por WhatsApp
                </WhatsAppCTA>
              </div>
            </div>
          ) : (
            <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {resultados.map((p, i) => (
                <div key={p.id} className="reveal">
                  {/* Las 3 primeras entran en pantalla sin scrollear: cargan con
                      prioridad. Las demás, recién cuando el visitante se acerca. */}
                  <PropiedadCard p={p} prioritaria={i < 3} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

type Opt = string | { v: string; l: string };
function FSelect({ value, onChange, options, ph, noEmpty }: { value: string; onChange: (v: string) => void; options: Opt[]; ph: string; noEmpty?: boolean }) {
  const opciones = [
    ...(noEmpty ? [] : [{ value: "", label: ph }]),
    ...options.map((o) => (typeof o === "string" ? { value: o, label: o } : { value: o.v, label: o.l })),
  ];
  return (
    <UISelect
      value={value}
      onChange={onChange}
      options={opciones}
      placeholder={ph}
      size="sm"
      className="min-w-[9.5rem]"
      triggerClassName="capitalize rounded-lg !bg-white/80"
    />
  );
}

// ── Slider de precio doble (pedido Mateo 5-ago: "una línea con un puntito", tipo
// Airbnb/Bochile). Dos ranges nativos superpuestos; el CSS .rango deja los eventos
// SOLO en los thumbs. En el tope, el rango queda abierto ("300k+").
function RangoPrecio({
  min, max, tope, paso, moneda, nota, onChange,
}: {
  min: number;
  max: number;
  tope: number;
  paso: number;
  moneda: "USD" | "ARS";
  nota?: string;
  onChange: (lo: number, hi: number) => void;
}) {
  const fmt = (n: number) => (moneda === "ARS" ? fmtARS(n, { short: true }) : fmtUSD(n, { short: true }));
  const lo = Math.min(min, tope - paso);
  const hi = max > 0 ? Math.min(max, tope) : tope;
  const abierto = lo <= 0 && hi >= tope;
  // Sin símbolos repetidos: la moneda la canta el badge, el rango va en números.
  const desnudo = (n: number) => fmt(n).replace(/^(U\$S|\$)\s?/, "");
  const etiqueta = abierto
    ? "Cualquiera"
    : `${desnudo(lo)} – ${hi >= tope ? `${desnudo(tope)}+` : desnudo(hi)}`;
  return (
    <div className="rango w-full sm:w-64">
      <div className="mb-0.5 flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-1.5 text-[10px] font-semibold uppercase tracking-widest2 text-graph-400">
          Precio
          {/* Moneda SIEMPRE cantada: dólares en azul de marca, pesos en terracota. */}
          <span
            className={`rounded px-1.5 py-px text-[10px] font-bold tracking-normal ${
              moneda === "USD" ? "bg-brand/10 text-brand-700" : "bg-clay/15 text-clay"
            }`}
          >
            {moneda === "USD" ? "U$S" : "$ ARS"}
          </span>
          {nota && <span className="text-[9px] font-medium normal-case tracking-normal text-graph-400">{nota}</span>}
        </span>
        <span className={`text-xs font-semibold ${abierto ? "text-graph-400" : "text-brand-700"}`}>{etiqueta}</span>
      </div>
      <div className="relative h-5">
        <div className="absolute top-1/2 h-[3px] w-full -translate-y-1/2 rounded-full bg-graph/15" />
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-brand"
          style={{ left: `${(lo / tope) * 100}%`, right: `${100 - (hi / tope) * 100}%` }}
        />
        <input
          type="range" min={0} max={tope} step={paso} value={lo}
          aria-label="Precio desde"
          onChange={(e) => onChange(Math.min(Number(e.target.value), hi - paso), hi)}
          className="absolute inset-0 w-full appearance-none bg-transparent"
        />
        <input
          type="range" min={0} max={tope} step={paso} value={hi}
          aria-label="Precio hasta"
          onChange={(e) => onChange(lo, Math.max(Number(e.target.value), lo + paso))}
          className="absolute inset-0 w-full appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}
