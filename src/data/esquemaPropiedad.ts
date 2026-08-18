// ── Qué datos pide cada tipo de propiedad ────────────────────────────────────
//
// De dónde sale: los audios de Mateo del 7-ago-2026. Textual:
//   "si es departamento que me pida piso, departamento, disposición y la
//    orientación… después en los lotes, cuando quiero cargar un terreno o un lote
//    que me pida metros de frente, metros de fondo, superficie total, el tipo de
//    acceso —si es por asfalto, si es por tierra— y la superficie construible."
//
// POR QUÉ ESTE ARCHIVO EXISTE
// El formulario ramificaba con `const esCampo = f.categoria === "campo"`, y ese
// booleano decidía cinco bloques distintos más un `delete ficha.X` a mano de doce
// líneas. Sumar departamento y lote por el mismo camino eran tres booleanos, ocho
// bloques y treinta `delete`… y después repetir la misma lógica en la ficha
// pública, en la tarjeta del catálogo, en el drawer y en el PDF. Cinco lugares
// donde olvidarse de uno.
//
// Acá cada campo se declara UNA vez y lo consumen todos. Agregar un campo nuevo
// es una línea, no una recorrida por el código.
//
// ⚠️ Los `id` son nombres de columna de `potente_propiedades` (ver
// 005_ficha_completa.sql). Van tipados como `keyof Propiedad`, así que un typo es
// un error de compilación y no un campo que no guarda nada.

import type { LucideIcon } from "lucide-react";
import {
  Ruler, Maximize, BedDouble, Bath, Car, Compass, Building2, Layers,
  Calendar, Receipt, Landmark, ArrowUpDown, Route, Trees,
} from "lucide-react";
import type { Categoria, OperacionProp, Propiedad } from "./propiedadTypes";

/** Cómo se pide y cómo se muestra un dato de la propiedad. */
export interface CampoProp {
  /** La columna. Tipado: un typo no compila. */
  id: keyof Propiedad;
  /** Cómo se llama en el formulario y en la ficha pública. */
  label: string;
  /** Versión corta para la tarjeta del catálogo, donde no hay lugar. */
  corto?: string;
  /** En qué bloque del formulario va. */
  grupo: "medidas" | "ambientes" | "unidad" | "lote" | "extra";
  tipo: "entero" | "numero" | "texto" | "opcion" | "siNo";
  opciones?: readonly { v: string; l: string }[];
  /** Se muestra pegado al número: "m²", "años". */
  unidad?: string;
  /** La unidad en singular, para cuando el valor es 1: "1 baño", no "1 baños". */
  unidadSingular?: string;
  /** El label en singular, para la tarjeta: "1 dorm." está bien, "1 baños" no. */
  cortoSingular?: string;
  ph?: string;
  icono: LucideIcon;
  /** ¿Sale en la web pública? (todo lo de acá sí; los datos del propietario van
   *  en la ficha interna, que la vista pública ni trae). */
  publico: boolean;
  /** ¿Entra en la tira de specs de la tarjeta del catálogo? Ahí van 3 o 4, no 15. */
  enTarjeta?: boolean;
  /** Para los que 0 ES un dato válido: antigüedad 0 = a estrenar.
   *  Sin esto, un 0 se trata como "vacío" y no se muestra. */
  ceroEsDato?: boolean;
  /** Cómo se lee el valor. Si no está, se usa el número + la unidad. */
  formato?: (v: number | string | boolean) => string;
  /**
   * 🔴 El campo aplica a TODAS las categorías: no describe al tipo de propiedad
   * sino a la operación. Se declara acá, una sola vez, y `camposDe()` lo suma a
   * las seis familias solo.
   *
   * Por qué existe esta marca: `camposParaGuardar()` (en el formulario) pone en
   * NULL todo campo que la categoría no usa — tiene que hacerlo, porque si una
   * ficha pasa de "departamento" a "lote" el piso y las expensas se tienen que
   * ir de verdad. El costo es que un campo transversal que alguien se olvide de
   * poner en una familia SE BORRA cada vez que se guarda una propiedad de esa
   * familia. Y no avisa.
   *
   * Nos pasó con `aptaCredito`, que estaba solo en `unidad` y `vivienda`: Mateo
   * editó veinte propiedades el 10-ago y cinco lotes perdieron el dato. Lo
   * agarró `verificar-db`. Con esta marca no puede repetirse por olvido: el
   * campo transversal se reparte solo.
   */
  transversal?: true;
  /**
   * El campo solo aplica a estas OPERACIONES. Sin la marca, aplica a todas.
   * Juani, 18-ago: «si es temporada deben ser los datos específicos, lo mismo
   * para compra/venta… no debemos hacer cuello de botella con el sistema» —
   * las expensas o el apta crédito no tienen nada que hacer en una ficha de
   * temporada, ni en el formulario ni en la web.
   * Igual que con las categorías, `camposParaGuardar()` pone en NULL lo que la
   * operación no usa: pasar una ficha de venta a temporada limpia de verdad.
   */
  operaciones?: readonly OperacionProp[];
}

