/**
 * MARINA NO SE ROMPE — y no confunde venta con alquiler.
 *
 * Nace de una captura de Mateo (19-ago): Marina venía bien, le ofreció un depto
 * en VENTA a alguien que buscaba ALQUILER, el visitante la corrigió… y al
 * siguiente mensaje se cayó con "el asistente no está disponible".
 * Juani, textual: «Marina no se puede romper NUNCA. Pero NUNCA» y «que por
 * favor JAMAS se confunda con venta y/o alquiler».
 *
 * Prueba contra el endpoint REAL (por defecto producción) con un catálogo de
 * sonda propio: operaciones controladas, así la aserción no depende de qué
 * tenga cargado Mateo hoy (cartera VIVA — nunca afirmar cantidades).
 *
 *   APP=https://potentepropiedades.com node e2e/marina.mjs
 */
const APP = process.env.APP || "https://potentepropiedades.com";

let ok = 0;
const fallos = [];
const chequear = (nombre, cond, detalle = "") => {
  if (cond) { ok++; console.log(`PASS  ${nombre}${detalle ? ` :: ${detalle}` : ""}`); }
  else { fallos.push(`${nombre} — ${detalle}`); console.log(`FAIL  ${nombre} :: ${detalle}`); }
};

/* Catálogo de sonda con la PROPORCIÓN REAL de la cartera (medida el 19-ago:
 * ~72 en venta contra ~10 en alquiler). Esto importa: con 5 propiedades Marina
 * no se confunde nunca — el error que fotografió Mateo aparece cuando el
 * alquiler es el 12% de una lista larga y la de venta "encaja" en la búsqueda.
 * Una sonda cómoda habría dado verde sin probar nada (la trampa del 14-ago).
 * IDs irreales a propósito: no tocan la cartera de Mateo. */
const ZONAS = ["Plaza Colón", "Los Troncos", "Chauvín", "Punta Mogotes", "Playa Grande", "Constitución", "Güemes", "La Perla"];
const CATALOGO = [];
for (let i = 1; i <= 72; i++) {
  CATALOGO.push({
    id: `SONDA-VTA-${i}`,
    titulo: i % 3 === 0 ? "Departamento 2 ambientes" : i % 3 === 1 ? "Casa 3 dormitorios" : "Departamento 3 ambientes",
    zona: ZONAS[i % ZONAS.length],
    categoria: i % 3 === 1 ? "casa" : "departamento",
    operacion: "venta",
    precio: `U$S ${60 + i}.900`,
  });
}
for (let i = 1; i <= 10; i++) {
  CATALOGO.push({
    id: `SONDA-ALQ-${i}`,
    titulo: i % 2 === 0 ? "Departamento 2 ambientes" : "Casa 3 dormitorios",
    zona: ZONAS[i % ZONAS.length],
    categoria: i % 2 === 0 ? "departamento" : "casa",
    operacion: "alquiler",
    precio: `$ ${300 + i * 25}.000 por mes`,
  });
}
for (let i = 1; i <= 5; i++) {
  CATALOGO.push({
    id: `SONDA-TEM-${i}`,
    titulo: "Depto frente al mar",
    zona: "Punta Mogotes",
    categoria: "departamento",
    operacion: "temporada",
    precio: "A consultar",
  });
}
const ES_VENTA = new Set(CATALOGO.filter((c) => c.operacion === "venta").map((c) => c.id));
const ES_ALQUILER = new Set(CATALOGO.filter((c) => c.operacion === "alquiler").map((c) => c.id));

const preguntar = async (mensaje, historial = []) => {
  const r = await fetch(APP + "/api/asistente", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mensaje, historial, catalogo: CATALOGO }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, ...data };
};

console.log(`\n🤖 Marina contra ${APP}\n`);

/* 1 · Responde, y con la forma que el widget espera */
const a = await preguntar("Hola, busco un departamento para alquilar");
chequear("Marina responde (HTTP 200 + texto)",
  a.status === 200 && typeof a.respuesta === "string" && a.respuesta.length > 10,
  `status ${a.status} · ${String(a.respuesta).slice(0, 60)}…`);
chequear("La respuesta no es el cartel de error",
  !/no está disponible|no esta disponible/i.test(String(a.respuesta ?? "")),
  String(a.respuesta ?? "").slice(0, 80));

/* 2 · 🔴 EL FILTRO DURO: buscando ALQUILER, jamás una de VENTA.
 * Se pregunta VARIAS veces con distintas formas: el error es probabilístico
 * (una sola pasada puede tener suerte y no probar nada). */
/* ⚠️ Los pedidos van CON zona y tipo: Marina pregunta antes de recomendar, así
 * que un "quiero alquilar" pelado devuelve 0 fichas y la aserción pasaría
 * vacía — probando nada (la trampa medida el 14-ago). Acá se le da todo para
 * que TENGA que recomendar, y se exige que efectivamente lo haga. */
const PEDIDOS_ALQUILER = [
  "Quiero alquilar un departamento de 2 ambientes en Chauvín, mostrame las opciones que tengas",
  "Busco alquilar una casa de 3 dormitorios en Los Troncos, ¿cuáles tenés? pasame 2 o 3",
  "Necesito alquilar un depto en Playa Grande para vivir todo el año, dame opciones concretas",
];
const idsB = [];
let textosAlquiler = "";
for (const pedido of PEDIDOS_ALQUILER) {
  const r = await preguntar(pedido, [{ rol: "cliente", texto: "Hola" }, { rol: "asistente", texto: String(a.respuesta ?? "") }]);
  idsB.push(...(Array.isArray(r.camposIds) ? r.camposIds : []));
  textosAlquiler += " " + String(r.respuesta ?? "");
}
chequear("La prueba de alquiler es válida (Marina recomendó algo, no está vacía)",
  idsB.length > 0, `recomendó ${idsB.length} fichas en ${PEDIDOS_ALQUILER.length} pedidos`);
