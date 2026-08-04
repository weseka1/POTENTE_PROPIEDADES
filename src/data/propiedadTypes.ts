// ===== Modelo unificado de propiedad (público) =====
// La inmobiliaria opera campos Y urbano (casas, deptos, lotes, terrenos, locales).
// Los `campos` (data/campos.ts) se adaptan a este modelo y se suman a las urbanas.

export type Categoria =
  | "campo"
  | "casa"
  | "casaquinta"
  | "chacra"
  | "chalet"
  | "cochera"
  | "consultorio"
  | "departamento"
  | "deposito"
  | "duplex"
  | "edificio"
  | "fondocomercio"
  | "galpon"
  | "hotel"
  | "local"
  | "oficina"
  | "ph"
  | "lote"
  | "terreno";

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
  disposicion?: "frente" | "contrafrente" | "interno" | "lateral";
  orientacion?: "N" | "S" | "E" | "O" | "NE" | "NO" | "SE" | "SO";
  metrosFrente?: number;
  metrosFondo?: number;
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
  // multi-oficina: quién la vende. Sin oficina = central (Mateo).
  oficina?: "chauvin" | "puntamogotes";
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
  { key: "chalet", label: "Chalet", plural: "Chalets" },
  { key: "casaquinta", label: "Casa quinta", plural: "Casas quinta" },
  { key: "departamento", label: "Departamento", plural: "Departamentos" },
  { key: "ph", label: "PH", plural: "PHs" },
  { key: "duplex", label: "Dúplex", plural: "Dúplex" },
  { key: "local", label: "Local comercial", plural: "Locales" },
  { key: "oficina", label: "Oficina", plural: "Oficinas" },
  { key: "consultorio", label: "Consultorio", plural: "Consultorios" },
  { key: "cochera", label: "Cochera", plural: "Cocheras" },
  { key: "deposito", label: "Depósito", plural: "Depósitos" },
  { key: "galpon", label: "Galpón", plural: "Galpones" },
  { key: "edificio", label: "Edificio", plural: "Edificios" },
  { key: "hotel", label: "Hotel", plural: "Hoteles" },
  { key: "fondocomercio", label: "Fondo de comercio", plural: "Fondos de comercio" },
  { key: "lote", label: "Lote", plural: "Lotes" },
  { key: "terreno", label: "Terreno", plural: "Terrenos" },
  { key: "chacra", label: "Chacra", plural: "Chacras" },
  { key: "campo", label: "Campo", plural: "Campos" },
];
