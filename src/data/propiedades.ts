import { campos } from "./campos";
import { urbanas } from "./urbanas";
import type { Propiedad } from "./propiedadTypes";

// Los campos (data/campos.ts) se adaptan al modelo unificado y se combinan con las urbanas.
const camposComoPropiedad: Propiedad[] = campos.map((c) => ({
  id: c.id,
  categoria: "campo",
  titulo: c.titulo,
  operacion: c.operacion,
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
}));

export const propiedades: Propiedad[] = [...camposComoPropiedad, ...urbanas];

export const getPropiedad = (id: string) => propiedades.find((p) => p.id === id);
export const propiedadesDestacadas = propiedades.filter((p) => p.destacado);

export const contarPorCategoria = (cat: string) =>
  propiedades.filter((p) => p.categoria === cat).length;
