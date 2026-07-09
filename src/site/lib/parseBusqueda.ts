// ── Buscador que entiende lo que el visitante escribe ─────────────────────────
// "depto de 3 ambientes cerca de Playa Grande hasta 180 mil" →
//   { cat: "departamento", amb: 3, zona: "Playa Grande", max: 180000 }
//
// Corre en el navegador, sin IA y sin costo: es instantáneo y no depende de que
// el asistente tenga saldo. Marina queda para quien prefiere preguntar.

export type Busqueda = {
  cat?: string;
  operacion?: string;
  zona?: string;
  amb?: number;
  max?: number;
  temporada?: boolean;
  q?: string; // texto suelto, si no entendimos nada concreto
};

const DIACRITICOS = new RegExp("[\u0300-\u036f]", "g");
const sinTildes = (s: string) =>
  s.normalize("NFD").replace(DIACRITICOS, "").toLowerCase();

// Sinónimos → categoría del catálogo
const TIPOS: [RegExp, string][] = [
  [/\b(departamento|depto|dpto|depa|monoambiente|semipiso|piso)\b/, "departamento"],
  [/\b(casa|chalet|ph|duplex|vivienda)\b/, "casa"],
  [/\b(local|comercio|negocio|fondo de comercio)\b/, "local"],
  [/\b(lote|terreno|parcela)\b/, "lote"],
  [/\b(campo|chacra|quinta|estancia)\b/, "campo"],
];

const OPERACIONES: [RegExp, string][] = [
  [/\b(alquiler|alquilar|alquilo|rentar|renta)\b/, "alquiler"],
  [/\b(venta|comprar|compra|vender|en venta)\b/, "venta"],
];

// Verano: no es un filtro del catálogo, es otra sección.
const TEMPORADA = /\b(temporada|veraneo|verano|quincena|vacaciones|enero|febrero)\b/;

/**
 * @param texto lo que escribió el visitante
 * @param zonasDisponibles zonas reales de la cartera (para no inventar barrios)
 */
export function parseBusqueda(texto: string, zonasDisponibles: string[]): Busqueda {
  const t = sinTildes(texto).trim();
  if (!t) return {};
  const out: Busqueda = {};

  if (TEMPORADA.test(t)) out.temporada = true;

  for (const [re, val] of TIPOS) if (re.test(t)) { out.cat = val; break; }
  for (const [re, val] of OPERACIONES) if (re.test(t)) { out.operacion = val; break; }

  // Zona: la más larga que aparezca (evita que "Centro" gane sobre "Macrocentro").
  const zona = [...zonasDisponibles]
    .sort((a, b) => b.length - a.length)
    .find((z) => t.includes(sinTildes(z)));
  if (zona) out.zona = zona;

  // Ambientes: "3 ambientes", "3 amb", "monoambiente"
  if (/\bmonoambiente\b/.test(t)) out.amb = 1;
  else {
    const m = t.match(/(\d+)\s*(ambientes?|amb\b)/);
    if (m) out.amb = Number(m[1]);
  }

  // Precio máximo: exige una pista ("hasta", "menos de", "máximo") o un sufijo
  // de escala ("mil", "k", "palos"). Así "3 ambientes" nunca se lee como precio.
  const precio = t.match(
    /(?:hasta|menos de|maximo|max\.?|por debajo de)?\s*(?:usd|u\$s|us\$|\$)?\s*([\d][\d.,]*)\s*(millones?|palos?|mil|k|lucas)?/g
  );
  if (precio) {
    for (const frag of precio) {
      const conPista = /(hasta|menos de|maximo|max\.?|por debajo de)/.test(frag);
      const m = frag.match(/([\d][\d.,]*)\s*(millones?|palos?|mil|k|lucas)?/);
      if (!m) continue;
      const escala = m[2];
      if (!conPista && !escala) continue; // número suelto: no es precio
      const crudo = m[1].replace(/\./g, "").replace(/,/g, ".");
      let n = Number(crudo);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (/millon|palo/.test(escala ?? "")) n *= 1_000_000;
      else if (/mil|k|luca/.test(escala ?? "")) n *= 1_000;
      // Si dijo "hasta X" es un precio aunque sea chico (un alquiler de 800/mes).
      // Sin esa pista, un número menor a mil casi siempre son ambientes mal leídos.
      if (n < (conPista ? 100 : 1000)) continue;
      out.max = n;
      break;
    }
  }

  // Un precio sin operación dicha revela la intención: los alquileres se piensan
  // por mes (USD 800) y las compras en decenas o cientos de miles (USD 200.000).
  // Sin esto, "casa hasta 200 mil" mezclaría alquileres de 800/mes en los resultados.
  if (out.max && !out.operacion && !out.temporada) {
    out.operacion = out.max >= 20_000 ? "venta" : "alquiler";
  }

  // Si no entendimos nada concreto, mandamos el texto como búsqueda libre.
  if (!out.cat && !out.zona && !out.amb && !out.max && !out.operacion && !out.temporada) {
    out.q = texto.trim();
  }
  return out;
}

// Barrios con página propia de temporada (debe coincidir con BARRIOS_TEMPORADA
// de site/Temporada.tsx). Mandamos ahí porque es la página que posiciona en Google.
const BARRIOS_CON_PAGINA = ["Playa Grande", "Varese", "Güemes", "La Perla", "Chauvín", "Punta Mogotes"];

/** A dónde va alguien que busca alquiler de verano. */
export function rutaTemporada(zona?: string): string {
  if (!zona) return "/temporada";
  const hit = BARRIOS_CON_PAGINA.find((b) => sinTildes(b) === sinTildes(zona));
  return hit ? `/temporada/${sinTildes(hit).replace(/\s+/g, "-")}` : "/temporada";
}

/** Arma el querystring del catálogo a partir de lo entendido. */
export function aQueryString(b: Busqueda): string {
  const p = new URLSearchParams();
  if (b.cat) p.set("cat", b.cat);
  if (b.operacion) p.set("operacion", b.operacion);
  if (b.zona) p.set("zona", b.zona);
  if (b.amb) p.set("amb", String(b.amb));
  if (b.max) p.set("max", String(b.max));
  if (b.q) p.set("q", b.q);
  return p.toString();
}