const coladasEnAlquiler = idsB.filter((id) => ES_VENTA.has(id));
chequear(`🔴 Buscando ALQUILER (${PEDIDOS_ALQUILER.length} formas) no recomienda NINGUNA de venta`,
  coladasEnAlquiler.length === 0, `se colaron [${coladasEnAlquiler.join(", ")}] de ${idsB.length} recomendadas`);
chequear("…y no le canta un precio en dólares (los alquileres van en pesos)",
  !/U\$S|USD/i.test(textosAlquiler), textosAlquiler.match(/.{0,40}U\$S.{0,30}/i)?.[0] ?? "sin U$S");

/* 3 · El espejo: buscando COMPRAR, jamás una de alquiler */
const c = await preguntar("Quiero COMPRAR un departamento de 2 ambientes en Plaza Colón, pasame 2 o 3 opciones con precio");
const idsC = Array.isArray(c.camposIds) ? c.camposIds : [];
chequear("La prueba de venta es válida (recomendó algo)", idsC.length > 0, `devolvió ${idsC.length}`);
chequear("🔴 Buscando COMPRAR no recomienda NINGUNA de alquiler",
  !idsC.some((id) => ES_ALQUILER.has(id)), `devolvió [${idsC.join(", ")}]`);

/* 4 · La corrección del visitante (el momento exacto de la captura de Mateo) */
const d = await preguntar("pero ese está en venta, no alquiler", [
  { rol: "cliente", texto: "busco depto en alquiler" },
  { rol: "asistente", texto: "Es un departamento de 2 ambientes bien ubicado en Plaza Colón. ¿Te late?" },
]);
chequear("🔴 Cuando el visitante la corrige, NO se rompe",
  d.status === 200 && String(d.respuesta ?? "").length > 10,
  `status ${d.status} · ${String(d.respuesta ?? "").slice(0, 70)}…`);
chequear("…y al corregirla no insiste con una de venta",
  !(Array.isArray(d.camposIds) ? d.camposIds : []).some((id) => ES_VENTA.has(id)),
  `devolvió [${(d.camposIds ?? []).join(", ")}]`);

/* 5 · Nunca inventa IDs: lo que devuelve existe en el catálogo */
const todos = new Set(CATALOGO.map((x) => x.id));
const inventados = [...idsB, ...idsC, ...(d.camposIds ?? [])].filter((id) => !todos.has(id));
chequear("Nunca devuelve un ID que no esté en el catálogo", inventados.length === 0, `inventó [${inventados.join(", ")}]`);

/* 6 · Aguanta un mensaje raro sin caerse (nada de 502 al visitante) */
const e = await preguntar("¿?¿?¿? 🏠🏠🏠 asdkjhasd", []);
chequear("Un mensaje sin sentido tampoco la rompe",
  e.status === 200 && String(e.respuesta ?? "").length > 5, `status ${e.status}`);

/* 7 · Sin catálogo (base lenta) contesta igual, no explota */
const f = await fetch(APP + "/api/asistente", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ mensaje: "¿Qué horarios tienen?", historial: [], catalogo: [] }),
  signal: AbortSignal.timeout(60_000),
}).then((r) => r.json().then((d) => ({ status: r.status, ...d }))).catch(() => ({ status: 0 }));
chequear("Con el catálogo vacío sigue atendiendo",
  f.status === 200 && String(f.respuesta ?? "").length > 10, `status ${f.status}`);

/* 8 · 🔴 LA CAUSA RAÍZ del "Marina no funciona" (19-ago): el cupo por IP.
 * Una oficina sale por UNA IP — Mateo y las chicas comparten balde. Al agotarlo,
 * el server devolvía 429 y el widget pintaba "el asistente no está disponible"
 * EN MEDIO de una charla. Ahora agotar el cupo hace que Marina conteste como
 * una persona ocupada: 200, con texto, y la conversación sigue viva.
 * Se dispara a propósito con una ráfaga: es la única forma de probarlo. */
const rafaga = await Promise.all(
  Array.from({ length: 45 }, (_, i) =>
    fetch(APP + "/api/asistente", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ mensaje: `ping ${i}`, historial: [], catalogo: [] }),
      signal: AbortSignal.timeout(60_000),
    }).then((r) => r.json().then((d) => ({ status: r.status, ...d }))).catch(() => ({ status: 0 }))),
);
const con429 = rafaga.filter((r) => r.status === 429);
const sinTexto = rafaga.filter((r) => r.status !== 0 && !String(r.respuesta ?? "").trim());
chequear("🔴 Agotar el cupo NUNCA devuelve 429 al visitante", con429.length === 0, `${con429.length} de ${rafaga.length} dieron 429`);
chequear("🔴 Con el cupo agotado, TODAS siguen trayendo una respuesta hablada",
  sinTexto.length === 0, `${sinTexto.length} de ${rafaga.length} vinieron sin texto`);
const degradadas = rafaga.filter((r) => r.degradado).length;
console.log(`      (de ${rafaga.length} pedidos en ráfaga, ${degradadas} contestaron en modo "estoy ocupada")`);

console.log(`\n==== ${ok} PASS / ${fallos.length} FAIL ====`);
if (fallos.length) { console.log("FALLARON:"); fallos.forEach((f) => console.log(" - " + f)); }
process.exit(fallos.length ? 1 : 0);
