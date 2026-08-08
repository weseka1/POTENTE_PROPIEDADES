import type { Campo } from "./types";

// ===== Cartera RURAL real de Potente Propiedades (20-jul-2026) =====
export const campos: Campo[] = [
  {
    id: "POT-169758",
    titulo: "Campo de 78000 m² en Comandante Nicanor Otamendi",
    tipo: "campo",
    operacion: "venta",
    hectareas: 7.8,
    zona: "Comandante Nicanor Otamendi",
    provincia: "General Alvarado",
    aptitud: "mixta",
    precioUSD: 190000,
    precioPorHa: 24359,
    estado: "activa",
    fotos: ["https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/c2728712-e71a-4de5-bb93-ed2151777a19.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/7/792d3b61-6614-4512-a3c6-c1e160e6cae8.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/3382ea95-b36f-4cf3-8987-fcc74ee0ebe3.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/1360a8c7-769e-4206-b9d4-0f211094e47b.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/607e7ee8-7dd9-4988-9c8b-65a308dccc9c.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/5206647c-9268-46a0-9a96-e0dc1046944c.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/38d38f85-6507-4317-8a38-81ec6c61c7f8.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/c2843214-7d5e-4191-9609-69929ce46d94.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/012fe16f-e56a-4c5a-a1d1-69daafd50e67.jpeg","https://storage.googleapis.com/portales-prod-images/4990/property-images/2025/8/f684c407-5c5d-4b75-9a3a-e76cb7dd1020.jpeg"],
    descripcion: "Terreno ubicado estratégicamente sobre Ruta, en Comandante Nicanor Otamendi, General Alvarado. Esta propiedad, con un precio de U$D190.000, ofrece una excelente oportunidad de inversión.\n\nCuenta con una hermosa cabaña de 3 dormitorios, amplio living comedor con hogar a leña, un baño.\n\nTambién dispone de un molino y un gran galpón.\n\n150mts de frente al SE, lindando con Ruta Provincial 88 y 520mts de fondo, con una superficie total de 7,80has.\n\n¡Llámenos para conocer más en detalle esta propiedad!\n\nTel: 2235129032\n\nEmail: info@potenteprop.com.ar\n\nPotente Propiedades",
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
