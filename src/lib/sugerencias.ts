import type { Propiedad } from "@/data/propiedadTypes";
import type { Lead, Cliente, Visita, Arrendamiento } from "@/data/types";
import { rebaseISO } from "./fechas";

export type TipoSugerencia =
  | "responder_lead"
  | "agendar_visita"
  | "confirmar_visita"
  | "seguimiento"
  | "vencimiento";

export interface Sugerencia {
  id: string;
  tipo: TipoSugerencia;
  prioridad: "alta" | "media";
  titulo: string;
  contexto: string; // por qué la IA lo propone
  propuesta: string; // el borrador / la acción que preparó la IA
  cta: string; // texto del botón de confirmar
  // payload para ejecutar la acción al confirmar
  refId?: string; // id de lead / visita / arrendamiento
  propiedadId?: string;
  clienteNombre?: string;
  fechaSugerida?: string; // ISO date para visitas
  horaSugerida?: string; // HH:MM para visitas
}

function horasDesde(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

function nombreCorto(p?: Propiedad) {
  return p ? p.titulo : "la propiedad consultada";
}

interface Input {
  propiedades: Propiedad[];
  leads: Lead[];
  clientes: Cliente[];
  visitas: Visita[];
  arrendamientos: Arrendamiento[];
}

// La "IA" organiza el trabajo del día: arma acciones listas para que el humano confirme.
export function generarSugerencias({ propiedades, leads, visitas, arrendamientos }: Input): Sugerencia[] {
  const out: Sugerencia[] = [];
  const getP = (id?: string | null) => propiedades.find((p) => p.id === id);

  // 1) Consultas nuevas sin responder → borrador de respuesta listo
  leads
    .filter((l) => l.estado === "nueva")
    .forEach((l) => {
      const p = getP(l.campoId);
      out.push({
        id: "sg-resp-" + l.id,
        tipo: "responder_lead",
        prioridad: "alta",
        titulo: `Responder a ${l.nombre}`,
        contexto: `Consulta por ${nombreCorto(p)} · entró ${horasDesde(l.fechaISO)} h y sigue sin responder.`,
        propuesta: `Hola ${l.nombre.split(" ")[0]}, ¡gracias por escribir a Potente Propiedades! Te paso la información de ${p ? p.titulo : "la propiedad"}. ¿Te gustaría coordinar una visita esta semana? Quedo a tu disposición. — Mateo, Potente Propiedades`,
        cta: "Confirmar y responder",
        refId: l.id,
        propiedadId: l.campoId || undefined,
      });
    });

  // 2) Leads en etapa "visita" → proponer agendar visita (el humano fija el horario)
  leads
    .filter((l) => l.estado === "visita")
    .forEach((l) => {
      const p = getP(l.campoId);
      out.push({
        id: "sg-agvis-" + l.id,
        tipo: "agendar_visita",
        prioridad: "alta",
        titulo: `Agendar visita con ${l.nombre}`,
        contexto: `Quiere ver ${nombreCorto(p)}. La IA propone día y horario — confirmalo o cambialo.`,
        propuesta: `Visita a ${p ? p.titulo : "la propiedad"} con ${l.nombre}.`,
        cta: "Agendar visita",
        refId: l.id,
        propiedadId: l.campoId || undefined,
        clienteNombre: l.nombre,
        fechaSugerida: rebaseISO("2026-06-26"),
        horaSugerida: "10:00",
      });
    });

  // 3) Visitas agendadas sin confirmar → confirmar (el humano da el OK / ajusta hora)
  visitas
    .filter((v) => v.estado === "agendada")
    .forEach((v) => {
      const p = getP(v.campoId);
      out.push({
        id: "sg-confvis-" + v.id,
        tipo: "confirmar_visita",
        prioridad: "alta",
        titulo: `Confirmar visita con ${v.clienteNombre}`,
        contexto: `${nombreCorto(p)} · ${v.fechaISO} a las ${v.hora}. Está agendada pero sin confirmar con el cliente.`,
        propuesta: `Hola ${v.clienteNombre.split(" ")[0]}, te confirmo la visita a ${p ? p.titulo : "la propiedad"} el ${v.fechaISO} a las ${v.hora}. ¿Te queda cómodo ese horario? — Mateo, Potente Propiedades`,
        cta: "Confirmar visita",
        refId: v.id,
        propiedadId: v.campoId,
        clienteNombre: v.clienteNombre,
        fechaSugerida: v.fechaISO,
        horaSugerida: v.hora,
      });
    });

  // 4) Leads contactados hace +3 días → seguimiento
  leads
    .filter((l) => l.estado === "contactado" && horasDesde(l.fechaISO) >= 72)
    .forEach((l) => {
      const p = getP(l.campoId);
      out.push({
        id: "sg-seg-" + l.id,
        tipo: "seguimiento",
        prioridad: "media",
        titulo: `Seguir a ${l.nombre}`,
        contexto: `Lo contactaron hace ${Math.round(horasDesde(l.fechaISO) / 24)} días y no hubo respuesta.`,
        propuesta: `Hola ${l.nombre.split(" ")[0]}, ¿pudiste ver la info de ${p ? p.titulo : "la propiedad"}? Si querés coordinamos una visita o te muestro otras opciones similares. — Potente Propiedades`,
        cta: "Enviar seguimiento",
        refId: l.id,
      });
    });

  // 5) Arrendamientos por vencer / vencidos → aviso de renovación
  arrendamientos
    .filter((a) => a.estado === "por_vencer" || a.estado === "vencido")
    .forEach((a) => {
      const p = getP(a.campoId);
      const vencido = a.estado === "vencido";
      out.push({
        id: "sg-venc-" + a.id,
        tipo: "vencimiento",
        prioridad: vencido ? "alta" : "media",
        titulo: `${vencido ? "Contrato VENCIDO" : "Vencimiento próximo"}: ${a.arrendatario}`,
        contexto: `Alquiler de ${nombreCorto(p)} · vence ${a.vencimientoISO}. ${vencido ? "Ya está vencido." : "Está por vencer."}`,
        propuesta: `Estimado ${a.arrendatario}, le recordamos que el alquiler de ${p ? p.titulo : "la propiedad"} ${vencido ? "venció" : "vence"} el ${a.vencimientoISO}. ¿Avanzamos con la renovación? — Potente Propiedades`,
        cta: "Avisar y registrar",
        refId: a.id,
      });
    });

  // ordenar: alta primero
  const peso = { alta: 0, media: 1 };
  return out.sort((x, y) => peso[x.prioridad] - peso[y.prioridad]);
}
