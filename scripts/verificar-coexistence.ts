/**
 * EL HISTORIAL DE WHATSAPP ENTRA COMO PASADO, NO COMO NOVEDAD.
 * ─────────────────────────────────────────────────────────────────────────────
 * El día que se escanee el QR de Coexistence, Meta manda de una sola vez los
 * chats viejos del celular de la oficina. Y los manda por DOS caminos distintos:
 *
 *   1. `value.history[].threads[]`  — los hilos completos. Esto ya se parseaba.
 *   2. `value.messages[]` con `field: "history"` — los que tienen ADJUNTO, con el
 *      MISMO wamid que su `media_placeholder` del hilo. Esto NO se parseaba: se
 *      leía `messages` sin mirar el `field`, así que un chat de hace cinco meses
 *      entraba como mensaje NUEVO sin responder. La bandeja de Mateo se habría
 *      llenado de rojo "Sin responder · hace 200.000 min".
 *
 * 🔴 POR QUÉ ESTA SUITE EXISTE Y POR QUÉ ES PURA: el historial llega UNA SOLA
 * VEZ. Si entra mal, no hay segunda oportunidad sin desconectar el número y
 * rehacer el flujo entero — y el número es el de la oficina que atiende. O sea:
 * esto no se puede probar en producción, hay que tenerlo bien ANTES. Molde:
 * `verificar-composicion.ts` / `verificar-derivacion.ts`.
 *
 *   npm run verificar-coexistence
 */
import { parsearEntrada, descripcionDeAdjunto } from "../netlify/functions/_meta";

let ok = 0;
const fallos: string[] = [];
const igual = (nombre: string, real: unknown, esperado: unknown) => {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  if (r === e) { ok++; console.log(`  ✓ ${nombre}`); }
  else fallos.push(`  ✗ ${nombre}\n      esperado ${e}\n      real     ${r}`);
};
const cierto = (nombre: string, cond: boolean, detalle = "") => {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else fallos.push(`  ✗ ${nombre}${detalle ? `\n      ${detalle}` : ""}`);
};

/* Los dos teléfonos, escritos como los escribe Meta: en `metadata` con espacios
 * y guiones, en `from` pelado. Esa inconsistencia es de Meta, no nuestra, y es
 * justo lo que hacía fallar la comparación. */
const OFICINA_LINDO = "+54 9 223 512-9032";
const OFICINA_PELADO = "5492235129032";
const CLIENTE = "5492236010101";

const sobre = (field: string, value: Record<string, unknown>) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "295097261637590", changes: [{ field, value }] }],
});
const meta = { display_phone_number: OFICINA_LINDO, phone_number_id: "961292850997751" };

console.log("\n📜 El historial de WhatsApp (Coexistence)\n");

/* ── 1 · El bug exacto: el MISMO mensaje, según el `field` ─────────────────── */
const mensajeDelCliente = {
  messaging_product: "whatsapp",
  metadata: meta,
  contacts: [{ wa_id: CLIENTE, profile: { name: "Sofía" } }],
  messages: [{ id: "wamid.VIEJO1", from: CLIENTE, timestamp: "1748000000", type: "image" }],
};

const comoNovedad = parsearEntrada(sobre("messages", mensajeDelCliente));
const comoHistorial = parsearEntrada(sobre("history", mensajeDelCliente));

igual("una novedad real NO se marca como histórica", comoNovedad[0]?.historico, undefined);
igual("…y el mismo payload con field:history SÍ", comoHistorial[0]?.historico, true);
cierto("el bug estaba acá: antes los dos daban lo mismo",
  comoNovedad[0]?.historico !== comoHistorial[0]?.historico,
  "si estos dos son iguales, el historial vuelve a entrar como novedad");
igual("el histórico del cliente sigue siendo del cliente", comoHistorial[0]?.de, "cliente");
igual("…y el hilo es el del cliente", comoHistorial[0]?.contacto, CLIENTE);
igual("…y conserva su fecha real, no la de hoy", comoHistorial[0]?.hora, new Date(1748000000 * 1000).toISOString());

/* ── 2 · Cuando en el historial escribe LA OFICINA ─────────────────────────── */
const escribeLaOficina = parsearEntrada(sobre("history", {
  messaging_product: "whatsapp",
  metadata: meta,
  messages: [{ id: "wamid.VIEJO2", from: OFICINA_PELADO, to: CLIENTE, timestamp: "1748000100", type: "document" }],
}));
igual("un histórico escrito por la oficina se guarda como 'humano'", escribeLaOficina[0]?.de, "humano");
igual("…y el hilo es el del CLIENTE, no el de la oficina", escribeLaOficina[0]?.contacto, CLIENTE);
cierto("el comparador ignora espacios y guiones de Meta",
  escribeLaOficina[0]?.de === "humano",
  `"${OFICINA_LINDO}" y "${OFICINA_PELADO}" tienen que ser el mismo teléfono`);

/* 🔴 El caso feo: la oficina escribió y Meta no dice a quién. Ese mensaje ya
 * entró por `history.threads` con su hilo correcto, así que acá se DESCARTA:
 * un hilo cuyo contacto es el propio número de Potente es basura en la bandeja
 * de Mateo, y encima con el nombre de su propia inmobiliaria como "cliente". */
