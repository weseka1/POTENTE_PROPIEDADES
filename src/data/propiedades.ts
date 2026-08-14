import { campos } from "./campos";
import { urbanas } from "./urbanas";
import type { Campo } from "./types";
import type { OperacionProp, Propiedad } from "./propiedadTypes";

/**
 * Con qué operación de la CARTERA se publica un campo.
 *
 * Hay que traducir porque son dos vocabularios distintos: un campo se ofrece en
 * "venta" o en "arrendamiento" —así lo dice la ficha de papel y así está tipado en
 * data/types.ts—, mientras que la cartera entera tiene exactamente TRES operaciones,
 * venta / alquiler / temporada, desde que las pidió Mateo el 14-ago-2026. Un campo
 * arrendado, para el que entra al catálogo, es un alquiler: filtrando por "alquiler"
 * lo tiene que encontrar, y no hay una cuarta opción donde esconderlo.
 *
 * Va tipado contra `Campo["operacion"]` a propósito: si mañana el vocabulario rural
 * suma un valor, esto deja de compilar hasta que alguien decida a qué operación de la
 * cartera corresponde. Un `as` acá enterraría esa decisión en silencio.
 */
const OPERACION_PUBLICADA: Record<Campo["operacion"], OperacionProp> = {
  venta: "venta",
  arrendamiento: "alquiler",
};

// Los campos (data/campos.ts) se adaptan al modelo unificado y se combinan con las urbanas.
const camposComoPropiedad: Propiedad[] = campos.map((c) => ({
  id: c.id,
  categoria: "campo",
  titulo: c.titulo,
  operacion: OPERACION_PUBLICADA[c.operacion],
  precioUSD: c.precioUSD,
  precioPorHa: c.precioPorHa,
  zona: c.zona,
  provincia: c.provincia,
  fotos: c.fotos,
  descripcion: c.descripcion,
  estado: c.estado,
  destacado: c.destacado,
  hectareas: c.hectareas,
  aptitud: c.aptitud,
  caracteristicas: c.mejoras,
  lat: c.lat,
  lng: c.lng,
  // El matiz rural no se tira en la traducción de arriba. "Venta o arrendamiento" es
  // un dato de la ficha del campo, así que se conserva donde corresponde: en la ficha.
  // Si se perdiera, un campo arrendado quedaría con la ficha muda y lo único legible
  // sería el "alquiler" de la publicación — que es cómo se muestra, no lo que se firma.
  ficha: { operacionCampo: c.operacion },
}));

export const propiedades: Propiedad[] = [...camposComoPropiedad, ...urbanas];

export const getPropiedad = (id: string) => propiedades.find((p) => p.id === id);
export const propiedadesDestacadas = propiedades.filter((p) => p.destacado);

export const contarPorCategoria = (cat: string) =>
  propiedades.filter((p) => p.categoria === cat).length;
