import { campos } from "./campos";
import { leads } from "./leads";
import { operaciones } from "./operaciones";
import { clientes } from "./clientes";

// ===== KPIs derivados (se recalculan solos cuando cambia la data) =====
export const kpis = {
  camposActivos: campos.filter((c) => c.estado === "disponible").length,
  camposTotal: campos.length,
  valorCarteraUSD: campos
    .filter((c) => c.estado !== "vendido" && c.precioUSD)
    .reduce((a, c) => a + (c.precioUSD || 0), 0),
  hectareasTotales: campos.reduce((a, c) => a + c.hectareas, 0),
  leadsNuevos: leads.filter((l) => l.estado === "nueva").length,
  leadsTotal: leads.length,
  enNegociacion: leads.filter((l) => l.estado === "negociacion").length,
  clientes: clientes.length,
  comisionPipelineUSD: operaciones
    .filter((o) => !["escritura"].includes(o.etapa))
    .reduce((a, o) => a + (o.valorUSD * o.comisionPct) / 100, 0),
  conversion: Math.round(
    (leads.filter((l) => l.estado === "cerrado").length / leads.length) * 100
  ),
};

// Consultas por mes (para gráfico de barras)
export const consultasPorMes = [
  { mes: "Ene", consultas: 42, cierres: 3 },
  { mes: "Feb", consultas: 46, cierres: 3 },
  { mes: "Mar", consultas: 39, cierres: 2 },
  { mes: "Abr", consultas: 44, cierres: 4 },
  { mes: "May", consultas: 51, cierres: 4 },
  { mes: "Jun", consultas: 58, cierres: 5 },
];

// Leads por canal (para gráfico de torta)
export const leadsPorCanal = (() => {
  const map: Record<string, number> = {};
  leads.forEach((l) => (map[l.canal] = (map[l.canal] || 0) + 1));
  const label: Record<string, string> = {
    web: "Web propia",
    whatsapp: "WhatsApp",
    mail: "Mail",
    telefono: "Teléfono",
    portal: "Portales",
  };
  return Object.entries(map).map(([k, v]) => ({ name: label[k] || k, value: v }));
})();

// Embudo del pipeline (cantidad por etapa)
export const embudo = (() => {
  const etapas: { key: string; label: string }[] = [
    { key: "consulta", label: "Consulta" },
    { key: "visita", label: "Visita" },
    { key: "oferta", label: "Oferta" },
    { key: "reserva", label: "Reserva" },
    { key: "boleto", label: "Boleto" },
    { key: "escritura", label: "Escritura" },
  ];
  return etapas.map((e) => ({
    etapa: e.label,
    cantidad: operaciones.filter((o) => o.etapa === e.key).length,
  }));
})();

// Distribución de cartera por aptitud (valor U$S)
export const carteraPorAptitud = (() => {
  const map: Record<string, number> = {};
  campos
    .filter((c) => c.estado !== "vendido")
    .forEach((c) => (map[c.aptitud] = (map[c.aptitud] || 0) + (c.precioUSD || 0)));
  return Object.entries(map).map(([k, v]) => ({ name: k, value: v }));
})();