const sinDestinatario = parsearEntrada(sobre("history", {
  messaging_product: "whatsapp",
  metadata: meta,
  messages: [{ id: "wamid.VIEJO3", from: OFICINA_PELADO, timestamp: "1748000200", type: "image" }],
}));
igual("sin destinatario NO se inventa un hilo con el número de Potente", sinDestinatario.length, 0);

/* ── 3 · Lo que ya andaba tiene que seguir andando (regresiones) ───────────── */
const hilosViejos = parsearEntrada(sobre("history", {
  messaging_product: "whatsapp",
  metadata: meta,
  history: [{
    threads: [{
      id: CLIENTE,
      messages: [
        { id: "wamid.H1", from: CLIENTE, timestamp: "1747000000", text: { body: "¿Sigue disponible el depto?" } },
        { id: "wamid.H2", from: OFICINA_PELADO, timestamp: "1747000060", text: { body: "Sí, la esperamos" } },
      ],
    }],
  }],
}));
igual("los hilos del historial siguen entrando enteros", hilosViejos.length, 2);
igual("…el del cliente, como cliente", hilosViejos[0]?.de, "cliente");
igual("…el de la oficina, como humano", hilosViejos[1]?.de, "humano");
cierto("…y los dos marcados históricos",
  hilosViejos.every((m) => m.historico === true));

const eco = parsearEntrada(sobre("smb_message_echoes", {
  messaging_product: "whatsapp",
  metadata: meta,
  message_echoes: [{ id: "wamid.ECO1", from: OFICINA_PELADO, to: CLIENTE, timestamp: "1757600000", text: { body: "Ya le paso la ficha" } }],
}));
igual("el eco de la oficina (la mitad que le importa a Mateo) sigue entrando", eco.length, 1);
igual("…como humano", eco[0]?.de, "humano");
igual("…en el hilo del cliente", eco[0]?.contacto, CLIENTE);
igual("…y NO marcado como histórico: es de ahora", eco[0]?.historico, undefined);

const dm = parsearEntrada({
  object: "instagram",
  entry: [{ id: "17841404222256569", messaging: [{ sender: { id: "17900001" }, recipient: { id: "17841404222256569" }, timestamp: 1757600000000, message: { mid: "mid.IG1", text: "Hola, vi la casa de Puán" } }] }],
});
igual("Instagram no se rompió con el cambio", dm.length, 1);
igual("…y sigue siendo del cliente", dm[0]?.de, "cliente");

/* ── 4 · Los tipos que solo aparecen con Coexistence, en castellano ────────── */
cierto("un adjunto del historial se dice en castellano, no 'media_placeholder'",
  descripcionDeAdjunto("media_placeholder").includes("adjunto del historial"),
  descripcionDeAdjunto("media_placeholder"));
cierto("…y nombra WhatsApp cuando es de WhatsApp",
  descripcionDeAdjunto("media_placeholder", "whatsapp").includes("WhatsApp"));
cierto("un mensaje eliminado se dice", descripcionDeAdjunto("revoke").includes("eliminado"));
cierto("un mensaje editado se dice", descripcionDeAdjunto("edited").includes("editado"));
cierto("lo que WhatsApp no pudo mostrar tampoco queda en blanco",
  descripcionDeAdjunto("unsupported").length > 0);
cierto("un tipo desconocido NUNCA queda vacío",
  descripcionDeAdjunto("algo_que_meta_invente_manana").length > 0,
  "una fila en blanco le hace creer a Mateo que el cliente no escribió nada");

/* ── 5 · Nada de esto puede TIRAR ──────────────────────────────────────────── */
const basura: unknown[] = [
  null, undefined, {}, { entry: null }, { entry: [{}] },
  sobre("history", { metadata: meta }),
  sobre("history", { metadata: null, messages: [{ id: "x", from: CLIENTE }] }),
  sobre("history", { metadata: meta, history: [{ errors: [{ code: 2593109, title: "History sync is turned off by the business" }] }] }),
  sobre("history", { metadata: meta, history: [{ threads: null }] }),
];
let tiro = "";
for (const b of basura) {
  try { parsearEntrada(b); } catch (e) { tiro = `${JSON.stringify(b)} → ${String(e)}`; break; }
}
cierto("ningún payload raro hace tirar al parser", tiro === "", tiro);

/* 🔴 Un error del historial NO genera mensajes, pero tampoco puede pasar mudo:
 * el 2593109 significa que el historial no va a llegar nunca. Acá se prueba que
 * no ensucia la bandeja; que se loguee se ve en el server. */
const conError = parsearEntrada(sobre("history", {
  metadata: meta,
  history: [{ errors: [{ code: 2593109, title: "History sync is turned off by the business" }] }],
}));
igual("un historial que viene con error no mete filas fantasma", conError.length, 0);

console.log("");
if (fallos.length) {
  console.log(fallos.join("\n"));
  console.log(`\n❌ ${ok} pasaron · ${fallos.length} fallaron\n`);
  process.exit(1);
}
console.log(`✅ ${ok}/${ok} — el historial entra como pasado y los ecos como presente\n`);
