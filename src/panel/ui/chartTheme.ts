// Paleta de marca para charts (recharts) — tema CLARO premium (flow Apple).
// Familia azul atlántico Potente: un solo tono, distintas intensidades (nada de dorado/marrón).
export const COLORS = {
  ink: "#0D1521", // grafito azulado (tinta)
  bone: "#0D1521", // alias: cualquier texto que usaba "bone" ahora es grafito
  wheat: "#0C4DA2", // alias histórico → azul marca (serie principal)
  wheat400: "#2F6FC2",
  field: "#0C4DA2", // azul Potente (un solo azul de marca)
  field300: "#7FA9DE",
  clay: "#083469", // alias histórico → navy profundo
  // grilla y ejes sobre fondo claro
  grid: "rgba(13,21,33,0.07)",
  axis: "rgba(13,21,33,0.45)",
  // alias compatibilidad
  ink10: "rgba(13,21,33,0.08)",
  ink60: "rgba(13,21,33,0.55)",
};

// Secuencia para series categóricas (torta/donut) — degradé de azules de marca, buen contraste en claro.
export const SERIE = ["#0C4DA2", "#1495D8", "#083469", "#2F6FC2", "#7FA9DE", "#0A4189"];

// Tooltip claro premium reutilizable.
export const tooltipStyle = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(23,26,23,0.10)",
  borderRadius: 12,
  boxShadow: "0 18px 44px -20px rgba(23,26,23,0.28)",
  fontSize: 12,
  padding: "8px 12px",
  color: "#171A17",
  backdropFilter: "blur(8px)",
} as const;

export const tooltipItemStyle = { color: "#171A17" } as const;
export const tooltipLabelStyle = { color: "rgba(23,26,23,0.55)", marginBottom: 2 } as const;
