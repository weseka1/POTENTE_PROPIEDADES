import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle, Instagram, MessageSquare, Globe, Mail, Phone, Sparkles, Send, Loader2,
  ArrowLeft, Check, CheckCheck, Clock, Hand, Bot, X, Building2, Trash2, PhoneCall, Copy, Inbox, CircleSlash,
} from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { useToast } from "./Toast";
import { CANALES_CONV, ORDEN_CANALES } from "@/data/conversaciones";
import type { CanalConv, Conversacion, MensajeConv } from "@/data/conversaciones";

const ICONO: Record<CanalConv, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  messenger: MessageSquare,
  web: Globe,
  mail: Mail,
  telefono: Phone,
};

/* ===== Tiempo relativo, en criollo ===== */
function haceCuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const hs = Math.round(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  const d = Math.round(hs / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

/* ===== Link para responder según el canal ===== */
function linkDe(conv: Conversacion, texto: string): string | null {
  const { modo } = CANALES_CONV[conv.canal];
  const digitos = conv.contacto.replace(/\D/g, "");
  if (modo === "wa") return digitos.length >= 8 ? `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}` : null;
  if (modo === "mail")
    return `mailto:${conv.contacto}?subject=${encodeURIComponent("Potente Propiedades")}&body=${encodeURIComponent(texto)}`;
  if (modo === "tel") return digitos.length >= 6 ? `tel:+${digitos}` : null;
  if (modo === "app")
    return conv.canal === "instagram"
      ? `https://ig.me/m/${conv.contacto.replace(/^@/, "")}`
      : "https://www.messenger.com/";
  return null; // widget: sale del propio sistema
}

function labelEnvio(canal: CanalConv): string {
  switch (CANALES_CONV[canal].modo) {
    case "wa": return "Abrir WhatsApp";
    case "mail": return "Abrir el mail";
    case "tel": return "Llamar";
    case "app": return canal === "instagram" ? "Copiar y abrir Instagram" : "Copiar y abrir Messenger";
    default: return "Enviar por el chat";
  }
}

/* ===== Burbuja de canal (el filtro) ===== */
function BurbujaCanal({
  canal, activo, total, sinLeer, onClick, conectado,
}: { canal: CanalConv | "todos"; activo: boolean; total: number; sinLeer: number; onClick: () => void; conectado?: boolean }) {
  const esTodos = canal === "todos";
  const meta = esTodos ? null : CANALES_CONV[canal];
  const Icon = esTodos ? Inbox : ICONO[canal];
  return (
    <button
      onClick={onClick}
      title={esTodos ? "Todos los canales" : conectado ? `${meta!.label} · conectado` : `${meta!.label} · sin conectar`}
      className={`group relative inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        activo
          ? "border-transparent bg-brand text-white shadow-[0_8px_18px_-10px_rgba(12,77,162,0.9)]"
          : "border-graph/12 text-graph-500 hover:border-graph/25 hover:text-graph"
      }`}
    >
      <span
        className="grid h-5 w-5 place-items-center rounded-full"
        style={activo || esTodos ? undefined : { color: meta!.color }}
      >
        <Icon size={14} />
      </span>
      {esTodos ? "Todos" : meta!.corto}
      <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${activo ? "bg-white/20" : "bg-graph/[0.07] text-graph-500"}`}>
        {total}
      </span>
      {sinLeer > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white ring-2 ring-paper">
          {sinLeer}
        </span>
      )}
      {!esTodos && !conectado && !activo && (
        <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-graph/25" />
      )}
    </button>
  );
}

/* ===== Un mensaje del hilo ===== */
function Burbuja({
  msg, iaNombre, canal, onConfirmar, onBorrar,
}: {
  msg: MensajeConv; iaNombre: string; canal: CanalConv;
  onConfirmar: () => void; onBorrar: () => void;
}) {
  const mio = msg.de !== "cliente";
  const esIA = msg.de === "ia";
  const pendiente = msg.de === "humano" && msg.envio === "abierto";

  return (
    <div className={`flex flex-col ${mio ? "items-end" : "items-start"}`}>
      {mio && (
        <span className="mb-1 flex items-center gap-1 pr-1 text-[10px] font-bold uppercase tracking-wide text-graph-400">
          {esIA ? <><Sparkles size={10} className="text-brand" /> {iaNombre} · IA</> : <><Hand size={10} /> Vos</>}
        </span>
      )}
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
          !mio
            ? "rounded-tl-sm border border-graph/10 bg-paper-100 text-graph"
            : esIA
            ? "rounded-tr-sm bg-brand/[0.08] text-graph ring-1 ring-inset ring-brand/15"
            : "rounded-tr-sm bg-brand text-white"
        }`}
      >
        {msg.texto}
      </div>
      <span className="mt-1 flex items-center gap-1 px-1 text-[10px] text-graph-400">
        {hora(msg.horaISO)}
        {msg.de === "humano" && msg.envio === "enviado" && <CheckCheck size={12} className="text-brand" />}
        {pendiente && <Clock size={12} className="text-amber-600" />}
      </span>

      {/* El panel no puede ver tu WhatsApp: preguntamos en vez de suponer. */}
      {pendiente && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-1.5">
          <span className="text-[11px] font-medium text-amber-800">
            Abrimos {CANALES_CONV[canal].label} con este texto. ¿Lo mandaste?
          </span>
          <button
            onClick={onConfirmar}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-2 py-1 text-[11px] font-bold text-white transition hover:bg-brand-600"
          >
            <Check size={11} /> Sí, lo mandé
          </button>
          <button
            onClick={onBorrar}
            title="No lo mandé — sacalo del hilo"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-graph-400 transition hover:bg-graph/[0.06] hover:text-graph"
          >
            <Trash2 size={11} /> No lo mandé
          </button>
        </div>
      )}
    </div>
  );
}

