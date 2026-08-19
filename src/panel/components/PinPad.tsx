import { useEffect, useRef, useState } from "react";
import { Delete, Loader2 } from "lucide-react";

/**
 * Teclado de PIN estilo iOS — pedido de Mateo vía Juani (18-ago): «al estilo
 * iPhone, replicar tal cual iOS». Puntos que se llenan, teclado numérico
 * circular con las letras de cortesía, sacudida cuando está mal, y OK para
 * confirmar: el largo del PIN acá es variable (4 a 8), igual que el "código
 * numérico personalizado" de iOS — que por eso también muestra OK.
 *
 * SOLO interfaz: la verificación, el fail-closed y la llave maestra viven en
 * quien lo usa (ProfileGate). Este componente no sabe qué es un PIN correcto.
 *
 * Anda con el teclado físico también (dígitos, Backspace, Enter, Escape):
 * en el mostrador hay compus, no solo dedos — y las suites e2e tipean por ahí.
 */
export default function PinPad({
  titulo,
  subtitulo,
  error,
  intentos = 0,
  ocupado = false,
  onSubmit,
  onCancelar,
}: {
  titulo: string;
  subtitulo?: string;
  /** Mensaje de error visible (PIN incorrecto / "Demasiados intentos…"). */
  error?: string;
  /** Contador de intentos fallidos: cada incremento dispara la sacudida y limpia los puntos. */
  intentos?: number;
  ocupado?: boolean;
  onSubmit: (pin: string) => void;
  onCancelar?: () => void;
}) {
  const [pin, setPin] = useState("");
  const [sacudida, setSacudida] = useState(false);
  const primerRender = useRef(true);
  // 🔴 El valor de verdad vive en un REF, el estado solo pinta. Con teclas en
  // ráfaga (React 18 batchea todo lo que cae en la misma tarea) el listener de
  // Enter leería el pin viejo del closure y el submit se perdería mudo.
  const pinRef = useRef("");
  const escribir = (n: string) => { pinRef.current = n; setPin(n); };

  // Cada intento fallido: sacudida iOS + los puntos se vacían.
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    escribir("");
    setSacudida(true);
    const t = setTimeout(() => setSacudida(false), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentos]);

  const tocar = (d: string) => { if (!ocupado) escribir((pinRef.current + d).slice(0, 8)); };
  const borrar = () => escribir(pinRef.current.slice(0, -1));
  const confirmar = () => { const p = pinRef.current; if (p.length >= 4 && !ocupado) onSubmit(p); };

  // Teclado físico mientras el pad está montado (el gate es pantalla completa:
  // no hay inputs de texto compitiendo abajo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) tocar(e.key);
      else if (e.key === "Backspace") borrar();
      else if (e.key === "Enter") confirmar();
      else if (e.key === "Escape" && onCancelar) onCancelar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocupado]);

  const FILAS: [string, string][] = [
    ["1", ""], ["2", "ABC"], ["3", "DEF"],
    ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
    ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ];
  const puntos = Math.max(4, pin.length);

  return (
    <div data-pin-pad className="flex flex-col items-center">
      <p className="font-display text-base font-semibold text-graph">{titulo}</p>
      {subtitulo && <p className="mt-1 text-xs text-graph-400">{subtitulo}</p>}

      {/* Los puntos, con la sacudida de iOS cuando el PIN no abre. */}
      <div className={`mt-5 flex h-4 items-center justify-center gap-3.5 ${sacudida ? "sacudida" : ""}`}>
        {Array.from({ length: puntos }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border transition-all duration-150 ${
              i < pin.length ? "border-graph bg-graph" : "border-graph/35 bg-transparent"
            }`}
          />
        ))}
      </div>
      <p className={`mt-3 h-4 text-xs font-semibold ${error ? "text-red-600" : "text-transparent"}`}>{error || "."}</p>

      {/* El teclado: círculos generosos, letras de cortesía, respuesta al tacto. */}
      <div className="mt-3 grid grid-cols-3 gap-x-6 gap-y-4">
        {FILAS.map(([d, letras]) => (
          <button
            key={d}
            type="button"
            data-digito={d}
            disabled={ocupado}
            onClick={() => tocar(d)}
            className="grid h-16 w-16 select-none place-items-center rounded-full bg-graph/[0.06] leading-none transition active:scale-95 active:bg-graph/[0.14] disabled:opacity-40 sm:h-[68px] sm:w-[68px]"
          >
            <span className="block">
              <span className="block font-display text-[26px] font-light text-graph">{d}</span>
              <span className="block h-2.5 text-[8px] font-semibold tracking-[0.18em] text-graph-400">{letras}</span>
            </span>
          </button>
        ))}
        {/* Fila de abajo: Cancelar · 0 · borrar — como el teléfono. */}
        <div className="grid place-items-center">
          {onCancelar && (
            <button type="button" onClick={onCancelar} className="text-[13px] font-medium text-graph-500 transition hover:text-graph">
              Cancelar
            </button>
          )}
        </div>
        <button
          type="button"
          data-digito="0"
          disabled={ocupado}
          onClick={() => tocar("0")}
          className="grid h-16 w-16 select-none place-items-center rounded-full bg-graph/[0.06] transition active:scale-95 active:bg-graph/[0.14] disabled:opacity-40 sm:h-[68px] sm:w-[68px]"
        >
          <span className="font-display text-[26px] font-light text-graph">0</span>
        </button>
        <div className="grid place-items-center">
          <button type="button" onClick={borrar} disabled={ocupado || !pin.length} aria-label="Borrar" className="p-3 text-graph-500 transition hover:text-graph disabled:opacity-30">
            <Delete size={22} />
          </button>
        </div>
      </div>

      {/* OK: aparece utilizable recién con 4 dígitos, como el código variable de iOS. */}
      <button
        type="button"
        onClick={confirmar}
        disabled={pin.length < 4 || ocupado}
        className="mt-5 inline-flex h-11 w-40 items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-35"
      >
        {ocupado ? <Loader2 size={16} className="animate-spin" /> : "OK"}
      </button>
    </div>
  );
}
