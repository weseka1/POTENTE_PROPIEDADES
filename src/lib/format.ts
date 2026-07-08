export function fmtUSD(n: number | null | undefined, opts?: { short?: boolean }): string {
  if (n === null || n === undefined) return "A consultar";
  if (opts?.short) {
    if (n >= 1_000_000) return `U$S ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
    if (n >= 1_000) return `U$S ${(n / 1_000).toFixed(0)}K`;
  }
  return "U$S " + n.toLocaleString("es-AR");
}

export function fmtNum(n: number): string {
  return n.toLocaleString("es-AR");
}

export function fmtHa(n: number): string {
  return n.toLocaleString("es-AR") + " ha";
}

export function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtFechaCorta(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export function desde(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.round((now.getTime() - d.getTime()) / 3_600_000);
  if (diff < 1) return "hace minutos";
  if (diff < 24) return `hace ${diff} h`;
  const dias = Math.round(diff / 24);
  return `hace ${dias} d`;
}
