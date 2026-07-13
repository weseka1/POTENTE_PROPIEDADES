import { useEffect } from "react";

// ── SEO por ruta (SPA) ─────────────────────────────────────────────────────────
// Actualiza title, description, canonical y JSON-LD al navegar. El index.html
// trae la base (RealEstateAgent + OG); esto especializa cada página.

const SITE = "https://potente-propiedades.onrender.com";

type SEOProps = {
  titulo: string;
  descripcion?: string;
  path?: string; // ej: "/propiedades" — arma la canonical
  jsonLd?: Record<string, unknown> | null; // datos estructurados de la página
};

function setMeta(selector: string, attr: string, value: string, create?: () => HTMLElement) {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el && create) {
    el = create();
    document.head.appendChild(el);
  }
  if (el) el.setAttribute(attr, value);
}

export function useSEO({ titulo, descripcion, path, jsonLd }: SEOProps) {
  useEffect(() => {
    document.title = titulo;
    setMeta('meta[property="og:title"]', "content", titulo);

    if (descripcion) {
      setMeta('meta[name="description"]', "content", descripcion);
      setMeta('meta[property="og:description"]', "content", descripcion);
    }
    if (path !== undefined) {
      const url = SITE + path;
      setMeta('link[rel="canonical"]', "href", url, () => {
        const l = document.createElement("link");
        l.setAttribute("rel", "canonical");
        return l;
      });
      setMeta('meta[property="og:url"]', "content", url);
    }

    // JSON-LD de la página (un solo script dinámico, se reemplaza al navegar)
    const ID = "seo-jsonld-ruta";
    document.getElementById(ID)?.remove();
    if (jsonLd) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = ID;
      s.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(s);
    }
    return () => {
      document.getElementById(ID)?.remove();
    };
  }, [titulo, descripcion, path, JSON.stringify(jsonLd ?? null)]);
}

// JSON-LD de una propiedad (ficha) — Google lo entiende como aviso inmobiliario.
export function jsonLdPropiedad(p: {
  id: string;
  titulo: string;
  descripcion: string;
  zona: string;
  precioUSD: number | null;
  precioARS?: number | null;
  operacion: string;
  fotos: string[];
  m2totales?: number;
  dormitorios?: number;
}) {
  // Los alquileres se publican en pesos; las ventas en dólares.
  const precio = p.precioARS || p.precioUSD;
  const moneda = p.precioARS ? "ARS" : "USD";
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: p.titulo,
    description: p.descripcion,
    url: `${SITE}/propiedad/${encodeURIComponent(p.id)}`,
    image: p.fotos.map((f) => (f.startsWith("http") ? f : SITE + f)),
    datePosted: new Date().toISOString().slice(0, 10),
    address: {
      "@type": "PostalAddress",
      addressLocality: `${p.zona}, Mar del Plata`,
      addressRegion: "Buenos Aires",
      addressCountry: "AR",
    },
    ...(precio
      ? {
          offers: {
            "@type": "Offer",
            price: precio,
            priceCurrency: moneda,
            availability: "https://schema.org/InStock",
            businessFunction:
              p.operacion === "venta"
                ? "http://purl.org/goodrelations/v1#Sell"
                : "http://purl.org/goodrelations/v1#LeaseOut",
          },
        }
      : {}),
    ...(p.m2totales ? { floorSize: { "@type": "QuantitativeValue", value: p.m2totales, unitCode: "MTK" } } : {}),
    ...(p.dormitorios ? { numberOfRooms: p.dormitorios } : {}),
  };
}
