/**
 * LA CONSULTA, ABIERTA — qué preguntó, por qué propiedad y cómo seguirla.
 * ─────────────────────────────────────────────────────────────────────────────
 * Pedido de Mateo (27-ago): la bandeja mostraba "Eric · Consulta capturada por
 * el asistente IA de la web" y nada más. No había forma de saber QUÉ preguntó.
 * Desde hoy la charla con Marina se guarda en la bandeja (canal Web) vinculada
 * a la consulta, y acá se lee entera: contacto, propiedad, conversación, notas.
 *
 * Las consultas anteriores a este cambio no tienen conversación guardada, y se
 * dice: no se inventa un resumen.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, MessageCircle, Phone, Mail, Inbox, Sparkles, ExternalLink, User } from "lucide-react";
import Drawer from "./Drawer";
import Badge from "./Badge";
import ChannelIcon from "./ChannelIcon";
import { Btn } from "./Controls";
import { useToast } from "./Toast";
import { useData } from "@/lib/DataProvider";
import type { Lead } from "@/data/types";
import type { MensajeConv } from "@/data/conversaciones";
import { desde, fmtPrecio } from "@/lib/format";
import { estadoLead, canalLabel } from "../ui/estados";
import { SITIO } from "@/config/marca";
import { cn } from "../ui/cn";

/** Del contacto tal cual lo dejó la persona a un link que abra algo útil. */
function linksDeContacto(contacto: string): { wa?: string; tel?: string; mail?: string } {
  const c = contacto.trim();
  if (!c) return {};
  if (c.includes("@")) return { mail: `mailto:${c}` };
  const digitos = c.replace(/\D/g, "");
  if (digitos.length < 8) return {};
  // Números argentinos sin código de país: WhatsApp los quiere con 54 9.
  const wa = digitos.startsWith("54") ? digitos : `549${digitos.replace(/^0/, "").replace(/^15/, "")}`;
  return { wa: `https://wa.me/${wa}`, tel: `tel:${c.startsWith("+") ? c : "+" + wa}` };
}

const hora = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

function Burbuja({ m, quien }: { m: MensajeConv; quien: string }) {
  const esCliente = m.de === "cliente";
  const esIA = m.de === "ia";
  return (
    <div className={cn("flex", esCliente ? "justify-start" : "justify-end")}>
      <div className="max-w-[85%]">
        <p className={cn("mb-0.5 flex items-center gap-1 text-[10.5px] font-medium text-graph-400", !esCliente && "justify-end")}>
          {esIA && <Sparkles size={10} className="text-brand" />}
          {esCliente ? quien : esIA ? "Marina" : "Asesor"} · {hora(m.horaISO)}
        </p>
        <div className={cn(
          "whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          esCliente ? "rounded-bl-sm bg-white text-graph shadow-sm ring-1 ring-graph/5" : esIA ? "rounded-br-sm bg-brand/10 text-graph" : "rounded-br-sm bg-brand text-white",
        )}>
          {m.texto}
        </div>
      </div>
    </div>
  );
}

