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
  contexto?: string;      // identidad del negocio con SU vocabulario (para que el asistente responda horarios, oficinas, servicios)
};

export const CONFIG: AsistenteConfig = {
  negocio: "Potente Propiedades",
  rubro:
    "inmobiliaria de Mar del Plata con más de 50 años y tres generaciones de trayectoria: casas, departamentos, PH, locales, lotes y chacras, en venta y alquiler",
  zona: "Mar del Plata y la costa atlántica",
  desde: "1968",
  asistente: "Marina",
  itemSingular: "propiedad",
  itemPlural: "propiedades",
  saludo:
    "¡Hola! Soy Marina, de Potente Propiedades. ¿Qué estás buscando? ¿Casa, depto, local, lote…? Contame la zona y qué necesitás y te muestro opciones.",
  // Con el vocabulario de su propia web (potentepropiedades.com.ar/nosotros):
  contexto:
    "Fundada en 1968: más de 50 años de trayectoria y 3 generaciones vendiendo, alquilando y administrando inmuebles. El objetivo de la casa es trabajar en el camino de la excelencia sobre la base de la confianza, la seriedad y la trayectoria, buscando maximizar el valor de las inversiones de los clientes. Ofrece asesoramiento integral: tasaciones sin cargo con informe escrito, ventas, alquileres y administración. Dos oficinas: Oficina 1 en Córdoba 3719 (Chauvín), tel. 223 512-9032, y Oficina 2 en Av. de los Trabajadores 2439 (Punta Mogotes), tel. 223 628-2659. Horario de ambas: lunes a viernes de 9 a 16.",
};
