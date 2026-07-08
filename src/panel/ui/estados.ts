// ===== Mapa central de estados del dominio -> look semántico de badge =====
// Colores semánticos: verde (positivo), amarillo (en curso / atención), rojo (negativo/cerrado),
// gris/neutro (sin definir). Se usa en todas las páginas para mantener consistencia.

export type Tone = "green" | "amber" | "red" | "blue" | "neutral" | "wheat";

export const toneClasses: Record<Tone, string> = {
  green: "bg-brand/10 text-brand-700 ring-1 ring-inset ring-brand/20",
  amber: "bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/25",
  red: "bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/20",
  blue: "bg-sky-500/10 text-sky-700 ring-1 ring-inset ring-sky-500/20",
  neutral: "bg-graph/[0.05] text-graph-500 ring-1 ring-inset ring-graph/10",
  wheat: "bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/25",
};

// Dot (puntito) con color sólido por tono — para listas compactas.
export const toneDot: Record<Tone, string> = {
  green: "bg-brand",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-sky-500",
  neutral: "bg-graph/30",
  wheat: "bg-amber-500",
};

// ---- Campos ----
export const estadoCampo: Record<string, { label: string; tone: Tone }> = {
  disponible: { label: "Disponible", tone: "green" },
  reservado: { label: "Reservado", tone: "amber" },
  vendido: { label: "Vendido", tone: "red" },
};

// ---- Leads ----
export const estadoLead: Record<string, { label: string; tone: Tone }> = {
  nueva: { label: "Nueva", tone: "blue" },
  contactado: { label: "Contactado", tone: "neutral" },
  visita: { label: "Visita", tone: "wheat" },
  negociacion: { label: "Negociación", tone: "amber" },
  cerrado: { label: "Cerrado", tone: "green" },
  perdido: { label: "Perdido", tone: "red" },
};

export const ESTADOS_LEAD = [
  "nueva",
  "contactado",
  "visita",
  "negociacion",
  "cerrado",
  "perdido",
] as const;

// ---- Clientes ----
export const tipoCliente: Record<string, { label: string; tone: Tone }> = {
  comprador: { label: "Comprador", tone: "blue" },
  propietario: { label: "Propietario", tone: "wheat" },
  inversor: { label: "Inversor", tone: "green" },
};

// ---- Pipeline ----
export const etapaPipeline: Record<string, { label: string; tone: Tone }> = {
  consulta: { label: "Consulta", tone: "neutral" },
  visita: { label: "Visita", tone: "blue" },
  oferta: { label: "Oferta", tone: "amber" },
  reserva: { label: "Reserva", tone: "wheat" },
  boleto: { label: "Boleto", tone: "green" },
  escritura: { label: "Escritura", tone: "green" },
};

export const ETAPAS_PIPELINE = [
  "consulta",
  "visita",
  "oferta",
  "reserva",
  "boleto",
  "escritura",
] as const;

// ---- Visitas ----
export const estadoVisita: Record<string, { label: string; tone: Tone }> = {
  agendada: { label: "Agendada", tone: "neutral" },
  confirmada: { label: "Confirmada", tone: "green" },
  realizada: { label: "Realizada", tone: "blue" },
  cancelada: { label: "Cancelada", tone: "red" },
};

// ---- Tasaciones ----
export const estadoTasacion: Record<string, { label: string; tone: Tone }> = {
  solicitada: { label: "Solicitada", tone: "blue" },
  en_proceso: { label: "En proceso", tone: "amber" },
  entregada: { label: "Entregada", tone: "green" },
};

// ---- Arrendamientos ----
export const estadoArrendamiento: Record<string, { label: string; tone: Tone }> = {
  vigente: { label: "Vigente", tone: "green" },
  por_vencer: { label: "Por vencer", tone: "amber" },
  vencido: { label: "Vencido", tone: "red" },
};

// ---- Aptitud (colores de marca) ----
export const aptitudColor: Record<string, string> = {
  "agrícola": "#C9A24E", // wheat
  ganadera: "#2F6FC2", // azul medio
  mixta: "#9C6B3C", // clay
};

// ---- Canales (label legible) ----
export const canalLabel: Record<string, string> = {
  web: "Web propia",
  whatsapp: "WhatsApp",
  mail: "Mail",
  telefono: "Teléfono",
  portal: "Portales",
};
