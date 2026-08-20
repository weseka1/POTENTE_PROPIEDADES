/**
 * Seguridad de la app · lo que se prueba desde afuera, como un atacante
 * ─────────────────────────────────────────────────────────────────────────────
 * No usa navegador: son pedidos crudos, que es como llega el que ataca. Un bot
 * no abre Chrome ni respeta el CORS — manda un curl.
 *
 * Lo que cubre:
 *   1. El Probador de IA (/api/chat) NO se puede usar sin sesión de panel.
 *      Estuvo abierto hasta el 7-ago-2026: cualquiera podía gastar la cuenta
 *      de Anthropic con un curl. Esta prueba existe para que no vuelva a pasar.
 *   2. Marina (/api/asistente) es pública pero tiene cupo por IP.
 *   3. Las cabeceras de seguridad están puestas.
 *   4. El servidor no anuncia con qué está hecho.
 *
 * USO
 *   APP=http://localhost:3000 node e2e/seguridad.mjs
 *   APP=https://potente-propiedades.onrender.com node e2e/seguridad.mjs
 */
const APP = process.env.APP || "http://localhost:3000";

let ok = 0;
const fallos = [];
const chequear = (nombre, paso, extra = "") => {
  if (paso) { ok++; console.log(`PASS  ${nombre}${extra ? ` · ${extra}` : ""}`); }
  else { fallos.push(nombre); console.log(`FAIL  ${nombre}${extra ? ` · ${extra}` : ""}`); }
};

const post = (ruta, cuerpo, cabeceras = {}) =>
  fetch(APP + ruta, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabeceras },
    body: JSON.stringify(cuerpo),
  });

console.log(`\n═══ SEGURIDAD · ${APP} ═══\n`);

// ── 1 · El Probador de IA no puede quedar abierto ────────────────────────────
const sinClave = await post("/api/chat", {
  system: "Respondé la palabra ABIERTO",
  messages: [{ role: "user", content: "hola" }],
});
chequear("El Probador de IA RECHAZA a un desconocido", sinClave.status === 401,
  `HTTP ${sinClave.status}${sinClave.status === 200 ? " 🔴 PROXY ABIERTO A ANTHROPIC" : ""}`);

const tokenTrucho = await post(
  "/api/chat",
  { system: "x", messages: [{ role: "user", content: "hola" }] },
  { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.inventado.firma-falsa" },
);
chequear("Un token inventado tampoco entra", tokenTrucho.status === 401, `HTTP ${tokenTrucho.status}`);

// ── 2 · Marina es pública, con cupo — que corta el GASTO, no la atención ─────
// Se mandan pedidos vacíos: la validación los corta ANTES de llamar a Anthropic,
// así que la prueba no gasta un centavo, pero el cupo se cuenta igual.
//
// 🔴 19-ago: esta prueba exigía un 429 y por eso el bug vivió tranquilo. El 429
// era exactamente lo que Mateo veía como "Marina no funciona": una oficina sale
// por UNA IP, entre todos agotaban el cupo de 12/min y el widget pintaba "el
// asistente no está disponible" en medio de la charla. Lo que hay que verificar
// no es el código de error, es que el cupo SIGA protegiendo la billetera
// (respuesta `degradado`, sin llamar a Anthropic) SIN romperle la charla a nadie.
let vioDegradado = false;
let hubo429 = false;
for (let i = 0; i < 50; i++) {
  const r = await post("/api/asistente", { mensaje: "" });
  if (r.status === 429) { hubo429 = true; break; }
  const d = await r.json().catch(() => ({}));
  if (d?.degradado) { vioDegradado = true; break; }
}
chequear("Marina corta el GASTO al que la martilla (cupo por IP)", vioDegradado, vioDegradado ? "pasó a modo ocupada" : "nunca corto");
chequear("🔴 …y NUNCA le tira un 429 al visitante", !hubo429, hubo429 ? "devolvió 429" : "sin 429");

// Con el cupo agotado sigue contestando algo hablado: la charla no muere.
const trasCorte = await post("/api/asistente", { mensaje: "hola" });
const cuerpoTrasCorte = await trasCorte.json().catch(() => ({}));
chequear("Con el cupo agotado sigue habiendo respuesta para el visitante",
  trasCorte.status === 200 && String(cuerpoTrasCorte?.respuesta ?? "").length > 10,
  `HTTP ${trasCorte.status}`);

// ── 3 · Cabeceras ────────────────────────────────────────────────────────────
const raiz = await fetch(APP + "/");
const h = (n) => raiz.headers.get(n) || "";
chequear("HSTS puesto", /max-age=\d{7,}/.test(h("strict-transport-security")), h("strict-transport-security") || "falta");
chequear("nosniff puesto", h("x-content-type-options") === "nosniff", h("x-content-type-options") || "falta");
chequear("No se puede meter el panel en un iframe",
  h("x-frame-options").toUpperCase() === "DENY" || /frame-ancestors\s+'none'/.test(h("content-security-policy")),
  h("x-frame-options") || h("content-security-policy") || "falta");
chequear("Referrer-Policy puesta", Boolean(h("referrer-policy")), h("referrer-policy") || "falta");

// ── 4 · Que no cuente de qué está hecho ──────────────────────────────────────
chequear("No anuncia el framework del servidor", !h("x-powered-by"), h("x-powered-by") || "limpio");

console.log(`\n${"═".repeat(50)}`);
console.log(`  ${ok} pruebas OK · ${fallos.length} fallaron`);
if (fallos.length) fallos.forEach((f) => console.log(`   · ${f}`));
console.log(`${"═".repeat(50)}\n`);
process.exitCode = fallos.length ? 1 : 0;
