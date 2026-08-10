/**
 * ORIENTACIÓN Y SOL — cuándo recibe sol esta propiedad, con matemática de verdad.
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo pidió Mateo el 10-ago después de verlo en Roomix. La diferencia con lo que
 * hace todo el rubro: acá no se dice "muy luminoso" — se calcula la posición
 * real del sol para las coordenadas de ESTA propiedad y se cruza con hacia
 * dónde da el frente. Es el primer dato de la ficha que reemplaza un adjetivo
 * por algo verificable, y por eso es también un argumento de captación:
 * "le mostramos al comprador cuánto sol recibe su propiedad, con matemática
 * solar exacta y no con adjetivos".
 *
 * El cálculo vive en `src/site/lib/asoleamiento.ts` y lo verifica
 * `npm run verificar-sol` (27 pruebas contra física, no contra sí mismo).
 *
 * DECISIONES DE COPY (bajadas con el CMO, 10-ago):
 * · El nombre es "Orientación y sol": ata el dato al campo que carga la
 *   inmobiliaria y suena a ficha técnica de toda la vida, no a chiche.
 * · El SUR no se esconde ni lleva tono de alerta: se dice lo que es ("luz
 *   pareja, sin sol directo") con su beneficio real (fresco en verano, sin
 *   encandilamiento). Mismo peso visual que las demás: la consistencia es lo
 *   que hace creíble al resto.
 * · La limitación de las sombras se dice en UNA línea informativa, sin ícono de
 *   alerta ni lenguaje de descargo legal.
 * · Registro formal (usted), como todo el sitio.
 */
import { useMemo, useState } from "react";
import { Sun, Sunrise, Sunset } from "lucide-react";
import {
  diaDeSol, solDelFrente, franjaDelSol, horaDeMinutos, minutosLocales,
  type DiaDeSol, type SolDelFrente,
} from "../lib/asoleamiento";
import type { Orientacion } from "@/data/propiedadTypes";

/* El copy de las 8 orientaciones. Etiqueta corta + la línea de la ficha. */
const COPY: Record<Orientacion, { etiqueta: string; linea: string }> = {
  N: { etiqueta: "Sol todo el día", linea: "El frente recibe sol durante prácticamente toda la jornada, la orientación más buscada en Mar del Plata." },
  NE: { etiqueta: "Sol de mañana y mediodía", linea: "El frente recibe sol desde la mañana y hasta bien entrado el mediodía." },
  E: { etiqueta: "Sol de mañana", linea: "El frente recibe sol durante la mañana." },
  SE: { etiqueta: "Sol de mañana, marcado en verano", linea: "El frente recibe sol por la mañana, con mayor intensidad en los meses de verano." },
  S: { etiqueta: "Luz pareja, sin sol directo", linea: "El frente recibe luz pareja durante el día, sin sol directo. Ideal para quien busca ambientes frescos en verano y sin encandilamiento." },
  SO: { etiqueta: "Sol de tarde, marcado en verano", linea: "El frente recibe sol por la tarde, con mayor intensidad en los meses de verano." },
  O: { etiqueta: "Sol de tarde", linea: "El frente recibe sol durante la tarde, con el atardecer de frente." },
  NO: { etiqueta: "Sol de mediodía y tarde", linea: "El frente recibe sol desde el mediodía y durante toda la tarde." },
};

const NOMBRE: Record<Orientacion, string> = {
  N: "norte", NE: "noreste", E: "este", SE: "sureste",
  S: "sur", SO: "suroeste", O: "oeste", NO: "noroeste",
};

/* Las tres épocas que se pueden mirar. El 21-dic y el 21-jun son los extremos
   reales del año: todo lo demás queda entre esos dos. */
const EPOCAS = [
  { k: "verano", l: "En verano", fecha: () => new Date("2026-12-21T15:00:00Z") },
  { k: "hoy", l: "Hoy", fecha: () => new Date() },
  { k: "invierno", l: "En invierno", fecha: () => new Date("2026-06-21T15:00:00Z") },
] as const;

function TituloFranja({ sol, dia }: { sol: SolDelFrente; dia: DiaDeSol }) {
  const f = franjaDelSol(sol, dia);
  const texto =
    f === "todo-el-dia" ? "Sol directo la mayor parte del día"
    : f === "manana" ? "Sol directo por la mañana"
    : f === "tarde" ? "Sol directo por la tarde"
    : f === "manana-y-tarde" ? "Sol directo temprano y al final del día"
    : "Sin sol directo en esta época";
  return <p className="text-sm font-semibold text-graph">{texto}</p>;
}