export default function ConsultaDrawer({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const { getProp, conversaciones, updateLead } = useData();
  const { push } = useToast();
  const navigate = useNavigate();
  const [notas, setNotas] = useState(lead?.notas ?? "");
  useEffect(() => { setNotas(lead?.notas ?? ""); }, [lead?.id, lead?.notas]);

  const prop = lead?.campoId ? getProp(lead.campoId) : null;
  const conv = lead ? conversaciones.find((c) => c.leadId === lead.id) : undefined;
  const e = lead ? estadoLead[lead.estado] : null;
  const links = lead ? linksDeContacto(lead.contacto) : {};

  const guardarNotas = async () => {
    if (!lead || notas === lead.notas) return;
    await updateLead(lead.id, { notas });
    push("Notas guardadas", "success");
  };

  return (
    <Drawer open={Boolean(lead)} onClose={onClose} width="max-w-2xl">
      {lead && (
        <div data-consulta-drawer className="p-6 md:p-8">
          {/* ── Quién ── */}
          <div className="flex items-start gap-3 pr-10">
            <ChannelIcon canal={lead.canal} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-semibold text-graph">{lead.nombre}</h2>
                {e && <Badge tone={e.tone} dot>{e.label}</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-graph-500">
                {[lead.contacto, canalLabel[lead.canal] ?? lead.canal, desde(lead.fechaISO)].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-0.5 text-xs text-graph-400">Atiende: {lead.asignado}</p>
            </div>
          </div>

          {/* ── Cómo seguirla ── */}
          {(links.wa || links.tel || links.mail) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {links.wa && (
                <a href={links.wa} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#25D366] px-3 text-sm font-semibold text-white transition hover:brightness-95">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              {links.tel && (
                <a href={links.tel} className="inline-flex h-9 items-center gap-2 rounded-lg border border-graph/15 px-3 text-sm font-medium text-graph-600 transition hover:border-brand hover:text-brand">
                  <Phone size={15} /> Llamar
                </a>
              )}
              {links.mail && (
                <a href={links.mail} className="inline-flex h-9 items-center gap-2 rounded-lg border border-graph/15 px-3 text-sm font-medium text-graph-600 transition hover:border-brand hover:text-brand">
                  <Mail size={15} /> Escribir
                </a>
              )}
            </div>
          )}

          {/* ── Por qué propiedad ── */}
          <section className="mt-6">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-graph-400">Propiedad</h3>
            {prop ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-graph/[0.08] bg-white p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><MapPin size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-graph">{prop.titulo}</p>
                  <p className="truncate text-xs text-graph-500">{prop.zona} · {fmtPrecio(prop)} · {prop.id}</p>
                </div>
                <a href={`${SITIO}/propiedad/${prop.id}`} target="_blank" rel="noreferrer" title="Ver la ficha pública" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-graph/10 text-graph-400 transition hover:border-brand hover:text-brand">
                  <ExternalLink size={15} />
                </a>
              </div>
            ) : (
              <p className="mt-2 text-sm text-graph-400">No consultó por una propiedad en particular.</p>
            )}
          </section>

          {/* ── La conversación ── */}
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-graph-400">Lo que preguntó</h3>
              {conv && (
                <Btn variant="ghost" onClick={() => { onClose(); navigate(`/panel/asistente?conv=${encodeURIComponent(conv.id)}`); }}>
                  <Inbox size={14} /> Abrir en la bandeja
                </Btn>
              )}
            </div>
            {conv && conv.mensajes.length ? (
              <div data-consulta-conversacion className="mt-2 max-h-[46vh] space-y-3 overflow-y-auto rounded-xl bg-paper-100 p-3 ring-1 ring-inset ring-graph/[0.06]">
                {conv.mensajes.map((m) => <Burbuja key={m.id} m={m} quien={lead.nombre} />)}
              </div>
            ) : (
              <p className="mt-2 flex items-start gap-2 rounded-xl border border-dashed border-graph/15 p-3 text-sm text-graph-500">
                <User size={15} className="mt-0.5 shrink-0 text-graph-400" />
                {lead.canal === "web"
                  ? "Esta consulta entró antes de que el panel guardara las charlas de la web: no hay conversación registrada. Lo que se sabe está en las notas."
                  : "Esta consulta no tiene una conversación guardada en la bandeja."}
              </p>
            )}
          </section>

          {/* ── Notas ── */}
          <section className="mt-6">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-graph-400">Notas</h3>
            <textarea
              value={notas}
              onChange={(ev) => setNotas(ev.target.value)}
              onBlur={guardarNotas}
              rows={3}
              placeholder="Qué busca, qué le dijiste, cuándo volver a llamar…"
              className="mt-2 w-full resize-y rounded-xl border border-graph/15 bg-white px-3 py-2 text-sm text-graph outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
            />
          </section>
        </div>
      )}
    </Drawer>
  );
}
