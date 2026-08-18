// ===== Tipos del dominio Potente Propiedades =====
// Alineado con 03_IMPLEMENTACION/sheet-schema.md (pestañas Campos / Consultas)

export type TipoCampo = "campo" | "chacra" | "estancia";
export type Operacion = "venta" | "arrendamiento";
export type Aptitud = "agrícola" | "ganadera" | "mixta";
export type EstadoCampo = "activa" | "reservada" | "vendida";

export interface Campo {
  id: string;
  titulo: string;
  tipo: TipoCampo;
  operacion: Operacion;
  hectareas: number;
  zona: string; // localidad / partido
  provincia: string;
  aptitud: Aptitud;
  precioUSD: number | null; // null = "consultar"
  precioPorHa?: number | null;
  estado: EstadoCampo;
  fotos: string[];
  descripcion: string;
  mejoras: string[];
  destacado: boolean;
  lat: number;
  lng: number;
  consultas: number; // métrica para el panel
  altaISO: string;
}

export type Canal = "web" | "whatsapp" | "mail" | "telefono" | "portal";
export type EstadoLead =
  | "nueva"
  | "contactado"
  | "visita"
  | "negociacion"
  | "cerrado"
  | "perdido";

export interface Lead {
  id: string;
  fechaISO: string;
  nombre: string;
  contacto: string;
  campoId: string | null;
  canal: Canal;
  estado: EstadoLead;
  asignado: string;
  notas: string;
  /** Multi-oficina: sin oficina = central (Mateo, orquestador). Derivar = setearla. */
  oficina?: "chauvin" | "puntamogotes";
}

export type TipoCliente = "comprador" | "propietario" | "inversor";

export interface Cliente {
  id: string;
  /** Multi-oficina: los clientes de cada oficina viven en la suya. */
  oficina?: "chauvin" | "puntamogotes";
  nombre: string;
  tipo: TipoCliente;
  telefono: string;
  email: string;
  localidad: string;
  // qué busca (para el matching lead <-> campo)
  buscaZona?: string;
  buscaHasMin?: number;
  buscaHasMax?: number;
  buscaAptitud?: Aptitud;
  presupuestoUSD?: number;
  operaciones: number;
  desdeISO: string;
  notas: string;
}

export type EtapaPipeline =
  | "consulta"
  | "visita"
  | "oferta"
  | "reserva"
  | "boleto"
  | "escritura";

export interface Operacion_ {
  id: string;
  campoId: string;
  clienteNombre: string;
  etapa: EtapaPipeline;
  valorUSD: number;
  comisionPct: number;
  responsable: string;
  actualizadoISO: string;
}

export interface Visita {
  id: string;
  fechaISO: string;
  hora: string;
  campoId: string;
  clienteNombre: string;
  responsable: string;
  estado: "agendada" | "confirmada" | "realizada" | "cancelada";
}

export interface Tasacion {
  id: string;
  fechaISO: string;
  solicitante: string;
  contacto: string;
  zona: string;
  hectareas: number;
  aptitud: Aptitud;
  valorEstimadoUSD: number | null;
  estado: "solicitada" | "en_proceso" | "entregada";
}

export interface Arrendamiento {
  id: string;
  campoId: string;
  arrendatario: string;
  hectareas: number;
  valorAnualUSD: number;
  inicioISO: string;
  vencimientoISO: string;
  estado: "vigente" | "por_vencer" | "vencido";
}

// ===== TEMPORADA (alquiler temporario de verano) =====
// La unidad de alquiler en la costa argentina es la QUINCENA. El verano se divide
// en 8 tramos fijos (dic → marzo). Las tarifas y las reservas se cuelgan de estos ids.

export type TemporadaTramoId =
  | "dic-1" | "dic-2" | "ene-1" | "ene-2" | "feb-1" | "feb-2" | "mar-1" | "mar-2";

export interface TemporadaTramo {
  id: TemporadaTramoId;
  label: string; // "1ª quincena de enero"
  corto: string; // "Ene 1ª"
  desdeISO: string;
  hastaISO: string;
  pico?: boolean; // 2ª de enero = pico de la temporada
}

