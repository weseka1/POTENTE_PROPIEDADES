import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, X, Send, Waves, Loader2 } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { hoyISO } from "@/lib/fechas";
import { fmtHa, fmtUSD } from "@/lib/format";
import { consultarAsistente, linkWhatsApp, type ChatMsg, type CampoLite } from "@/lib/asistente";
import type { Lead } from "@/data/types";
import type { Propiedad } from "@/data/propiedadTypes";

const SALUDO =
  "¡Hola! Soy Marina, de Potente Propiedades. ¿Qué estás buscando? ¿Casa, depto, local, lote…? Contame la zona y qué necesitás y te muestro opciones.";

type Burbuja = { rol: "cliente" | "asistente"; texto: string; campos?: Propiedad[] };

export default function ChatAsistente() {
  const { propiedades, addLead } = useData();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Burbuja[]>([{ rol: "asistente", texto: SALUDO }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [leadEnviado, setLeadEnviado] = useState(false);
  const [leadNombre, setLeadNombre] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mensaje pre-armado para WhatsApp, con el contexto de la charla.
  const waTexto = () => {
    const ultimoUser = [...msgs].reverse().find((m) => m.rol === "cliente")?.texto || "";
    const recom = [...new Set(msgs.flatMap((m) => m.campos || []).map((c) => c.titulo))].slice(0, 3);
    const partes = ["Hola, vengo de la web de Potente Propiedades."];
    if (leadNombre) partes.push(`Soy ${leadNombre}.`);
    if (ultimoUser) partes.push(`Estoy buscando: ${ultimoUser}`);
    if (recom.length) partes.push(`Me interesó: ${recom.join(", ")}.`);
    return partes.join(" ");
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, open]);

  // El buscador IA del hero abre a Marina con la consulta ya escrita:
  // window.dispatchEvent(new CustomEvent("marina:abrir", { detail: { mensaje } }))
  const enviarRef = useRef<(t?: string) => void>(() => {});
  useEffect(() => {
    const onAbrir = (e: Event) => {
      const detalle = (e as CustomEvent).detail as { mensaje?: string } | undefined;
      setOpen(true);
      const mensaje = detalle?.mensaje?.trim();
      if (mensaje) enviarRef.current(mensaje);
    };
    window.addEventListener("marina:abrir", onAbrir);
    return () => window.removeEventListener("marina:abrir", onAbrir);
  }, []);

  const catalogo = (): CampoLite[] =>
    propiedades
      .filter((p) => p.estado === "disponible")
      .map((p) => ({
        id: p.id,
        titulo: p.titulo,
        zona: p.zona,
        categoria: p.categoria,
        hectareas: p.hectareas,
        aptitud: p.aptitud,
        operacion: p.operacion,
        precio: p.categoria === "campo" ? "A consultar" : fmtUSD(p.precioUSD),
      }));

  const enviar = async (textoDirecto?: string) => {
    const texto = (textoDirecto ?? input).trim();
    if (!texto || busy) return;
    const historial: ChatMsg[] = msgs.map((m) => ({ rol: m.rol, texto: m.texto }));
    setMsgs((m) => [...m, { rol: "cliente", texto }]);
    setInput("");
    setBusy(true);
    try {
      const r = await consultarAsistente(texto, historial, catalogo());
      const campos = r.camposIds
        .map((id) => propiedades.find((p) => p.id === id))
        .filter((p): p is Propiedad => Boolean(p));
      setMsgs((m) => [...m, { rol: "asistente", texto: r.respuesta, campos: campos.length ? campos : undefined }]);

      if (r.lead && !leadEnviado) {
        const lead: Lead = {
          id: "WEB-" + Date.now().toString(36),
          fechaISO: hoyISO(),
          nombre: r.lead.nombre || "Consulta web",
          contacto: r.lead.contacto,
          campoId: campos[0]?.id ?? null,
          canal: "web",
          estado: "nueva",
          asignado: "Sin asignar",
          notas: "Consulta capturada por el asistente IA de la web.",
        };
        addLead(lead);
        setLeadEnviado(true);
        if (r.lead.nombre) setLeadNombre(r.lead.nombre);
      }
    } catch {
      setMsgs((m) => [
        ...m,
        {
          rol: "asistente",
          texto:
            "Disculpá, el asistente no está disponible en este momento. Escribinos por WhatsApp o dejanos tu mail y te contactamos a la brevedad.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };
  enviarRef.current = enviar;

  return (
    <>
      {/* botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente"
          className="fixed bottom-5 right-5 z-[60] grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-[0_12px_30px_-8px_rgba(12,77,162,0.7)] transition hover:scale-105 hover:bg-brand-600"
        >
          <MessageCircle size={24} />
          <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-sea-300" />
        </button>
      )}

      {/* panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[60] flex h-[min(80vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-graph/10 bg-white shadow-2xl">
          {/* header */}
          <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
                <Waves size={18} />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">Marina · Potente Propiedades</p>
                <p className="text-[11px] text-white/80">Te respondo al toque</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-full p-1 transition hover:bg-white/15">
              <X size={18} />
            </button>
          </div>

          {/* mensajes */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-paper-100 px-3 py-4">
            {msgs.map((m, i) => (
              <div key={i} className={m.rol === "cliente" ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[85%]">
                  <div
                    className={
                      m.rol === "cliente"
                        ? "rounded-2xl rounded-br-sm bg-brand px-3.5 py-2 text-sm text-white"
                        : "rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-sm text-graph shadow-sm ring-1 ring-graph/5"
                    }
                  >
                    {m.texto}
                  </div>
                  {m.campos && (
                    <div className="mt-2 space-y-2">
                      {m.campos.map((c) => (
                        <Link
                          key={c.id}
                          to={`/propiedad/${c.id}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 rounded-xl border border-graph/10 bg-white p-2 transition hover:border-brand/40 hover:shadow-sm"
                        >
                          <img
                            src={c.fotos?.[0] || ""}
                            alt=""
                            className="h-12 w-14 shrink-0 rounded-lg bg-graph/5 object-cover"
                            onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                          />
                          <div className="min-w-0 leading-tight">
                            <p className="truncate text-[13px] font-semibold text-graph">{c.titulo}</p>
                            <p className="truncate text-[11px] text-graph-400">
                              {c.zona}
                              {c.hectareas ? ` · ${fmtHa(c.hectareas)}` : ""}
                            </p>
                            <p className="text-[11px] font-semibold text-brand">
                              {c.categoria === "campo" ? "A consultar" : fmtUSD(c.precioUSD)}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm text-graph-400 shadow-sm ring-1 ring-graph/5">
                  <Loader2 size={15} className="animate-spin text-brand" /> Escribiendo…
                </div>
              </div>
            )}

            {leadEnviado && (
              <p className="pt-1 text-center text-[11px] text-graph-400">✓ Tus datos llegaron a Potente. Un asesor te contacta.</p>
            )}
          </div>

          {/* CTA WhatsApp: derivar la charla a un asesor (aparece apenas arranca la conversación) */}
          {msgs.some((m) => m.rol === "cliente") && (
            <a
              href={linkWhatsApp(waTexto())}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-3 mb-1.5 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            >
              <MessageCircle size={16} /> Seguir por WhatsApp
            </a>
          )}

          {/* input */}
          <div className="flex items-center gap-2 border-t border-graph/10 bg-white px-3 py-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
              aria-label="Escribile a Marina"
              placeholder="Escribí tu consulta…"
              className="h-10 flex-1 rounded-xl border border-graph/15 bg-paper-100 px-3 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand/60 focus:bg-white focus:ring-2 focus:ring-brand/15"
            />
            <button
              onClick={() => enviar()}
              disabled={busy || !input.trim()}
              aria-label="Enviar"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-600 disabled:opacity-40"
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
