/**
 * POTENTE PROPIEDADES · Carga de datos a Supabase
 * ─────────────────────────────────────────────────────────────────────────────
 * Sube el contenido de src/data/*.ts a la base. Es idempotente (usa upsert):
 * se puede correr las veces que sea, siempre deja la base igual a los archivos.
 *
 * CÓMO SE USA
 *   cd 03_IMPLEMENTACION/frontend
 *   npm run sembrar            → solo datos REALES
 *   npm run sembrar -- --con-demo → + datos de ejemplo del CRM
 *
 * QUÉ ES REAL Y QUÉ ES DE EJEMPLO
 *   REAL      → las 103 propiedades (replicadas del sitio de Potente) y las 11
 *               unidades de temporada (apuntan a propiedades reales).
 *   DE EJEMPLO→ leads, clientes, operaciones, visitas, tasaciones, alquileres,
 *               conversaciones y reservas: nombres inventados para que la demo
 *               se vea viva. En el sistema de un cliente que paga, arrancan vacías
 *               salvo que se pida --con-demo.
 *
 * SEGURIDAD
 *   Entra como el usuario de dirección (mateo@) con la CLAVE PÚBLICA, igual que
 *   el panel. No usa la service_role: si el RLS estuviera mal, este script falla,
 *   y eso es justamente lo que queremos que pase.
 */
import { createClient } from "@supabase/supabase-js";
// Las credenciales se leen de .env.local: en el repo no va ninguna clave.
import { cuenta, exigirBase, SUPABASE_URL as URL, SUPABASE_KEY as KEY } from "./credenciales";

exigirBase();
const { email: EMAIL, password: PASS } = cuenta("mateo");
import { propiedades } from "../src/data/propiedades";
import { leads } from "../src/data/leads";
import { clientes } from "../src/data/clientes";
import {
  operaciones, visitas, tasaciones, arrendamientos,
} from "../src/data/operaciones";
import { unidadesTemporada, reservasTemporada } from "../src/data/temporada";

const CON_DEMO = process.argv.includes("--con-demo");

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

/** Recorta un ISO a fecha (las columnas de reserva son date, no timestamp). */
const soloFecha = (iso: string) => iso.slice(0, 10);

/** Sube en lotes: el upsert de a 500 filas es el punto dulce de la API REST. */
async function subir(tabla: string, filas: object[]) {
  if (!filas.length) return console.log(`   ${tabla.padEnd(30)} — sin filas`);
  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500);
    const { error } = await sb.from(tabla).upsert(lote, { onConflict: "id" });
    if (error) {
      console.error(`❌ ${tabla}: ${error.message}`);
      if (error.details) console.error(`   detalle: ${error.details}`);
      process.exit(1);
    }
  }
  console.log(`   ✓ ${tabla.padEnd(30)} ${String(filas.length).padStart(4)} filas`);
}

