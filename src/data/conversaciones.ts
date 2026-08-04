// ===== Bandeja de conversaciones =====
// Todo lo que entra por cualquier canal cae acá: lo que escribe la persona, lo que
// contesta la IA sola, y lo que responde el humano cuando toma la conversación.
//
// Regla de honestidad: el panel NO puede saber si un mensaje salió por WhatsApp
// (es una app afuera). Por eso un mensaje del humano nace "abierto" —abrimos el
// canal con el texto listo— y solo pasa a "enviado" cuando la persona lo confirma.
// El único canal que el sistema sí controla es el chat de la web propia.

export type CanalConv = "whatsapp" | "instagram" | "messenger" | "web" | "mail" | "telefono";

/** Quién escribió el mensaje. */
export type AutorMensaje = "cliente" | "ia" | "humano";

/** Estado de un mensaje escrito por el humano desde el panel. */
export type EstadoEnvio = "abierto" | "enviado";

export interface MensajeConv {
  id: string;
  de: AutorMensaje;
  texto: string;
  horaISO: string;
  /** Solo en mensajes del humano. Sin esto, no afirmamos que se envió. */
  envio?: EstadoEnvio;
}

/** Quién está atendiendo la conversación ahora mismo. */
export type EstadoConv = "ia" | "vos" | "cerrada";

export interface Conversacion {
  id: string;
  /** Multi-oficina: las conversaciones entran a Mateo (sin oficina) y él deriva. */
  oficina?: "chauvin" | "puntamogotes";
  canal: CanalConv;
  nombre: string;
  /** Teléfono, mail o usuario, según el canal. */
  contacto: string;
  propiedadId?: string;
  leadId?: string;
  estado: EstadoConv;
  noLeida: boolean;
  /** Por qué la IA la derivó a una persona. */
  motivo?: string;
  mensajes: MensajeConv[];
}

/* ===== Cómo se responde cada canal ===== */
export type ModoRespuesta =
  | "wa" // wa.me con el texto ya cargado
  | "mail" // mailto con asunto y cuerpo
  | "tel" // tel: — no se manda texto, se llama
  | "app" // Instagram / Messenger: no aceptan texto en el link → copiamos y abrimos
  | "widget"; // chat de nuestra propia web: el mensaje sale del sistema

export const CANALES_CONV: Record<
  CanalConv,
  { label: string; corto: string; color: string; modo: ModoRespuesta; meta?: boolean }
> = {
  whatsapp: { label: "WhatsApp", corto: "WhatsApp", color: "#25D366", modo: "wa", meta: true },
  instagram: { label: "Instagram", corto: "Instagram", color: "#E1306C", modo: "app", meta: true },
  messenger: { label: "Messenger", corto: "Messenger", color: "#0084FF", modo: "app", meta: true },
  web: { label: "Chat en tu web", corto: "Web", color: "#0C4DA2", modo: "widget" },
  mail: { label: "Email", corto: "Mail", color: "#C9A24E", modo: "mail" },
  telefono: { label: "Teléfono", corto: "Teléfono", color: "#9C6B3C", modo: "tel" },
};

export const ORDEN_CANALES: CanalConv[] = ["whatsapp", "instagram", "messenger", "web", "mail", "telefono"];

/* ===== Semilla de demo ===== */
// Las horas se calculan contra el día real para que la bandeja nunca se vea vieja.
const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

let seq = 0;
const m = (de: AutorMensaje, texto: string, minutos: number, envio?: EstadoEnvio): MensajeConv => ({
  id: "MSG-" + String(++seq).padStart(3, "0"),
  de,
  texto,
  horaISO: hace(minutos),
  ...(envio ? { envio } : {}),
});

