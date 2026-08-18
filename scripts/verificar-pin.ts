/**
 * POTENTE PROPIEDADES · Verificación del PIN por perfil
 * ─────────────────────────────────────────────────────────────────────────────
 * El PIN es la segunda llave: el login separa a cada oficina, y el PIN cubre el
 * caso de la sesión abierta (alguien se cambia de perfil en la computadora de
 * Mateo). Se prueba contra la base:
 *
 *   1. Solo Dirección puede poner o quitar PIN.
 *   2. El PIN correcto entra y el incorrecto no.
 *   3. El hash NO se puede leer desde afuera, ni siquiera estando logueado.
 *   4. Un visitante anónimo no puede ni probar PINs.
 *   5. Cinco fallos seguidos bloquean el PIN 15 minutos — también al correcto
 *      (migración 017) — y quitar el PIN destraba.
 *
 * USO:  npm run verificar-pin
 */
import { createClient } from "@supabase/supabase-js";
// Las credenciales se leen de .env.local: en el repo no va ninguna clave.
import { cuenta, exigirBase, SUPABASE_URL as URL, SUPABASE_KEY as KEY } from "./credenciales";

exigirBase();


const CUENTAS = {
  mateo: cuenta("mateo"),
  chauvin: cuenta("chauvin"),
};

let ok = 0;
const fallos: string[] = [];
const chequear = (nombre: string, paso: boolean, extra = "") => {
  if (paso) { ok++; console.log(`  ✓ ${nombre}${extra ? ` · ${extra}` : ""}`); }
  else { fallos.push(nombre); console.log(`  ✗ ${nombre}${extra ? ` · ${extra}` : ""}`); }
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function entrar(quien: keyof typeof CUENTAS) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  for (let n = 1; n <= 5; n++) {
    const { error } = await sb.auth.signInWithPassword(CUENTAS[quien]);
    if (!error) return sb;
    if (n === 5) throw new Error(`login ${quien}: ${error.message || "sin mensaje"}`);
    await esperar(3500 * n);
  }
  return sb;
}