const DISPOSICION = [
  { v: "frente", l: "Frente" },
  { v: "contrafrente", l: "Contrafrente" },
  { v: "interno", l: "Interno" },
  { v: "lateral", l: "Lateral" },
] as const;

const ORIENTACION = [
  { v: "N", l: "Norte" }, { v: "S", l: "Sur" }, { v: "E", l: "Este" }, { v: "O", l: "Oeste" },
  { v: "NE", l: "Noreste" }, { v: "NO", l: "Noroeste" },
  { v: "SE", l: "Sudeste" }, { v: "SO", l: "Sudoeste" },
] as const;

const TIPO_COCHERA = [
  { v: "cubierta", l: "Cubierta" },
  { v: "descubierta", l: "Descubierta" },
] as const;

const TIPO_ACCESO = [
  { v: "asfalto", l: "Asfalto" },
  { v: "tierra", l: "Tierra" },
  { v: "mejorado", l: "Mejorado / ripio" },
] as const;

const ACCESO_EDIFICIO = [
  { v: "escalera", l: "Por escalera" },
  { v: "ascensor", l: "Con ascensor" },
] as const;

/* ── El catálogo de campos ────────────────────────────────────────────────────
   `satisfies` en vez de `:` a propósito: valida la forma de cada entrada PERO
   conserva las claves literales, así `CAMPOS.expensasARS` autocompleta y
   `keyof typeof CAMPOS` es la lista exacta. */
