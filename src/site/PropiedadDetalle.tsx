import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, MapPin, Maximize, Sprout, Tag, CheckCircle2, Phone, Heart, Sun,
  BedDouble, Bath, Car, Ruler, Home as HomeIcon, PlayCircle, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PropiedadCard from "./components/PropiedadCard";
import GaleriaPropiedad from "./components/GaleriaPropiedad";
import MapaPropiedad from "./components/MapaPropiedad";
import OrientacionYSol from "./components/OrientacionYSol";
import { useLenis } from "./lib/useLenis";
import { useSEO, jsonLdPropiedad } from "./lib/seo";
import { useData } from "@/lib/DataProvider";
import { precioPublico, fmtARS } from "@/lib/format";
import { datosPublicos } from "@/data/esquemaPropiedad";
import { ESTADO_LABEL, type EstadoPropiedad, type OperacionProp } from "@/data/propiedadTypes";
import { useFavorites } from "./context/FavoritesContext";
import { esVideoArchivo, useVideoUrl } from "@/lib/videoStore";

import { waDigits, OFICINAS } from "@/config/marca";

const WA = waDigits();
// Cómo se nombra cada operación en la ficha (el badge sobre la foto, la línea de
// datos y el bloque de precio: los tres leen de acá).
// ⚠️ Va tipado por OperacionProp y NO por `Record<string, …>`, que es lo que era
// hasta el 14-ago. Con `string` el compilador no exige las tres, y una operación
// sin entrada devuelve undefined → el badge sale VACÍO en la ficha pública. Es
// exactamente lo que pasó con `arrendamiento`: quedó acá meses después de que
// ninguna propiedad lo usara, y nadie se enteró porque nada lo reclamaba. Misma
// regla que `estadoCampo` en panel/ui/estados.ts (donde casi cuesta una pantalla
// blanca en la Cartera).
// Mateo, 14-ago-2026: «tienen que quedar 3 tipos de operaciones: Venta, Alquiler,
// Temporada». Si mañana aparece una cuarta, TypeScript la pide acá antes de que
// llegue a la web.
const opLabel: Record<OperacionProp, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  temporada: "Temporada",
};
// El color de cada estado. El NOMBRE sale de ESTADO_LABEL (propiedadTypes), que
// es la misma fuente que usa la tarjeta del catálogo: al comprador se le dice
// "Disponible", no "Activa".
const estadoBadge: Record<EstadoPropiedad, string> = {
  activa: "bg-brand/10 text-brand-700",
  reservada: "bg-amber-100 text-amber-800",
  vendida: "bg-graph/10 text-graph-600",
  alquilada: "bg-sky-100 text-sky-800",
  suspendida: "bg-graph/10 text-graph-500",
};
const NO_IMG = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='300'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23e7e8e3'/%3E%3C/svg%3E";

