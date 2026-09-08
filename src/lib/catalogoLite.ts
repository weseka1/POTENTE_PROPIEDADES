/**
 * EL CATÁLOGO QUE VE MARINA — un solo mapeo para todos los canales.
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo usan los tres lugares donde Marina atiende:
 *   · el widget de la web (src/site/components/ChatAsistente.tsx)
 *   · el Probador del panel (src/panel/pages/Asistente.tsx)
 *   · el server, cuando contesta por Instagram (netlify/functions/_catalogo.ts)
 *
 * 🔴 Cicatriz del 21-ago: Marina negaba un alquiler EN PANTALLA porque los
 * dormitorios no viajaban en el catálogo del widget. La lección no es "sumar el
 * campo": es que el catálogo se arme en UN solo lugar. Si un canal lo arma por
 * su cuenta, Marina vuelve a quedar ciega ahí, y nadie se entera hasta que lo
 * ve el cliente. Este archivo no importa nada de React ni del navegador a
 * propósito: el server lo empaqueta tal cual.
 */
import type { Propiedad } from "../data/propiedadTypes";
import type { CampoLite } from "./asistente";
import { precioPublico } from "./format";
import { describirComposicion } from "./composicion";

/**
 * La dirección tal como conviene que la LEA Marina.
 *
 * 🔴 En la cartera real están cargadas a mano y sin criterio fijo: la de
 * Punta Mogotes figura como "Puan2560" —sin espacio y sin tilde— mientras el
 * visitante escribe "Puán 2560". Se le separa el número de la calle para que la
 * comparación sea obvia; las tildes y las mayúsculas las resuelve el modelo, y
 * el prompt además se lo ordena explícitamente.
 *
 * Es SOLO para lo que ve Marina: la ficha pública sigue mostrando lo que cargó
 * Mateo, tal cual. Acá no se corrige el dato del cliente, se lo hace legible.
 */
function direccionLegible(d?: string | null): string | undefined {
  const t = String(d ?? "").trim();
  if (!t) return undefined;
  return t.replace(/([A-Za-zÁÉÍÓÚáéíóúÑñ])(\d)/g, "$1 $2").replace(/\s+/g, " ");
}

/** Una propiedad, reducida a lo que Marina necesita para recomendarla. */
export function aCampoLite(p: Propiedad): CampoLite {
  return {
    id: p.id,
    titulo: p.titulo,
    zona: p.zona,
    direccion: direccionLegible(p.direccion),
    categoria: p.categoria,
    hectareas: p.hectareas,
    aptitud: p.aptitud,
    operacion: p.operacion,
    oficina: p.oficina,
    // Temporada no publica precio (candado `precioPublico`); alquiler aclara el período.
    precio: precioPublico(p) + (p.operacion === "alquiler" ? " por mes" : ""),
    ambientes: p.ambientes,
    dormitorios: p.dormitorios,
    banos: p.banos,
    m2: p.m2totales ?? p.m2cubiertos,
    // Edificios (028): la frase, o nada. `describirComposicion` es total.
    composicion: describirComposicion(p.composicion),
  };
}

/** Solo se recomienda lo que se ofrece: las activas. */
export function catalogoParaMarina(propiedades: Propiedad[]): CampoLite[] {
  return propiedades.filter((p) => p.estado === "activa").map(aCampoLite);
}
