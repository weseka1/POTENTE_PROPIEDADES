// ===== Modelo unificado de propiedad (público) =====
// La inmobiliaria opera campos Y urbano (casas, deptos, lotes, terrenos, locales).
// Los `campos` (data/campos.ts) se adaptan a este modelo y se suman a las urbanas.

export type Categoria =
  | "campo"
  | "casa"
  | "departamento"
  | "lote"
  | "terreno"
  | "local";

export type OperacionProp = "venta" | "alquiler" | "arrendamiento";

// ===== Ficha completa (réplica digital de la ficha de papel de Potente Propiedades) =====
// Se guarda como JSONB en potente_propiedades.ficha. Todo opcional: el form llena
// el subconjunto según sea campo o urbano.
export interface Ficha {
  // ── Comunes a ambas fichas ──
  autorizacionVenta?: boolean;
  cartel?: boolean;
  aptaCredito?: boolean;
  llaves?: boolean;
  propietario?: string;
  contacto?: string;
  captador?: string;
  observaciones?: string;
  planos?: string[]; // planos del campo / de la propiedad (URLs subidas)
  fecha?: string; // fecha de la ficha / autorización
  precioUSD?: number | null; // vacío/null = A consultar

  // ── Ficha CAMPO ──
  tipoCampo?: "agrícola" | "ganadero" | "mixto" | "monte";
  alambradoPerimetral?: "bueno" | "regular" | "malo";
  alambradoInterno?: "bueno" | "regular" | "malo";
  equipoRiego?: "pivote central" | "subterráneo" | "cañón";
  cancha?: string[]; // fútbol, básquet, tenis
  plantacion?: string[]; // olivos, almendras, nogales
  mejorasCampo?: string[]; // molinos, tanques, aguadas, casas, manga y corrales, etc.
  operacion?: "venta" | "arrendamiento";
  hectareas?: number;

  // ── Ficha URBANA ──
  piso?: string;
  depto?: string;
  barrio?: string;
  ciudad?: string;
  orientacion?: "frente" | "contrafrente";
  acceso?: "escalera" | "ascensor";
  servicios?: string[]; // luz, agua, gas, cloacas, asfalto
  superficieLote?: number;
  superficieSemicubierta?: number;
  dimensiones?: string;
  antiguedad?: string;
  estadoGeneral?: string;
  mejorasUrbanas?: string[]; // quincho, pileta, cochera, amenities, etc.
  subtipo?: string; // casa, departamento, local, oficina, lote, cochera, galpón, dúplex, complejo, fondo de comercio
  direccion?: string;
  superficieCubierta?: number;
  dormitorios?: number;
  banos?: number;
}

export interface Propiedad {
  id: string;
  categoria: Categoria;
  titulo: string;
  operacion: OperacionProp;
  precioUSD: number | null; // null = "Consultar"
  // Los alquileres se publican en pesos (así opera Potente hoy). Si está seteado,
  // el precio que se muestra es este; precioUSD queda en null.
  precioARS?: number | null;
  precioPorHa?: number | null;
  zona: string;
  provincia: string;
  direccion?: string;
  fotos: string[];
  descripcion: string;
  estado: "disponible" | "reservado" | "vendido";
  publicado?: boolean; // false/undefined = borrador (ficha interna, no sale en la web); true = publicada
  destacado: boolean;
  esNuevo?: boolean;
  esOportunidad?: boolean;
  // rural
  hectareas?: number;
  aptitud?: "agrícola" | "ganadera" | "mixta";
  // urbano
  ambientes?: number;
  dormitorios?: number;
  banos?: number;
  cocheras?: number;
  m2cubiertos?: number;
  m2totales?: number;
  // común
  caracteristicas: string[];
  video?: string;
  lat?: number;
  lng?: number;
  // ficha completa estilo papel (campo / urbano)
  ficha?: Ficha;
}

export const CATEGORIAS: { key: Categoria; label: string; plural: string }[] = [
  { key: "casa", label: "Casa", plural: "Casas" },
  { key: "departamento", label: "Departamento", plural: "Departamentos" },
  { key: "local", label: "Local", plural: "Locales" },
  { key: "lote", label: "Lote", plural: "Lotes" },
  { key: "terreno", label: "Terreno", plural: "Terrenos" },
  { key: "campo", label: "Campo", plural: "Campos" },
];
