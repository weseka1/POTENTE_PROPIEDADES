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

/**
 * Las TRES operaciones. Mateo, 14-ago-2026: «tienen que quedar 3 tipos de
 * operaciones: Venta, Alquiler, Temporada. Cada una con sus respectivas fichas».
 *
 * 🔴 `temporada` reemplaza a `arrendamiento` (que no usaba NINGUNA propiedad —
 * verificado contra la base antes de tocarlo). Y es una operación de verdad, no
 * una etiqueta: una propiedad de temporada es una FICHA PROPIA, independiente de
 * la de venta o alquiler. La razón la dio él y es la que manda el diseño:
 * «la ficha de temporada, cuando no es verano, la damos de baja» — si colgara de
 * la ficha de venta, no se podría dar de baja sin tocar la otra.
 *
 * Es un enum de Postgres (`potente_operacion`, migración 014): la base rechaza
 * cualquier otro valor, así que esta lista y la de la base no se pueden
 * desincronizar en silencio.
 */
export type OperacionProp = "venta" | "alquiler" | "temporada";

/* ── Vocabularios cerrados ────────────────────────────────────────────────────
   Son enums de Postgres, no texto libre: la base rechaza un valor inventado, así
   que el desplegable del panel y lo que acepta la base no se pueden
   desincronizar. Cada lista de acá tiene su `create type` en 005_ficha_completa.sql
   — si se toca una, se toca la otra. */

/** Los 5 estados que nombró Mateo (audio 7-ago). El orden es el del ciclo comercial. */
export type EstadoPropiedad = "activa" | "reservada" | "vendida" | "alquilada" | "suspendida";

/** Cómo se llama cada estado para el visitante. Vive acá y no en el panel porque
 *  lo usan los dos lados, y así el nombre que ve el cliente es uno solo. */
export const ESTADO_LABEL: Record<EstadoPropiedad, string> = {
  activa: "Disponible",       // al comprador se le dice "disponible", no "activa"
  reservada: "Reservada",
  vendida: "Vendida",
  alquilada: "Alquilada",
  suspendida: "No disponible",
};

/** Estados en los que la propiedad ya NO se ofrece: no cuentan como cartera
 *  vendible y no se le recomiendan a nadie. */
export const ESTADOS_CERRADOS: readonly EstadoPropiedad[] = ["vendida", "alquilada", "suspendida"];

/** ¿Se está ofreciendo hoy? Es el chequeo que reemplaza al viejo `=== "disponible"`. */
export const seOfrece = (e: EstadoPropiedad | undefined) => e === "activa" || e === "reservada";

/** Cómo está ubicada la unidad dentro del edificio o del lote. */
export type Disposicion = "frente" | "contrafrente" | "interno" | "lateral";

/** Los 8 puntos cardinales. */
export type Orientacion = "N" | "S" | "E" | "O" | "NE" | "NO" | "SE" | "SO";

export type TipoCochera = "cubierta" | "descubierta";

/** Cómo se LLEGA al lote. "mejorado" = tierra consolidada / ripio. */
export type TipoAcceso = "asfalto" | "tierra" | "mejorado";

