/* Carga la data inicial (seed) en Supabase. Ejecutar: npx tsx scripts/seed.ts */
import { createClient } from "@supabase/supabase-js";
import { propiedades } from "../src/data/propiedades";
import { leads } from "../src/data/leads";
import { clientes } from "../src/data/clientes";
import { operaciones, visitas, tasaciones, arrendamientos } from "../src/data/operaciones";

const URL = "https://jkkytzgmhzzngnntkfbr.supabase.co";
const KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impra3l0emdtaHp6bmdubnRrZmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODA0OTQsImV4cCI6MjA4NDk1NjQ5NH0.ztBsYgEa4OIEUGHZOtRE-8glkYH2-rg8RHHQADblQUQ";

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function seed(table: string, rows: any[]) {
  let ok = 0;
  let err = "";
  for (const row of rows) {
    const { error } = await sb.from(table).upsert(row, { onConflict: "id" });
    if (error) err = error.message;
    else ok++;
  }
  console.log(err ? `❌ ${table}: ${ok}/${rows.length} (${err})` : `✅ ${table}: ${ok} filas`);
}

(async () => {
  await seed("potente_propiedades", propiedades as any[]);
  await seed("potente_leads", leads as any[]);
  await seed("potente_clientes", clientes as any[]);
  await seed("potente_operaciones", operaciones as any[]);
  await seed("potente_visitas", visitas as any[]);
  await seed("potente_tasaciones", tasaciones as any[]);
  await seed("potente_arrendamientos", arrendamientos as any[]);
  console.log("listo");
})();
