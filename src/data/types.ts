// ===== Tipos del dominio Potente Propiedades =====
// Alineado con 03_IMPLEMENTACION/sheet-schema.md (pestañas Campos / Consultas)

export type TipoCampo = "campo" | "chacra" | "estancia";
export type Operacion = "venta" | "arrendamiento";
export type Aptitud = "agrícola" | "ganadera" | "mixta";
export type EstadoCampo = "disponible" | "reservado" | "vendido";

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
}

export type TipoCliente = "comprador" | "propietario" | "inversor";

export interface Cliente {
  id: string;
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
