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

// Precio de una propiedad respetando su moneda de publicación: los alquileres
// van en pesos (precioARS) y las ventas en dólares (precioUSD).
export function fmtPrecio(
  p: { precioUSD?: number | null; precioARS?: number | null; categoria?: string },
  opts?: { short?: boolean }
): string {
  if (p.precioARS) return fmtARS(p.precioARS, opts);
  if (p.categoria === "campo" && !p.precioUSD) return "A consultar";
  return fmtUSD(p.precioUSD ?? null, opts);
}

/* 🔴 14-ago · EL PRECIO QUE VE EL VISITANTE. Es distinto del interno A PROPÓSITO.
 *
 * Una propiedad de TEMPORADA no publica precio: la tarifa se cotiza según las
 * fechas (Mateo, 13-ago), y por eso la migración 013 le sacó al visitante hasta
 * la columna `tarifas`. El agujero era que `precioARS` sí le llega: una ficha
 * que pasó de alquiler a temporada arrastra su precio MENSUAL, y `fmtPrecio` lo
 * devuelve sin mirar la operación → la web publicaba ese número como si fuera la
 * tarifa de temporada, en la tarjeta, en la ficha y en lo que se le manda a la IA.
 *
 * Por qué la regla NO vive adentro de `fmtPrecio`: en el panel Mateo SÍ tiene que
 * ver ese número — es su cartera, y esconderlo le rompería la columna Precio.
 * Entonces hay dos funciones con nombres que dicen de qué lado están, y todo lo
 * que se pinta para el público pasa por ésta. Si aparece un `fmtPrecio` dentro de
 * `src/site/`, es un bug. */
export function precioPublico(
  p: { precioUSD?: number | null; precioARS?: number | null; categoria?: string; operacion?: string },
  opts?: { short?: boolean }
): string {
  if (p.operacion === "temporada") return "A consultar";
  return fmtPrecio(p, opts);
}

// Pesos argentinos — usado por Temporada (el temporario se cobra en ARS).
export function fmtARS(n: number | null | undefined, opts?: { short?: boolean }): string {
  if (n === null || n === undefined) return "—";
  if (opts?.short) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  }
  return "$" + n.toLocaleString("es-AR");
}

export function fmtHa(n: number): string {
  return n.toLocaleString("es-AR") + " ha";
}

/**
 * 🔴 Una fecha SIN hora ("2026-08-12") la spec manda interpretarla como UTC, así
 * que `new Date("2026-08-12")` es medianoche UTC = 11-ago 21:00 en Argentina, y
 * el panel mostraba TODAS las fechas simples un día antes (lo cazamos el 12-ago
 * probando el registro de llaves: decía "se la llevó el 11/8" el mismo día que
 * se entregó). Agregarle la hora la vuelve LOCAL, que es lo que quiso escribir
 * quien la cargó. Los timestamps completos (con T y zona) no se tocan.
 */
function comoFechaLocal(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
}

export function fmtFecha(iso: string): string {
  const d = comoFechaLocal(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtFechaCorta(iso: string): string {
  const d = comoFechaLocal(iso);
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