export default function OrientacionYSol({
  lat, lng, orientacion,
}: { lat: number; lng: number; orientacion: Orientacion }) {
  const [epoca, setEpoca] = useState<(typeof EPOCAS)[number]["k"]>("hoy");

  const { dia, sol } = useMemo(() => {
    const fecha = EPOCAS.find((e) => e.k === epoca)!.fecha();
    const dia = diaDeSol(lat, lng, fecha);
    return { dia, sol: solDelFrente(orientacion, dia) };
  }, [lat, lng, orientacion, epoca]);

  if (!dia.amanecer || !dia.atardecer) return null;

  const desde = minutosLocales(dia.amanecer);
  const hasta = minutosLocales(dia.atardecer);
  const ancho = hasta - desde;
  const pct = (m: number) => Math.max(0, Math.min(100, ((m - desde) / ancho) * 100));
  const mediodia = minutosLocales(dia.mediodia);

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-graph">Orientación y sol</h2>
          <p className="mt-1 text-sm text-graph-500">
            Calculado con la posición real del sol para esta dirección exacta, en
            cualquier época del año.
          </p>
        </div>
        {/* Las épocas */}
        <div className="flex gap-1.5" role="group" aria-label="Época del año">
          {EPOCAS.map((e) => (
            <button
              key={e.k}
              onClick={() => setEpoca(e.k)}
              aria-pressed={epoca === e.k}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                epoca === e.k
                  ? "bg-brand text-white"
                  : "bg-white/75 text-graph-500 ring-1 ring-graph/10 hover:text-brand hover:ring-brand/40"
              }`}
            >
              {e.l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-graph/10 bg-paper-100 p-5 shadow-card sm:p-6">
        {/* El titular del dato */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/70">
            <Sun size={13} aria-hidden />
            Frente al {NOMBRE[orientacion]}
          </span>
          <TituloFranja sol={sol} dia={dia} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-graph-600">{COPY[orientacion].linea}</p>

        {/* La banda del día: del amanecer al atardecer, con los ratos de sol
            directo sobre el frente pintados. Dos tramos separados —el caso del
            frente sur en verano— se ven como dos bandas, que es la verdad. */}
        <div className="mt-5">
          <div className="relative h-9 overflow-hidden rounded-lg bg-navy/[0.06]">
            {sol.tramos.map((t) => (
              <div
                key={t.desde}
                className="absolute inset-y-0 bg-gradient-to-b from-amber-300/85 to-amber-400/85"
                style={{ left: `${pct(t.desde)}%`, width: `${Math.max(1.5, pct(t.hasta) - pct(t.desde))}%` }}
                title={`Sol directo de ${horaDeMinutos(t.desde)} a ${horaDeMinutos(t.hasta)}`}
              />
            ))}
            {/* El mediodía solar, de referencia */}
            <div className="absolute inset-y-0 w-px bg-navy/20" style={{ left: `${pct(mediodia)}%` }} aria-hidden />
            {/* Las horas de los tramos, adentro de la banda cuando entran */}
            {sol.tramos.map((t) => {
              const w = pct(t.hasta) - pct(t.desde);
              if (w < 14) return null;
              return (
                <span
                  key={`t-${t.desde}`}
                  className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold text-amber-900"
                  style={{ left: `${pct(t.desde) + w / 2}%`, transform: "translate(-50%, -50%)" }}
                >
                  {horaDeMinutos(t.desde)} – {horaDeMinutos(t.hasta)}
                </span>
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-graph-400">
            <span className="inline-flex items-center gap-1">
              <Sunrise size={12} aria-hidden /> {horaDeMinutos(desde)}
            </span>
            <span>
              {sol.horas > 0
                ? `${sol.horas.toFixed(1).replace(".", ",")} h de sol directo sobre el frente`
                : "El sol no da de frente en esta época"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Sunset size={12} aria-hidden /> {horaDeMinutos(hasta)}
            </span>
          </div>
        </div>

        {/* La limitación, dicha una vez y sin tono de descargo. */}
        <p className="mt-4 border-t border-graph/10 pt-3 text-xs leading-relaxed text-graph-400">
          Este dato muestra el recorrido real del sol para esta dirección. La sombra
          de construcciones vecinas o de árboles puede modificar la luz que
          efectivamente entra.
        </p>
      </div>
    </div>
  );
}