/* ===================================================================== */
export default function BandejaConversaciones({
  iaNombre, iaActiva, canalesConectados, redactar, irACanales,
}: {
  iaNombre: string;
  iaActiva: boolean;
  canalesConectados: Record<string, boolean>;
  /** Pide a la IA un borrador con el cerebro cargado. Devuelve el texto. */
  redactar: (conv: Conversacion) => Promise<string>;
  irACanales: () => void;
}) {
  const {
    conversaciones, propiedades, marcarLeida, agregarMensaje, actualizarMensaje, borrarMensaje,
    setEstadoConversacion, updateLead,
  } = useData();
  const { push } = useToast();

  const [filtro, setFiltro] = useState<CanalConv | "todos">("todos");
  const [selId, setSelId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [redactando, setRedactando] = useState(false);
  const [verHiloMobile, setVerHiloMobile] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  const ordenadas = useMemo(() => {
    const ultima = (c: Conversacion) => new Date(c.mensajes[c.mensajes.length - 1]?.horaISO ?? 0).getTime();
    return [...conversaciones].sort((a, b) => ultima(b) - ultima(a));
  }, [conversaciones]);

  const visibles = useMemo(
    () => (filtro === "todos" ? ordenadas : ordenadas.filter((c) => c.canal === filtro)),
    [ordenadas, filtro]
  );

  // Siempre dentro del canal filtrado: si filtrás Instagram, no queda abierto un WhatsApp.
  const sel = visibles.find((c) => c.id === selId) ?? visibles[0] ?? null;
  useEffect(() => {
    if (sel && sel.id !== selId) setSelId(sel.id);
  }, [sel, selId]);

  useEffect(() => {
    if (sel?.noLeida) marcarLeida(sel.id);
    setTexto("");
  }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [sel?.id, sel?.mensajes.length]);

  const conteo = (canal: CanalConv | "todos") =>
    canal === "todos" ? conversaciones.length : conversaciones.filter((c) => c.canal === canal).length;
  const sinLeer = (canal: CanalConv | "todos") =>
    (canal === "todos" ? conversaciones : conversaciones.filter((c) => c.canal === canal)).filter((c) => c.noLeida).length;

  const abrir = (c: Conversacion) => { setSelId(c.id); setVerHiloMobile(true); };

  /* ===== Acciones sobre el hilo ===== */
  const tomar = async () => {
    if (!sel) return;
    await setEstadoConversacion(sel.id, "vos");
    push(`${iaNombre} dejó de responder en esta conversación. La seguís vos.`, "info");
  };
  const devolver = async () => {
    if (!sel) return;
    await setEstadoConversacion(sel.id, "ia");
    push(`${iaNombre} vuelve a atender esta conversación`, "success");
  };
  const cerrar = async () => {
    if (!sel) return;
    await setEstadoConversacion(sel.id, "cerrada");
    push("Conversación cerrada", "info");
  };

  const pedirBorrador = async () => {
    if (!sel || redactando) return;
    setRedactando(true);
    try {
      setTexto(await redactar(sel));
    } catch (e: any) {
      push(e?.message || "No se pudo redactar el borrador", "error");
    }
    setRedactando(false);
  };

  const enviar = async () => {
    if (!sel) return;
    const t = texto.trim();
    const { modo } = CANALES_CONV[sel.canal];
    if (!t && modo !== "tel") return;

    const href = linkDe(sel, t);

    // Llamar no manda texto: abre el teléfono y deja la nota en el hilo.
    if (modo === "tel") {
      if (href) window.location.href = href;
      if (t) {
        await agregarMensaje(sel.id, {
          id: "MSG-" + Date.now(), de: "humano", texto: t, horaISO: new Date().toISOString(), envio: "enviado",
        });
      }
      setTexto("");
      push("Se abrió el teléfono. La nota quedó en el hilo.", "info");
      return;
    }

    // Instagram y Messenger no aceptan texto en el link: lo copiamos.
    if (modo === "app") await navigator.clipboard?.writeText(t).catch(() => {});
    if (href) window.open(href, "_blank", "noopener");

    await agregarMensaje(sel.id, {
      id: "MSG-" + Date.now(),
      de: "humano",
      texto: t,
      horaISO: new Date().toISOString(),
      // El chat de nuestra web sí lo controla el sistema; los demás canales, no.
      envio: modo === "widget" ? "enviado" : "abierto",
    });
    if (sel.estado === "ia") await setEstadoConversacion(sel.id, "vos");
    setTexto("");

    push(
      modo === "widget"
        ? "Mensaje enviado por el chat de tu web"
        : modo === "app"
        ? "Texto copiado. Pegalo en la conversación que se abrió."
        : `Se abrió ${CANALES_CONV[sel.canal].label} con el mensaje listo`,
      modo === "widget" ? "success" : "info"
    );
  };

  // Confirmar que salió: recién ahí el lead pasa a "contactado".
  const confirmar = async (msgId: string) => {
    if (!sel) return;
    await actualizarMensaje(sel.id, msgId, { envio: "enviado" });
    if (sel.leadId) await updateLead(sel.leadId, { estado: "contactado" });
    push("Anotado. Queda registrado como enviado.", "success");
  };

  const canalMeta = sel ? CANALES_CONV[sel.canal] : null;
  const IconCanal = sel ? ICONO[sel.canal] : Inbox;
  const conectado = sel ? !!canalesConectados[sel.canal] : false;
  const iaAtiende = sel?.estado === "ia" && iaActiva && conectado;
  const prop = sel?.propiedadId ? propiedades.find((p) => p.id === sel.propiedadId) : undefined;
  const modo = canalMeta?.modo;

  return (
    <div className="pcard overflow-hidden">
      {/* ===== Burbujas de canal ===== */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-graph/[0.08] px-4 py-3">
        <BurbujaCanal canal="todos" activo={filtro === "todos"} total={conteo("todos")} sinLeer={sinLeer("todos")} onClick={() => setFiltro("todos")} />
        <span className="h-5 w-px shrink-0 bg-graph/10" />
        {ORDEN_CANALES.map((c) => (
          <BurbujaCanal
            key={c}
            canal={c}
            activo={filtro === c}
            total={conteo(c)}
            sinLeer={sinLeer(c)}
            conectado={!!canalesConectados[c]}
            onClick={() => setFiltro(c)}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,330px)_1fr]">
        {/* ===== Lista ===== */}
        <aside
          data-bandeja="lista"
          className={`max-h-[540px] min-h-[420px] overflow-y-auto border-graph/[0.08] lg:border-r ${
            verHiloMobile ? "hidden lg:block" : "block"
          }`}
        >
          {visibles.length === 0 ? (
            <div className="grid h-full place-items-center px-6 py-16 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-graph/[0.05] text-graph-400"><Inbox size={22} /></span>
                <p className="mt-3 text-sm font-semibold text-graph">No hay conversaciones en este canal</p>
                <p className="mt-1 text-xs text-graph-400">Probá con otro canal o mirá todas juntas.</p>
              </div>
            </div>
          ) : (
            visibles.map((c) => {
              const Icon = ICONO[c.canal];
              const ultimo = c.mensajes[c.mensajes.length - 1];
              const activa = sel?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => abrir(c)}
                  className={`flex w-full items-start gap-3 border-b border-graph/[0.05] px-4 py-3 text-left transition ${
                    activa ? "bg-brand/[0.06]" : "hover:bg-graph/[0.02]"
                  }`}
                >
                  <span className="relative shrink-0">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-graph/[0.05] font-display text-sm font-bold text-graph-500">
                      {c.nombre.charAt(0).toUpperCase()}
                    </span>
                    <span
                      className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full text-white ring-2 ring-paper"
                      style={{ background: CANALES_CONV[c.canal].color }}
                    >
                      <Icon size={11} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${c.noLeida ? "font-bold text-graph" : "font-semibold text-graph-500"}`}>
                        {c.nombre}
                      </span>
                      <span className="shrink-0 text-[10px] text-graph-400">{ultimo && haceCuanto(ultimo.horaISO)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {ultimo?.de === "ia" && <Sparkles size={11} className="shrink-0 text-brand" />}
                      {ultimo?.de === "humano" && <CheckCheck size={11} className="shrink-0 text-graph-400" />}
                      <span className={`truncate text-[12px] ${c.noLeida ? "text-graph" : "text-graph-400"}`}>{ultimo?.texto}</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5">
                      {c.estado === "vos" ? (
                        <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-500/25">
                          Te toca a vos
                        </span>
                      ) : c.estado === "cerrada" ? (
                        <span className="rounded-full bg-graph/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-graph-400">Cerrada</span>
                      ) : (
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand/20">
                          {iaNombre} responde
                        </span>
                      )}
                      {c.noLeida && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </aside>

        {/* ===== Hilo ===== */}
        <section data-bandeja="hilo" className={`flex max-h-[540px] min-h-[420px] flex-col ${verHiloMobile ? "flex" : "hidden lg:flex"}`}>
          {!sel ? (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Inbox size={26} /></span>
                <p className="mt-4 font-display text-lg text-graph">Elegí una conversación</p>
                <p className="mt-1 text-sm text-graph-400">Vas a ver todo el ida y vuelta, incluso lo que contestó {iaNombre} sola.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Encabezado del hilo */}
              <header className="flex flex-wrap items-center gap-3 border-b border-graph/[0.08] px-4 py-3">
                <button onClick={() => setVerHiloMobile(false)} className="grid h-9 w-9 place-items-center rounded-lg text-graph-500 transition hover:bg-graph/5 lg:hidden" aria-label="Volver">
                  <ArrowLeft size={18} />
                </button>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: canalMeta!.color }}>
                  <IconCanal size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold text-graph">{sel.nombre}</p>
                  <p className="truncate text-[11px] text-graph-400">
                    {canalMeta!.label} · {sel.contacto}
                    {prop && (
                      <>
                        {" · "}
                        <a
                          href={`/propiedad/${prop.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Ver la ficha publicada"
                          className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                        >
                          <Building2 size={10} /> {prop.titulo}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {sel.estado === "ia" && (
                    <button onClick={tomar} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-graph/15 px-3 text-xs font-semibold text-graph-500 transition hover:border-brand/40 hover:text-brand">
                      <Hand size={13} /> Tomar la conversación
                    </button>
                  )}
                  {sel.estado === "vos" && (
                    <button onClick={devolver} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-graph/15 px-3 text-xs font-semibold text-graph-500 transition hover:border-brand/40 hover:text-brand">
                      <Bot size={13} /> Devolver a {iaNombre}
                    </button>
                  )}
                  {sel.estado !== "cerrada" ? (
                    <button onClick={cerrar} title="Cerrar conversación" className="grid h-9 w-9 place-items-center rounded-xl border border-graph/15 text-graph-400 transition hover:border-red-400/40 hover:text-red-600">
                      <X size={15} />
                    </button>
                  ) : (
                    <button onClick={devolver} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-graph/15 px-3 text-xs font-semibold text-graph-500 transition hover:border-brand/40 hover:text-brand">
                      Reabrir
                    </button>
                  )}
                </div>
              </header>

              {/* Avisos de contexto */}
              {sel.estado === "vos" && sel.motivo && (
                <p className="flex items-start gap-2 border-b border-amber-500/15 bg-amber-500/[0.06] px-4 py-2.5 text-[12px] text-amber-800">
                  <Hand size={13} className="mt-0.5 shrink-0" />
                  <span><b>{iaNombre} te la pasó:</b> {sel.motivo}</span>
                </p>
              )}
              {iaAtiende && (
                <p className="flex items-center gap-2 border-b border-brand/15 bg-brand/[0.05] px-4 py-2.5 text-[12px] text-brand-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                  {iaNombre} está respondiendo sola en {canalMeta!.label}. Si escribís vos, toma el control.
                </p>
              )}
              {sel.estado === "ia" && !conectado && (
                <p className="flex flex-wrap items-center gap-2 border-b border-graph/[0.08] bg-graph/[0.02] px-4 py-2.5 text-[12px] text-graph-500">
                  <CircleSlash size={13} className="shrink-0 text-graph-400" />
                  {canalMeta!.label} no está conectado, así que {iaNombre} no responde sola acá.
                  <button onClick={irACanales} className="font-semibold text-brand hover:underline">Conectar canal</button>
                </p>
              )}
              {sel.estado === "cerrada" && (
                <p className="flex items-center gap-2 border-b border-graph/[0.08] bg-graph/[0.02] px-4 py-2.5 text-[12px] text-graph-500">
                  <Check size={13} /> Conversación cerrada. Podés reabrirla cuando quieras.
                </p>
              )}

              {/* Mensajes */}
              <div className="flex-1 space-y-4 overflow-y-auto bg-graph/[0.015] px-4 py-4">
                {sel.mensajes.map((msg) => (
                  <Burbuja
                    key={msg.id}
                    msg={msg}
                    iaNombre={iaNombre}
                    canal={sel.canal}
                    onConfirmar={() => confirmar(msg.id)}
                    onBorrar={() => borrarMensaje(sel.id, msg.id)}
                  />
                ))}
                <div ref={finRef} />
              </div>

              {/* Redactar y responder */}
              <div className="border-t border-graph/[0.08] px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={pedirBorrador}
                    disabled={redactando}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-graph/20 px-3 py-1.5 text-[11px] font-semibold text-graph-500 transition hover:border-brand hover:text-brand disabled:opacity-50"
                  >
                    {redactando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {redactando ? "Redactando…" : `Que ${iaNombre} escriba la respuesta`}
                  </button>
                  {texto.trim() && (
                    <button
                      onClick={() => { navigator.clipboard?.writeText(texto); push("Mensaje copiado", "info"); }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-graph-400 transition hover:text-graph"
                    >
                      <Copy size={11} /> Copiar
                    </button>
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enviar(); }}
                    rows={2}
                    placeholder={modo === "tel" ? "Nota de la llamada (opcional)…" : "Escribí la respuesta…"}
                    className="max-h-32 min-h-[52px] flex-1 resize-y rounded-xl border border-graph/15 bg-paper-100 px-3 py-2.5 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand/60 focus:bg-white focus:ring-2 focus:ring-brand/15"
                  />
                  <button
                    onClick={enviar}
                    disabled={!texto.trim() && modo !== "tel"}
                    className="inline-flex h-[52px] shrink-0 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {modo === "tel" ? <PhoneCall size={16} /> : <Send size={16} />}
                    <span className="hidden sm:inline">{labelEnvio(sel.canal)}</span>
                  </button>
                </div>
                <p className="mt-1.5 text-[10.5px] leading-snug text-graph-400">
                  {modo === "widget"
                    ? "El chat de tu web sale desde acá: se envía de verdad."
                    : modo === "tel"
                    ? "Se abre el teléfono. La nota queda registrada en el hilo."
                    : `El panel abre ${canalMeta!.label} con el texto listo — el mensaje lo mandás vos y después confirmás acá.`}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