export const conversaciones: Conversacion[] = [
  {
    id: "CONV-01",
    canal: "whatsapp",
    nombre: "Nicolás Peralta",
    contacto: "+54 9 223 552-8811",
    propiedadId: "POT-193849",
    oficina: "puntamogotes",
    leadId: "LEAD-102",
    estado: "vos",
    noLeida: true,
    motivo: "Pide precio de cochera y expensas — la IA no cierra números",
    mensajes: [
      m("cliente", "Hola! Vi el 3 ambientes en Punta Mogotes. ¿Sigue disponible?", 384),
      m("ia", "¡Hola Nicolás! Sí, sigue disponible 🙂 Es un 3 ambientes muy luminoso en Punta Mogotes, con cochera. ¿Querés que coordinemos una visita esta semana?", 383),
      m("cliente", "Genial. ¿Cuánto sale la cochera aparte? ¿Y las expensas?", 372),
      m("ia", "La cochera se vende por separado y las expensas varían según la unidad. Prefiero que un asesor te confirme los dos números exactos, así no te paso nada erróneo. ¿Te parece si Mateo te escribe hoy?", 371),
      m("cliente", "Dale, que me escriba. Tengo el crédito pre aprobado.", 18),
      m("ia", "Perfecto, le paso tu consulta a Mateo ahora mismo. Te escribe hoy 👌", 17),
    ],
  },
  {
    id: "CONV-02",
    canal: "instagram",
    nombre: "Sofía Álvarez",
    contacto: "@sofi.alvarez.mdq",
    propiedadId: "POT-218380",
    estado: "ia",
    noLeida: false,
    mensajes: [
      m("cliente", "hola! alquilan por quincena en enero?", 190),
      m("ia", "¡Hola Sofi! Sí, trabajamos alquiler temporario. Para enero tenemos disponibilidad en Playa Grande, Punta Mogotes y Chauvín. ¿Cuántas personas son y qué fechas buscás?", 189),
      m("cliente", "somos 4, la segunda de enero", 185),
      m("ia", "Para 4 personas en la 2ª quincena de enero tengo un semipiso en Playa Grande, sobre la costa. Es la quincena más pedida, así que conviene definirla pronto. ¿Me dejás tu teléfono y te mando fotos y valores?", 184),
      m("cliente", "223 641-2290", 176),
      m("ia", "¡Gracias! Ya quedó cargada tu consulta con todos los datos. Te llega la ficha por WhatsApp en un rato 🙌", 175),
    ],
  },
  {
    id: "CONV-03",
    canal: "web",
    nombre: "Martín Bermúdez",
    contacto: "+54 9 223 508-4412",
    propiedadId: "POT-222304",
    oficina: "chauvin",
    estado: "ia",
    noLeida: false,
    mensajes: [
      m("cliente", "Buenas. Me interesa el chalet de Chauvín. ¿Se puede visitar el sábado?", 96),
      m("ia", "¡Hola Martín! Sí, hacemos visitas los sábados a la mañana. ¿Te queda cómodo a las 10:00?", 95),
      m("cliente", "Perfecto, 10 hs.", 92),
      m("ia", "Listo, dejé pedida la visita al chalet de Chauvín para el sábado a las 10:00 y un asesor te la confirma por acá. ¿Me pasás tu teléfono por las dudas?", 91),
      m("cliente", "223 508-4412", 90),
      m("ia", "¡Anotado! Nos vemos el sábado 🙂", 89),
    ],
  },
  {
    id: "CONV-04",
    canal: "messenger",
    nombre: "Carla Ferreyra",
    contacto: "Carla Ferreyra",
    propiedadId: "POT-154254",
    estado: "vos",
    noLeida: true,
    motivo: "Propone permuta — la evalúa una persona",
    mensajes: [
      m("cliente", "Hola, ¿tomarían mi departamento como parte de pago por la casa de Faro Norte?", 260),
      m("ia", "Hola Carla. Las permutas las evalúa un asesor caso por caso, no es algo que pueda confirmarte yo. ¿Me contás qué departamento tenés (barrio, ambientes, metros)? Así se lo paso completo.", 259),
      m("cliente", "2 ambientes en La Perla, al frente, 55 m². La casa me interesa mucho.", 240),
      m("ia", "Perfecto, le paso el detalle a Mateo para que lo evalúe y te escriba. Gracias por la paciencia 🙏", 239),
    ],
  },
  {
    id: "CONV-05",
    canal: "mail",
    nombre: "Estudio Vidal",
    contacto: "administracion@estudiovidal.com.ar",
    propiedadId: "POT-170781",
    leadId: "LEAD-103",
    estado: "ia",
    noLeida: false,
    mensajes: [
      m("cliente", "Estimados: consultamos por el local de Av. Antártida Argentina. Solicitamos renta actual y vencimiento del contrato vigente. Quedamos a la espera.", 610),
      m("ia", "Estimados, gracias por escribir a Potente Propiedades. El local de Av. Antártida Argentina está publicado en venta con contrato de alquiler vigente. La renta actual y el vencimiento se los confirma un asesor por escrito. ¿Nos dejan un teléfono de contacto para coordinar? — Equipo Potente Propiedades", 608),
      m("cliente", "223 495-1120. Gracias.", 540),
      m("ia", "Recibido. Derivamos la consulta a un asesor, que se comunica en el día. — Equipo Potente Propiedades", 539),
    ],
  },
  {
    id: "CONV-06",
    canal: "whatsapp",
    nombre: "Familia Gutiérrez",
    contacto: "+54 9 11 4478-2031",
    propiedadId: "POT-218380",
    estado: "vos",
    noLeida: true,
    motivo: "Quiere señar la 2ª de enero — hay que confirmar disponibilidad y monto",
    mensajes: [
      m("cliente", "Hola, nos interesa el semipiso frente al mar de Playa Grande para la 2ª de enero. ¿Cómo es la seña?", 55),
      m("ia", "¡Hola! La 2ª quincena de enero es la más pedida, así que la disponibilidad la confirma un asesor antes de reservar. La seña habitual es un porcentaje del total, pero el número exacto te lo pasa Mateo. ¿Te escribe hoy?", 54),
      m("cliente", "Sí, por favor. Somos 6 personas.", 40),
      m("ia", "Perfecto, se lo paso ahora. Ojo que esa quincena vuela 😅", 39),
    ],
  },
  {
    id: "CONV-07",
    canal: "telefono",
    nombre: "Rubén Sosa",
    contacto: "+54 9 223 470-3388",
    estado: "vos",
    noLeida: true,
    motivo: "Pidió que lo llamen después de las 18",
    mensajes: [
      m("cliente", "(Llamada entrante · 1 min 40 s)", 320),
      m("ia", "Consulta registrada: busca casa en alquiler en Chauvín para familia de 4. Pidió que lo llamen después de las 18. Sin propiedad asignada todavía.", 319),
    ],
  },
  {
    id: "CONV-08",
    canal: "whatsapp",
    nombre: "Lucía Márquez",
    contacto: "+54 9 223 533-9074",
    estado: "cerrada",
    noLeida: false,
    mensajes: [
      m("cliente", "Hola, quiero saber cuánto vale mi depto para venderlo.", 1500),
      m("ia", "¡Hola Lucía! Hacemos tasaciones sin cargo. ¿Me pasás barrio, ambientes y metros aproximados?", 1499),
      m("cliente", "Güemes, 2 ambientes, 48 m², piso 6 con balcón.", 1480),
      m("ia", "Genial. Con esos datos un asesor te arma la tasación y te la manda por escrito. ¿Te va bien que te escriban mañana a la mañana?", 1479),
      m("cliente", "Sí, perfecto. ¡Gracias!", 1470),
      m("humano", "Hola Lucía, soy Mateo de Potente Propiedades. Mañana a las 10 te mando la tasación del 2 ambientes de Güemes. Saludos.", 1400, "enviado"),
    ],
  },
];