// Propiedad ofrecida en temporada. Se apoya en una Propiedad de la cartera (propiedadId).
export interface UnidadTemporada {
  id: string;
  /** Multi-oficina: qué oficina administra la unidad en temporada. */
  oficina?: "chauvin" | "puntamogotes";
  propiedadId: string;
  ambientes: number;
  capacidad: number; // personas — 0 = SIN DATO: no se cargó y la web no promete cupo (audios Mateo 18-ago: «ese número se lo doy yo»)
  barrio: string; // Playa Grande, Güemes, La Perla, Varese, Chauvín, Punta Mogotes…
  frenteAlMar?: boolean;
  comodidades: string[]; // pileta, parrilla, cochera, wifi, aire…
  tarifas: Partial<Record<TemporadaTramoId, number>>; // ARS por quincena (ref. web pública)
  tarifaNocheARS: number; // ARS por noche en temporada alta (pico); la curva lo baja fuera del pico
  minNoches?: number; // estadía mínima sugerida (solo avisa, no bloquea)
  comisionPct: number; // % de Potente (default 15)
  activa: boolean; // se muestra en la web pública
  // Turnover: entre el inquilino que se va y el que entra hay que limpiar y pasar llaves.
  // Se marca a mano desde la grilla; es el dolor #3 de la operación de temporada.
  enLimpieza?: boolean;
}

export type EstadoReserva =
  | "senada" // reservada con seña
  | "confirmada" // saldo + garantía al día
  | "en_curso" // inquilino adentro
  | "finalizada"
  | "cancelada";

export interface ReservaTemporada {
  id: string;
  unidadId: string;
  // Fechas del alquiler. hastaISO es el día que se va (check-out): no cuenta como
  // noche ocupada, así el que entra ese mismo día no choca.
  desdeISO: string;
  hastaISO: string;
  noches: number;
  inquilino: string;
  contacto: string;
  personas: number;
  montoTotalARS: number;
  senaARS: number;
  garantiaARS: number;
  estado: EstadoReserva;
  creadaISO: string;
  notas?: string;
}

/* ── REGISTRO DE LLAVES (audios de Mateo, 12-ago-2026) ──────────────────────
 * El llavero físico de cada oficina. Textual: «que haya 300 números y yo a cada
 * número le pueda asignar una llave», «guardarlo con el apellido del dueño y
 * con la dirección del inmueble», «si las tenemos nosotros o si las entregamos
 * y a quién», «poder hacer anotaciones».
 *
 * 🔴 NO depende de las propiedades cargadas: «va a haber propiedades cargadas y
 * propiedades que NO están cargadas que igualmente administramos». `propiedadId`
 * es un vínculo OPCIONAL, no un requisito.
 *
 * ⚠️ No confundir con `Ficha.llaves` (booleano de la ficha de captación: "el
 * propietario nos dejó un juego"). Esto es el REGISTRO OPERATIVO: dónde está
 * cada juego hoy y toda su historia. Una verdad por cosa (estándar 5).
 */
export type EstadoLlave =
  | "en_oficina" // el juego está en el cajón
  | "entregada" // se lo llevó alguien (siempre con nombre)
  | "perdida"; // el caso que originó todo esto

export interface Llave {
  id: string;
  /** Multi-oficina: cada oficina su llavero. Sin oficina = central. */
  oficina?: "chauvin" | "puntamogotes";
  /** El número del llavero físico, como lo nombra el equipo. Único por oficina. */
  numero?: number;
  /** Apellido del dueño — con esto la busca Mateo. */
  propietario?: string;
  direccion?: string;
  /** Vínculo OPCIONAL a una propiedad cargada (queda vacío si no está en el sistema). */
  propiedadId?: string;
  estado: EstadoLlave;
  /** A quién se la entregamos. Obligatorio cuando estado = entregada (lo exige la base). */
  enPoderDe?: string;
  entregadaISO?: string;
  notas?: string;
  created_at?: string;
  updated_at?: string;
}

export type TipoMovimientoLlave =
  | "entrega" // se la llevó alguien
  | "devolucion" // volvió al cajón
  | "ingreso" // entró un juego nuevo al llavero
  | "nota"; // anotación suelta, sin cambio de tenencia

export interface MovimientoLlave {
  id: string;
  /** Se cuelga de la llave y HEREDA su oficina: no repetir `oficina` acá
   *  (cicatriz de la migración 003: dos fuentes de verdad se desincronizan). */
  llaveId: string;
  tipo: TipoMovimientoLlave;
  fechaISO: string;
  /** Quién se la llevó o quién la devolvió. Libre: dueño, albañil, inquilino… */
  persona?: string;
  nota?: string;
  created_at?: string;
}