export const CAMPOS = {
  // ── Ambientes ──────────────────────────────────────────────────────────────
  ambientes:   { id: "ambientes",   label: "Ambientes",   corto: "amb.",  grupo: "ambientes", tipo: "entero", icono: Layers,     publico: true, enTarjeta: true,  ph: "3" },
  dormitorios: { id: "dormitorios", label: "Dormitorios", corto: "dorm.", grupo: "ambientes", tipo: "entero", icono: BedDouble, publico: true, enTarjeta: true,  ph: "2" },
  banos:       { id: "banos",       label: "Baños",       corto: "baños", cortoSingular: "baño", grupo: "ambientes", tipo: "entero", icono: Bath, publico: true, enTarjeta: true, ph: "1" },

  // Cochera: la CANTIDAD. El "¿tiene cochera?" del formulario es un interruptor
  // sobre este número (0 = no), para que no pueda quedar "tiene sí / cantidad 0".
  cocheras:    { id: "cocheras",    label: "Cocheras",    corto: "coch.", grupo: "ambientes", tipo: "entero", icono: Car,       publico: true, ph: "1" },
  tipoCochera: { id: "tipoCochera", label: "Tipo de cochera", grupo: "ambientes", tipo: "opcion", opciones: TIPO_COCHERA, icono: Car, publico: true },

  // ── Medidas ────────────────────────────────────────────────────────────────
  m2cubiertos:     { id: "m2cubiertos",     label: "Superficie cubierta",     corto: "cub.", grupo: "medidas", tipo: "numero", unidad: "m²", icono: Maximize, publico: true, enTarjeta: true, ph: "85" },
  m2semicubiertos: { id: "m2semicubiertos", label: "Superficie semicubierta", grupo: "medidas", tipo: "numero", unidad: "m²", icono: Maximize, publico: true, ph: "12" },
  m2descubiertos:  { id: "m2descubiertos",  label: "Superficie descubierta",  grupo: "medidas", tipo: "numero", unidad: "m²", icono: Maximize, publico: true, ph: "30" },
  m2totales:       { id: "m2totales",       label: "Superficie total",        corto: "tot.", grupo: "medidas", tipo: "numero", unidad: "m²", icono: Ruler,   publico: true, ph: "120" },

  // ── Departamentos ──────────────────────────────────────────────────────────
  // TEXTO, no números: en la realidad son "PB", "10°", "B", "1 bis".
  piso:           { id: "piso",           label: "Piso",              grupo: "unidad", tipo: "texto",  icono: Building2,   publico: true, ph: "PB, 3, 10…" },
  depto:          { id: "depto",          label: "Departamento",      grupo: "unidad", tipo: "texto",  icono: Building2,   publico: true, ph: "A, B, 2…" },
  disposicion:    { id: "disposicion",    label: "Disposición",       grupo: "unidad", tipo: "opcion", opciones: DISPOSICION,    icono: Compass,     publico: true },
  orientacion:    { id: "orientacion",    label: "Orientación",       grupo: "unidad", tipo: "opcion", opciones: ORIENTACION,    icono: Compass,     publico: true },
  accesoEdificio: { id: "accesoEdificio", label: "Acceso al edificio", grupo: "unidad", tipo: "opcion", opciones: ACCESO_EDIFICIO, icono: ArrowUpDown, publico: true },

  // ── Lotes y terrenos ───────────────────────────────────────────────────────
  metrosFrente:   { id: "metrosFrente",   label: "Metros de frente", grupo: "lote", tipo: "numero", unidad: "m",  icono: Ruler, publico: true, ph: "10" },
  metrosFondo:    { id: "metrosFondo",    label: "Metros de fondo",  grupo: "lote", tipo: "numero", unidad: "m",  icono: Ruler, publico: true, ph: "30" },
  m2construibles: { id: "m2construibles", label: "Superficie construible", grupo: "lote", tipo: "numero", unidad: "m²", icono: Landmark, publico: true, ph: "240" },
  tipoAcceso:     { id: "tipoAcceso",     label: "Tipo de acceso",   grupo: "lote", tipo: "opcion", opciones: TIPO_ACCESO, icono: Route, publico: true },

  // ── Extra ──────────────────────────────────────────────────────────────────
  antiguedadAnios: {
    id: "antiguedadAnios", label: "Antigüedad", grupo: "extra", tipo: "entero",
    unidad: "años", unidadSingular: "año", icono: Calendar, publico: true, ph: "15",
    // 0 SÍ es un dato: significa "a estrenar".
    ceroEsDato: true,
    formato: (v) => (Number(v) === 0 ? "A estrenar" : `${v} años`),
  },
  expensasARS: {
    id: "expensasARS", label: "Expensas", grupo: "extra", tipo: "numero",
    icono: Receipt, publico: true, ph: "85000",
    // Las expensas NO van en la grilla de datos: se renderizan aparte, como
    // segunda línea abajo del precio (pedido textual de Mateo).
    // Solo venta y alquiler: al que alquila quince días no se le cobran
    // expensas aparte (la web ya lo escondía; ahora el formulario también).
    operaciones: ["venta", "alquiler"],
  },
  // Transversal: cualquier cosa que se venda puede ser apta crédito. Un lote, un
  // galpón y un departamento por igual — "lote apto crédito" es un término real
  // del rubro y así venían etiquetados los datos que importamos del portal.
  aptaCredito: {
    id: "aptaCredito", label: "Apta para crédito", grupo: "extra", tipo: "siNo",
    icono: Landmark, publico: true, transversal: true,
    // El crédito hipotecario es para COMPRAR: en alquiler y temporada el toggle
    // solo confundía (Juani, 18-ago: cada operación con sus datos).
    operaciones: ["venta"],
  },

  // ── Rurales (ya existían; se declaran acá para que el campo también salga de
  //    una sola fuente) ─────────────────────────────────────────────────────
  hectareas: { id: "hectareas", label: "Hectáreas", grupo: "medidas", tipo: "numero", unidad: "ha", icono: Trees, publico: true, enTarjeta: true, ph: "150" },
} as const satisfies Record<string, CampoProp>;

export type IdCampo = keyof typeof CAMPOS;

/* ── Qué pide cada tipo de propiedad ──────────────────────────────────────────
   Se agrupa por FAMILIA y no categoría por categoría: 19 listas serían 19
   lugares donde olvidarse de sumar un campo. */

