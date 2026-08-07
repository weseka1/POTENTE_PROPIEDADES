import { useEffect, useState } from "react";
import {
  Sparkles, BookOpen, SlidersHorizontal, Plus, Trash2, Clock, UserCheck,
  Inbox, TrendingUp, Bot, ShieldCheck, Power, Link2, Activity,
  MessageCircle, Instagram, MessageSquare, Globe, Mail, Phone, Wand2, Zap,
  Send, Loader2, KeyRound, Upload,
} from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { supabase } from "@/lib/supabase";
import { useToast } from "../components/Toast";
import { PageHeader } from "../components/PageShell";
import { canalLabel } from "../ui/estados";
import Modal from "../components/Modal";
import Select from "@/components/Select";
import BandejaConversaciones from "../components/BandejaConversaciones";
import { CANALES_CONV } from "@/data/conversaciones";
import type { Conversacion } from "@/data/conversaciones";

/* ===================== Configuración del cerebro de la IA (self-service) ===================== */
type IAConfig = {
  activa: boolean;
  modo: "auto" | "supervisado";
  nombre: string;
  tono: "cercano" | "formal";
  idioma: string;
  firma: string;
  emojis: boolean;
  reglas: Record<string, boolean>;
  acciones: Record<string, boolean>;
  contexto: string;
  conocimiento: { id: string; tema?: string; texto: string }[];
  canales: Record<string, boolean>;
};

const TEMAS_SUGERIDOS = ["Zonas y barrios", "Preguntas frecuentes", "Precios de referencia", "Formas de pago", "Proceso de compra", "Tasaciones", "Alquileres", "Horarios y contacto"];

const REGLAS = [
  { key: "ofrecerVisita", label: "Ofrecer coordinar una visita al campo" },
  { key: "pedirContacto", label: "Pedir nombre, teléfono y zona de interés" },
  { key: "noPrecioFinal", label: "No cerrar precio final (deriva a un asesor)" },
  { key: "derivarNegociacion", label: "Derivar a una persona si quieren negociar" },
  { key: "derivarLegal", label: "Derivar consultas legales / de escritura" },
];
const ACCIONES = [
  { key: "agendarVisitas", label: "Agendar visitas en la agenda", icon: Clock },
  { key: "enviarFichas", label: "Enviar fichas de propiedades (fotos / PDF)", icon: BookOpen },
  { key: "calificarLeads", label: "Calificar y clasificar cada consulta", icon: TrendingUp },
  { key: "pedirDatos", label: "Pedir y guardar datos de contacto", icon: UserCheck },
  { key: "responderPrecios", label: "Responder precios cuando estén cargados", icon: Zap },
];
const CANALES = [
  { key: "whatsapp", nombre: "WhatsApp", via: "Meta", desc: "Conectá tu agente IA a WhatsApp Business con la función nueva de Meta.", Icon: MessageCircle, color: "#25D366", meta: true, destacado: true },
  { key: "instagram", nombre: "Instagram", via: "Meta", desc: "Respondé los mensajes directos de Instagram automáticamente.", Icon: Instagram, color: "#E1306C", meta: true },
  { key: "messenger", nombre: "Messenger", via: "Meta", desc: "Atendé Facebook Messenger sin estar encima.", Icon: MessageSquare, color: "#0084FF", meta: true },
  { key: "web", nombre: "Chat en tu web", via: "Widget", desc: "Un asistente en tu web propia que responde solo, 24/7.", Icon: Globe, color: "#0C4DA2" },
  { key: "mail", nombre: "Email", via: "Casilla", desc: "Responde y ordena los mails de consultas.", Icon: Mail, color: "#C9A24E" },
  { key: "telefono", nombre: "Teléfono", via: "Registro", desc: "Toma el dato de las llamadas y las deriva.", Icon: Phone, color: "#9C6B3C" },
];

const DEFAULT_IA: IAConfig = {
  activa: true, modo: "auto",
  nombre: "Marina", tono: "cercano", idioma: "Español (rioplatense)", firma: "Equipo Potente Propiedades", emojis: true,
  reglas: { ofrecerVisita: true, pedirContacto: true, noPrecioFinal: true, derivarNegociacion: true, derivarLegal: true },
  acciones: { agendarVisitas: true, enviarFichas: true, calificarLeads: true, pedirDatos: true, responderPrecios: false },
  contexto: "Somos Potente Propiedades, inmobiliaria de Mar del Plata con más de 50 años y tres generaciones en el rubro. Trabajamos venta y alquiler de casas, departamentos, locales y terrenos, con oficinas en Punta Mogotes y Chauvín. Nos conocen por la seriedad y por conocer a fondo cada barrio de la ciudad.",
  conocimiento: [
    { id: "k1", tema: "Zonas y barrios", texto: "Trabajamos propiedades en Punta Mogotes, Chauvín, Playa Grande, Güemes, Centro y alrededores." },
    { id: "k2", tema: "Horarios y contacto", texto: "Horarios para coordinar visitas: Chauvín, lunes a viernes de 9 a 16 hs; Punta Mogotes, lunes a viernes de 9 a 18 hs y sábados hasta las 12." },
    { id: "k3", tema: "Precios de referencia", texto: "Ante una consulta puntual, dar superficie, barrio y características principales. El precio final lo confirma un asesor." },
  ],
  canales: { whatsapp: false, instagram: false, messenger: false, web: true, mail: false, telefono: false },
};