async function main() {
  // ── Entrar al sistema como el panel ─────────────────────────────────────────
  const { error: errLogin } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASS });
  if (errLogin) {
    console.error(`❌ No se pudo entrar como ${EMAIL}: ${errLogin.message}`);
    process.exit(1);
  }
  console.log(`\n🔑 Conectado como ${EMAIL}\n`);

  // ── 1 · DATOS REALES ────────────────────────────────────────────────────────
  console.log("📦 Datos reales de Potente");

  // publicado: los seeds no siempre lo traen; en la web todas se ven, así que
  // van publicadas salvo que el dato diga explícitamente que no.
  await subir(
    "potente_propiedades",
    propiedades.map((p) => ({
      id: p.id,
      categoria: p.categoria,
      titulo: p.titulo,
      operacion: p.operacion,
      precioUSD: p.precioUSD ?? null,
      precioARS: p.precioARS ?? null,
      precioPorHa: p.precioPorHa ?? null,
      zona: p.zona,
      provincia: p.provincia,
      direccion: p.direccion ?? null,
      fotos: p.fotos ?? [],
      descripcion: p.descripcion ?? "",
      estado: p.estado,
      publicado: p.publicado ?? true,
      destacado: Boolean(p.destacado),
      esNuevo: Boolean(p.esNuevo),
      esOportunidad: Boolean(p.esOportunidad),
      hectareas: p.hectareas ?? null,
      aptitud: p.aptitud ?? null,
      ambientes: p.ambientes ?? null,
      dormitorios: p.dormitorios ?? null,
      banos: p.banos ?? null,
      cocheras: p.cocheras ?? null,
      m2cubiertos: p.m2cubiertos ?? null,
      m2totales: p.m2totales ?? null,
      caracteristicas: p.caracteristicas ?? [],
      video: p.video ?? null,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      ficha: p.ficha ?? null,
      oficina: p.oficina ?? null,
    }))
  );

  await subir(
    "potente_unidades_temporada",
    unidadesTemporada.map((u) => ({
      id: u.id,
      propiedadId: u.propiedadId,
      ambientes: u.ambientes,
      capacidad: u.capacidad,
      barrio: u.barrio,
      frenteAlMar: Boolean(u.frenteAlMar),
      comodidades: u.comodidades ?? [],
      tarifas: u.tarifas ?? {},
      tarifaNocheARS: u.tarifaNocheARS ?? 0,
      minNoches: u.minNoches ?? null,
      comisionPct: u.comisionPct,
      activa: u.activa,
      enLimpieza: Boolean(u.enLimpieza),
      oficina: u.oficina ?? null,
    }))
  );

  // ── 2 · DATOS DE EJEMPLO (solo con --con-demo) ──────────────────────────────
  if (!CON_DEMO) {
    console.log("\n⏭️  Datos de ejemplo del CRM: NO se cargan (agregá --con-demo si los querés)");
  } else {
    console.log("\n🎭 Datos de ejemplo del CRM (nombres inventados)");

    await subir("potente_leads", leads.map((l) => ({
      id: l.id, fechaISO: l.fechaISO, nombre: l.nombre, contacto: l.contacto,
      campoId: l.campoId ?? null, canal: l.canal, estado: l.estado,
      asignado: l.asignado, notas: l.notas ?? "", oficina: l.oficina ?? null,
    })));

    await subir("potente_clientes", clientes.map((c) => ({
      id: c.id, nombre: c.nombre, tipo: c.tipo, telefono: c.telefono ?? "",
      email: c.email ?? "", localidad: c.localidad ?? "",
      buscaZona: c.buscaZona ?? null, buscaHasMin: c.buscaHasMin ?? null,
      buscaHasMax: c.buscaHasMax ?? null, buscaAptitud: c.buscaAptitud ?? null,
      presupuestoUSD: c.presupuestoUSD ?? null, operaciones: c.operaciones ?? 0,
      desdeISO: c.desdeISO ?? null, notas: c.notas ?? "", oficina: c.oficina ?? null,
    })));

    await subir("potente_operaciones", operaciones.map((o) => ({
      id: o.id, campoId: o.campoId, clienteNombre: o.clienteNombre, etapa: o.etapa,
      valorUSD: o.valorUSD, comisionPct: o.comisionPct,
      responsable: o.responsable ?? null, actualizadoISO: o.actualizadoISO ?? null,
    })));

    await subir("potente_visitas", visitas.map((v) => ({
      id: v.id, fechaISO: v.fechaISO, hora: v.hora, campoId: v.campoId ?? null,
      clienteNombre: v.clienteNombre, responsable: v.responsable ?? null, estado: v.estado,
    })));

    await subir("potente_tasaciones", tasaciones.map((t) => ({
      id: t.id, fechaISO: t.fechaISO, solicitante: t.solicitante, contacto: t.contacto ?? "",
      zona: t.zona ?? null, hectareas: t.hectareas ?? null, aptitud: t.aptitud ?? null,
      valorEstimadoUSD: t.valorEstimadoUSD ?? null, estado: t.estado,
    })));

    await subir("potente_arrendamientos", arrendamientos.map((a) => ({
      id: a.id, campoId: a.campoId, arrendatario: a.arrendatario,
      hectareas: a.hectareas ?? null, valorAnualUSD: a.valorAnualUSD,
      inicioISO: a.inicioISO ?? null, vencimientoISO: a.vencimientoISO ?? null, estado: a.estado,
    })));

    await subir("potente_reservas_temporada", reservasTemporada.map((r) => ({
      id: r.id, unidadId: r.unidadId,
      desdeISO: soloFecha(r.desdeISO), hastaISO: soloFecha(r.hastaISO),
      noches: r.noches, inquilino: r.inquilino, contacto: r.contacto ?? "",
      personas: r.personas, montoTotalARS: r.montoTotalARS, senaARS: r.senaARS,
      garantiaARS: r.garantiaARS, estado: r.estado,
      creadaISO: r.creadaISO ?? null, notas: r.notas ?? null,
    })));

    // 🔴 potente_conversaciones NO se siembra, ni con --con-demo (19-ago).
    // Es el registro operativo de los canales reales: las CONV-01..08 de demo
    // aparecieron en el panel de Mateo como si Nicolás Peralta existiera.
    // Se borraron de producción ese día; las semillas quedan solo para el
    // modo demo sin base (DataProvider las usa únicamente si no hay Supabase).
  }

  // ── 3 · Control final ───────────────────────────────────────────────────────
  console.log("\n📊 Lo que quedó en la base:");
  for (const t of [
    "potente_propiedades", "potente_unidades_temporada", "potente_leads", "potente_clientes",
    "potente_operaciones", "potente_visitas", "potente_tasaciones", "potente_arrendamientos",
    "potente_reservas_temporada", "potente_conversaciones",
  ]) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`   ${t.padEnd(30)} ${error ? `error: ${error.message}` : `${String(count).padStart(4)} filas`}`);
  }

  await sb.auth.signOut();
  console.log("\n✅ Listo.\n");
}

main().catch((e) => {
  console.error("\n❌ El seed se cortó:", e instanceof Error ? e.message : e);
  process.exit(1);
});
