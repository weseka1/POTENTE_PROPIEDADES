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
// Las credenciales se leen de .env.local: en el repo no va ninguna clave.
import { cuenta, exigirBase, SUPABASE_URL as URL, SUPABASE_KEY as KEY } from "./credenciales";

exigirBase();

// Los acentos, para comparar texto sin depender de las tildes.
//
// ⚠️ El rango va como STRING con escapes, no como caracteres literales adentro
// de un /regex/. Escrito literal funciona… hasta que alguien reencodea el
// archivo: ahí deja de matchear y no tira ningún error. Es la misma forma que
// usa src/site/lib/parseBusqueda.ts.
const DIACRITICOS = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");

// Las claves del objeto son las que espera signInWithPassword: email y password.
const CUENTAS = {
  mateo: cuenta("mateo"),
  chauvin: cuenta("chauvin"),
  mogotes: cuenta("mogotes"),
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

/**
 * Borra TODO lo que dejó la verificación.
 *
 * ⚠️ Se llama desde un `finally`, no al final del camino feliz. Varias pruebas
 * crean filas, y la primera prueba de todas afirma que la cartera tiene 103
 * propiedades: si una prueba del medio corta el script, la fila de prueba queda
 * y esa primera prueba se pone roja PARA SIEMPRE, en cada corrida futura.
 */
async function limpiar(sb: any) {
  await sb.from("potente_leads").delete().like("id", "LEAD-VERIF-%");
  await sb.from("potente_propiedades").delete().like("id", "PROP-VERIF-%");
  await sb.from("potente_propiedades").delete().like("id", "VERIF-%");
  await sb.from("potente_reservas_temporada").delete().like("id", "RSV-VERIF-%");
  await sb.from("potente_unidades_temporada").delete().like("id", "UNI-VERIF-%");
  // Llaves de prueba: los movimientos se van en cascada con su llave, pero se
  // barren igual por si alguno quedó apuntando a una llave ya borrada.
  await sb.from("potente_movimientos_llave").delete().like("id", "MOV-VERIF-%");
  await sb.from("potente_llaves").delete().like("id", "LLV-VERIF-%");
  await sb.from("potente_planos").delete().like("id", "PLANO-VERIF-%");
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

  // Una corrida anterior cortada no puede envenenar ésta: se barre ANTES,
  // además del finally (el doble barrido que ya usan las suites e2e).
  await limpiar(mateo);

  /* ── Siembra de TEMPORADA (sonda; se borra en el finally) ──────────────────
   * Las pruebas de aislamiento e integridad de temporada dependían de que
   * hubiera unidades y reservas VIVAS. El 18-ago la temporada quedó
   * legítimamente vacía (se borraron las semillas y las fichas de prueba) y
   * cuatro pruebas se pusieron rojas con "0 de 0" — rojo por datos del cliente,
   * la clase de test que MIENTE. La regla de la casa: toda prueba que necesita
   * datos SIEMBRA los suyos.
   * Las fichas de sonda van con publicado:false — JAMÁS pisan la web del
   * cliente. Las unidades sí van activas: la prueba del visitante necesita
   * poder leer una unidad activa por la API (y sin ficha publicada no llegan
   * a la web igual: unidadesPublicables exige la ficha en la vista). */
  const SELLO = Date.now();
  const sondaProp = (id: string, oficina: "chauvin" | "puntamogotes") => ({
    id, categoria: "departamento", operacion: "temporada", publicado: false,
    estado: "activa", titulo: "Sonda de verificación de temporada",
    zona: "Punta Mogotes", provincia: "Mar del Plata", oficina,
    descripcion: "Fila de la verificación automática de WESEKA. Se borra sola al terminar.",
    fotos: [],
  });
  const sondaUnidad = (id: string, propiedadId: string, oficina: "chauvin" | "puntamogotes") => ({
    id, propiedadId, oficina, barrio: "Punta Mogotes", ambientes: 2, capacidad: 4,
    frenteAlMar: false, comodidades: [], tarifas: {}, tarifaNocheARS: 0,
    comisionPct: 15, activa: true, enLimpieza: false,
  });
  const siembra = [
    await mateo.from("potente_propiedades").insert([
      sondaProp(`PROP-VERIF-TCH-${SELLO}`, "chauvin"),
      sondaProp(`PROP-VERIF-TMG-${SELLO}`, "puntamogotes"),
    ]),
    await mateo.from("potente_unidades_temporada").insert([
      sondaUnidad(`UNI-VERIF-CH-${SELLO}`, `PROP-VERIF-TCH-${SELLO}`, "chauvin"),
      sondaUnidad(`UNI-VERIF-MG-${SELLO}`, `PROP-VERIF-TMG-${SELLO}`, "puntamogotes"),
    ]),
    await mateo.from("potente_reservas_temporada").insert({
      id: `RSV-VERIF-BASE-${SELLO}`, unidadId: `UNI-VERIF-MG-${SELLO}`,
      desdeISO: "2028-01-10", hastaISO: "2028-01-15", noches: 5,
      inquilino: "Verificación", personas: 2, estado: "senada",
    }),
  ];
  const errSiembra = siembra.find((r) => r.error)?.error;
  if (errSiembra) {
    console.error(`\n🔴 No se pudo sembrar la sonda de temporada: ${errSiembra.message}`);
    console.error("   Sin la sonda, las pruebas de temporada no prueban nada. Abortando.");
    await limpiar(mateo);
    process.exit(1);
  }

  const propsMateo = await contar(mateo, "potente_propiedades");
  const propsChauvin = await contar(chauvin, "potente_propiedades");
  const propsMogotes = await contar(mogotes, "potente_propiedades");

  // ⚠️ NO se afirma un número exacto. Lo que esta prueba tiene que demostrar es
  // el AISLAMIENTO (que la dirección ve más que cada oficina), no cuántas
  // propiedades hay hoy: la cartera crece cada vez que Mateo carga una, y una
  // fila de prueba huérfana ponía esto en rojo sin que hubiera ningún problema
  // real. Ya pasó: un script de depuración se cortó antes de limpiar y la
  // primera prueba quedó fallando con "104 propiedades".
  // Sin número fijo: la cartera baja cuando Mateo borra y sube cuando carga. Lo
  // que importa es que la dirección vea algo y vea MÁS que cualquier oficina —
  // eso es el aislamiento, que es lo que esta prueba cuida de verdad.
  chequear("Mateo (dirección) ve toda la cartera", propsMateo > 0, `${propsMateo} propiedades`);
  chequear("Chauvín ve MENOS que Mateo", propsChauvin > 0 && propsChauvin < propsMateo, `${propsChauvin} propiedades`);
  chequear("Mogotes ve MENOS que Mateo", propsMogotes > 0 && propsMogotes < propsMateo, `${propsMogotes} propiedades`);

  // La prueba dura: que Chauvín no pueda leer NI UNA fila de la otra oficina,
  // ni siquiera pidiéndola explícitamente por su nombre.
  const fugaChauvin = await contar(chauvin, "potente_propiedades", ["oficina", "puntamogotes"]);
  const fugaMogotes = await contar(mogotes, "potente_propiedades", ["oficina", "chauvin"]);
  chequear("Chauvín NO puede leer propiedades de Mogotes ni pidiéndolas", fugaChauvin === 0, `intentó y obtuvo ${fugaChauvin}`);
  chequear("Mogotes NO puede leer propiedades de Chauvín ni pidiéndolas", fugaMogotes === 0, `intentó y obtuvo ${fugaMogotes}`);

  /* 🔴 LAS CONVERSACIONES SON DEL ORQUESTADOR (migración 015, pedido de Mateo
   * del 17-ago: «no quiere que vean en las demás oficinas… él ve las
   * conversaciones de las sucursales»). La prueba vieja miraba solo el CRUCE
   * (Chauvín no ve hilos marcados Mogotes) y pasaba en verde mientras las
   * oficinas leían 7 de 8 conversaciones — las centrales, con oficina NULL,
   * que la regla de la 004 les regalaba. La regla de verdad es total: una
   * oficina lee CERO conversaciones, de cualquier oficina y de la central.
   * ⚠️ Y sin cantidades fijas: la prueba vieja afirmaba `=== 8` sobre una
   * bandeja VIVA — se rompía sola con la primera conversación nueva de Marina. */
  const convChauvin = await contar(chauvin, "potente_conversaciones");
  const convMogotes = await contar(mogotes, "potente_conversaciones");
  const convMateo = await contar(mateo, "potente_conversaciones");
  chequear("🔒 Chauvín lee CERO conversaciones (ni las de la central)", convChauvin === 0, `leyó ${convChauvin}`);
  chequear("🔒 Mogotes lee CERO conversaciones (ni las de la central)", convMogotes === 0, `leyó ${convMogotes}`);
  chequear("Mateo sigue viendo la bandeja entera", convMateo > 0, `${convMateo} conversaciones`);

  // Temporada: las unidades y, con ellas, las reservas (que llevan el nombre y el
  // teléfono del inquilino). La reserva no tiene columna oficina: la hereda de su
  // unidad, así que se prueba contra las unidades de la otra oficina.
  const unidadesMateo = await contar(mateo, "potente_unidades_temporada");
  const unidadesChauvin = await contar(chauvin, "potente_unidades_temporada");
  chequear("Temporada dividida: Chauvín ve MENOS unidades que Mateo",
    unidadesChauvin >= 0 && unidadesChauvin < unidadesMateo, `${unidadesChauvin} de ${unidadesMateo}`);

  const idsDeMogotes = async (sb: any) => {
    const { data } = await sb.from("potente_unidades_temporada").select("id").eq("oficina", "puntamogotes");
    return (data ?? []).map((u: { id: string }) => u.id);
  };
  const unidadesMogotes = await idsDeMogotes(mateo);
  const reservasMateo = await contar(mateo, "potente_reservas_temporada");

  let fugaReservas = -1;
  if (unidadesMogotes.length) {
    const { data, error } = await chauvin
      .from("potente_reservas_temporada")
      .select("id, inquilino, contacto")
      .in("unidadId", unidadesMogotes);
    fugaReservas = error ? -1 : (data?.length ?? 0);
  }
  chequear("Chauvín NO ve las reservas (ni los inquilinos) de Mogotes",
    fugaReservas <= 0, fugaReservas > 0 ? `filtró ${fugaReservas}` : "bloqueado");

  const reservasChauvin = await contar(chauvin, "potente_reservas_temporada");
  chequear("Mateo ve TODAS las reservas y cada oficina solo las suyas",
    reservasMateo > 0 && reservasChauvin < reservasMateo, `${reservasChauvin} de ${reservasMateo}`);

  // Tampoco puede crear una reserva sobre una unidad de la otra oficina.
  if (unidadesMogotes.length) {
    const { error: errReservaAjena } = await chauvin.from("potente_reservas_temporada").insert({
      id: `RSV-VERIF-AJENA-${Date.now()}`, unidadId: unidadesMogotes[0],
      desdeISO: "2028-03-01", hastaISO: "2028-03-05", noches: 4,
      inquilino: "Verificación", personas: 1, estado: "senada",
    });
    chequear("Chauvín no puede reservar una unidad de Mogotes", Boolean(errReservaAjena), errReservaAjena?.code ?? "");
  }

  // Nadie puede pasar una propiedad a la oficina de otro.
  const { error: errRobo } = await chauvin
    .from("potente_propiedades")
    .update({ oficina: "puntamogotes" })
    .eq("oficina", "chauvin")
    .limit(1);
  const robo = await contar(chauvin, "potente_propiedades", ["oficina", "puntamogotes"]);
  chequear("Chauvín no puede mover una propiedad a Mogotes", robo === 0, errRobo ? "rechazado con error" : "sin efecto");

  // ── LLAVES (migración 011): «que cada oficina tenga su registro» ────────────
  // El llavero es el caso más sensible del aislamiento: saber dónde está la
  // llave de un inmueble ajeno es saber demasiado.
  const idLlaveMogotes = `LLV-VERIF-MOG-${Date.now()}`;
  const { error: errLlaveMog } = await mogotes.from("potente_llaves").insert({
    id: idLlaveMogotes, numero: 9901, propietario: "Verificación Mogotes",
    direccion: "Sonda automática", estado: "en_oficina", oficina: "puntamogotes",
  });
  chequear("Mogotes puede cargar una llave en SU llavero", !errLlaveMog, errLlaveMog?.message ?? "");

  const laVeChauvin = await contar(chauvin, "potente_llaves", ["id", idLlaveMogotes]);
  chequear("🔴 Chauvín NO ve la llave de Mogotes", laVeChauvin === 0, `${laVeChauvin} visibles`);

  const laVeMateo = await contar(mateo, "potente_llaves", ["id", idLlaveMogotes]);
  chequear("Mateo (dirección) SÍ la ve", laVeMateo === 1, `${laVeMateo}`);

  // Y no puede llevársela a su oficina con un update (el with check de la policy).
  await chauvin.from("potente_llaves").update({ oficina: "chauvin" }).eq("id", idLlaveMogotes);
  const { data: trasRobo } = await mateo.from("potente_llaves").select("oficina").eq("id", idLlaveMogotes).maybeSingle();
  chequear("Chauvín no puede mudar una llave a su oficina", trasRobo?.oficina === "puntamogotes", `quedó en ${trasRobo?.oficina}`);

  // La coherencia del vistazo rápido: "entregada" SIEMPRE con nombre. Es el
  // constraint que evita repetir el problema que originó el módulo.
  const { error: errSinNombre } = await mogotes.from("potente_llaves")
    .update({ estado: "entregada", enPoderDe: null }).eq("id", idLlaveMogotes);
  chequear("La base rechaza una llave 'entregada' sin decir a quién", Boolean(errSinNombre), errSinNombre?.code ?? "");

  // El movimiento hereda el permiso de su llave.
  const { error: errMovAjeno } = await chauvin.from("potente_movimientos_llave").insert({
    id: `MOV-VERIF-AJENO-${Date.now()}`, llaveId: idLlaveMogotes, tipo: "entrega", fechaISO: "2026-08-12", persona: "Sonda",
  });
  chequear("🔴 Chauvín NO puede anotar un movimiento en una llave de Mogotes", Boolean(errMovAjeno), errMovAjeno?.code ?? "");

  // El número no se repite dentro de la misma oficina (índice único).
  const { error: errDuplicado } = await mogotes.from("potente_llaves").insert({
    id: `LLV-VERIF-DUP-${Date.now()}`, numero: 9901, propietario: "Duplicado",
    estado: "en_oficina", oficina: "puntamogotes",
  });
  chequear("Dos llaves no comparten número en la misma oficina", Boolean(errDuplicado), errDuplicado?.code ?? "");

  // ── PLANOS EN LA NUBE (migración 016): el dibujo viaja entre dispositivos ──
  // A diferencia del llavero, la tabla es transversal al equipo A PROPÓSITO
  // (como potente_fichas): se dibuja en el iPad y se abre en la compu. La sonda
  // upsertea, la ve otra oficina, se relee con su fecha y se borra.
  const idPlano = `PLANO-VERIF-${Date.now()}`;
  const { error: errPlanoSube } = await chauvin.from("potente_planos").upsert({
    id: idPlano, data: { v: 2, floors: [], active: 0, mPerCell: 0.5, unit: "auto" },
  });
  chequear("Una oficina puede guardar un plano en la nube", !errPlanoSube, errPlanoSube?.message ?? "");

  const { data: planoLeido, error: errPlanoLee } = await chauvin
    .from("potente_planos").select("data, updated_at").eq("id", idPlano).maybeSingle();
  chequear(
    "…y volver a leerlo con su fecha (la que decide qué versión gana)",
    !errPlanoLee && planoLeido?.data?.v === 2 && Boolean(planoLeido?.updated_at),
    errPlanoLee?.message ?? "",
  );

  const planoTransversal = await contar(mogotes, "potente_planos", ["id", idPlano]);
  chequear("El plano lo ve TODO el equipo (transversal, como las fichas)", planoTransversal === 1, `${planoTransversal} visibles`);

  const { error: errPlanoBorra } = await chauvin.from("potente_planos").delete().eq("id", idPlano);
  const planoQueda = await contar(chauvin, "potente_planos", ["id", idPlano]);
  chequear("…y borrarlo de verdad", !errPlanoBorra && planoQueda === 0, errPlanoBorra?.message ?? `${planoQueda} quedaron`);

  console.log("\n═══ 2 · LO QUE VE UN DESCONOCIDO (clave pública) ═══\n");

  const anon = createClient(URL, KEY, { auth: { persistSession: false } });

  // 🔴 Desde la migración 012 el visitante NO puede leer la tabla cruda: lee la
  // VISTA, que es lo que hace la web. Antes esto contaba sobre la tabla y por
  // eso pasaba en verde mientras la ficha se filtraba — la prueba medía el
  // permiso equivocado.
  const catalogo = await contar(anon, "potente_propiedades_web");
  chequear("Lee el catálogo publicado (por la vista)", catalogo > 0, `${catalogo} propiedades`);

  const crudo = await contar(anon, "potente_propiedades");
  chequear(
    "🔒 …y NO puede leer la tabla cruda con `*`",
    crudo === -1,
    crudo === -1 ? "bloqueado" : `🔴 ${crudo} filas · correr 012_ficha_cerrada.sql`,
  );

  // Temporada no tiene vista: el visitante lee la tabla, pero SOLO las columnas
  // públicas (la comisión y la tarifa por noche quedan adentro).
  const temporada = await anon
    .from("potente_unidades_temporada")
    .select('id,"propiedadId",oficina,ambientes,capacidad,barrio,"frenteAlMar",comodidades,activa');
  chequear(
    "Lee las unidades de temporada activas",
    !temporada.error && (temporada.data?.length ?? 0) > 0,
    temporada.error?.message?.slice(0, 60) ?? `${temporada.data?.length} unidades`,
  );

  // La web tiene que leer la VISTA, no la tabla: la ficha interna (propietario,
  // llaves, observaciones) no puede viajar al navegador de un desconocido.
  const vista = await anon.from("potente_propiedades_web").select("*").limit(1);
  chequear("La vista pública existe y responde", !vista.error && (vista.data?.length ?? 0) > 0, vista.error?.message ?? "");
  chequear("La vista NO trae la ficha interna", !("ficha" in (vista.data?.[0] ?? { ficha: 1 })));

  // La vista es la única puerta del visitante, así que su cuenta ES el catálogo.
  const catalogoVista = await contar(anon, "potente_propiedades_web");
  chequear("La vista muestra el catálogo completo", catalogoVista === catalogo && catalogoVista > 0, `${catalogoVista} propiedades`);

  for (const tabla of [
    "potente_clientes", "potente_leads", "potente_conversaciones",
    "potente_operaciones", "potente_tasaciones", "potente_reservas_temporada",
    // El llavero es del equipo: el visitante de la web no tiene nada que hacer
    // ahí (migración 011 le revoca todo explícitamente).
    "potente_llaves", "potente_movimientos_llave",
    // Un plano puede llevar datos del propietario dibujados encima: anon no
    // tiene ni grant ni política (migración 016).
    "potente_planos",
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

  console.log("\n═══ 2b · LA PUERTA CIERRA SOLA ═══\n");

  // El agujero más feo que salió en la auditoría del 7-ago: "no tener oficina"
  // significaba VER TODO (así entraba Mateo), y una cuenta recién creada tampoco
  // tiene oficina. Encima el registro público estaba abierto. Una cuenta
  // desconocida nacía con los permisos de la dirección.
  //
  // Ahora la dirección se declara con rol=direccion en app_metadata, que solo se
  // escribe desde el backend. Estas pruebas cuidan las dos mitades.

  const { data: sesionMateo } = await mateo.auth.getSession();
  const claims = (() => {
    try {
      const t = sesionMateo?.session?.access_token ?? "";
      return JSON.parse(Buffer.from(t.split(".")[1], "base64").toString("utf8"));
    } catch { return {}; }
  })();
  chequear(
    "La dirección se declara EXPLÍCITAMENTE (rol en el token)",
    claims?.app_metadata?.rol === "direccion",
    `rol=${claims?.app_metadata?.rol ?? "(ninguno)"}`
  );
  chequear(
    "Y no le cuelga de 'no tener oficina'",
    claims?.app_metadata?.oficina === undefined,
    "Mateo no tiene oficina, pero eso ya no le da permisos"
  );

  // Registro público: si está abierto, cualquiera se crea una cuenta con la clave
  // que viaja en la web. Hoy el mail sin confirmar lo frena, pero eso es un
  // interruptor. Que esté cerrado es el candado de verdad.
  // ── Que un desconocido no se pueda crear una cuenta ─────────────────────────
  // Lo que importa no es el interruptor de Supabase (que es configuración de
  // cuenta y no se puede tocar por SQL): es que el alta NO ENTRE. Lo cierra el
  // trigger `potente_solo_el_equipo` de la migración 006, que rechaza cualquier
  // dominio que no esté en potente_dominios_permitidos.
  const intentarAlta = async (email: string) => {
    const r = await fetch(`${URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: `Verif-${Date.now()}-Ax9!` }),
    });
    const b: any = await r.json().catch(() => ({}));
    // Entró si devolvió un usuario con id. Cualquier otra cosa = rechazado.
    return { entro: r.ok && Boolean(b?.id), status: r.status, codigo: String(b?.error_code ?? "") };
  };

  const desdeGmail = await intentarAlta(`sonda.verificacion.${Date.now()}@gmail.com`);
  chequear(
    "Un desconocido NO puede crearse una cuenta",
    !desdeGmail.entro,
    desdeGmail.entro ? "🔴 SE CREÓ LA CUENTA" : `rechazado (HTTP ${desdeGmail.status})`,
  );

  const desdeOtro = await intentarAlta(`sonda.verificacion.${Date.now()}@dominio-cualquiera.net`);
  chequear(
    "Tampoco con otro dominio inventado",
    !desdeOtro.entro,
    desdeOtro.entro ? "🔴 SE CREÓ LA CUENTA" : `rechazado (HTTP ${desdeOtro.status})`,
  );

  // Y que el candado no se haya pasado de rosca: el equipo TIENE que poder darse
  // de alta, o el día que entre alguien nuevo a la inmobiliaria no se puede.
  // Se consulta la lista blanca en vez de crear una cuenta de prueba: este script
  // entra como usuario normal y no podría borrarla después.
  const permitido = async (d: string) =>
    (await mateo.rpc("potente_dominio_permitido", { p_dominio: d })).data === true;
  chequear(
    "Pero el equipo SÍ puede (el candado no se pasó de rosca)",
    (await permitido("potenteprop.com.ar")) && !(await permitido("gmail.com")),
    "potenteprop.com.ar habilitado · gmail.com no",
  );

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

  console.log("\n═══ 3b · LA FICHA COMPLETA (audios de Mateo, 7-ago) ═══\n");

  // ── El vocabulario de estados ───────────────────────────────────────────────
  const { data: estados } = await mateo.rpc("potente_estados_propiedad");
  chequear(
    "Los estados son EXACTAMENTE los 5 que nombró Mateo",
    JSON.stringify(estados) === JSON.stringify(["activa", "reservada", "vendida", "alquilada", "suspendida"]),
    (estados ?? []).join(" · "),
  );

  const conEstado = async (estado: string) => {
    const id = `PROP-VERIF-${estado}-${Date.now()}`;
    const { error } = await mateo.from("potente_propiedades").insert({
      id, categoria: "casa", titulo: "Verificación", operacion: "venta",
      zona: "Verificación", provincia: "Mar del Plata", estado,
    });
    return { id, error };
  };

  const alquilada = await conEstado("alquilada");
  chequear("Acepta el estado 'alquilada'", !alquilada.error, alquilada.error?.message ?? "");

  const viejo = await conEstado("disponible");
  chequear("RECHAZA el vocabulario viejo ('disponible')", Boolean(viejo.error), "el enum se cambió de verdad");

  const inventado = await conEstado("mudada");
  chequear("Rechaza un estado inventado", Boolean(inventado.error));

  // ── 🔒 Una SUSPENDIDA no la ve el visitante. Ni en la vista, ni pidiendo la
  //    tabla directo (con security_invoker el anon conserva el SELECT sobre la
  //    tabla base, así que filtrar solo en la vista no alcanzaba).
  const idSusp = `PROP-VERIF-SUSP-${Date.now()}`;
  await mateo.from("potente_propiedades").insert({
    id: idSusp, categoria: "casa", titulo: "Suspendida de prueba", operacion: "venta",
    zona: "Verificación", provincia: "Mar del Plata", estado: "suspendida", publicado: true,
  });
  const enVista = await anon.from("potente_propiedades_web").select("id").eq("id", idSusp);
  const enTabla = await anon.from("potente_propiedades").select("id").eq("id", idSusp);
  chequear("Una suspendida NO sale en la vista pública", (enVista.data?.length ?? 0) === 0);
  chequear(
    "Ni pidiendo la tabla directo con la clave pública",
    (enTabla.data?.length ?? 0) === 0,
    (enTabla.data?.length ?? 0) === 0 ? "bloqueado por la política" : "🔴 SE FILTRÓ",
  );

  // ── Los 15 campos nuevos: ¿los acepta la base y los expone la vista? ────────
  const idCampos = `PROP-VERIF-CAMPOS-${Date.now()}`;
  const nuevos = {
    m2semicubiertos: 12.5, m2descubiertos: 30, m2construibles: 240,
    metrosFrente: 10, metrosFondo: 30, tipoAcceso: "asfalto",
    piso: "PB", depto: "B", disposicion: "contrafrente", orientacion: "SO",
    accesoEdificio: "ascensor", tipoCochera: "cubierta",
    antiguedadAnios: 15, expensasARS: 85000, aptaCredito: true,
  };
  const { error: errNuevos } = await mateo.from("potente_propiedades").insert({
    id: idCampos, categoria: "departamento", titulo: "Verificación de campos",
    operacion: "venta", zona: "Verificación", provincia: "Mar del Plata",
    publicado: true, ...nuevos,
  });
  chequear("La base acepta los 15 campos nuevos", !errNuevos, errNuevos?.message ?? "");

  // Este es el modo de falla que ya nos pasó con `ficha`: el dato está guardado y
  // la web queda muda porque la vista no lo expone.
  const { data: filaVista } = await anon
    .from("potente_propiedades_web").select("*").eq("id", idCampos).maybeSingle();
  const faltan = Object.keys(nuevos).filter((k) => !(k in (filaVista ?? {})));
  chequear(
    "La vista pública EXPONE los 15 campos nuevos",
    Boolean(filaVista) && faltan.length === 0,
    faltan.length ? `🔴 faltan: ${faltan.join(", ")}` : "los 15",
  );
  chequear(
    "…y los devuelve con el valor que se guardó",
    filaVista?.expensasARS === 85000 && filaVista?.piso === "PB" && filaVista?.tipoCochera === "cubierta",
    `expensas ${filaVista?.expensasARS} · piso ${filaVista?.piso}`,
  );
  chequear("La vista sigue SIN exponer la ficha interna", !("ficha" in (filaVista ?? { ficha: 1 })));

  /* 🔴 …Y TAMPOCO PIDIÉNDOLA DIRECTO EN LA TABLA CRUDA.
   * Hasta el 13-ago esto no se probaba, y ahí estaba el agujero: la vista
   * escondía la ficha, pero `anon` conserva el SELECT sobre la tabla base (lo
   * necesita `security_invoker`) y ese permiso llegaba a TODAS las columnas.
   * Un `select=id,ficha` devolvía la ficha interna de la cartera entera.
   * Lo cierra la migración 012. Esta prueba es la que no lo deja volver. */
  const fichaCruda = await anon.from("potente_propiedades").select("id,ficha").limit(1);
  chequear(
    "🔒 El visitante NO puede leer la ficha ni pidiendo la tabla cruda",
    Boolean(fichaCruda.error) || !(fichaCruda.data?.[0] && "ficha" in fichaCruda.data[0]),
    fichaCruda.error ? `bloqueado (${fichaCruda.error.code})` : "🔴 EXPUESTA · correr 02_INFRA/supabase/012_ficha_cerrada.sql",
  );

  /* Temporada no tiene vista pública: el visitante lee la tabla. Lo interno de
   * esa tabla (la comisión de Potente sobre todo) tampoco puede salir. */
  const tempCruda = await anon.from("potente_unidades_temporada").select('id,"comisionPct"').limit(1);
  chequear(
    "🔒 El visitante NO ve la comisión de las unidades de temporada",
    Boolean(tempCruda.error) || tempCruda.data?.[0]?.comisionPct === undefined,
    tempCruda.error ? `bloqueado (${tempCruda.error.code})` : "🔴 EXPUESTA · correr 012_ficha_cerrada.sql",
  );

  /* 🔴 «Los precios de temporada deben decir todos a consultar. No debemos dar
   * referencia de precios» (Mateo, 13-ago). La web dice "A consultar", pero si
   * la tarifa igual viajara en la respuesta el precio se leería en la pestaña de
   * red. Lo corta la migración 013. */
  const tarifas = await anon.from("potente_unidades_temporada").select("id,tarifas").limit(1);
  chequear(
    "🔒 …ni las TARIFAS de temporada (no se publican precios)",
    Boolean(tarifas.error) || tarifas.data?.[0]?.tarifas === undefined,
    tarifas.error ? `bloqueado (${tarifas.error.code})` : "🔴 EXPUESTAS · correr 013_tarifas_no_se_publican.sql",
  );

  /* …pero lo que la web SÍ necesita de temporada tiene que seguir llegando, o
   * la página queda vacía. Es la otra mitad del candado. */
  const tempPublica = await anon
    .from("potente_unidades_temporada")
    .select('id,"propiedadId",oficina,ambientes,capacidad,barrio,"frenteAlMar",comodidades,activa')
    .limit(1);
  chequear(
    "…y la web sigue leyendo lo que necesita de temporada",
    !tempPublica.error,
    tempPublica.error?.message?.slice(0, 70) ?? "",
  );
  // 010: el catálogo ordena "más recientes primero" con esta columna. Si la
  // vista no la expone, el orden del visitante degrada al del archivo en mudo.
  chequear(
    "La vista pública EXPONE created_at (orden 'más recientes', migración 010)",
    "created_at" in (filaVista ?? {}),
    "created_at" in (filaVista ?? {}) ? "" : "🔴 correr 02_INFRA/supabase/010_orden_recientes.sql",
  );

  // ── El relleno de la migración ──────────────────────────────────────────────
  //
  // ⚠️ ACÁ NO SE CUENTAN FILAS, SE VERIFICA LA INVARIANTE. Estas dos pruebas
  // decían "hay 21 o más con expensas" y "hay 67 o más aptas crédito". Eran
  // ciertas el día de la migración y se pusieron rojas solas el 10-ago, cuando
  // Mateo borró tres propiedades y editó veinte: la base dejó de ser un seed y
  // pasó a ser la cartera viva de una inmobiliaria. Un contador de volumen
  // contra datos de un cliente que trabaja da rojo para siempre, y un rojo que
  // no es un bug enseña a ignorar los rojos.
  //
  // Lo que la migración prometió no es una cantidad: es que NO QUEDE el dato
  // como texto suelto teniendo la columna vacía. Eso es cierto con 97
  // propiedades, con 300 y con las que cargue Mateo mañana.
  const textoSuelto = async (aguja: string, columnaVacia: (q: any) => any) => {
    const { data } = await columnaVacia(
      mateo.from("potente_propiedades").select("id, caracteristicas"),
    );
    return (data ?? []).filter((p: any) =>
      (p.caracteristicas ?? []).some((c: string) =>
        c.normalize("NFD").replace(DIACRITICOS, "").toLowerCase().includes(aguja),
      ),
    );
  };

  const expensasHuerfanas = await textoSuelto("expensas", (q: any) => q.is("expensasARS", null));
  chequear(
    "Ninguna propiedad tiene las expensas como texto y la columna vacía",
    expensasHuerfanas.length === 0,
    expensasHuerfanas.length ? expensasHuerfanas.map((p: any) => p.id).join(", ") : "todas migradas",
  );

  const creditoHuerfano = await textoSuelto("apto credito", (q: any) => q.not("aptaCredito", "is", true));
  chequear(
    "Ninguna dice \"apto crédito\" en el texto con el campo apagado",
    creditoHuerfano.length === 0,
    creditoHuerfano.length ? creditoHuerfano.map((p: any) => p.id).join(", ") : "todas migradas",
  );

  // Ningún duplicado quedó sin migrar: si la columna está vacía y la ficha tiene
  // el dato, la migración se salteó una fila.
  const { data: sinMigrar } = await mateo
    .from("potente_propiedades").select("id, ficha").is("dormitorios", null);
  const huerfanos = (sinMigrar ?? []).filter((p: any) => p.ficha?.dormitorios != null).length;
  chequear("Ningún duplicado de la ficha quedó sin migrar", huerfanos === 0, `${huerfanos} sin migrar`);

  console.log("\n═══ 3c · LAS TRES OPERACIONES (Mateo, 14-ago) ═══\n");

  /* Mateo, 14-ago-2026, textual: «tienen que quedar 3 tipos de operaciones:
   * Venta, Alquiler, Temporada». Y Juani, el mismo día: «arrendamiento cambia
   * por temporada» — se verificó antes de escribir la migración 014 que CERO
   * propiedades usaban 'arrendamiento', así que el valor se reemplaza sin
   * migrar ni un dato.
   *
   * Este bloque es el gemelo del vocabulario de estados de acá arriba, y existe
   * por la misma razón: el enum es del lado de la BASE. El front puede tener el
   * union de TypeScript impecable y la base seguir aceptando el valor viejo —
   * esa es la mitad que se olvida y la que nadie ve hasta que un dato entra mal.
   *
   * ⚠️ Acá tampoco se cuentan filas: NO se afirma "hay N propiedades en
   * temporada". La cartera es viva (Mateo carga y borra todos los días) y un
   * contador se pondría rojo solo, sin que haya ningún problema real — ya pasó
   * con las expensas y con apta crédito (ver el comentario del relleno, arriba).
   * Lo que se prueba es el VOCABULARIO, que es lo que la migración prometió y no
   * se mueve con el trabajo del día.
   */
  const { data: operaciones } = await mateo.rpc("potente_operaciones_propiedad");
  chequear(
    "Las operaciones son EXACTAMENTE las 3 que nombró Mateo",
    JSON.stringify(operaciones) === JSON.stringify(["venta", "alquiler", "temporada"]),
    (operaciones ?? []).join(" · "),
  );

  /* La sonda de escritura. El id lleva el prefijo PROP-VERIF- a propósito: es lo
   * que barre `limpiar()` en el `finally`. Esta es una base de PRODUCCIÓN de un
   * cliente que la usa a diario y una fila de prueba huérfana deja una prueba en
   * rojo para siempre (ver el comentario de limpiar()). */
  const conOperacion = async (operacion: string) => {
    const id = `PROP-VERIF-OP-${operacion}-${Date.now()}`;
    const { error } = await mateo.from("potente_propiedades").insert({
      id, categoria: "casa", titulo: "Verificación", operacion,
      zona: "Verificación", provincia: "Mar del Plata",
    });
    return { id, error };
  };

  // (se llama opTemporada y no `temporada`: ese nombre ya lo usa la sonda de
  //  unidades de temporada del bloque 2, y son cosas distintas)
  const opTemporada = await conOperacion("temporada");
  chequear("Acepta la operación 'temporada'", !opTemporada.error, opTemporada.error?.message ?? "");

  /* 🔴 LA PRUEBA QUE MÁS IMPORTA DE LAS CUATRO. `ALTER TYPE ... ADD VALUE` no
   * sirve para esto (el valor nuevo no se puede usar en la misma transacción, y
   * el editor de Supabase manda todo como una), así que la 014 hace el
   * INTERCAMBIO de tipo completo. Una migración a medias —alguien que agrega
   * 'temporada' de la manera fácil— deja 'arrendamiento' VIVO y las otras tres
   * pruebas pasan igual, en verde, mintiendo. Esta es la única que la caza. */
  const arrendamiento = await conOperacion("arrendamiento");
  chequear(
    "RECHAZA el vocabulario viejo ('arrendamiento')",
    Boolean(arrendamiento.error),
    "el enum se intercambió de verdad",
  );

  // Y que la puerta siga cerrada para cualquier otra cosa: sin esto, un enum con
  // un cuarto valor de más pasaría la prueba de arriba sin despeinarse.
  const opInventada = await conOperacion("permuta");
  chequear("Rechaza una operación inventada", Boolean(opInventada.error));

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

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  ${ok} pruebas OK · ${fallos.length} fallaron`);
  if (fallos.length) {
    console.log("\n  FALLARON:");
    fallos.forEach((f) => console.log(`   · ${f}`));
  }
  console.log(`${"═".repeat(50)}\n`);

  await Promise.all([mateo.auth.signOut(), chauvin.auth.signOut(), mogotes.auth.signOut()]);
  return fallos.length ? 1 : 0;
}

// La limpieza va en un finally: si una prueba corta el script a mitad de camino,
// las filas de prueba tienen que irse igual. Si no, la próxima corrida arranca
// con una cartera de 104 propiedades y la primera prueba falla para siempre.
let salida = 1;
try {
  salida = await main();
} catch (e) {
  console.error("\n❌ La verificación se cortó:", e instanceof Error ? e.message : e);
} finally {
  try {
    const sb = createClient(URL, KEY, { auth: { persistSession: false } });
    await sb.auth.signInWithPassword(cuenta("mateo"));
    await limpiar(sb);
    await sb.auth.signOut();
  } catch {
    console.error("⚠️ No pude limpiar las filas de prueba. Revisar PROP-VERIF-% y LEAD-VERIF-%.");
  }
}
process.exit(salida);