function useIAConfig() {
  const [cfg, setCfg] = useState<IAConfig>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("potente_ia_config") || "{}");
      // Migración 4-ago: horario por oficina — si quedó guardado el texto viejo
      // ("9 a 16 en cualquiera de las dos"), lo pisamos con el default nuevo.
      if (Array.isArray(saved.conocimiento)) {
        saved.conocimiento = saved.conocimiento.map((k: IAConfig["conocimiento"][number]) =>
          k.id === "k2" && k.texto.includes("en cualquiera de las dos oficinas") ? DEFAULT_IA.conocimiento[1] : k
        );
      }
      return { ...DEFAULT_IA, ...saved };
    } catch { return DEFAULT_IA; }
  });
  useEffect(() => { try { localStorage.setItem("potente_ia_config", JSON.stringify(cfg)); } catch { /* noop */ } }, [cfg]);
  return [cfg, setCfg] as const;
}

function Switch({ on, onChange, size = "md" }: { on: boolean; onChange: (v: boolean) => void; size?: "md" | "lg" }) {
  const w = size === "lg" ? "h-7 w-12" : "h-6 w-11", k = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <button type="button" onClick={() => onChange(!on)} className={`relative ${w} shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-graph/20"}`}>
      <span className={`absolute top-0.5 ${k} rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

const TABS = [
  { key: "conversaciones", label: "Conversaciones", Icon: Inbox },
  { key: "canales", label: "Canales", Icon: Link2 },
  { key: "cerebro", label: "Cerebro", Icon: BookOpen },
  { key: "comportamiento", label: "Comportamiento", Icon: SlidersHorizontal },
  { key: "probar", label: "Probar", Icon: Send },
  { key: "actividad", label: "Actividad", Icon: Activity },
];

/* ===== Cerebro real: arma el system prompt desde la config y llama a Claude ===== */
function buildSystem(cfg: IAConfig): string {
  const ctx = cfg.contexto.trim();
  const ko = cfg.conocimiento.filter((k) => k.texto.trim()).map((k) => `- ${k.tema ? `[${k.tema}] ` : ""}${k.texto.trim()}`).join("\n");
  const reglas = [
    cfg.reglas.ofrecerVisita && "Ofrecé coordinar una visita a la propiedad.",
    cfg.reglas.pedirContacto && "Pedí nombre, teléfono y barrio de interés.",
    cfg.reglas.noPrecioFinal && "No des ni cierres precio final; para eso deriva a un asesor humano.",
    cfg.reglas.derivarNegociacion && "Si el cliente quiere negociar, derivá a una persona.",
    cfg.reglas.derivarLegal && "Las consultas legales o de escritura, derivalas a un asesor.",
  ].filter(Boolean).map((r) => `- ${r}`).join("\n");
  return `Sos ${cfg.nombre || "el asistente"}, la asistente virtual de Potente Propiedades, inmobiliaria de Mar del Plata (más de 50 años) que vende y alquila casas, departamentos, locales y terrenos.
Tono: ${cfg.tono === "formal" ? "formal, de usted" : "cercano y profesional"}. Idioma: ${cfg.idioma}. ${cfg.emojis ? "Podés usar algún emoji con medida." : "No uses emojis."}
Cuando corresponda, firmás como "${cfg.firma}".

LO QUE SABÉS DEL NEGOCIO:
${ctx ? ctx + "\n" : ""}${ko || (ctx ? "" : "- (todavía no cargaron datos; respondé en general y ofrecé que un asesor lo contacte)")}

CÓMO TRABAJÁS:
${reglas || "- Respondé con amabilidad y ofrecé ayuda."}

Respondé corto, humano y al grano, como un WhatsApp. NO inventes datos (precios, superficies, propiedades) que no figuren arriba. Si no sabés algo, ofrecé que un asesor lo confirme.`;
}

async function responderConClaude(cfg: IAConfig, msgs: { role: string; content: string }[], key: string): Promise<string> {
  // Sin key en el navegador → usa el servidor (la clave vive segura ahí, como en producción).
  if (!key) {
    // El Probador va con la sesión del panel: del otro lado se verifica contra
    // Supabase. Sin esto el endpoint quedaba abierto a cualquiera de internet.
    const { data: s } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    const token = s?.session?.access_token;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ system: buildSystem(cfg), messages: msgs.map((m) => ({ role: m.role, content: m.content })) }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      const m: string = data?.error || "";
      if (/no está configurado|ANTHROPIC_API_KEY/i.test(m)) throw new Error("El asistente todavía no está activado en el servidor. Cargá la API key en el deploy (o pegá tu clave abajo) para probarlo.");
      if (/credit balance/i.test(m)) throw new Error("La cuenta de Anthropic no tiene créditos. Cargá saldo en console.anthropic.com (Plans & Billing).");
      throw new Error(m || "No se pudo conectar con el asistente.");
    }
    return data?.text || "(sin respuesta)";
  }
  // Con key propia (avanzado) → llamada directa a Anthropic desde el navegador.
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 600, system: buildSystem(cfg), messages: msgs.map((m) => ({ role: m.role, content: m.content })) }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const m: string = data?.error?.message || "";
    if (/credit balance/i.test(m)) throw new Error("La cuenta de Anthropic no tiene créditos. Cargá saldo en console.anthropic.com (Plans & Billing) y volvé a probar.");
    if (/authentication|x-api-key/i.test(m)) throw new Error("La API key no es válida. Revisala.");
    throw new Error(m || "No se pudo conectar con Claude.");
  }
  return data?.content?.[0]?.text || "(sin respuesta)";
}

export default function Asistente() {
  const { leads, propiedades, conversaciones, conversacionesNoLeidas } = useData();
  const { push } = useToast();
  const [cfg, setCfg] = useIAConfig();
  const [tab, setTab] = useState("conversaciones");
  const [conn, setConn] = useState<(typeof CANALES)[number] | null>(null);

  // La IA escribe la respuesta con el mismo cerebro que usa en los canales,
  // leyendo la conversación real. El humano la edita y la manda.
  const redactarRespuesta = async (conv: Conversacion): Promise<string> => {
    const prop = conv.propiedadId ? propiedades.find((p) => p.id === conv.propiedadId) : undefined;
    const hilo = conv.mensajes
      .map((m) => `${m.de === "cliente" ? conv.nombre : m.de === "ia" ? cfg.nombre : "Asesor"}: ${m.texto}`)
      .join("\n");
    const encargo = `Esta es una conversación real por ${CANALES_CONV[conv.canal].label} con ${conv.nombre}${
      prop ? `, que consulta por "${prop.titulo}"` : ""
    }${conv.motivo ? `. Se derivó a un asesor porque: ${conv.motivo}` : ""}.

--- CONVERSACIÓN ---
${hilo}
--- FIN ---

Escribí SOLO el próximo mensaje que le mandaría el asesor, listo para copiar y pegar. Sin encabezados, sin comillas, sin explicar lo que hacés.`;
    const key = (() => { try { return localStorage.getItem("potente_anthropic_key") || ""; } catch { return ""; } })();
    const texto = await responderConClaude(cfg, [{ role: "user", content: encargo }], key);
    return texto.trim();
  };

  const set = (patch: Partial<IAConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const setRegla = (k: string, v: boolean) => setCfg((c) => ({ ...c, reglas: { ...c.reglas, [k]: v } }));
  const setAccion = (k: string, v: boolean) => setCfg((c) => ({ ...c, acciones: { ...c.acciones, [k]: v } }));
  const addConoc = (tema = "") => setCfg((c) => ({ ...c, conocimiento: [...c.conocimiento, { id: "k" + Math.random().toString(36).slice(2, 7), tema, texto: "" }] }));
  const editConoc = (id: string, texto: string) => setCfg((c) => ({ ...c, conocimiento: c.conocimiento.map((k) => (k.id === id ? { ...k, texto } : k)) }));
  const editTema = (id: string, tema: string) => setCfg((c) => ({ ...c, conocimiento: c.conocimiento.map((k) => (k.id === id ? { ...k, tema } : k)) }));
  const delConoc = (id: string) => setCfg((c) => ({ ...c, conocimiento: c.conocimiento.filter((k) => k.id !== id) }));
  const onDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const txt = String(r.result || "").slice(0, 8000); setCfg((c) => ({ ...c, conocimiento: [...c.conocimiento, { id: "k" + Math.random().toString(36).slice(2, 7), tema: "Documento: " + f.name, texto: txt }] })); push("Documento cargado al cerebro ✓", "success"); };
    r.readAsText(f); e.target.value = "";
  };
  const entren = Math.min(100, Math.round((cfg.contexto.trim().length / 600) * 40 + cfg.conocimiento.filter((k) => k.texto.trim()).length * 12));
  const desconectar = (key: string) => { setCfg((c) => ({ ...c, canales: { ...c.canales, [key]: false } })); push("Canal desconectado", "info"); };
  const confirmarConexion = () => {
    if (!conn) return;
    setCfg((c) => ({ ...c, canales: { ...c.canales, [conn.key]: true } }));
    push(conn.meta ? `¡${conn.nombre} conectado! Tu IA ya responde ahí ✓` : `${conn.nombre} conectado ✓`, "success");
    setConn(null);
  };

  // Métricas: todas salen de la bandeja real, ninguna está inventada.
  const teEsperan = conversaciones.filter((c) => c.estado === "vos").length;
  const totalConv = Math.max(conversaciones.length, 1);
  const sinIntervencion = conversaciones.filter((c) => !c.mensajes.some((m) => m.de === "humano")).length;
  const sinHumano = Math.round((sinIntervencion / totalConv) * 100);
  const conectados = CANALES.filter((c) => cfg.canales[c.key]).length;
  const porCanal = leads.reduce<Record<string, number>>((a, l) => ((a[l.canal] = (a[l.canal] || 0) + 1), a), {});
  const intereses: Record<string, number> = {};
  leads.forEach((l) => { const p = propiedades.find((x) => x.id === l.campoId); if (p) intereses[p.zona] = (intereses[p.zona] || 0) + 1; });
  const topIntereses = Object.entries(intereses).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const recientes = [...conversaciones]
    .sort((a, b) => new Date(b.mensajes[b.mensajes.length - 1]?.horaISO ?? 0).getTime() - new Date(a.mensajes[a.mensajes.length - 1]?.horaISO ?? 0).getTime())
    .slice(0, 7);

  const metricas = [
    { icon: Inbox, label: "Conversaciones en la bandeja", value: conversaciones.length },
    { icon: UserCheck, label: "Te esperan a vos", value: teEsperan },
    { icon: Link2, label: "Canales conectados", value: `${conectados}/${CANALES.length}` },
    { icon: ShieldCheck, label: "Resueltas sin que intervengas", value: sinHumano + "%" },
  ];

  const card = "pcard p-5";
  return (
    <div>
      <PageHeader
        title="Asistente IA"
        subtitle="Una sola bandeja para todos los canales. Mirá lo que la IA responde sola, tomá la conversación cuando haga falta y enseñale tu negocio."
      />

      {/* ===== Estado del cerebro ===== */}
      <div className="pcard relative mb-5 overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand opacity-[0.10] blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand ring-1 ring-inset ring-brand/25"><Bot size={24} /></span>
            <div>
              <p className="flex items-center gap-2 font-display text-xl font-semibold text-graph">
                {cfg.nombre || "Tu IA"} está {cfg.activa ? "respondiendo sola" : "en pausa"}
                {cfg.activa && <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-inset ring-brand/30"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> en vivo</span>}
              </p>
              <p className="mt-1 max-w-xl text-sm text-graph-500">Atiende {conectados > 0 ? `${conectados} canal${conectados > 1 ? "es" : ""} conectado${conectados > 1 ? "s" : ""}` : "tus canales"} con la info que cargás, y te deriva solo lo que necesita una persona.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-graph-500">{cfg.activa ? "Activada" : "Pausada"}</span>
            <Switch size="lg" on={cfg.activa} onChange={(v) => { set({ activa: v }); push(v ? "IA activada · responde sola" : "IA en pausa", v ? "success" : "info"); }} />
            <Power size={18} className={cfg.activa ? "text-brand" : "text-graph-400"} />
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metricas.map((m) => (
            <div key={m.label} className="pcard-2 p-4">
              <m.icon size={16} className="text-brand" />
              <p className="mt-2 font-display text-2xl font-semibold text-graph">{m.value}</p>
              <p className="text-xs font-medium text-graph-500">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Tabs ===== */}
      <div className="mb-5 flex flex-wrap gap-1.5 rounded-2xl border border-graph/[0.08] bg-graph/[0.02] p-1.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === t.key ? "bg-brand text-white shadow-[0_8px_18px_-8px_rgba(12,77,162,0.7)]" : "text-graph-500 hover:bg-graph/[0.05] hover:text-graph"}`}>
            <t.Icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* ===================== BANDEJA DE CONVERSACIONES ===================== */}
      {tab === "conversaciones" && (
        <div className="space-y-4">
          <div className="pcard flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-graph">
                {teEsperan
                  ? `${teEsperan} ${teEsperan === 1 ? "conversación te espera" : "conversaciones te esperan"}`
                  : "Ninguna conversación te espera"}
              </h2>
              <p className="mt-0.5 max-w-2xl text-sm text-graph-500">
                Todo lo que entra por cualquier canal cae acá. Ves lo que {cfg.nombre} contesta sola y, cuando algo necesita una
                persona, te lo pasa con el motivo. {conversacionesNoLeidas > 0 && <b className="text-graph">{conversacionesNoLeidas} sin leer.</b>}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> En vivo
            </span>
          </div>

          <BandejaConversaciones
            iaNombre={cfg.nombre || "la IA"}
            iaActiva={cfg.activa}
            canalesConectados={cfg.canales}
            redactar={redactarRespuesta}
            irACanales={() => setTab("canales")}
          />
        </div>
      )}

      {/* ========================= CANALES ========================= */}
      {tab === "canales" && (
        <div className="space-y-5">
          {/* banner Meta */}
          <div className="pcard relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-brand opacity-[0.10] blur-3xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand ring-1 ring-inset ring-brand/25"><Sparkles size={22} /></span>
                <div className="max-w-xl">
                  <p className="font-display text-lg font-semibold text-graph">Conectá tu agente IA por Meta</p>
                  <p className="mt-1 text-sm text-graph-500">Con la función nueva de Meta, enchufás tu IA directo a <b className="text-graph">WhatsApp, Instagram y Messenger</b> en un toque. La IA empieza a responder sola en esos canales.</p>
                </div>
              </div>
            </div>
          </div>

          {/* grilla de canales */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CANALES.map((c) => {
              const on = !!cfg.canales[c.key];
              return (
                <div key={c.key} className={`pcard p-5 ${c.destacado ? "ring-1 ring-brand/25" : ""}`}>
                  <div className="flex items-start justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: c.color }}><c.Icon size={20} /></span>
                    {on ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand-700 ring-1 ring-inset ring-brand/20"><span className="h-1.5 w-1.5 rounded-full bg-brand" /> Conectado</span>
                    ) : (
                      <span className="rounded-full bg-graph/[0.05] px-2.5 py-1 text-[11px] font-semibold text-graph-400 ring-1 ring-inset ring-graph/10">Sin conectar</span>
                    )}
                  </div>
                  <p className="mt-3 flex items-center gap-2 font-display text-base font-semibold text-graph">
                    {c.nombre}
                    {c.via && <span className="rounded-md bg-graph/[0.06] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-graph-400">{c.via}</span>}
                  </p>
                  <p className="mt-1 min-h-[40px] text-[13px] leading-snug text-graph-500">{c.desc}</p>
                  <button onClick={() => (on ? desconectar(c.key) : setConn(c))}
                    className={`mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${on ? "border border-graph/15 text-graph-500 hover:bg-graph/5" : "bg-brand text-white hover:bg-brand-600"}`}>
                    {on ? "Desconectar" : <>{c.meta ? <Sparkles size={15} /> : <Link2 size={15} />} {c.meta ? "Conectar agente IA" : "Conectar"}</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================= CEREBRO ========================= */}
      {tab === "cerebro" && (
        <div className="space-y-5">
          {/* medidor de entrenamiento */}
          <div className={card}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-graph"><BookOpen size={18} className="text-brand" /> El cerebro de tu IA</h2>
                <p className="mt-0.5 text-sm text-graph-500">Cargá TODO lo que sepas de tu negocio — no hay límite. Cuanto más le enseñás, mejor responde y menos se equivoca.</p>
              </div>
              <span className="hidden shrink-0 text-right sm:block">
                <span className="font-display text-3xl font-bold text-brand">{entren}%</span>
                <span className="block text-[11px] font-medium text-graph-400">entrenada</span>
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-graph/[0.06]"><div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${entren}%` }} /></div>
            <p className="mt-1.5 text-[11px] text-graph-400">{entren < 40 ? "Recién arranca — sumale más info para que responda con seguridad." : entren < 80 ? "Va bien. Cuanta más info cargues, más precisa." : "Muy completa 💪 La IA responde con muy buena base."}</p>
          </div>

          {/* contexto general */}
          <div className={card}>
            <h3 className="flex items-center gap-2 font-display text-base font-semibold text-graph"><Wand2 size={16} className="text-brand" /> Contá tu negocio con tus palabras</h3>
            <p className="mt-0.5 text-sm text-graph-500">Escribí libremente todo lo que quieras: quiénes son, cómo trabajan, qué ofrecen, condiciones, lo que sea. Esto es la base del cerebro.</p>
            <textarea value={cfg.contexto} onChange={(e) => set({ contexto: e.target.value })} rows={7}
              placeholder="Ej: Somos una inmobiliaria familiar de Mar del Plata con más de 50 años. Trabajamos venta y alquiler. Conocemos cada barrio de la ciudad y acompañamos en todo el proceso…"
              className="mt-3 w-full resize-y rounded-xl border border-graph/10 bg-graph/[0.03] p-3 text-sm leading-relaxed text-graph outline-none transition placeholder:text-graph-400 focus:border-brand/60 focus:bg-white focus:ring-2 focus:ring-brand/15" />
          </div>

          {/* datos puntuales por tema */}
          <div className={card}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold text-graph"><BookOpen size={16} className="text-brand" /> Datos por tema</h3>
              <span className="text-[11px] text-graph-400">{cfg.conocimiento.length} cargados · se guarda solo</span>
            </div>
            <p className="mt-0.5 text-sm text-graph-500">Sumá datos concretos agrupados por tema. Cada ficha es algo que la IA va a saber. Tocá un tema sugerido o creá el tuyo.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TEMAS_SUGERIDOS.map((t) => (
                <button key={t} onClick={() => addConoc(t)} className="rounded-full border border-dashed border-graph/20 px-2.5 py-1 text-[11px] font-medium text-graph-500 transition hover:border-brand hover:text-brand">+ {t}</button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {cfg.conocimiento.map((k) => (
                <div key={k.id} className="rounded-xl border border-graph/[0.07] bg-graph/[0.02] p-3">
                  <div className="flex items-center gap-2">
                    <input value={k.tema || ""} onChange={(e) => editTema(k.id, e.target.value)} placeholder="Tema (ej: Zonas y barrios)" className="h-8 flex-1 rounded-lg border border-graph/10 bg-paper-100 px-2.5 text-sm font-semibold text-graph outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15" />
                    <button onClick={() => delConoc(k.id)} title="Borrar" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-graph-400 transition hover:bg-red-500/10 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                  <textarea value={k.texto} onChange={(e) => editConoc(k.id, e.target.value)} rows={3} placeholder="Escribí el dato con todo el detalle que quieras…"
                    className="mt-2 w-full resize-y rounded-lg border border-graph/10 bg-paper-100 p-2.5 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand/60 focus:ring-2 focus:ring-brand/15" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => addConoc("")} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-graph/20 px-3 py-2 text-sm font-medium text-graph-500 transition hover:border-brand hover:text-brand"><Plus size={15} /> Agregar dato</button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-graph/20 px-3 py-2 text-sm font-medium text-graph-500 transition hover:border-brand hover:text-brand">
                <Upload size={15} /> Subir documento (.txt)
                <input type="file" accept=".txt,.md,text/plain" className="hidden" onChange={onDoc} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================= COMPORTAMIENTO ========================= */}
      {tab === "comportamiento" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* personalidad */}
          <div className={card}>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-graph"><Wand2 size={18} className="text-brand" /> Personalidad</h2>
            <p className="mt-1 text-sm text-graph-500">Cómo se presenta y habla tu IA.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Nombre del asistente"><input value={cfg.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Marina" className={INP} /></Field>
              <Field label="Tono">
                <Select
                  value={cfg.tono}
                  onChange={(v) => set({ tono: v as IAConfig["tono"] })}
                  options={[
                    { value: "cercano", label: "Cercano y profesional" },
                    { value: "formal", label: "Formal (usted)" },
                  ]}
                />
              </Field>
              <Field label="Idioma"><input value={cfg.idioma} onChange={(e) => set({ idioma: e.target.value })} className={INP} /></Field>
              <Field label="Firma"><input value={cfg.firma} onChange={(e) => set({ firma: e.target.value })} className={INP} /></Field>
            </div>
            <label className="mt-4 flex items-center justify-between rounded-xl border border-graph/[0.07] bg-graph/[0.02] px-3 py-2.5">
              <span className="text-sm text-graph">Usar emojis con medida 🙂</span>
              <Switch on={cfg.emojis} onChange={(v) => set({ emojis: v })} />
            </label>
            {/* modo */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button onClick={() => set({ modo: "auto" })} className={`rounded-xl border p-3 text-left transition ${cfg.modo === "auto" ? "border-brand bg-brand/[0.06] ring-1 ring-brand/30" : "border-graph/12 hover:border-graph/25"}`}>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-graph"><Sparkles size={14} className="text-brand" /> Automático</span>
                <span className="mt-0.5 block text-[12px] text-graph-500">Responde sola, sin aprobar nada. (Recomendado)</span>
              </button>
              <button onClick={() => set({ modo: "supervisado" })} className={`rounded-xl border p-3 text-left transition ${cfg.modo === "supervisado" ? "border-brand bg-brand/[0.06] ring-1 ring-brand/30" : "border-graph/12 hover:border-graph/25"}`}>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-graph"><MessageSquare size={14} className="text-graph-500" /> Supervisado</span>
                <span className="mt-0.5 block text-[12px] text-graph-500">Deja el borrador y vos lo soltás.</span>
              </button>
            </div>
          </div>

          {/* reglas + acciones */}
          <div className="space-y-5">
            <div className={card}>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-graph"><SlidersHorizontal size={18} className="text-brand" /> Reglas</h2>
              <div className="mt-3 divide-y divide-graph/[0.06]">
                {REGLAS.map((r) => (
                  <div key={r.key} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-sm text-graph">{r.label}</span>
                    <Switch on={!!cfg.reglas[r.key]} onChange={(v) => setRegla(r.key, v)} />
                  </div>
                ))}
              </div>
            </div>
            <div className={card}>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-graph"><Zap size={18} className="text-brand" /> Qué puede hacer</h2>
              <p className="mt-1 text-sm text-graph-500">Las acciones que la IA ejecuta sola.</p>
              <div className="mt-3 divide-y divide-graph/[0.06]">
                {ACCIONES.map((a) => (
                  <div key={a.key} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-graph"><a.icon size={15} className="text-graph-400" /> {a.label}</span>
                    <Switch on={!!cfg.acciones[a.key]} onChange={(v) => setAccion(a.key, v)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================= PROBAR ========================= */}
      {tab === "probar" && <Probador cfg={cfg} />}

      {/* ========================= ACTIVIDAD ========================= */}
      {tab === "actividad" && (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* min-w-0 en las columnas: sin eso el grid les da min-width:auto, no ceden
              y estiran la página entera en pantallas angostas. */}
          <div className={`${card} min-w-0`}>
            <h3 className="flex items-center gap-2 font-display text-base font-semibold text-graph"><Activity size={16} className="text-brand" /> Lo que respondió la IA</h3>
            <p className="mt-0.5 text-xs text-graph-400">Las últimas conversaciones de la bandeja (solo para mirar)</p>
            <div className="mt-3 space-y-2.5">
              {recientes.map((c) => {
                const p = propiedades.find((x) => x.id === c.propiedadId);
                const meta = CANALES_CONV[c.canal];
                const derivada = c.estado === "vos";
                return (
                  <div key={c.id} className="flex items-start gap-3 rounded-xl border border-graph/[0.06] bg-graph/[0.02] p-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: meta.color }}>
                      <Sparkles size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-graph">{c.nombre}</p>
                      <p className="truncate text-[12px] text-graph-400">{p ? p.titulo : "Consulta general"} · {meta.label}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${derivada ? "bg-amber-500/12 text-amber-700 ring-amber-500/25" : "bg-brand/10 text-brand-700 ring-brand/20"}`}>
                      {derivada ? "Derivada a vos" : c.estado === "cerrada" ? "Cerrada" : "Resuelta por IA"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="min-w-0 space-y-5">
            <div className={card}>
              <h3 className="flex items-center gap-2 font-display text-base font-semibold text-graph"><TrendingUp size={16} className="text-brand" /> Qué están buscando</h3>
              <div className="mt-4 space-y-2">
                {topIntereses.map(([k, v]) => {
                  const max = topIntereses[0][1];
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-sm"><span className="text-graph">{k}</span><span className="font-semibold text-brand">{v}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-graph/[0.06]"><div className="h-full rounded-full bg-brand" style={{ width: `${(v / max) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={card}>
              <h3 className="font-display text-base font-semibold text-graph">Por dónde entran</h3>
              <div className="mt-4 space-y-2.5">
                {Object.entries(porCanal).sort((a, b) => b[1] - a[1]).map(([canal, n]) => (
                  <div key={canal} className="flex items-center justify-between">
                    <span className="text-sm text-graph-500">{canalLabel[canal] || canal}</span>
                    <span className="rounded-full bg-graph/[0.06] px-2.5 py-0.5 text-xs font-semibold text-graph">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* paso a paso de conexión — lo hacen ellos solos */}
      <Modal open={!!conn} onClose={() => setConn(null)}
        title={conn ? `Conectar ${conn.nombre}` : ""}
        subtitle={conn?.meta ? "Con la función nueva de Meta — lo hacés vos, en 3 pasos" : "Lo dejás andando en un par de pasos"}
        footer={
          <>
            <button onClick={() => setConn(null)} className="inline-flex h-9 items-center rounded-lg border border-graph/15 px-4 text-sm font-medium text-graph-500 transition hover:text-graph">Cancelar</button>
            <button onClick={confirmarConexion} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-600">{conn?.meta ? <><Sparkles size={15} /> Ir a Meta y autorizar</> : <><Link2 size={15} /> Conectar</>}</button>
          </>
        }>
        {conn && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white" style={{ background: conn.color }}><conn.Icon size={22} /></span>
              <div>
                <p className="font-display text-base font-semibold text-graph">{conn.nombre}</p>
                <p className="text-xs text-graph-400">{conn.desc}</p>
              </div>
            </div>
            <ol className="space-y-2.5">
              {(conn.meta
                ? ["Te llevamos a Meta (Facebook / WhatsApp Business).", `Elegís tu cuenta de ${conn.nombre} Business.`, "Autorizás a tu agente IA. Listo, responde solo."]
                : conn.key === "web" ? ["Copiás un código que te damos.", "Lo pegás en tu web (o lo hace tu técnico).", "El chat queda andando 24/7."]
                : conn.key === "mail" ? ["Conectás tu casilla de correo.", "La IA lee y responde las consultas que entran por mail."]
                : ["Registrás tu número de teléfono.", "La IA toma el dato de las llamadas y las deriva."]
              ).map((paso, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">{i + 1}</span>
                  <span className="text-sm text-graph">{paso}</span>
                </li>
              ))}
            </ol>
            <p className="rounded-xl bg-brand/[0.06] px-3 py-2.5 text-[12px] text-brand-700">Lo hacés vos, sin depender de nadie. Cuando quieras lo desconectás con un click.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

const INP = "h-10 w-full rounded-xl border border-graph/15 bg-paper-100 px-3 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand/60 focus:bg-white focus:ring-2 focus:ring-brand/15";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-graph-400">{label}</span>
      {children}
    </label>
  );
}

/* ===== Probador: la IA responde DE VERDAD con Claude usando la config ===== */
const EJEMPLOS = ["Hola! Tienen departamentos en Playa Grande?", "Busco una casa de 3 ambientes en Chauvín", "Quiero vender mi propiedad, cómo es?"];

function Probador({ cfg }: { cfg: IAConfig }) {
  const [key, setKey] = useState<string>(() => { try { return localStorage.getItem("potente_anthropic_key") || ""; } catch { return ""; } });
  const [kin, setKin] = useState("");
  const [avanzado, setAvanzado] = useState(false);
  const [msgs, setMsgs] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const saveKey = () => { const k = kin.trim(); if (!k) return; try { localStorage.setItem("potente_anthropic_key", k); } catch { /* noop */ } setKey(k); setKin(""); setAvanzado(false); };
  const clearKey = () => { try { localStorage.removeItem("potente_anthropic_key"); } catch { /* noop */ } setKey(""); };

  const enviar = async (texto?: string) => {
    const q = (texto ?? input).trim(); if (!q || busy) return;
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next); setInput(""); setErr(""); setBusy(true);
    try { const text = await responderConClaude(cfg, next, key); setMsgs([...next, { role: "assistant", content: text }]); }
    catch (e: any) { setErr(e?.message || "No se pudo conectar."); }
    setBusy(false);
  };

  return (
    <div className="pcard mx-auto max-w-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-graph/[0.08] px-5 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-graph"><Bot size={17} className="text-brand" /> Probá a {cfg.nombre || "tu IA"} en vivo</span>
        {key ? (
          <button onClick={clearKey} className="text-[11px] font-medium text-brand transition hover:text-brand-700">Usando tu clave · quitar</button>
        ) : (
          <button onClick={() => setAvanzado((v) => !v)} className="text-[11px] font-medium text-graph-400 transition hover:text-graph">Usar mi API key</button>
        )}
      </div>

      {avanzado && !key && (
        <div className="flex items-center gap-2 border-b border-graph/[0.08] bg-graph/[0.02] px-5 py-2.5">
          <KeyRound size={15} className="shrink-0 text-graph-400" />
          <input value={kin} onChange={(e) => setKin(e.target.value)} type="password" placeholder="sk-ant-…  (opcional: por defecto usa el servidor)"
            className="h-9 flex-1 rounded-lg border border-graph/15 bg-paper-100 px-3 text-sm text-graph outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15" />
          <button onClick={saveKey} className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-xs font-semibold text-white transition hover:bg-brand-600">Guardar</button>
        </div>
      )}

      <div className="max-h-[46vh] min-h-[220px] space-y-3 overflow-y-auto bg-graph/[0.015] px-5 py-4">
        {msgs.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-sm text-graph-500">Escribile como si fueras un cliente. Responde con lo que cargaste en el Cerebro.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {EJEMPLOS.map((e) => (
                <button key={e} onClick={() => enviar(e)} className="rounded-full border border-graph/15 px-3 py-1.5 text-xs font-medium text-graph-500 transition hover:border-brand hover:text-brand">{e}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-brand text-white" : "border border-graph/10 bg-paper-100 text-graph"}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="inline-flex items-center gap-2 rounded-2xl border border-graph/10 bg-paper-100 px-3.5 py-2 text-sm text-graph-400"><Loader2 size={14} className="animate-spin" /> escribiendo…</div></div>}
        {err && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
      </div>

      <div className="flex items-center gap-2 border-t border-graph/[0.08] px-4 py-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} placeholder="Escribí una consulta…"
          className="h-10 flex-1 rounded-xl border border-graph/15 bg-paper-100 px-3 text-sm text-graph outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15" />
        <button onClick={() => enviar()} disabled={busy || !input.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-600 disabled:opacity-50"><Send size={17} /></button>
      </div>
    </div>
  );
}
