import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, MapPin, Maximize, Sprout, Tag, CheckCircle2, Phone, Heart,
  BedDouble, Bath, Car, Ruler, Home as HomeIcon, PlayCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PropiedadCard from "./components/PropiedadCard";
import GaleriaPropiedad from "./components/GaleriaPropiedad";
import MapaPropiedad from "./components/MapaPropiedad";
import { useLenis } from "./lib/useLenis";
import { useSEO, jsonLdPropiedad } from "./lib/seo";
import { useData } from "@/lib/DataProvider";
import { fmtPrecio, fmtARS } from "@/lib/format";
import { datosPublicos } from "@/data/esquemaPropiedad";
import { ESTADO_LABEL, type EstadoPropiedad } from "@/data/propiedadTypes";
import { useFavorites } from "./context/FavoritesContext";
import { esVideoArchivo, useVideoUrl } from "@/lib/videoStore";

import { waDigits, OFICINAS } from "@/config/marca";

const WA = waDigits();
const opLabel: Record<string, string> = { venta: "Venta", alquiler: "Alquiler", arrendamiento: "Arrendamiento" };
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
  const { getProp, propiedades } = useData();
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
  const similares = propiedades.filter((x) => x.id !== p.id && x.categoria === p.categoria).slice(0, 3);
  const waMsg = encodeURIComponent(`Hola Potente Propiedades, me interesa "${p.titulo}" (${p.id}). ¿Me pasan más información?`);
  // Cada consulta va al WhatsApp de la oficina que vende la propiedad (sin oficina → central).
  const waProp = waDigits(p.oficina);

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
              campos vacíos no se muestran" daba un falso positivo. */}
          <div
            data-datos="propiedad"
            className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-graph/10 sm:grid-cols-2 lg:grid-cols-3"
          >
            {datos.map((d, i) => (
              <div key={i} className="bg-paper-100 p-5">
                <span className="flex items-center gap-2 text-xs uppercase tracking-widest2 text-graph-400">
                  <d.icon size={15} className="text-brand" /> {d.l}
                </span>
                <p className="mt-2 font-display text-lg capitalize text-graph">{d.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="font-display text-2xl text-graph">Descripción</h2>
            <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-graph-500">{p.descripcion}</p>
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
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {caracs.map((m) => (
                  <li key={m} className="flex items-center gap-3 rounded-xl bg-paper-100 px-4 py-3 text-graph-500">
                    <CheckCircle2 size={18} className="text-brand" /> {m}
                  </li>
                ))}
              </ul>
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
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-graph/10 bg-paper-100 p-7 shadow-card">
            <p className="text-xs uppercase tracking-widest2 text-graph-400">{opLabel[p.operacion]}</p>
            <p className="mt-2 font-display text-4xl font-semibold text-brand">{fmtPrecio(p)}</p>
            {p.operacion === "alquiler" && (p.precioARS || p.precioUSD) && (
              <p className="mt-1 text-sm text-graph-400">por mes</p>
            )}
            {/* Las expensas, pegadas al precio. Pedido textual de Mateo: "un lugar
                para poner el valor de las expensas, y que se muestre junto al
                precio o abajo del precio".
                SIEMPRE en pesos y NUNCA sumadas al precio: mezclar monedas sería
                mentir, y el sistema no tiene cotización del dólar. */}
            {Boolean(p.expensasARS) && (
              <p className="mt-1.5 text-sm font-medium text-graph-500">
                + {fmtARS(p.expensasARS as number)} de expensas
              </p>
            )}

            <div className="mt-6 space-y-3">
              <a href={`https://wa.me/${waProp}?text=${waMsg}`} target="_blank" rel="noreferrer" className="btn-primary w-full">
                <Phone size={16} /> Consultar por WhatsApp
              </a>
              <button onClick={() => toggle(p.id)} className={`flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-semibold transition ${fav ? "border-brand bg-brand-50 text-brand" : "border-graph/20 text-graph-500 hover:border-brand hover:text-brand"}`}>
                <Heart size={15} fill={fav ? "currentColor" : "none"} /> {fav ? "En favoritos" : "Guardar en favoritos"}
              </button>
            </div>

            <div className="mt-6 border-t border-graph/10 pt-6 text-sm text-graph-500">
              <p className="font-medium text-graph">Potente Propiedades</p>
              {OFICINAS.map((o) => (
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