/** Cómo se SUBE al departamento. */
export type AccesoEdificio = "escalera" | "ascensor";

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
  /**
   * De dónde salió el pin del mapa. Vive en `ficha` A PROPÓSITO: cero SQL, y la
   * vista pública descarta `ficha` — "este pin lo corrigió una persona" es
   * información interna que el visitante no necesita.
   *
   * La regla que protege: si `origen === "manual"`, ningún geocodificador
   * vuelve a pisar `lat`/`lng` NUNCA, salvo que se toque explícitamente
   * "Volver a buscar automática". Mateo corrigió el pin porque Google/georef se
   * equivocaban — pisárselo en la próxima edición sería repetir el error que
   * vino a arreglar.
   */
  ubicacion?: {
    origen: "auto" | "manual";
    /** Quién la encontró cuando fue automática (georef / nominatim). */
    fuente?: string;
    fecha?: string;
  };

  // ── Ficha CAMPO ──
  tipoCampo?: "agrícola" | "ganadero" | "mixto" | "monte";
  alambradoPerimetral?: "bueno" | "regular" | "malo";
  alambradoInterno?: "bueno" | "regular" | "malo";
  equipoRiego?: "pivote central" | "subterráneo" | "cañón";
  cancha?: string[]; // fútbol, básquet, tenis
  plantacion?: string[]; // olivos, almendras, nogales
  mejorasCampo?: string[]; // molinos, tanques, aguadas, casas, manga y corrales, etc.
  /** Ficha rural: el campo se vende o se arrienda. NO es la `operacion` de la
   *  propiedad (esa ahora es venta/alquiler/temporada) — es un dato interno del
   *  campo, y por eso vive en la ficha y no en la columna. */
  operacionCampo?: "venta" | "arrendamiento";
  /** 🪦 El nombre viejo de `operacionCampo`, antes de que "operación" pasara a
   *  significar venta/alquiler/temporada (14-ago). Las fichas rurales ya cargadas
   *  siguen teniendo la clave con este nombre adentro del jsonb, y NO se migró:
   *  hay una sola propiedad de categoría campo en toda la cartera, así que un
   *  UPDATE sobre jsonb en producción costaba más riesgo que valor.
   *  Se lee con `operacionCampo ?? operacion` allá donde se muestra; al guardar
   *  se escribe siempre el nombre nuevo. Cuando no queden fichas con la clave
   *  vieja, se borra este campo y los dos `??`. */
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
  // Los 5 estados que nombró Mateo (audio 7-ago). El enum de la base tiene
  // exactamente estos. "suspendida" = el dueño la levantó un tiempo: la ficha
  // está completa, simplemente no se ofrece.
  estado: EstadoPropiedad;
  // Interruptor TÉCNICO, distinto de `estado`: ¿la carga está terminada?
  // false/undefined = borrador (no sale en la web) · true = publicada.
  // Las dos cosas sacan la propiedad de la web, pero reactivar una suspendida es
  // un clic y no hay que volver a cargar nada.
  publicado?: boolean;
  destacado: boolean;
  esNuevo?: boolean;
  esOportunidad?: boolean;
  /** Cuándo se cargó (lo pone la base al insertar). Ordena "más recientes
   *  primero" en el catálogo y en Cartera — pedido Mateo 12-ago. En los seeds
   *  del modo demo no existe: el orden cae al del archivo, que está bien. */
  created_at?: string;
  // rural
  hectareas?: number;
  aptitud?: "agrícola" | "ganadera" | "mixta";
  // ── urbano ────────────────────────────────────────────────────────────────
  ambientes?: number;
  dormitorios?: number;
  banos?: number;
  /** CANTIDAD de cocheras. El "¿tiene cochera?" del formulario es `cocheras > 0`:
   *  no hay booleano aparte, para que no pueda quedar "tiene=sí, cantidad=0". */
  cocheras?: number;
  tipoCochera?: TipoCochera;

  // ── Superficies (audio 7-ago). Todas opcionales: "si no tengo el dato lo dejo
  //    en blanco y que ni se muestre". ──────────────────────────────────────
  m2cubiertos?: number;
  m2totales?: number;
  m2semicubiertos?: number;
  m2descubiertos?: number;

  // ── Departamentos (audio 7-ago) ───────────────────────────────────────────
  /** TEXTO, no número: en la realidad es "PB", "10°", "1 bis". */
  piso?: string;
  /** La letra o número de la unidad: "B", "3", "A bis". */
  depto?: string;
  disposicion?: Disposicion;
  orientacion?: Orientacion;
  /** Cómo se sube. NO confundir con `tipoAcceso`, que es cómo se llega al lote. */
  accesoEdificio?: AccesoEdificio;

  // ── Lotes y terrenos (audio 7-ago) ────────────────────────────────────────
  metrosFrente?: number;
  metrosFondo?: number;
  m2construibles?: number;
  tipoAcceso?: TipoAcceso;

  // ── Comunes (audio 7-ago) ─────────────────────────────────────────────────
  /** Años. 0 = a estrenar. */
  antiguedadAnios?: number;
  /** Expensas mensuales en PESOS. Se muestran abajo del precio, nunca sumadas. */
  expensasARS?: number | null;
  /** Apta para crédito hipotecario. Es un filtro real de compradores. */
  aptaCredito?: boolean;
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