export default function PropiedadDetalle() {
  useLenis();
  const { id } = useParams();
  const { getProp, propiedades, unidadesTemporada } = useData();
  const p = getProp(id || "");
  // La galería maneja su propio estado (ver components/GaleriaPropiedad).
  const { esFavorito, toggle } = useFavorites();
  // Video subido como archivo → reproductor embebido. En modo demo (idb:) el
  // archivo vive en el navegador que lo cargó; si acá no está, la sección se oculta.
  const videoUrl = useVideoUrl(p?.video);

  // SEO por propiedad: título, descripción y aviso estructurado (RealEstateListing)
  useSEO({
    titulo: p ? `${p.titulo} · ${p.zona}, Mar del Plata | Potente Propiedades` : "Propiedad · Potente Propiedades",
    descripcion: p ? p.descripcion.slice(0, 155) : undefined,
    path: p ? `/propiedad/${encodeURIComponent(p.id)}` : undefined,
    jsonLd: p
      ? jsonLdPropiedad({
          id: p.id,
          titulo: p.titulo,
          descripcion: p.descripcion,
          zona: p.zona,
          precioUSD: p.precioUSD,
          precioARS: p.precioARS,
          operacion: p.operacion,
          fotos: p.fotos ?? [],
          m2totales: p.m2totales,
          dormitorios: p.dormitorios,
        })
      : null,
  });

  if (!p) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper text-graph">
        <div className="text-center">
          <p className="font-display text-3xl">Propiedad no encontrada</p>
          <Link to="/propiedades" className="btn-primary mt-6">Ver el catálogo</Link>
        </div>
      </div>
    );
  }

  const fav = esFavorito(p.id);
  const fotos = p.fotos?.length ? p.fotos : [NO_IMG];
  const caracs = p.caracteristicas ?? [];
  // 🏖️ ¿Esta propiedad se ofrece en temporada? La unidad se apoya en la
  // propiedad (`propiedadId`), así que desde la ficha se llega sola.
  // ⚠️ SIN useMemo a propósito: acá arriba hay un `return` temprano (propiedad
  // no encontrada) y un hook después de un return rompe el orden de hooks de
  // React. Es un `find` sobre una lista corta: no necesita memo.
  // ⚠️ Acá NO se calcula ninguna tarifa: la ficha dice "A consultar" y el
  // visitante ni siquiera recibe la columna `tarifas`. Calcularla igual fue el
  // bug del 13-ago — `tarifaDesde` recibía undefined y tiraba abajo la ficha
  // entera. Si no se muestra, no se calcula.
  /* 🔴 14-ago · La condición lleva `p.operacion === "temporada"` y NO es de más:
   * es la MISMA regla que `unidadesPublicables()` usa en /temporada. Sin ella,
   * cualquier ficha EN VENTA que arrastre una unidad vieja (todas las que se
   * crearon con el flujo anterior, donde había que elegir una propiedad ya
   * cargada) anunciaría "Alquiler de temporada" en una propiedad que no está en
   * /temporada y que la oficina no ofrece. Las tres páginas deciden igual o el
   * sitio se contradice solo. */
  const esTemporada = p.operacion === "temporada";
  const unidadTemp = unidadesTemporada.find((u) => u.propiedadId === p.id && u.activa && esTemporada);

  /* "Similares" compara también la OPERACIÓN, no solo la categoría. Antes un
   * departamento en venta ofrecía como similar uno en alquiler — molesto pero
   * tolerable. Con temporada adentro pasa a ser engañoso: al que mira para
   * comprar se le ofrece algo que solo se alquila quince días, sin precio. */
  const similares = propiedades
    .filter((x) => x.id !== p.id && x.categoria === p.categoria && x.operacion === p.operacion)
    .slice(0, 3);
  const waMsg = encodeURIComponent(`Hola Potente Propiedades, me interesa "${p.titulo}" (${p.id}). ¿Me pasan más información?`);
  // Cada consulta va al WhatsApp de la oficina que vende la propiedad (sin oficina → central).
  // 🔴 17-ago · En TEMPORADA manda la oficina de la UNIDAD (la que administra el
  // temporario), igual que el CTA del bloque de temporada. Sin esto, una ficha de
  // temporada sin oficina caía al número central — el WhatsApp personal de Mateo.
  // Audio textual: «manda a mi whatsapp personal… cambiar eso para que mande
  // directamente al WhatsApp de Mogotes». Los DOS botones de la ficha tienen que
  // marcar el mismo número: el visitante no distingue cuál tocó.
  const waProp = waDigits((esTemporada ? unidadTemp?.oficina : undefined) ?? p.oficina);
  // El pie de contacto sale del MISMO dato que el botón de WhatsApp: si la
  // propiedad es de una oficina, se muestra solo esa; si es central, las dos.
  const oficinaDeLaFicha = (esTemporada ? unidadTemp?.oficina : undefined) ?? p.oficina;
  const oficinasAMostrar = OFICINAS.filter((o) => o.id === oficinaDeLaFicha);
  if (oficinasAMostrar.length === 0) oficinasAMostrar.push(...OFICINAS);

  // Los datos salen del esquema (src/data/esquemaPropiedad.ts), que decide qué
  // pide cada tipo de propiedad y qué cuenta como "vacío". Pedido textual de
  // Mateo: "si no tengo el dato lo dejo en blanco y que ni se muestre".
  // Antes esto era un `if` por campo; con quince campos nuevos serían quince
  // lugares donde olvidarse de uno.
  const datos: { icon: any; l: string; v: string }[] = datosPublicos(p).map(({ campo, valor }) => ({
    icon: campo.icono,
    l: campo.label,
    v: valor,
  }));
  if (p.categoria === "campo" && p.aptitud) datos.push({ icon: Sprout, l: "Aptitud", v: p.aptitud });
  datos.push({ icon: Tag, l: "Operación", v: opLabel[p.operacion] });
  datos.push({ icon: MapPin, l: "Ubicación", v: p.direccion || `${p.zona}, ${p.provincia}` });

  return (
    <div className="min-h-screen bg-paper text-graph">
      <div className="grain" />
      <Navbar variant="solid" />

      <div className="container-x pt-28">
        <Link to="/propiedades" className="inline-flex items-center gap-2 text-sm text-graph-500 transition hover:text-brand">
          <ArrowLeft size={16} /> Volver al catálogo
        </Link>
      </div>

      {/* Galería: se desliza siguiendo el dedo, con resistencia en los extremos y
          apertura a pantalla completa. El ancho se limita para que el 4:3 no quede
          desmesurado en pantallas grandes (ver components/GaleriaPropiedad). */}
      <section className="container-x mt-6 max-w-[900px]">
        <GaleriaPropiedad
          fotos={fotos}
          titulo={p.titulo}
          favorito={fav}
          onToggleFavorito={() => toggle(p.id)}
        />
      </section>

      <section className="container-x mt-12 grid gap-12 pb-12 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">{opLabel[p.operacion]}</span>
            <span className="rounded-full border border-graph/20 px-3 py-1 text-xs font-medium capitalize text-graph-500">{p.categoria}</span>
            {p.estado !== "activa" && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estadoBadge[p.estado]}`}>{ESTADO_LABEL[p.estado]}</span>}
            {/* 🏖️ «que diría temporada» (Mateo, 13-ago). Una propiedad puede
                estar en venta Y ofrecerse en temporada: el sello no reemplaza a
                la operación, se suma. */}
            {unidadTemp && (
              <span className="flex items-center gap-1 rounded-full bg-sea px-3 py-1 text-xs font-semibold text-white">
                <Sun size={13} /> Temporada 2027
              </span>
            )}
            {p.esNuevo && <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase text-white">Nuevo</span>}
            {p.esOportunidad && <span className="rounded-full bg-clay px-3 py-1 text-xs font-bold uppercase text-white">Oportunidad</span>}
          </div>

          <h1 className="mt-5 font-display text-3xl font-medium tracking-tight leading-tight text-graph md:text-4xl">{p.titulo}</h1>
          <p className="mt-3 flex items-center gap-2 text-graph-500">
            <MapPin size={18} className="text-brand" /> {p.direccion && p.direccion.toLowerCase() !== p.zona.toLowerCase() ? `${p.direccion} · ` : ""}{p.zona}, {p.provincia}
          </p>

          {/* La grilla de datos. El `data-datos` lo usa e2e/ficha-sin-vacios.mjs
              para mirar SOLO esta sección: la palabra "baños" aparece igual más
              abajo, en las propiedades similares, y sin esto la prueba de "los
              campos vacíos no se muestran" daba un falso positivo.

              📱 DOS COLUMNAS TAMBIÉN EN EL CELULAR (pedido de Juani, 11-ago:
              "te aburre bajar tanto"). Antes era una columna de celdas enormes:
              con 10 datos, la lista sola medía más de dos pantallas. */}
          <div
            data-datos="propiedad"
            className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-graph/10 lg:grid-cols-3"
          >
            {datos.map((d, i) => (
              <div key={i} className="bg-paper-100 p-3.5 sm:p-5">
                {/* La etiqueta baja a dos líneas si no entra ("Superficie
                    cubierta"): truncarla dejaba "SUPERFICIE CU…", que parece
                    un error en vez de un dato. */}
                <span className="flex items-start gap-1.5 text-[10px] uppercase leading-snug tracking-widest2 text-graph-400 sm:gap-2 sm:text-xs">
                  <d.icon size={14} className="mt-px shrink-0 text-brand" /> <span>{d.l}</span>
                </span>
                <p className="mt-1.5 font-display text-base capitalize text-graph sm:mt-2 sm:text-lg">{d.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="font-display text-2xl text-graph">Descripción</h2>
            {/* La descripción entera son varias pantallas de scroll en el celular.
                Se muestra el arranque y el resto se abre a pedido: la página
                queda corta y el que quiere leer todo, lee todo. */}
            <VerMasTexto texto={p.descripcion} />
          </div>

          {p.video && (esVideoArchivo(p.video) ? videoUrl : true) && (
            <div className="mt-10">
              <h2 className="font-display text-2xl text-graph">Video</h2>
              {esVideoArchivo(p.video) && videoUrl ? (
                <video src={videoUrl} controls playsInline preload="metadata" className="mt-4 w-full rounded-2xl ring-1 ring-graph/10" />
              ) : (
                <a href={p.video} target="_blank" rel="noreferrer" className="btn-ghost mt-4 inline-flex w-auto">
                  <PlayCircle size={18} /> Ver video de la propiedad
                </a>
              )}
            </div>
          )}

          {caracs.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display text-2xl text-graph">Características</h2>
              {/* 📱 Plegadas: quince características en una columna eran otra
                  pantalla y media de scroll. Se muestran las primeras y el resto
                  se abre a pedido, con la banda de contraste atrás para que las
                  tarjetas blancas respiren (la referencia que pasó Juani). */}
              <CaracteristicasPlegadas items={caracs} />
            </div>
          )}

          {p.lat && p.lng && (
            <MapaPropiedad
              lat={p.lat}
              lng={p.lng}
              direccion={p.direccion}
              zona={p.zona}
              titulo={p.titulo}
            />
          )}

          {/* Cuándo recibe sol. Con coordenadas ya muestra la salida/puesta y las
              horas de luz del lugar (verdad pura); cuando la inmobiliaria carga
              hacia dónde da el frente (la brújula del panel), la misma sección se
              completa sola con la franja de sol directo. Nunca se inventa. */}
          {p.lat && p.lng && (
            <OrientacionYSol lat={p.lat} lng={p.lng} orientacion={p.orientacion} />
          )}
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-graph/10 bg-paper-100 p-7 shadow-card">
            <p className="text-xs uppercase tracking-widest2 text-graph-400">{opLabel[p.operacion]}</p>
            {/* 🔴 14-ago · UNA FICHA DE TEMPORADA NO PUBLICA PRECIO — la regla vive
                en `precioPublico()` (src/lib/format.ts), que es por dónde pasa TODO
                lo que se le pinta al visitante. Acá antes se llamaba a `fmtPrecio`,
                que devuelve el número sin mirar la operación: una ficha que pasó de
                alquiler a temporada arrastraba su precio MENSUAL y lo publicaba como
                si fuera la tarifa de la temporada. Sacarle el dato a la base
                (migración 013) y dejar que el front lo muestre igual era hacer la
                mitad del trabajo. */}
            <p className="mt-2 font-display text-4xl font-semibold text-brand">
              {precioPublico(p)}
            </p>
            {p.operacion === "alquiler" && (p.precioARS || p.precioUSD) && (
              <p className="mt-1 text-sm text-graph-400">por mes</p>
            )}
            {/* Las expensas, pegadas al precio. Pedido textual de Mateo: "un lugar
                para poner el valor de las expensas, y que se muestre junto al
                precio o abajo del precio".
                SIEMPRE en pesos y NUNCA sumadas al precio: mezclar monedas sería
                mentir, y el sistema no tiene cotización del dólar. */}
            {/* En temporada tampoco: al que alquila quince días no se le cobran
                expensas aparte, así que mostrarlas al lado de "A consultar" sería
                anunciar un costo que no existe. */}
            {Boolean(p.expensasARS) && !esTemporada && (
              <p className="mt-1.5 text-sm font-medium text-graph-500">
                + {fmtARS(p.expensasARS as number)} de expensas
              </p>
            )}

            {/* 🏖️ TEMPORADA — «con los datos de temporada, precio de temporada»
                (Mateo, 13-ago). Va en su propio bloque y NUNCA mezclado con el
                precio de venta: son dos cosas distintas, en dos monedas
                distintas, y sumarlas o pisarlas sería mentir.
                La consulta sale al WhatsApp de la oficina que administra la
                unidad, no al central. */}
            {unidadTemp && (
              <div className="mt-6 rounded-xl border border-sea/30 bg-sea/[0.06] p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest2 text-sea">
                  <Sun size={14} /> Alquiler de temporada
                </p>
                {/* Sin precio ni "desde": la tarifa de temporada no se publica
                    (Mateo, 13-ago). Se cotiza por WhatsApp según las fechas.
                    El "A consultar" grande ya está arriba, en el lugar del precio:
                    repetirlo acá era decir dos veces lo mismo en la misma tarjeta. */}
                {/* 🔴 18-ago (audios de Mateo): ni "Por quincena" —la consulta
                    puede ser por dos días, una semana o lo que pidan— ni una
                    capacidad INVENTADA: «ese número de personas se lo doy yo».
                    capacidad 0 = no la cargó → no se promete cupo.
                    Y acá NO va botón: el "Consultar la temporada" duplicaba al
                    WhatsApp de abajo («me parece como mucho dos botones
                    iguales»), que ya rutea a la oficina de la unidad. */}
                {unidadTemp.capacidad > 0 && (
                  <p className="mt-2 text-sm text-graph-500">
                    Hasta {unidadTemp.capacidad} personas
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <a href={`https://wa.me/${waProp}?text=${waMsg}`} target="_blank" rel="noreferrer" className="btn-primary w-full">
                <Phone size={16} /> Consultar por WhatsApp
              </a>
              <button onClick={() => toggle(p.id)} className={`flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-semibold transition ${fav ? "border-brand bg-brand-50 text-brand" : "border-graph/20 text-graph-500 hover:border-brand hover:text-brand"}`}>
                <Heart size={15} fill={fav ? "currentColor" : "none"} /> {fav ? "En favoritos" : "Guardar en favoritos"}
              </button>
            </div>

            {/* 🔴 LA OFICINA QUE ATIENDE ESTA PROPIEDAD, NO LAS DOS (21-ago).
                Pedido de Mateo: la ficha listaba las dos sucursales, así que un
                interesado por una propiedad de Chauvín podía llamar a Mogotes
                —y al revés—. Cada ficha ya sabe de qué oficina es: se usa
                EXACTAMENTE el mismo criterio que rutea el botón de WhatsApp
                (`waProp`, arriba), para que el teléfono del botón y el del pie
                no puedan contradecirse nunca.
                Si la propiedad no tiene oficina asignada (las centrales, que
                atiende Mateo) se muestran las dos: es la única forma honesta
                de no mandar al visitante a una sucursal que no la tiene. */}
            <div className="mt-6 border-t border-graph/10 pt-6 text-sm text-graph-500">
              <p className="font-medium text-graph">Potente Propiedades</p>
              {oficinasAMostrar.map((o) => (
                <p key={o.id} className="mt-1">
                  {o.direccion} ({o.nombre}) · {o.telefono} · {o.horario}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {similares.length > 0 && (
        <section className="border-t border-graph/10 py-20">
          <div className="container-x">
            <h2 className="mb-10 font-display text-3xl font-medium tracking-tight text-graph">Propiedades similares</h2>
            <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {similares.map((x) => (
                <PropiedadCard key={x.id} p={x} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}

/* ── "Ver más" de la descripción ──────────────────────────────────────────────
   📱 Pedido de Juani (11-ago): "la web debe ser corta, pero se debe poder
   ampliar... te aburre bajar tanto". La descripción entera son 3-4 pantallas en
   el celular; acá se muestran las primeras líneas y el resto se abre a pedido.
   El recorte va por CSS (line-clamp), así el texto completo queda igual en el
   HTML: Google lo lee entero aunque el visitante vea el resumen. */
function VerMasTexto({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  // Corto no se recorta: un "Ver más" que muestra dos renglones es un chiste.
  const esLargo = texto.length > 420;

  return (
    <div>
      <p
        className="mt-4 whitespace-pre-line text-lg leading-relaxed text-graph-500"
        style={!abierto && esLargo ? { display: "-webkit-box", WebkitLineClamp: 7, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}
      >
        {texto}
      </p>
      {esLargo && (
        <button
          onClick={() => setAbierto((v) => !v)}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/70 px-5 text-sm font-semibold text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-graph/10 backdrop-blur transition hover:ring-brand/40"
        >
          {abierto ? "Ver menos" : "Leer la descripción completa"}
          <ChevronDown size={16} className={`transition-transform duration-300 ${abierto ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

/* ── Características plegadas ─────────────────────────────────────────────────
   Dos columnas SIEMPRE (antes en el celular era una columna de 15 renglones) y
   lo que pasa de 8 se abre a pedido. La apertura anima con grid-template-rows:
   suave, sin medir alturas y sin tocar el layout del resto de la página. */
const CARACTERISTICAS_VISIBLES = 8;

function CaracteristicasPlegadas({ items }: { items: string[] }) {
  const [abierto, setAbierto] = useState(false);
  const primeras = items.slice(0, CARACTERISTICAS_VISIBLES);
  const resto = items.slice(CARACTERISTICAS_VISIBLES);

  const Chip = ({ texto }: { texto: string }) => (
    <li className="flex items-center gap-2 rounded-xl bg-paper-100 px-3 py-2.5 text-sm text-graph-500 shadow-[0_1px_2px_rgba(13,21,33,0.04)] sm:gap-3 sm:px-4 sm:py-3 sm:text-base">
      <CheckCircle2 size={16} className="shrink-0 text-brand" /> <span className="min-w-0">{texto}</span>
    </li>
  );

  return (
    // La banda de contraste: las tarjetas blancas sobre un fondo apenas más
    // oscuro (la receta de la referencia que pasó Juani, en la paleta de Potente).
    <div className="mt-5 rounded-3xl bg-paper-200/60 p-3 sm:p-4">
      <ul className="grid grid-cols-2 gap-2 sm:gap-3">
        {primeras.map((m) => <Chip key={m} texto={m} />)}
      </ul>

      {resto.length > 0 && (
        <>
          <div
            className="grid transition-[grid-template-rows] duration-500"
            style={{ gridTemplateRows: abierto ? "1fr" : "0fr", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <div className="overflow-hidden">
              <ul className="grid grid-cols-2 gap-2 pt-2 sm:gap-3 sm:pt-3">
                {resto.map((m) => <Chip key={m} texto={m} />)}
              </ul>
            </div>
          </div>

          <button
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-white/70 text-sm font-semibold text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-graph/10 backdrop-blur transition hover:ring-brand/40"
          >
            {abierto ? "Ver menos" : `Ver las ${items.length} características`}
            <ChevronDown size={16} className={`transition-transform duration-300 ${abierto ? "rotate-180" : ""}`} />
          </button>
        </>
      )}
    </div>
  );
}
