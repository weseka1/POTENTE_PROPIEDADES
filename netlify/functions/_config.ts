// ── Config del cliente (el "molde" replicable) ────────────────────────────────
// Para clonar el asistente a otro cliente: copiá este archivo y cambiá estos valores.
// El resto del código (prompt + function + widget) es genérico y no se toca.

export type AsistenteConfig = {
  negocio: string;        // nombre comercial
  rubro: string;          // qué hace, en una frase
  zona: string;           // zona de trabajo
  desde?: string;         // año de fundación (opcional)
  asistente: string;      // nombre de la asesora virtual
  itemSingular: string;   // "campo" | "auto" | "propiedad" | "turno"…
  itemPlural: string;     // "campos" | "autos"…
  saludo: string;         // primer mensaje que ve el visitante
};

export const CONFIG: AsistenteConfig = {
  negocio: "Potente Propiedades",
  rubro:
    "inmobiliaria de Mar del Plata con más de 50 años y tres generaciones de trayectoria: casas, departamentos, PH, locales, lotes y chacras, en venta y alquiler",
  zona: "Mar del Plata y la costa atlántica",
  asistente: "Marina",
  itemSingular: "propiedad",
  itemPlural: "propiedades",
  saludo:
    "¡Hola! Soy Marina, de Potente Propiedades. ¿Qué estás buscando? ¿Casa, depto, local, lote…? Contame la zona y qué necesitás y te muestro opciones.",
};
