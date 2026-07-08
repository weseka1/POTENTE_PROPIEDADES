import type { Campo } from "./types";

const IMG = (n: string) => `/img/campos/${n}.jpg`;

// ⚠️ DEMO: datos representativos del mercado rural y semirrural de Mar del Plata
// (Sierra de los Padres, Batán, Laguna de los Padres). Reemplazar por la cartera
// real de Potente Propiedades al cargar la data definitiva. Las fotos son placeholders.
export const campos: Campo[] = [
  {
    id: "CAMPO-001",
    titulo: "Chacra 12 ha con casa principal, Sierra de los Padres",
    tipo: "chacra",
    operacion: "venta",
    hectareas: 12,
    zona: "Sierra de los Padres",
    provincia: "Buenos Aires",
    aptitud: "mixta",
    precioUSD: 350000,
    precioPorHa: null,
    estado: "disponible",
    fotos: [IMG("u16"), IMG("u3"), IMG("u18"), IMG("u2")],
    descripcion:
      "Chacra parquizada a 2 km del acceso principal de Sierra de los Padres. Casa principal de tres dormitorios, galpón de máquinas y perforación con bomba. Monte de eucaliptos y frutales en producción. Luz trifásica sobre el camino.",
    mejoras: ["Casa principal 3 dormitorios", "Galpón de máquinas", "Perforación con bomba", "Monte de frutales"],
    destacado: false,
    lat: -37.952,
    lng: -57.782,
    consultas: 26,
    altaISO: "2026-05-14",
  },
  {
    id: "CAMPO-002",
    titulo: "Quinta frutihortícola 5 ha sobre camino vecinal, Batán",
    tipo: "chacra",
    operacion: "venta",
    hectareas: 5,
    zona: "Batán",
    provincia: "Buenos Aires",
    aptitud: "agrícola",
    precioUSD: 145000,
    precioPorHa: 29000,
    estado: "disponible",
    fotos: [IMG("u3"), IMG("u13"), IMG("u8")],
    descripcion:
      "Quinta en plena zona frutihortícola de Batán, suelo franco y riego por perforación. Dos invernáculos de 50 metros y casa de encargado. Salida directa a la ruta 88, a 15 minutos del puerto de Mar del Plata.",
    mejoras: ["Dos invernáculos", "Riego por perforación", "Casa de encargado", "Luz monofásica"],
    destacado: false,
    lat: -38.007,
    lng: -57.708,
    consultas: 14,
    altaISO: "2026-06-01",
  },
  {
    id: "CAMPO-003",
    titulo: "Campo mixto 90 ha zona Laguna de los Padres",
    tipo: "campo",
    operacion: "venta",
    hectareas: 90,
    zona: "Laguna de los Padres",
    provincia: "Buenos Aires",
    aptitud: "mixta",
    precioUSD: 720000,
    precioPorHa: 8000,
    estado: "disponible",
    fotos: [IMG("u9"), IMG("u12"), IMG("u1"), IMG("u10")],
    descripcion:
      "Campo periurbano sobre la ruta 226, a la altura de Laguna de los Padres. 60 ha agrícolas con historia de papa y el resto en pasturas. Corrales, manga y casilla de material. Muy buen acceso durante todo el año.",
    mejoras: ["Manga y corrales", "Casilla de material", "Molino y tanque", "Alambrados en buen estado"],
    destacado: false,
    lat: -37.938,
    lng: -57.744,
    consultas: 21,
    altaISO: "2026-05-22",
  },
  {
    id: "CAMPO-004",
    titulo: "Chacra 8 ha en arrendamiento, paraje El Coyunco",
    tipo: "chacra",
    operacion: "arrendamiento",
    hectareas: 8,
    zona: "El Coyunco",
    provincia: "Buenos Aires",
    aptitud: "agrícola",
    precioUSD: null,
    precioPorHa: null,
    estado: "disponible",
    fotos: [IMG("u8"), IMG("u7"), IMG("u13")],
    descripcion:
      "Chacra apta para huerta intensiva o pasturas, sobre camino consolidado a la altura del km 14 de la ruta 226. Contrato anual con opción de renovación. Consultar condiciones en cualquiera de nuestras dos oficinas.",
    mejoras: ["Perforación", "Tinglado chico", "Acceso consolidado"],
    destacado: false,
    lat: -37.973,
    lng: -57.677,
    consultas: 7,
    altaISO: "2026-06-12",
  },
];

export const getCampo = (id: string) => campos.find((c) => c.id === id);
export const camposDestacados = campos.filter((c) => c.destacado);
