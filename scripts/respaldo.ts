/**
 * POTENTE PROPIEDADES · Respaldo de la base
 * ─────────────────────────────────────────────────────────────────────────────
 * Baja TODO a un archivo JSON con fecha. Sirve para dos cosas:
 *
 *   1. Antes de una migración: si algo sale mal, el dato está.
 *   2. Como respaldo periódico — el plan free de Supabase **no tiene backups
 *      automáticos**, y esto es un cliente que paga.
 *
 * Entra como la DIRECCIÓN (no con service_role): así el respaldo prueba, de paso,
 * que el usuario de Mateo sigue viendo todo lo que tiene que ver. Si el RLS se
 * rompiera, el respaldo saldría corto y nos enteraríamos acá.
 *
 * USO
 *   npm run respaldo                  → 05_RESPALDOS/2026-08-08T1930_respaldo.json
 *   npm run respaldo -- --carpeta X   → a otra carpeta
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cuenta, exigirBase, SUPABASE_URL as URL, SUPABASE_KEY as KEY } from "./credenciales";

exigirBase();

// Todo lo que duele perder. El orden es el de las dependencias, por si algún día
// esto se usa para restaurar (las propiedades antes que sus unidades y reservas).
const TABLAS = [
  "potente_propiedades",
  "potente_leads",
  "potente_clientes",
  "potente_operaciones",
  "potente_visitas",
  "potente_tasaciones",
  "potente_arrendamientos",
  "potente_fichas",
  "potente_unidades_temporada",
  "potente_reservas_temporada",
  "potente_conversaciones",
  "potente_auditoria",
] as const;

const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  const { error: errLogin } = await sb.auth.signInWithPassword(cuenta("mateo"));
  if (errLogin) throw new Error(`No pude entrar como la dirección: ${errLogin.message}`);

  console.log("\n═══ RESPALDO ═══\n");

  const datos: Record<string, unknown[]> = {};
  let total = 0;
  const problemas: string[] = [];

  for (const tabla of TABLAS) {
    // Paginado: PostgREST corta en 1000 filas por defecto y un respaldo cortado
    // es peor que no tener respaldo, porque parece completo.
    const filas: unknown[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await sb.from(tabla).select("*").range(desde, desde + 999);
      if (error) { problemas.push(`${tabla}: ${error.message}`); break; }
      filas.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    datos[tabla] = filas;
    total += filas.length;
    console.log(`  ${filas.length.toString().padStart(5)} · ${tabla}`);
  }

  await sb.auth.signOut();

  const ahora = new Date();
  const sello = ahora.toISOString().slice(0, 16).replace(/[:T]/g, "").replace(/(\d{8})/, "$1T");
  const carpeta = resolve(arg("--carpeta") ?? "../../05_RESPALDOS");
  mkdirSync(carpeta, { recursive: true });
  const salida = resolve(carpeta, `${ahora.toISOString().slice(0, 10)}_${sello.slice(-4)}_respaldo.json`);

  writeFileSync(
    salida,
    JSON.stringify(
      {
        proyecto: "gqhpgexqbnqqqeynbucu",
        tomado: ahora.toISOString(),
        // Contar acá lo que se esperaba sirve para detectar un respaldo corto:
        // si mañana el RLS se rompe, este número baja y salta a la vista.
        filas: Object.fromEntries(Object.entries(datos).map(([t, f]) => [t, f.length])),
        datos,
      },
      null,
      1,
    ),
    "utf8",
  );

  console.log(`\n  ${total} filas → ${salida}`);
  if (problemas.length) {
    console.log("\n  ⚠️ TABLAS QUE FALLARON (el respaldo está incompleto):");
    problemas.forEach((p) => console.log(`   · ${p}`));
  }
  console.log(
    problemas.length
      ? "\n  🔴 NO avanzar con una migración con este respaldo.\n"
      : "\n  ✅ Respaldo completo.\n",
  );
  process.exit(problemas.length ? 1 : 0);
}

main().catch((e) => {
  console.error("\n❌ El respaldo se cortó:", e instanceof Error ? e.message : e);
  process.exit(1);
});
