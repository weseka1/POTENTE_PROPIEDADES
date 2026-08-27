/**
 * COMPARTIR UNA PROPIEDAD — el iconito que pidió Mateo (27-ago).
 * ─────────────────────────────────────────────────────────────────────────────
 * En el celular abre la hoja de compartir del sistema (WhatsApp, Instagram,
 * lo que tenga instalado): es lo que la gente ya sabe usar y la única forma de
 * llegar a Instagram, que no acepta links con texto. En escritorio, un menú
 * chico: WhatsApp con el texto armado y copiar el link. El link es el canónico
 * de la ficha, que ya tiene OG server-side: la tarjeta se ve bien en cualquier
 * chat. Nada del navegador: ni `prompt` ni `alert` (regla de la casa).
 */
import { useEffect, useRef, useState } from "react";
import { Share2, MessageCircle, Link2, Check } from "lucide-react";
import { SITIO } from "@/config/marca";

type Props = {
  id: string;
  titulo: string;
  zona: string;
  className?: string;
  /** Solo el icono (para barras angostas). */
  compacto?: boolean;
};

/** ¿Pantalla de dedo? Ahí la hoja nativa es la mejor experiencia; en escritorio, el menú propio. */
const esDeDedo = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export default function CompartirPropiedad({ id, titulo, zona, className = "", compacto = false }: Props) {
  const url = `${SITIO}/propiedad/${id}`;
  const texto = `${titulo} · ${zona}\n${url}`;
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState<"si" | "no" | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  // Cerrar al tocar afuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); window.removeEventListener("keydown", tecla); };
  }, [abierto]);

  const compartir = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share && esDeDedo()) {
      // Cancelar la hoja no es un error: no se muestra nada.
      try { await nav.share({ title: titulo, text: `${titulo} · ${zona}`, url }); } catch { /* canceló */ }
      return;
    }
    setAbierto((v) => !v);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado("si");
    } catch {
      setCopiado("no");
    }
    setTimeout(() => setCopiado(null), 1800);
  };

  return (
    <div ref={caja} className="relative">
      <button type="button" onClick={compartir} aria-label="Compartir esta propiedad" aria-expanded={abierto} className={className}>
        <Share2 size={15} /> {!compacto && "Compartir"}
      </button>

      {abierto && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-graph/10 bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(20,30,50,0.35)]">
          <a
            role="menuitem"
            href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setAbierto(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-graph transition hover:bg-paper-100"
          >
            <MessageCircle size={16} className="text-[#25D366]" /> Enviar por WhatsApp
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={copiar}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-graph transition hover:bg-paper-100"
          >
            {copiado === "si" ? <Check size={16} className="text-brand" /> : <Link2 size={16} className="text-graph-400" />}
            {copiado === "si" ? "Link copiado" : copiado === "no" ? "No se pudo copiar" : "Copiar el link"}
          </button>
          <p className="px-3 pb-1.5 pt-1 text-[11px] leading-snug text-graph-400">
            Para Instagram: copiá el link y pegalo en el mensaje.
          </p>
        </div>
      )}
    </div>
  );
}
