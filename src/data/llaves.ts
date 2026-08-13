import type { Llave, MovimientoLlave } from "./types";

/* ── Semilla del REGISTRO DE LLAVES (modo demo) ─────────────────────────────
 * Solo para la demo sin base: con Supabase conectado, la sincronización pisa
 * esto con las llaves reales del equipo (y si la tabla está vacía, la lista
 * arranca vacía — el guardia del DataProvider mira `error`, no `length`).
 *
 * Los casos que están acá son los que Mateo describió en el audio, para que la
 * pantalla se entienda de una: una en el cajón, una entregada a un albañil (el
 * caso real que originó el pedido) y una de un inmueble que NO está cargado en
 * el sistema — la razón por la que esta tabla es independiente.
 */
export const seedLlaves: Llave[] = [
  {
    id: "LLV-DEMO-1",
    numero: 12,
    propietario: "Gutiérrez",
    direccion: "Córdoba 3712, Chauvín",
    estado: "en_oficina",
    oficina: "chauvin",
    notas: "Juego completo: portón, puerta y reja.",
  },
  {
    id: "LLV-DEMO-2",
    numero: 47,
    propietario: "Lemos",
    direccion: "Falucho 2162, La Perla",
    estado: "entregada",
    enPoderDe: "Albañil (Rubén) — refacción del baño",
    entregadaISO: "2026-08-04",
    oficina: "chauvin",
  },
  {
    id: "LLV-DEMO-3",
    numero: 103,
    propietario: "Sosa",
    direccion: "Av. de los Trabajadores 2145",
    estado: "en_oficina",
    oficina: "puntamogotes",
    notas: "Inmueble que administramos sin publicar.",
  },
];

export const seedMovimientosLlave: MovimientoLlave[] = [
  { id: "MOV-DEMO-1", llaveId: "LLV-DEMO-1", tipo: "ingreso", fechaISO: "2026-07-21", persona: "Sra. Gutiérrez", nota: "Nos dejó el juego al firmar la autorización." },
  { id: "MOV-DEMO-2", llaveId: "LLV-DEMO-2", tipo: "ingreso", fechaISO: "2026-07-28", persona: "Sr. Lemos" },
  { id: "MOV-DEMO-3", llaveId: "LLV-DEMO-2", tipo: "entrega", fechaISO: "2026-08-04", persona: "Albañil (Rubén)", nota: "Refacción del baño. Avisa cuando termina." },
  { id: "MOV-DEMO-4", llaveId: "LLV-DEMO-3", tipo: "ingreso", fechaISO: "2026-08-01", persona: "Sr. Sosa" },
];
