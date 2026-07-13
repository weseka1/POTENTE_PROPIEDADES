import type { Campo } from "./types";

// ===== Cartera RURAL real de Potente Propiedades (12-jul-2026) =====
// Un solo campo publicado hoy en potentepropiedades.com.ar. Fotos reales del portal.
export const campos: Campo[] = [
  {
    id: "POT-169758",
    titulo: "Campo en venta de 78000m2 ubicado en Comandante Nicanor Otamendi",
    tipo: "campo",
    operacion: "venta",
    hectareas: 7.8,
    zona: "Comandante Nicanor Otamendi",
    provincia: "General Alvarado",
    aptitud: "mixta",
    precioUSD: 190000,
    precioPorHa: 24359,
    estado: "disponible",
    fotos: ["https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/c2728712-e71a-4de5-bb93-ed2151777a19.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/7/792d3b61-6614-4512-a3c6-c1e160e6cae8.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/3382ea95-b36f-4cf3-8987-fcc74ee0ebe3.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/1360a8c7-769e-4206-b9d4-0f211094e47b.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/607e7ee8-7dd9-4988-9c8b-65a308dccc9c.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/5206647c-9268-46a0-9a96-e0dc1046944c.jpeg"],
    descripcion: "Terreno ubicado estratégicamente sobre Ruta, en Comandante Nicanor Otamendi, General Alvarado. Esta propiedad, con un precio de U$D190.000, ofrece una excelente oportunidad de inversión. Cuenta con una hermosa cabaña de 3 dormitorios, amplio living comedor con hogar a leña, un baño. También dispone de un molino y un gran galpón. 150mts de frente al SE, lindando con Ruta Provincial 88 y 520mts de fondo, con una superficie total de 7,80has.",
    mejoras: [],
    destacado: false,
    lat: -38.183376409259,
    lng: -58.005043676438,
    consultas: 9,
    altaISO: "2025-07-08",
  },
];

export const getCampo = (id: string) => campos.find((c) => c.id === id);
export const camposDestacados = campos.filter((c) => c.destacado);
