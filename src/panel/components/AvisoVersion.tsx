/**
 * "HAY UNA VERSIÓN NUEVA" — la barra que evita medio día de bugs fantasma.
 * ─────────────────────────────────────────────────────────────────────────────
 * 27-ago. El panel queda abierto todo el día. Deployamos al mediodía y la
 * pestaña siguió corriendo el JavaScript de la mañana: los botones nuevos
 * simplemente no existían ahí, y desde este lado parecía que el sistema estaba
 * roto. Se perdió media tarde buscando un bug que no estaba.
 *
 * Cuándo mira: al entrar, cada vez que se vuelve a la pestaña, y cada 10
 * minutos. Los tres son baratos (un JSON de 20 bytes) y cubren el caso real:
 * la pestaña dormida que revive.
 *
 * 🔴 NUNCA recarga sola. Puede haber alguien escribiendo una respuesta a un
 * cliente; perderle el texto por una mejora nuestra sería peor que la versión
 * vieja. Avisa y la persona decide cuándo.
 */
import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { hayVersionNueva } from "@/lib/version";

const CADA_MS = 10 * 60 * 1000;

export default function AvisoVersion() {
  const [hay, setHay] = useState(false);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    let vivo = true;
    const mirar = async () => {
      if (!vivo || document.visibilityState !== "visible") return;
      if (await hayVersionNueva()) setHay(true);
    };
    mirar();
    const cada = setInterval(mirar, CADA_MS);
    document.addEventListener("visibilitychange", mirar);
    return () => { vivo = false; clearInterval(cada); document.removeEventListener("visibilitychange", mirar); };
  }, []);

  if (!hay || oculto) return null;

  return (
    <div data-aviso-version className="flex items-center justify-center gap-3 border-b border-brand/20 bg-brand/[0.07] px-4 py-2 text-[12.5px] text-brand-700">
      <span>
        <strong className="font-semibold">Hay una versión nueva del panel.</strong> Recargá para verla — lo que estés escribiendo se pierde, así que terminá primero.
      </span>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1 text-[12px] font-semibold text-white transition hover:bg-brand-600"
      >
        <RefreshCw size={12} /> Recargar
      </button>
      <button onClick={() => setOculto(true)} aria-label="Ahora no" className="shrink-0 rounded-md p-1 text-brand-700/70 transition hover:bg-brand/10 hover:text-brand-700">
        <X size={14} />
      </button>
    </div>
  );
}