const FAMILIAS = {
  /** Casas y similares: se vive adentro, tiene ambientes y terreno propio. */
  vivienda: ["casa", "chalet", "casaquinta", "ph", "duplex"],
  /** Departamento: el único que tiene piso, unidad y disposición en el edificio. */
  unidad: ["departamento"],
  /** Comerciales: metros y poco más; no tienen dormitorios. */
  comercial: ["local", "oficina", "consultorio", "galpon", "deposito", "fondocomercio", "hotel", "edificio"],
  /** Tierra: lo que pidió Mateo para lotes. */
  tierra: ["lote", "terreno", "chacra"],
  /** Rural. */
  rural: ["campo"],
  /** Cochera suelta: un caso propio, casi sin datos. */
  guardado: ["cochera"],
} as const satisfies Record<string, readonly Categoria[]>;

type Familia = keyof typeof FAMILIAS;

/** ⚠️ Record COMPLETO, no Partial: si mañana entra una categoría 20 y nadie la
 *  clasifica, esto NO COMPILA. El compilador hace de checklist. */
const CAMPOS_DE: Record<Familia, readonly IdCampo[]> = {
// ⚠️ Acá van SOLO los campos que dependen del tipo de propiedad. Los
// transversales (los marcados con `transversal: true` en CAMPOS) no se listan:
// `camposDe()` los suma a todas las familias solo, para que no se puedan olvidar
// en una. Ver el comentario de `transversal` arriba — cuesta datos del cliente.
  unidad: [
    "ambientes", "dormitorios", "banos", "cocheras", "tipoCochera",
    "m2cubiertos", "m2semicubiertos", "m2descubiertos", "m2totales",
    "piso", "depto", "disposicion", "orientacion", "accesoEdificio",
    "antiguedadAnios", "expensasARS",
  ],
  vivienda: [
    "ambientes", "dormitorios", "banos", "cocheras", "tipoCochera",
    "m2cubiertos", "m2semicubiertos", "m2descubiertos", "m2totales",
    "metrosFrente", "metrosFondo", "orientacion", "disposicion",
    "antiguedadAnios",
  ],
  comercial: [
    "ambientes", "banos", "cocheras", "tipoCochera",
    "m2cubiertos", "m2semicubiertos", "m2descubiertos", "m2totales",
    "metrosFrente", "metrosFondo", "orientacion",
    "antiguedadAnios", "expensasARS",
  ],
  tierra: [
    "m2totales", "metrosFrente", "metrosFondo", "m2construibles", "tipoAcceso", "orientacion",
  ],
  rural: ["hectareas", "m2totales"],
  guardado: ["m2cubiertos", "tipoCochera", "expensasARS"],
};

/** Excepciones puntuales, en un solo lugar y con el motivo escrito.
 *  Los datos reales de la cartera lo confirman: hay un PH con "Expensas $20.000"
 *  y un local con "Expensas $30.000", así que las expensas no pueden colgar solo
 *  del departamento. */
const EXTRA_POR_CATEGORIA: Partial<Record<Categoria, readonly IdCampo[]>> = {
  ph: ["expensasARS"],
  duplex: ["expensasARS"],
};

const familiaDe = (cat: Categoria): Familia => {
  for (const [familia, cats] of Object.entries(FAMILIAS) as [Familia, readonly Categoria[]][]) {
    if (cats.includes(cat)) return familia;
  }
  return "vivienda"; // no debería pasar: el Record de arriba cubre las 19
};

// Memoizado: `camposDe` se llama en cada render de la ficha, de la tarjeta y del
// formulario. 19 categorías × 3 operaciones (+ "sin operación"): el mapa se
// llena una vez y listo.
const cache = new Map<string, CampoProp[]>();

/** Los campos transversales: van en todas las categorías, sin excepción. */
const TRANSVERSALES = Object.values(CAMPOS)
  .filter((c) => (c as CampoProp).transversal)
  .map((c) => String(c.id) as IdCampo);

/** Los campos que pide (y muestra) esta categoría, en orden de formulario.
 *  Con `operacion`, además filtra los que esa operación no usa (expensas y
 *  apta crédito no existen en temporada). Sin `operacion` devuelve todos —
 *  compatibilidad para quien no tiene el dato a mano. */
