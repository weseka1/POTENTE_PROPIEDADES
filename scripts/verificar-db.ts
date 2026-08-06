/**
 * POTENTE PROPIEDADES · Verificación de la base de datos
 * ─────────────────────────────────────────────────────────────────────────────
 * Prueba contra la base REAL las tres cosas que no se pueden dar por sentadas:
 *
 *   1. AISLAMIENTO POR OFICINA — que Chauvín no pueda leer los datos de Punta
 *      Mogotes ni al revés, y que Mateo vea las dos. No alcanza con esconderlo
 *      en la interfaz: se prueba con la clave real, contra la base.
 *   2. LO QUE VE UN DESCONOCIDO — que con la clave pública se pueda leer el
 *      catálogo publicado y NADA más (ni clientes, ni consultas, ni bandeja).
 *   3. INTEGRIDAD — que la base rechace una doble reserva y los datos inválidos.
 *
 * USO
 *   cd 03_IMPLEMENTACION/frontend
 *   npm run verificar-db
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "https://gqhpgexqbnqqqeynbucu.supabase.co";
const KEY = process.env.SUPABASE_KEY ?? "sb_publishable_LQ_JxpWjM__E0uO2s3hcUA_L_hLFJgw";

// Las claves del objeto son las que espera signInWithPassword: email y password.
const CUENTAS = {
  mateo:   { email: "mateo@potenteprop.com.ar",   password: "Potente.Mateo.2026" },
  chauvin: { email: "chauvin@potenteprop.com.ar", password: "Potente.Chauvin.2026" },
  mogotes: { email: "mogotes@potenteprop.com.ar", password: "Potente.Mogotes.2026" },
};

let ok = 0;
const fallos: string[] = [];
function chequear(nombre: string, paso: boolean, detalle = "") {
  if (paso) { ok++; console.log(`  ✓ ${nombre}${detalle ? ` · ${detalle}` : ""}`); }
  else { fallos.push(`${nombre}${detalle ? ` · ${detalle}` : ""}`); console.log(`  ✗ ${nombre}${detalle ? ` · ${detalle}` : ""}`); }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cliente nuevo por cuenta: cada sesión tiene que ser independiente de verdad.
 *  Con espera y reintentos: el endpoint de login de Supabase corta si le llegan
 *  varios pedidos seguidos desde la misma IP. */
async function entrar(quien: keyof typeof CUENTAS) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  for (let intento = 1; intento <= 5; intento++) {
    const { error } = await sb.auth.signInWithPassword(CUENTAS[quien]);
    if (!error) return sb;
    if (intento === 5) {
      throw new Error(
        `no se pudo entrar como ${quien} · ${error.message || "(sin mensaje)"} · status ${error.status ?? "?"} · code ${error.code ?? "?"}`
      );
    }
    process.stdout.write(`  … reintentando login de ${quien} (${intento})\n`);
    await esperar(4000 * intento);
  }
  return sb;
}

const contar = async (sb: any, tabla: string, filtro?: [string, string]) => {
  let q = sb.from(tabla).select("*", { count: "exact", head: true });
  if (filtro) q = q.eq(filtro[0], filtro[1]);
  const { count, error } = await q;
  return error ? -1 : (count ?? 0);
};