async function main() {
  console.log("\n═══ PIN POR PERFIL ═══\n");

  const mateo = await entrar("mateo");
  await esperar(3000);
  const chauvin = await entrar("chauvin");
  const anon = createClient(URL, KEY, { auth: { persistSession: false } });

  // ⚠️ Perfil de juguete, NO uno real. Esta prueba pone un PIN y después lo saca:
  // si corriera sobre "puntamogotes", cada verificación le borraría a Mateo el PIN
  // que puso, en producción y sin avisar.
  const PERFIL = "__verificacion__";
  const PIN = "4821";

  try {
    // 1 · Dirección pone el PIN
    const puesto = await mateo.rpc("potente_pin_definir", { p_perfil: PERFIL, p_pin: PIN });
    chequear("Dirección puede poner un PIN", !puesto.error, puesto.error?.message ?? "");

    const pide = await mateo.rpc("potente_pin_puesto", { p_perfil: PERFIL });
    chequear("El perfil queda marcado como 'pide PIN'", pide.data === true);

    // 2 · El PIN correcto entra, el incorrecto no
    const bien = await mateo.rpc("potente_pin_ok", { p_perfil: PERFIL, p_pin: PIN });
    const mal = await mateo.rpc("potente_pin_ok", { p_perfil: PERFIL, p_pin: "0000" });
    chequear("El PIN correcto abre", bien.data === true);
    chequear("El PIN incorrecto NO abre", mal.data === false);

    // 3 · Una oficina NO puede administrar los PIN
    const intento = await chauvin.rpc("potente_pin_definir", { p_perfil: "mateo", p_pin: "1111" });
    chequear("Una oficina NO puede ponerle PIN a nadie", Boolean(intento.error), intento.error ? "rechazado" : "🔴 LO DEJÓ");

    // 4 · El hash no se lee, ni logueado
    const fuga = await mateo.from("potente_pines").select("*");
    chequear("Ni Dirección puede leer los PIN guardados", (fuga.data?.length ?? 0) === 0, fuga.error ? "bloqueado" : `${fuga.data?.length} filas`);

    // 5 · Un desconocido no puede ni probar PINs
    const anonPrueba = await anon.rpc("potente_pin_ok", { p_perfil: PERFIL, p_pin: PIN });
    chequear("Un visitante anónimo no puede probar PINs", Boolean(anonPrueba.error) || anonPrueba.data !== true, anonPrueba.error ? "bloqueado" : `devolvió ${anonPrueba.data}`);

    // 6 · Quitar el PIN lo deja libre otra vez
    await mateo.rpc("potente_pin_definir", { p_perfil: PERFIL, p_pin: "" });
    const trasQuitar = await mateo.rpc("potente_pin_puesto", { p_perfil: PERFIL });
    chequear("Se puede quitar el PIN", trasQuitar.data === false);

    // 7 · Un PIN corto se rechaza
    const corto = await mateo.rpc("potente_pin_definir", { p_perfil: PERFIL, p_pin: "12" });
    chequear("Rechaza un PIN de menos de 4 números", Boolean(corto.error));

    // 8 · El PIN se defiende solo (migración 017): 5 fallos seguidos → 15 min
    //     bloqueado, y el bloqueo frena TAMBIÉN al PIN correcto. Se rearma el
    //     de juguete: el 6 borró la fila, así que ésta nace con el contador en 0.
    const rearme = await mateo.rpc("potente_pin_definir", { p_perfil: PERFIL, p_pin: PIN });
    chequear("Se rearma el PIN de juguete para probar el límite", !rearme.error, rearme.error?.message ?? "");

    const intentos: string[] = [];
    for (let n = 1; n <= 5; n++) {
      const r = await mateo.rpc("potente_pin_ok", { p_perfil: PERFIL, p_pin: "0000" });
      intentos.push(r.error ? `error: ${r.error.message}` : String(r.data));
    }
    chequear("5 intentos errados seguidos devuelven false (sin excepción)",
      intentos.every((r) => r === "false"), intentos.join(" · "));

    const sexto = await mateo.rpc("potente_pin_ok", { p_perfil: PERFIL, p_pin: PIN });
    chequear("El 6º intento — con el PIN CORRECTO — rebota con 'Demasiados intentos'",
      Boolean(sexto.error) && (sexto.error?.message ?? "").includes("Demasiados intentos"),
      sexto.error?.message ?? `🔴 devolvió ${sexto.data}`);

    // Quitar el PIN borra la fila y el bloqueo se va con ella: el perfil vuelve
    // a pasar libre (diseño 002). Es la limpieza y también la prueba del destrabe.
    const quita = await mateo.rpc("potente_pin_definir", { p_perfil: PERFIL, p_pin: "" });
    const libre = await mateo.rpc("potente_pin_ok", { p_perfil: PERFIL, p_pin: "0000" });
    chequear("Quitar el PIN de juguete destraba (la fila se va, el bloqueo con ella)",
      !quita.error && !libre.error && libre.data === true,
      libre.error?.message ?? `devolvió ${libre.data}`);

    // 9 · Los PIN reales quedaron como estaban (la prueba no pisa nada de Mateo)
    const reales = await Promise.all(
      ["mateo", "chauvin", "puntamogotes"].map((p) => mateo.rpc("potente_pin_puesto", { p_perfil: p })),
    );
    chequear("Ningún PIN real se rompió con la prueba", reales.every((r) => !r.error),
      reales.map((r, i) => `${["mateo", "chauvin", "puntamogotes"][i]}:${r.data ? "con PIN" : "sin PIN"}`).join(" · "));
  } finally {
    // 🔴 La sonda se limpia SIEMPRE, pase lo que pase: una corrida cortada
    // dejaría '__verificacion__' con PIN — y quizá bloqueado 15 minutos —
    // envenenando las corridas siguientes (patrón de e2e/pin-direccion.mjs).
    const quitado = await mateo.rpc("potente_pin_definir", { p_perfil: PERFIL, p_pin: "" });
    const sigue = await mateo.rpc("potente_pin_puesto", { p_perfil: PERFIL });
    if (quitado.error || sigue.error || sigue.data !== false) {
      console.error(`\n🔴🔴 EL PIN DE JUGUETE ('${PERFIL}') QUEDÓ EN LA BASE. Limpiarlo YA con una de estas:`);
      console.error(`   · por RPC (Dirección): potente_pin_definir(p_perfil:'${PERFIL}', p_pin:'')`);
      console.error(`   · o en el SQL Editor:  delete from potente_pines where perfil_id = '${PERFIL}';`);
      fallos.push("La limpieza del PIN de juguete falló");
    }
  }

  console.log(`\n${"═".repeat(46)}`);
  console.log(`  ${ok} pruebas OK · ${fallos.length} fallaron`);
  if (fallos.length) fallos.forEach((f) => console.log(`   · ${f}`));
  console.log(`${"═".repeat(46)}\n`);

  await Promise.all([mateo.auth.signOut(), chauvin.auth.signOut()]);
  process.exit(fallos.length ? 1 : 0);
}

main().catch((e) => {
  console.error("\n❌ La verificación se cortó:", e instanceof Error ? e.message : e);
  process.exit(1);
});
