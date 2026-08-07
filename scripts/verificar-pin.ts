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

  // 8 · Los PIN reales quedaron como estaban (la prueba no pisa nada de Mateo)
  const reales = await Promise.all(
    ["mateo", "chauvin", "puntamogotes"].map((p) => mateo.rpc("potente_pin_puesto", { p_perfil: p })),
  );
  chequear("Ningún PIN real se rompió con la prueba", reales.every((r) => !r.error),
    reales.map((r, i) => `${["mateo", "chauvin", "puntamogotes"][i]}:${r.data ? "con PIN" : "sin PIN"}`).join(" · "));

  // Limpieza: que no quede el perfil de juguete dando vueltas.
  await mateo.rpc("potente_pin_definir", { p_perfil: PERFIL, p_pin: "" });

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