async function main() {
  console.log("\n═══ 1 · AISLAMIENTO POR OFICINA ═══\n");

  // Espaciados a propósito: tres logins seguidos disparan el límite de auth.
  const mateo = await entrar("mateo");
  await esperar(3000);
  const chauvin = await entrar("chauvin");
  await esperar(3000);
  const mogotes = await entrar("mogotes");

  const propsMateo = await contar(mateo, "potente_propiedades");
  const propsChauvin = await contar(chauvin, "potente_propiedades");
  const propsMogotes = await contar(mogotes, "potente_propiedades");

  chequear("Mateo (dirección) ve TODA la cartera", propsMateo === 103, `${propsMateo} propiedades`);
  chequear("Chauvín ve MENOS que Mateo", propsChauvin > 0 && propsChauvin < propsMateo, `${propsChauvin} propiedades`);
  chequear("Mogotes ve MENOS que Mateo", propsMogotes > 0 && propsMogotes < propsMateo, `${propsMogotes} propiedades`);

  // La prueba dura: que Chauvín no pueda leer NI UNA fila de la otra oficina,
  // ni siquiera pidiéndola explícitamente por su nombre.
  const fugaChauvin = await contar(chauvin, "potente_propiedades", ["oficina", "puntamogotes"]);
  const fugaMogotes = await contar(mogotes, "potente_propiedades", ["oficina", "chauvin"]);
  chequear("Chauvín NO puede leer propiedades de Mogotes ni pidiéndolas", fugaChauvin === 0, `intentó y obtuvo ${fugaChauvin}`);
  chequear("Mogotes NO puede leer propiedades de Chauvín ni pidiéndolas", fugaMogotes === 0, `intentó y obtuvo ${fugaMogotes}`);

  // Lo más sensible que pidió Mateo: las conversaciones de una oficina no las ve la otra.
  const convChauvinDeMogotes = await contar(chauvin, "potente_conversaciones", ["oficina", "puntamogotes"]);
  const convMogotesDeChauvin = await contar(mogotes, "potente_conversaciones", ["oficina", "chauvin"]);
  const convMateo = await contar(mateo, "potente_conversaciones");
  chequear("Bandeja aislada: Chauvín no ve hilos de Mogotes", convChauvinDeMogotes === 0);
  chequear("Bandeja aislada: Mogotes no ve hilos de Chauvín", convMogotesDeChauvin === 0);
  chequear("Mateo ve TODA la bandeja", convMateo === 8, `${convMateo} conversaciones`);

  // Nadie puede pasar una propiedad a la oficina de otro.
  const { error: errRobo } = await chauvin
    .from("potente_propiedades")
    .update({ oficina: "puntamogotes" })
    .eq("oficina", "chauvin")
    .limit(1);
  const robo = await contar(chauvin, "potente_propiedades", ["oficina", "puntamogotes"]);
  chequear("Chauvín no puede mover una propiedad a Mogotes", robo === 0, errRobo ? "rechazado con error" : "sin efecto");

  console.log("\n═══ 2 · LO QUE VE UN DESCONOCIDO (clave pública) ═══\n");

  const anon = createClient(URL, KEY, { auth: { persistSession: false } });

  const catalogo = await contar(anon, "potente_propiedades");
  chequear("Lee el catálogo publicado", catalogo > 0, `${catalogo} propiedades`);

  const temporada = await contar(anon, "potente_unidades_temporada");
  chequear("Lee las unidades de temporada activas", temporada > 0, `${temporada} unidades`);

  for (const tabla of [
    "potente_clientes", "potente_leads", "potente_conversaciones",
    "potente_operaciones", "potente_tasaciones", "potente_reservas_temporada",
    "potente_auditoria",
  ]) {
    const n = await contar(anon, tabla);
    chequear(`NO puede leer ${tabla}`, n === 0 || n === -1, n === -1 ? "bloqueado" : `${n} filas visibles`);
  }

  const { error: errEscritura } = await anon.from("potente_propiedades").insert({
    id: "HACK-1", categoria: "casa", titulo: "x", operacion: "venta", zona: "x", provincia: "x",
  });
  chequear("NO puede cargar una propiedad", Boolean(errEscritura), errEscritura?.code ?? "");

  // Sí puede dejar una consulta (es el formulario de la web), pero no asignársela.
  const idPrueba = `LEAD-VERIF-${Date.now()}`;
  const { error: errLead } = await anon.from("potente_leads").insert({
    id: idPrueba, fechaISO: new Date().toISOString(), nombre: "Verificación automática",
    contacto: "no responder", canal: "web", estado: "nueva", notas: "[VERIFICACIÓN] borrar",
  });
  chequear("SÍ puede dejar una consulta por el formulario", !errLead, errLead?.message ?? "");

  const { error: errLeadTrucho } = await anon.from("potente_leads").insert({
    id: `${idPrueba}-b`, fechaISO: new Date().toISOString(), nombre: "x", contacto: "x",
    canal: "web", estado: "nueva", oficina: "chauvin",
  });
  chequear("NO puede saltear la bandeja central autoasignando oficina", Boolean(errLeadTrucho));

  console.log("\n═══ 3 · INTEGRIDAD DE LOS DATOS ═══\n");

  // Doble reserva: tomo una reserva real y trato de pisarla con otra que se solape.
  const { data: reservas } = await mateo
    .from("potente_reservas_temporada")
    .select("unidadId, desdeISO, hastaISO")
    .neq("estado", "cancelada")
    .limit(1);

  if (reservas?.length) {
    const r = reservas[0];
    const { error: errSolape } = await mateo.from("potente_reservas_temporada").insert({
      id: `RSV-VERIF-${Date.now()}`, unidadId: r.unidadId,
      desdeISO: r.desdeISO, hastaISO: r.hastaISO, noches: 1,
      inquilino: "Verificación", personas: 1, estado: "senada",
    });
    chequear("La base RECHAZA una doble reserva de la misma unidad", Boolean(errSolape), errSolape?.code ?? "");
  } else {
    chequear("La base RECHAZA una doble reserva", false, "no hay reservas para probar");
  }

  // Fechas al revés y montos negativos.
  const { error: errFechas } = await mateo.from("potente_reservas_temporada").insert({
    id: `RSV-VERIF-F${Date.now()}`, unidadId: "TMP-01",
    desdeISO: "2027-02-10", hastaISO: "2027-02-01", noches: 1, inquilino: "x", personas: 1,
  });
  chequear("Rechaza un check-out anterior al check-in", Boolean(errFechas));

  const { error: errPrecio } = await mateo.from("potente_propiedades").insert({
    id: `VERIF-NEG-${Date.now()}`, categoria: "casa", titulo: "x", operacion: "venta",
    zona: "x", provincia: "x", precioUSD: -1000,
  });
  chequear("Rechaza un precio negativo", Boolean(errPrecio));

  const { error: errCategoria } = await mateo.from("potente_propiedades").insert({
    id: `VERIF-CAT-${Date.now()}`, categoria: "castillo", titulo: "x", operacion: "venta",
    zona: "x", provincia: "x",
  });
  chequear("Rechaza una categoría inventada", Boolean(errCategoria));

  const { error: errFK } = await mateo.from("potente_unidades_temporada").insert({
    id: `VERIF-FK-${Date.now()}`, propiedadId: "POT-NO-EXISTE", barrio: "x",
  });
  chequear("Rechaza una unidad que apunta a una propiedad inexistente", Boolean(errFK));

  console.log("\n═══ 4 · AUDITORÍA ═══\n");

  // Cambiar algo y ver si quedó registrado quién lo hizo.
  const { data: unaProp } = await mateo.from("potente_propiedades").select("id, destacado").limit(1).single();
  if (unaProp) {
    await mateo.from("potente_propiedades").update({ destacado: !unaProp.destacado }).eq("id", unaProp.id);
    await mateo.from("potente_propiedades").update({ destacado: unaProp.destacado }).eq("id", unaProp.id);
    const { data: rastro } = await mateo
      .from("potente_auditoria")
      .select("tabla, operacion, registro_id, usuario, despues")
      .eq("registro_id", unaProp.id)
      .order("ocurrido_en", { ascending: false })
      .limit(1);
    const a = rastro?.[0];
    chequear(
      "Un cambio queda registrado con quién lo hizo",
      Boolean(a && a.usuario === CUENTAS.mateo.email && "destacado" in (a.despues ?? {})),
      a ? `${a.operacion} por ${a.usuario}` : "sin rastro"
    );
  }

  // Limpieza de lo que dejó la verificación.
  await mateo.from("potente_leads").delete().like("id", "LEAD-VERIF-%");

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  ${ok} pruebas OK · ${fallos.length} fallaron`);
  if (fallos.length) {
    console.log("\n  FALLARON:");
    fallos.forEach((f) => console.log(`   · ${f}`));
  }
  console.log(`${"═".repeat(50)}\n`);

  await Promise.all([mateo.auth.signOut(), chauvin.auth.signOut(), mogotes.auth.signOut()]);
  process.exit(fallos.length ? 1 : 0);
}

main().catch((e) => {
  console.error("\n❌ La verificación se cortó:", e instanceof Error ? e.message : e);
  process.exit(1);
});