export function camposDe(cat: Categoria, operacion?: OperacionProp): CampoProp[] {
  const clave = `${cat}|${operacion ?? "*"}`;
  const guardado = cache.get(clave);
  if (guardado) return guardado;
  const ids = [
    ...CAMPOS_DE[familiaDe(cat)],
    ...(EXTRA_POR_CATEGORIA[cat] ?? []),
    // Los transversales al final: son condiciones de la operación, no del tipo,
    // así que quedan después de las características propias de la propiedad.
    ...TRANSVERSALES,
  ];
  const lista = [...new Set(ids)]
    .map((id) => CAMPOS[id] as CampoProp)
    .filter((c) => !c.operaciones || !operacion || c.operaciones.includes(operacion));
  cache.set(clave, lista);
  return lista;
}

/** ¿Esta categoría (y operación) usa este campo? Lo usa el formulario para
 *  decidir si lo guarda o lo manda en null (un depto no tiene "superficie
 *  construible"; una temporada no tiene expensas). */
export const usa = (cat: Categoria, id: IdCampo, operacion?: OperacionProp): boolean =>
  camposDe(cat, operacion).some((c) => c.id === CAMPOS[id].id);

/** Los campos de un grupo, para armar los bloques del formulario. */
export const camposDelGrupo = (cat: Categoria, grupo: CampoProp["grupo"], operacion?: OperacionProp) =>
  camposDe(cat, operacion).filter((c) => c.grupo === grupo);

/* ── Cómo se lee un valor, y qué cuenta como "vacío" ──────────────────────────
   Pedido textual de Mateo: "si no tengo el dato lo dejo en blanco y que ni se
   muestre". Un solo lugar decide qué es vacío, en vez de quince `if` sueltos. */

/** El valor legible, o null si no hay dato (y entonces no se muestra). */
export function valorLegible(campo: CampoProp, p: Propiedad): string | null {
  const v = p[campo.id] as number | string | boolean | null | undefined;
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? "Sí" : null; // un "No" no aporta: se omite
  // Un 0 casi siempre significa "no tiene" (0 cocheras no es un dato). La
  // excepción es la antigüedad, donde 0 = a estrenar.
  if (typeof v === "number" && v === 0 && !campo.ceroEsDato) return null;
  if (campo.formato) return campo.formato(v);

  // Un valor de una lista cerrada se muestra con su etiqueta, no con el valor
  // crudo de la base: "Contrafrente", no "contrafrente"; "Noroeste", no "NO".
  if (campo.opciones) {
    const op = campo.opciones.find((o) => o.v === String(v));
    if (op) return op.l;
  }

  const n = typeof v === "number" ? v.toLocaleString("es-AR") : String(v);
  // Singular cuando corresponde: "1 baño", "1 año".
  const unidad = v === 1 && campo.unidadSingular ? campo.unidadSingular : campo.unidad;
  return unidad ? `${n} ${unidad}` : n;
}

/** Los datos que se muestran en la ficha pública: los que tienen valor, nada más.
 *  Las expensas quedan afuera porque van pegadas al precio, no en la grilla. */
export function datosPublicos(p: Propiedad): { campo: CampoProp; valor: string }[] {
  return camposDe(p.categoria, p.operacion)
    .filter((c) => c.publico && c.id !== "expensasARS")
    .map((campo) => ({ campo, valor: valorLegible(campo, p) }))
    .filter((d): d is { campo: CampoProp; valor: string } => d.valor !== null);
}

/** Los 3-4 datos de la tarjeta del catálogo, donde no hay lugar para más.
 *  Formato compacto: "2 dorm." · "1 baño" · "85 m² cub." */
export function specsTarjeta(p: Propiedad, max = 3): string[] {
  return camposDe(p.categoria, p.operacion)
    .filter((c) => c.enTarjeta)
    .map((c) => {
      const v = p[c.id] as number | string | undefined | null;
      if (v === null || v === undefined || v === "" || (typeof v === "number" && v === 0 && !c.ceroEsDato)) return null;
      const n = typeof v === "number" ? v.toLocaleString("es-AR") : String(v);
      const etiqueta = v === 1 && c.cortoSingular ? c.cortoSingular : c.corto;
      // "85 m² cub." = número + unidad + etiqueta corta; "2 dorm." = número + etiqueta.
      return [n, c.unidad, etiqueta].filter(Boolean).join(" ");
    })
    .filter((s): s is string => s !== null)
    .slice(0, max);
}
