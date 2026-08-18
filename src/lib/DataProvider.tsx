import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import type { Propiedad } from "@/data/propiedadTypes";
import { ESTADOS_CERRADOS } from "@/data/propiedadTypes";
import type { Lead, Cliente, Operacion_, Visita, Tasacion, Arrendamiento, UnidadTemporada, ReservaTemporada, Llave, MovimientoLlave } from "@/data/types";
import { seedLlaves, seedMovimientosLlave } from "@/data/llaves";
import { propiedades as seedPropiedades } from "@/data/propiedades";
import { leads as seedLeads } from "@/data/leads";
import { clientes as seedClientes } from "@/data/clientes";
import { operaciones as seedOps, visitas as seedVisitas, tasaciones as seedTas, arrendamientos as seedArr } from "@/data/operaciones";
import { unidadesTemporada as seedUnidades, reservasTemporada as seedReservas } from "@/data/temporada";
import { conversaciones as seedConversaciones } from "@/data/conversaciones";
import type { Conversacion, EstadoConv, MensajeConv } from "@/data/conversaciones";
import { consultasPorMes as seedConsultasMes } from "@/data/kpis";
import { comoFechaLocal } from "./format";
import { rebaseISO } from "./fechas";

// Demo "siempre actual": las fechas del dataset de ejemplo se desplazan al día real (ver lib/fechas).
const seedLeadsR = seedLeads.map((l) => ({ ...l, fechaISO: rebaseISO(l.fechaISO) }));
const seedClientesR = seedClientes.map((c) => ({ ...c, desdeISO: rebaseISO(c.desdeISO) }));
const seedOpsR = seedOps.map((o) => ({ ...o, actualizadoISO: rebaseISO(o.actualizadoISO) }));
const seedVisitasR = seedVisitas.map((v) => ({ ...v, fechaISO: rebaseISO(v.fechaISO) }));
const seedTasR = seedTas.map((t) => ({ ...t, fechaISO: rebaseISO(t.fechaISO) }));
const seedArrR = seedArr.map((a) => ({ ...a, inicioISO: rebaseISO(a.inicioISO), vencimientoISO: rebaseISO(a.vencimientoISO) }));

// ===== Persistencia en modo DEMO (sin Supabase) =====
// Sin base de datos, los cambios del panel viven en localStorage para que
// sobrevivan al refresh (que Mateo cargue una propiedad y siga ahí). Con Supabase
// esto no se usa: manda la DB. Versionado para descartar datos si cambian los seeds.
// Al subir el modelo de reservas de temporada (quincena → fechas) hay que invalidar
// el cache viejo: una reserva sin desdeISO/hastaISO rompía la sección Temporada.
// ⚠️ REGLA: cada vez que cambian los SEEDS (catálogo, reservas, leads…) hay que
// SUBIR esta versión. El 13-jul se reemplazó el catálogo entero por el real y esta
// versión quedó igual → los navegadores que ya habían visitado la demo siguieron
// mostrando los datos viejos del localStorage por una semana (le pasó a Juani).
// ⚠️ SUBIR ESTO cada vez que cambie la FORMA de los datos, no solo su contenido.
// 8-ago: el vocabulario de estados pasó de disponible/reservado/vendido a
// activa/reservada/vendida/alquilada/suspendida. Todo navegador que ya había
// abierto la app tiene propiedades guardadas con el vocabulario viejo, y
// `estadoCampo["disponible"]` ahora es undefined → pantalla blanca. Subir la
// versión invalida ese caché y se rehidrata del seed nuevo.
// 14-ago: `arrendamiento` salió del vocabulario y entró `temporada` como
// OPERACIÓN. Todo navegador que ya abrió la demo tiene propiedades guardadas
// con el vocabulario viejo; sin subir esto seguiría mostrándolas y la
// temporada aparecería vacía. Es la misma regla del 8-ago.
const SEED_VERSION = "2026-08-14-temporada-es-operacion";
const lsKey = (name: string) => `potente_demo_${name}`;

/** Para páginas que guardan su propia colección (ej: Fichas) y no viven en el provider. */
export function cargarDemo<T>(name: string, fallback: T): T {
  return loadLocal(name, fallback);
}
export function guardarDemo<T>(name: string, data: T) {
  saveLocal(name, data);
}

function loadLocal<T>(name: string, fallback: T): T {
  if (supabase) return fallback; // con DB, no leemos del cache local
  try {
    const raw = localStorage.getItem(lsKey(name));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== SEED_VERSION || !Array.isArray(parsed?.data)) return fallback;
    return parsed.data as T;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(name: string, data: T) {
  if (supabase) return; // con DB, no cacheamos local
  try {
    localStorage.setItem(lsKey(name), JSON.stringify({ v: SEED_VERSION, data }));
  } catch (e) {
    // Se llenó el navegador (suele pasar con muchas fotos). Antes esto se tragaba
    // en silencio: el usuario guardaba algo, refrescaba, y no estaba. Que se entere.
    console.error(`No se pudo guardar "${name}" en el navegador:`, e);
    window.dispatchEvent(new CustomEvent("potente:sin-espacio", { detail: { coleccion: name } }));
  }
}

// Borra los datos de demo guardados y recarga (botón "Restablecer datos de prueba").
export function resetDemoData() {
  try {
    [
      "propiedades", "leads", "clientes", "operaciones", "visitas", "tasaciones", "arrendamientos",
      "unidades_temporada", "reservas_temporada", "conversaciones", "fichas",
      "llaves", "movimientos_llave",
    ].forEach((n) => localStorage.removeItem(lsKey(n)));
  } catch { /* noop */ }
}

/**
 * Lo que devuelve una escritura a la base.
 *
 * Antes cada llamada terminaba en `.then(() => {}, () => {})`, que descarta el
 * error sin dejar rastro. Eso escondió un bug real: entre el 6 y el 7-ago el
 * formulario de la web usaba `upsert`, la base lo rechazaba por permisos, y el
 * visitante igual veía "¡Consulta enviada!". Nadie se enteró hasta auditarlo.
 *
 * Loguear no alcanza: la consola la mira un programador, no Mateo. Por eso las
 * escrituras de propiedades devuelven esto y quien llama muestra el fallo EN
 * PANTALLA. El caso que viene a evitar: el formulario guarda una columna que la
 * base todavía no tiene, PostgREST rechaza el update entero con 400, y el panel
 * igual muestra "Cambios guardados ✓". Mateo edita, ve el tilde, y no se guardó.
 */
export type Resultado = { ok: boolean; error?: string; codigo?: string };

/** En modo demo (sin base) no hay nada que verificar: siempre salió bien. */
const SIN_BASE: Resultado = { ok: true };

/** Corre una operación contra la base, avisa por consola si falla y devuelve el resultado. */
async function aviso(que: string, op: PromiseLike<{ error: unknown }>): Promise<Resultado> {
  try {
    const r = await op;
    const e = r?.error as { message?: string; code?: string } | null;
    if (e) {
      console.error(`Base de datos · ${que}:`, e);
      return { ok: false, error: e.message ?? String(e), codigo: e.code };
    }
    return { ok: true };
  } catch (e) {
    console.error(`Base de datos · ${que} (sin conexión):`, e);
    return { ok: false, error: e instanceof Error ? e.message : "Sin conexión con la base" };
  }
}

interface DataCtx {
  loading: boolean;
  online: boolean; // true si la DB respondió
  propiedades: Propiedad[];
  leads: Lead[];
  clientes: Cliente[];
  operaciones: Operacion_[];
  visitas: Visita[];
  tasaciones: Tasacion[];
  arrendamientos: Arrendamiento[];
  getProp: (id: string) => Propiedad | undefined;
  // mutaciones
  // Devuelven si la base aceptó. Quien las llama TIENE que mirarlo antes de
  // decirle al usuario que se guardó (cicatriz del 7-ago: ver `aviso` abajo).
  addPropiedad: (p: Propiedad) => Promise<Resultado>;
  updatePropiedad: (id: string, patch: Partial<Propiedad>) => Promise<Resultado>;
  deletePropiedad: (id: string) => Promise<Resultado>;
  addLead: (l: Lead) => Promise<void>;
  updateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  updateOperacion: (id: string, patch: Partial<Operacion_>) => Promise<Resultado>;
  addCliente: (c: Cliente) => Promise<void>;
  updateCliente: (id: string, patch: Partial<Cliente>) => Promise<void>;
  deleteCliente: (id: string) => Promise<void>;
  addVisita: (v: Visita) => Promise<Resultado>;
  updateVisita: (id: string, patch: Partial<Visita>) => Promise<Resultado>;
  deleteVisita: (id: string) => Promise<Resultado>;
  addTasacion: (t: Tasacion) => Promise<Resultado>;
  updateTasacion: (id: string, patch: Partial<Tasacion>) => Promise<Resultado>;
  deleteTasacion: (id: string) => Promise<Resultado>;
  addArrendamiento: (a: Arrendamiento) => Promise<Resultado>;
  updateArrendamiento: (id: string, patch: Partial<Arrendamiento>) => Promise<Resultado>;
  deleteArrendamiento: (id: string) => Promise<Resultado>;
  // llaves (el llavero físico de cada oficina — audios de Mateo 12-ago)
  llaves: Llave[];
  movimientosLlave: MovimientoLlave[];
  addLlave: (l: Llave) => Promise<Resultado>;
  updateLlave: (id: string, patch: Partial<Llave>) => Promise<Resultado>;
  deleteLlave: (id: string) => Promise<Resultado>;
  addMovimientoLlave: (m: MovimientoLlave) => Promise<Resultado>;
  deleteMovimientoLlave: (id: string) => Promise<Resultado>;
  // temporada (alquiler temporario)
  unidadesTemporada: UnidadTemporada[];
  reservasTemporada: ReservaTemporada[];
  addUnidadTemporada: (u: UnidadTemporada) => Promise<Resultado>;
  updateUnidadTemporada: (id: string, patch: Partial<UnidadTemporada>) => Promise<Resultado>;
  deleteUnidadTemporada: (id: string) => Promise<Resultado>;
  addReservaTemporada: (r: ReservaTemporada) => Promise<Resultado>;
  updateReservaTemporada: (id: string, patch: Partial<ReservaTemporada>) => Promise<Resultado>;
  deleteReservaTemporada: (id: string) => Promise<Resultado>;
  // asistente IA · bandeja de conversaciones
  conversaciones: Conversacion[];
  conversacionesNoLeidas: number;
  marcarLeida: (convId: string) => void;
  agregarMensaje: (convId: string, msg: MensajeConv) => Promise<void>;
  actualizarMensaje: (convId: string, msgId: string, patch: Partial<MensajeConv>) => Promise<void>;
  borrarMensaje: (convId: string, msgId: string) => Promise<void>;
  setEstadoConversacion: (convId: string, estado: EstadoConv) => Promise<void>;
  setOficinaConversacion: (convId: string, oficina?: "chauvin" | "puntamogotes") => void;
  // derivados
  kpis: ReturnType<typeof computeKpis>;
  consultasPorMes: typeof seedConsultasMes;
  leadsPorCanal: { name: string; value: number }[];
  embudo: { etapa: string; cantidad: number }[];
  carteraPorAptitud: { name: string; value: number }[];
}

const Ctx = createContext<DataCtx>(null as any);

function computeKpis(propiedades: Propiedad[], leads: Lead[], operaciones: Operacion_[], clientes: Cliente[]) {
  return {
    camposActivos: propiedades.filter((c) => c.estado === "activa").length,
    camposTotal: propiedades.length,
    // Una vendida, una alquilada y una suspendida NO son cartera vendible.
    valorCarteraUSD: propiedades.filter((c) => !ESTADOS_CERRADOS.includes(c.estado) && c.precioUSD).reduce((a, c) => a + (c.precioUSD || 0), 0),
    leadsNuevos: leads.filter((l) => l.estado === "nueva").length,
    leadsTotal: leads.length,
    enNegociacion: leads.filter((l) => l.estado === "negociacion").length,
    clientes: clientes.length,
    comisionPipelineUSD: operaciones.filter((o) => o.etapa !== "escritura").reduce((a, o) => a + (o.valorUSD * o.comisionPct) / 100, 0),
    conversion: leads.length ? Math.round((leads.filter((l) => l.estado === "cerrado").length / leads.length) * 100) : 0,
  };
}

// Etiquetas fijas en vez de toLocaleDateString: el eje del gráfico tiene que decir
// "Sep", no lo que el ICU del navegador opine ("sept.", en minúscula y con punto).
const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * Tendencia de los últimos 6 meses derivada de los leads REALES (con base; sin
 * base el provider sigue mostrando el seed, que la demo se vea viva). Misma
 * forma que el seed de data/kpis para que Dashboard y Reportes no cambien.
 * Un mes sin consultas vale 0: cero es la verdad, no se maquilla.
 * "Cierres" se atribuye al mes en que ENTRÓ la consulta: el lead no guarda
 * cuándo se cerró (fechaISO es su única fecha).
 * Las fechas pasan por comoFechaLocal: una fecha simple parseada como UTC cae
 * en el mes anterior si el lead entró el día 1 (la cicatriz del 12-ago).
 */
function computeConsultasPorMes(leads: Lead[]): typeof seedConsultasMes {
  const ahora = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const mes = new Date(ahora.getFullYear(), ahora.getMonth() - (5 - i), 1);
    const delMes = leads.filter((l) => {
      const f = comoFechaLocal(l.fechaISO);
      return f.getFullYear() === mes.getFullYear() && f.getMonth() === mes.getMonth();
    });
    return {
      mes: MES_CORTO[mes.getMonth()],
      consultas: delMes.length,
      cierres: delMes.filter((l) => l.estado === "cerrado").length,
    };
  });
}


// ===== Aislamiento MULTI-OFICINA =====
// Re-provee el MISMO contexto de datos filtrado por oficina: montado en el panel
// con la oficina del perfil activo, cada oficina ve SOLO lo suyo (propiedades,
// clientes, consultas, conversaciones, temporada) sin tocar ninguna página.
// Perfil central (Mateo, sin oficina) → pasa todo tal cual: el orquestador ve TODO.
// Las mutaciones no se filtran: siguen operando sobre la colección completa.
export function DataScope({ oficina, children }: { oficina?: "chauvin" | "puntamogotes"; children: ReactNode }) {
  const full = useContext(Ctx);
  const value = useMemo(() => {
    if (!oficina) return full;
    const propiedades = full.propiedades.filter((p) => p.oficina === oficina);
    const idsProps = new Set(propiedades.map((p) => p.id));
    const leads = full.leads.filter((l) => l.oficina === oficina);
    const clientes = full.clientes.filter((c) => c.oficina === oficina);
    const conversaciones = full.conversaciones.filter((c) => c.oficina === oficina);
    const operaciones = full.operaciones.filter((o) => o.campoId != null && idsProps.has(o.campoId));
    const visitas = full.visitas.filter((v) => v.campoId != null && idsProps.has(v.campoId));
    const unidadesTemporada = full.unidadesTemporada.filter((u) => u.oficina === oficina);
    const idsUnidades = new Set(unidadesTemporada.map((u) => u.id));
    const reservasTemporada = full.reservasTemporada.filter((r) => idsUnidades.has(r.unidadId));
    // Llaves: «que cada oficina tenga su registro de llaves» (Mateo, 12-ago).
    // Los movimientos se filtran por los ids de las llaves YA filtradas — nunca
    // por una columna propia: el movimiento hereda la oficina de su llave.
    const llaves = full.llaves.filter((l) => l.oficina === oficina);
    const idsLlaves = new Set(llaves.map((l) => l.id));
    const movimientosLlave = full.movimientosLlave.filter((m) => idsLlaves.has(m.llaveId));

    const canal: Record<string, number> = {};
    leads.forEach((l) => (canal[l.canal] = (canal[l.canal] || 0) + 1));
    const labelCanal: Record<string, string> = { web: "Web propia", whatsapp: "WhatsApp", mail: "Mail", telefono: "Teléfono", portal: "Portales" };
    const etapas = [
      { key: "consulta", label: "Consulta" }, { key: "visita", label: "Visita" }, { key: "oferta", label: "Oferta" },
      { key: "reserva", label: "Reserva" }, { key: "boleto", label: "Boleto" }, { key: "escritura", label: "Escritura" },
    ];
    const aptitud: Record<string, number> = {};
    propiedades.filter((c) => !ESTADOS_CERRADOS.includes(c.estado)).forEach((c) => {
      const k = c.categoria === "campo" ? c.aptitud || "campo" : c.categoria;
      aptitud[k] = (aptitud[k] || 0) + (c.precioUSD || 0);
    });

    return {
      ...full,
      propiedades, leads, clientes, conversaciones, operaciones, visitas, unidadesTemporada, reservasTemporada,
      llaves, movimientosLlave,
      getProp: (id: string) => propiedades.find((p) => p.id === id),
      conversacionesNoLeidas: conversaciones.filter((c) => c.noLeida).length,
      kpis: computeKpis(propiedades, leads, operaciones, clientes),
      // La oficina ve SU tendencia (sus leads, ya filtrados). Sin base, el seed global.
      consultasPorMes: supabase ? computeConsultasPorMes(leads) : full.consultasPorMes,
      leadsPorCanal: Object.entries(canal).map(([k, v]) => ({ name: labelCanal[k] || k, value: v })),
      embudo: etapas.map((e) => ({ etapa: e.label, cantidad: operaciones.filter((o) => o.etapa === e.key).length })),
      carteraPorAptitud: Object.entries(aptitud).map(([k, v]) => ({ name: k, value: v })),
    };
  }, [full, oficina]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  // En modo demo (sin Supabase) rehidratamos desde localStorage; con DB, arrancamos del seed y luego sincroniza.
  const [propiedades, setPropiedades] = useState<Propiedad[]>(() => loadLocal("propiedades", seedPropiedades));
  const [leads, setLeads] = useState<Lead[]>(() => loadLocal("leads", seedLeadsR));
  const [clientes, setClientes] = useState<Cliente[]>(() => loadLocal("clientes", seedClientesR));
  const [operaciones, setOperaciones] = useState<Operacion_[]>(() => loadLocal("operaciones", seedOpsR));
  const [visitas, setVisitas] = useState<Visita[]>(() => loadLocal("visitas", seedVisitasR));
  const [tasaciones, setTasaciones] = useState<Tasacion[]>(() => loadLocal("tasaciones", seedTasR));
  const [arrendamientos, setArrendamientos] = useState<Arrendamiento[]>(() => loadLocal("arrendamientos", seedArrR));
  const [unidadesTemporada, setUnidadesTemporada] = useState<UnidadTemporada[]>(() => loadLocal("unidades_temporada", seedUnidades));
  const [reservasTemporada, setReservasTemporada] = useState<ReservaTemporada[]>(() => loadLocal("reservas_temporada", seedReservas));
  const [conversaciones, setConversaciones] = useState<Conversacion[]>(() => loadLocal("conversaciones", seedConversaciones));
  // Registro de llaves (audios de Mateo 12-ago). Tablas del PANEL: se cargan
  // solo con sesión, nunca en el pedido del visitante.
  const [llaves, setLlaves] = useState<Llave[]>(() => loadLocal("llaves", seedLlaves));
  const [movimientosLlave, setMovimientosLlave] = useState<MovimientoLlave[]>(() => loadLocal("movimientos_llave", seedMovimientosLlave));

  // Persistir cada colección en modo demo (no-op si hay Supabase).
  useEffect(() => { saveLocal("propiedades", propiedades); }, [propiedades]);
  useEffect(() => { saveLocal("leads", leads); }, [leads]);
  useEffect(() => { saveLocal("clientes", clientes); }, [clientes]);
  useEffect(() => { saveLocal("operaciones", operaciones); }, [operaciones]);
  useEffect(() => { saveLocal("visitas", visitas); }, [visitas]);
  useEffect(() => { saveLocal("tasaciones", tasaciones); }, [tasaciones]);
  useEffect(() => { saveLocal("arrendamientos", arrendamientos); }, [arrendamientos]);
  useEffect(() => { saveLocal("unidades_temporada", unidadesTemporada); }, [unidadesTemporada]);
  useEffect(() => { saveLocal("reservas_temporada", reservasTemporada); }, [reservasTemporada]);
  useEffect(() => { saveLocal("conversaciones", conversaciones); }, [conversaciones]);
  useEffect(() => { saveLocal("llaves", llaves); }, [llaves]);
  useEffect(() => { saveLocal("movimientos_llave", movimientosLlave); }, [movimientosLlave]);

  // Sincronizar desde Supabase (en segundo plano; si falla, quedan los datos locales).
  //
  // Se sincroniza al arrancar y otra vez cuando alguien entra o sale del panel:
  // lo que devuelve la base depende de quién pregunta, así que un login tiene que
  // volver a pedir los datos (si no, el panel recién abierto se queda con lo que
  // veía el visitante).
  useEffect(() => {
    let cancel = false;
    let ultimaSesion: boolean | null = null;

    const sincronizar = async (haySesion: boolean) => {
      if (!supabase) { setLoading(false); return; }
      try {
        // El visitante de la web lee la VISTA, no la tabla: trae solo lo publicado
        // y SIN la ficha interna (propietario, llaves, observaciones). El equipo
        // logueado sí lee la tabla completa, porque el panel necesita la ficha y
        // las propiedades sin publicar. La base igual filtra por RLS: esto no es
        // el candado, es no pedir de más.
        const fuentePropiedades = haySesion ? "potente_propiedades" : "potente_propiedades_web";

        // 🔴 Temporada no tiene vista pública: el visitante lee la tabla. Por eso
        // pide COLUMNAS EXPLÍCITAS y no `*` — así la comisión de Potente, la
        // tarifa por noche, la estadía mínima y el estado de limpieza no salen
        // de la oficina. Es lo mismo que hace la línea de arriba con la ficha,
        // pero por columna en vez de por vista.
        // ⚠️ Este cambio va A PRODUCCIÓN ANTES que la migración 012: PostgREST
        // falla la consulta ENTERA si el cliente pide `*` y le falta una sola
        // columna. Revocar primero dejaría la página de temporada en blanco.
        // 🔴 13-ago, Mateo: «no debemos dar referencia de precios». Por eso
        // `tarifas` TAMPOCO está acá: si la web dice "A consultar" pero la
        // tarifa igual viaja en la respuesta, el precio se lee en la pestaña de
        // red. No mostrar y no mandar son la misma decisión.
        const columnasTemporada = haySesion
          ? "*"
          : 'id,"propiedadId",oficina,ambientes,capacidad,barrio,"frenteAlMar",comodidades,activa';

        // El visitante solo necesita catálogo y temporada. Las otras ocho tablas
        // son del panel: pedírselas era un viaje a São Paulo por cada una para que
        // el RLS devolviera vacío. Ocho idas y vueltas menos en cada visita.
        const [p, ut] = await Promise.all([
          supabase.from(fuentePropiedades).select("*"),
          supabase.from("potente_unidades_temporada").select(columnasTemporada),
        ]);
        if (cancel) return;
        if (p.data?.length) setPropiedades(p.data as Propiedad[]);
        // Temporada: si la tabla existe y responde, manda la base (aunque esté vacía).
        // El doble cast es por la lista de columnas variable: supabase-js deduce
        // la forma del resultado leyendo el string del `select` en tiempo de
        // compilación, y con una variable no puede. El visitante recibe un
        // subconjunto (sin comisión ni tarifa por noche) y la web solo usa lo
        // que sí pide — ver `columnasTemporada` arriba.
        if (!ut.error && ut.data) setUnidadesTemporada(ut.data as unknown as UnidadTemporada[]);
        if (!p.error) setOnline(true);

        if (haySesion) {
          const [l, c, o, v, t, a, rt, cv, lv, ml] = await Promise.all([
            supabase.from("potente_leads").select("*"),
            supabase.from("potente_clientes").select("*"),
            supabase.from("potente_operaciones").select("*"),
            supabase.from("potente_visitas").select("*"),
            supabase.from("potente_tasaciones").select("*"),
            supabase.from("potente_arrendamientos").select("*"),
            supabase.from("potente_reservas_temporada").select("*"),
            supabase.from("potente_conversaciones").select("*"),
            supabase.from("potente_llaves").select("*"),
            supabase.from("potente_movimientos_llave").select("*"),
          ]);
          if (cancel) return;
          if (l.data) setLeads(l.data as Lead[]);
          if (c.data) setClientes(c.data as Cliente[]);
          if (o.data) setOperaciones(o.data as Operacion_[]);
          if (v.data) setVisitas(v.data as Visita[]);
          if (t.data) setTasaciones(t.data as Tasacion[]);
          if (a.data) setArrendamientos(a.data as Arrendamiento[]);
          if (!rt.error && rt.data) setReservasTemporada(rt.data as ReservaTemporada[]);
          if (!cv.error && cv.data) setConversaciones(cv.data as Conversacion[]);
          // ⚠️ `!error && data` (no `data?.length`): con el llavero vacío la base
          // tiene que ganarle al seed, si no aparecen llaves inventadas.
          if (!lv.error && lv.data) setLlaves(lv.data as Llave[]);
          if (!ml.error && ml.data) setMovimientosLlave(ml.data as MovimientoLlave[]);
        }
      } catch {
        /* offline → datos locales */
      } finally {
        if (!cancel) setLoading(false);
      }
    };

    if (!supabase) { setLoading(false); return; }

    // onAuthStateChange dispara una vez al suscribirse (INITIAL_SESSION), así que
    // esa primera vez hace de carga inicial. Después solo se re-sincroniza si
    // cambió el HECHO de estar logueado: los refrescos de token no cuentan.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      const hay = Boolean(sesion);
      if (hay === ultimaSesion) return;
      ultimaSesion = hay;
      // Fuera del callback: supabase-js tiene tomado el candado de sesión mientras
      // corre, y consultar la base ahí mismo puede quedar esperando para siempre.
      setTimeout(() => { if (!cancel) void sincronizar(hay); }, 0);
    });

    return () => { cancel = true; sub.subscription.unsubscribe(); };
  }, []);


  // ===== mutaciones (actualizan estado local SIEMPRE + DB si hay conexión) =====
  // Las de propiedades DEVUELVEN el resultado: el panel necesita saber si la base
  // aceptó para no mostrar un tilde verde sobre un guardado que no ocurrió.
  const addPropiedad = async (p: Propiedad): Promise<Resultado> => {
    setPropiedades((prev) => [p, ...prev]);
    if (!supabase) return SIN_BASE;
    return aviso("upsert en potente_propiedades", supabase.from("potente_propiedades").upsert(p));
  };
  const updatePropiedad = async (id: string, patch: Partial<Propiedad>): Promise<Resultado> => {
    setPropiedades((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (!supabase) return SIN_BASE;
    return aviso("update en potente_propiedades", supabase.from("potente_propiedades").update(patch).eq("id", id));
  };
  const deletePropiedad = async (id: string): Promise<Resultado> => {
    setPropiedades((prev) => prev.filter((x) => x.id !== id));
    if (!supabase) return SIN_BASE;
    return aviso("delete en potente_propiedades", supabase.from("potente_propiedades").delete().eq("id", id));
  };
  const addLead = async (l: Lead) => {
    setLeads((prev) => [l, ...prev]);
    if (!supabase) return;
    // ⚠️ INSERT, no upsert. El formulario de la web lo usa un VISITANTE (rol anon),
    // y su permiso es solo de inserción: un upsert es "insert or update" y la base
    // lo rechaza entero con 42501. Entre el 6 y el 7-ago esto hizo que ninguna
    // consulta de la web se guardara, y en silencio. El id lleva Date.now(), así
    // que no hay colisión posible y el upsert nunca hizo falta.
    const { error } = await supabase.from("potente_leads").insert(l);
    if (error) console.error("No se pudo guardar la consulta:", error.message, error.code);
  };
  const updateLead = async (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await aviso("update en potente_leads", supabase.from("potente_leads").update(patch).eq("id", id));
  };
  /* ── GESTIÓN COMERCIAL (operaciones, visitas, tasaciones, arrendamientos) ──
   * Mismo contrato que temporada: devuelven `Resultado`, pintan optimista y
   * DESHACEN lo pintado si la base rechaza. Eran las últimas que devolvían
   * void: el error moría en consola y la página mostraba el toast de éxito
   * igual — la cicatriz de los errores silenciosos que ya costó leads dos
   * veces (IAGRO 14-jul, Potente 6/7-ago). Sin la reversión, la fila fantasma
   * queda en pantalla hasta un reload y Mateo le cree. */
  const updateOperacion = async (id: string, patch: Partial<Operacion_>): Promise<Resultado> => {
    const anterior = operaciones.find((x) => x.id === id);
    setOperaciones((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (!supabase) return SIN_BASE;
    const r = await aviso("update en potente_operaciones", supabase.from("potente_operaciones").update(patch).eq("id", id));
    if (!r.ok && anterior) setOperaciones((prev) => prev.map((x) => (x.id === id ? anterior : x)));
    return r;
  };
  const addCliente = async (c: Cliente) => {
    setClientes((prev) => [c, ...prev]);
    if (supabase) await aviso("upsert en potente_clientes", supabase.from("potente_clientes").upsert(c));
  };
  const updateCliente = async (id: string, patch: Partial<Cliente>) => {
    setClientes((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await aviso("update en potente_clientes", supabase.from("potente_clientes").update(patch).eq("id", id));
  };
  const deleteCliente = async (id: string) => {
    setClientes((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await aviso("delete en potente_clientes", supabase.from("potente_clientes").delete().eq("id", id));
  };
  const addVisita = async (v: Visita): Promise<Resultado> => {
    setVisitas((prev) => [v, ...prev]);
    if (!supabase) return SIN_BASE;
    const r = await aviso("upsert en potente_visitas", supabase.from("potente_visitas").upsert(v));
    if (!r.ok) setVisitas((prev) => prev.filter((x) => x.id !== v.id));
    return r;
  };
  const updateVisita = async (id: string, patch: Partial<Visita>): Promise<Resultado> => {
    const anterior = visitas.find((x) => x.id === id);
    setVisitas((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (!supabase) return SIN_BASE;
    const r = await aviso("update en potente_visitas", supabase.from("potente_visitas").update(patch).eq("id", id));
    if (!r.ok && anterior) setVisitas((prev) => prev.map((x) => (x.id === id ? anterior : x)));
    return r;
  };
  const addTasacion = async (t: Tasacion): Promise<Resultado> => {
    setTasaciones((prev) => [t, ...prev]);
    if (!supabase) return SIN_BASE;
    const r = await aviso("upsert en potente_tasaciones", supabase.from("potente_tasaciones").upsert(t));
    if (!r.ok) setTasaciones((prev) => prev.filter((x) => x.id !== t.id));
    return r;
  };
  const updateTasacion = async (id: string, patch: Partial<Tasacion>): Promise<Resultado> => {
    const anterior = tasaciones.find((x) => x.id === id);
    setTasaciones((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (!supabase) return SIN_BASE;
    const r = await aviso("update en potente_tasaciones", supabase.from("potente_tasaciones").update(patch).eq("id", id));
    if (!r.ok && anterior) setTasaciones((prev) => prev.map((x) => (x.id === id ? anterior : x)));
    return r;
  };
  const addArrendamiento = async (a: Arrendamiento): Promise<Resultado> => {
    setArrendamientos((prev) => [a, ...prev]);
    if (!supabase) return SIN_BASE;
    const r = await aviso("upsert en potente_arrendamientos", supabase.from("potente_arrendamientos").upsert(a));
    if (!r.ok) setArrendamientos((prev) => prev.filter((x) => x.id !== a.id));
    return r;
  };
  const updateArrendamiento = async (id: string, patch: Partial<Arrendamiento>): Promise<Resultado> => {
    const anterior = arrendamientos.find((x) => x.id === id);
    setArrendamientos((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (!supabase) return SIN_BASE;
    const r = await aviso("update en potente_arrendamientos", supabase.from("potente_arrendamientos").update(patch).eq("id", id));
    if (!r.ok && anterior) setArrendamientos((prev) => prev.map((x) => (x.id === id ? anterior : x)));
    return r;
  };
  /* ── TEMPORADA ─────────────────────────────────────────────────────────────
   * 🔴 Estas mutaciones DEVUELVEN `Resultado`, como las de propiedades y llaves.
   * Hasta el 14-ago no devolvían nada: el error de la base moría en la consola.
   * Eso dejó de ser aceptable cuando temporada pasó a ser una OPERACIÓN y la
   * unidad se crea junto con la propiedad — si la propiedad se guarda y la
   * unidad no, Mateo ve "publicada ✓" y esa ficha NO aparece en temporada. Es
   * exactamente la cicatriz de los errores silenciosos, que ya costó leads dos
   * veces (IAGRO 14-jul, Potente 6/7-ago). */
  /* 🔴 Las cinco mutaciones de temporada pintan primero y preguntan después
   * (escritura optimista: la pantalla responde al toque), pero si la base RECHAZA
   * se DESHACE lo pintado. Sin la reversión, avisar del error no alcanza: la fila
   * fantasma se queda en la lista hasta que alguien recargue, y Mateo la ve ahí y
   * le cree. Devolver el `Resultado` es la mitad del arreglo; la otra mitad es
   * que la pantalla vuelva a decir la verdad.
   * No hay función pública de resincronizado, así que cada una guarda el valor
   * anterior y lo repone. */
  const addUnidadTemporada = async (u: UnidadTemporada): Promise<Resultado> => {
    setUnidadesTemporada((prev) => [u, ...prev]);
    if (!supabase) return SIN_BASE;
    const r = await aviso("upsert en potente_unidades_temporada", supabase.from("potente_unidades_temporada").upsert(u));
    if (!r.ok) setUnidadesTemporada((prev) => prev.filter((x) => x.id !== u.id));
    return r;
  };
  const updateUnidadTemporada = async (id: string, patch: Partial<UnidadTemporada>): Promise<Resultado> => {
    const anterior = unidadesTemporada.find((x) => x.id === id);
    setUnidadesTemporada((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (!supabase) return SIN_BASE;
    const r = await aviso("update en potente_unidades_temporada", supabase.from("potente_unidades_temporada").update(patch).eq("id", id));
    if (!r.ok && anterior) setUnidadesTemporada((prev) => prev.map((x) => (x.id === id ? anterior : x)));
    return r;
  };
  /* Sacar una unidad de temporada también borra sus reservas (no dejamos huérfanas).
   * Son DOS borrados y el orden importa: primero las reservas, porque apuntan a la
   * unidad. Si el primero falla se corta acá y se devuelve ese error — seguir con
   * el segundo dejaría reservas colgadas de una unidad que ya no existe. */
  const deleteUnidadTemporada = async (id: string): Promise<Resultado> => {
    const unidadAnterior = unidadesTemporada.find((x) => x.id === id);
    const reservasAnteriores = reservasTemporada.filter((r) => r.unidadId === id);
    const reponer = () => {
      if (unidadAnterior) setUnidadesTemporada((prev) => (prev.some((x) => x.id === id) ? prev : [unidadAnterior, ...prev]));
      if (reservasAnteriores.length) setReservasTemporada((prev) => [...reservasAnteriores.filter((r) => !prev.some((x) => x.id === r.id)), ...prev]);
    };
    setUnidadesTemporada((prev) => prev.filter((x) => x.id !== id));
    setReservasTemporada((prev) => prev.filter((r) => r.unidadId !== id));
    if (!supabase) return SIN_BASE;
    const r1 = await aviso("delete en potente_reservas_temporada", supabase.from("potente_reservas_temporada").delete().eq("unidadId", id));
    if (!r1.ok) { reponer(); return r1; }
    const r2 = await aviso("delete en potente_unidades_temporada", supabase.from("potente_unidades_temporada").delete().eq("id", id));
    if (!r2.ok) reponer();
    return r2;
  };
  const deleteReservaTemporada = async (id: string): Promise<Resultado> => {
    const anterior = reservasTemporada.find((x) => x.id === id);
    setReservasTemporada((prev) => prev.filter((x) => x.id !== id));
    if (!supabase) return SIN_BASE;
    const r = await aviso("delete en potente_reservas_temporada", supabase.from("potente_reservas_temporada").delete().eq("id", id));
    if (!r.ok && anterior) setReservasTemporada((prev) => (prev.some((x) => x.id === id) ? prev : [anterior, ...prev]));
    return r;
  };
  const deleteLead = async (id: string) => {
    setLeads((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await aviso("delete en potente_leads", supabase.from("potente_leads").delete().eq("id", id));
  };
  const deleteTasacion = async (id: string): Promise<Resultado> => {
    const anterior = tasaciones.find((x) => x.id === id);
    setTasaciones((prev) => prev.filter((x) => x.id !== id));
    if (!supabase) return SIN_BASE;
    const r = await aviso("delete en potente_tasaciones", supabase.from("potente_tasaciones").delete().eq("id", id));
    if (!r.ok && anterior) setTasaciones((prev) => (prev.some((x) => x.id === id) ? prev : [anterior, ...prev]));
    return r;
  };

  /* ── LLAVES ────────────────────────────────────────────────────────────────
   * Estas mutaciones DEVUELVEN `Resultado` (como las de propiedades): un
   * movimiento de llaves es dato operativo — si la base lo rechazó, la persona
   * tiene que verlo en pantalla, no en la consola. Es la cicatriz del 7-ago.  */
  const addLlave = async (l: Llave): Promise<Resultado> => {
    setLlaves((prev) => [l, ...prev]);
    if (!supabase) return SIN_BASE;
    return aviso("upsert en potente_llaves", supabase.from("potente_llaves").upsert(l));
  };
  const updateLlave = async (id: string, patch: Partial<Llave>): Promise<Resultado> => {
    setLlaves((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (!supabase) return SIN_BASE;
    return aviso("update en potente_llaves", supabase.from("potente_llaves").update(patch).eq("id", id));
  };
  // Borrar una llave se lleva su historia (la base también lo hace en cascada,
  // pero el estado local tiene que quedar coherente al instante).
  const deleteLlave = async (id: string): Promise<Resultado> => {
    setLlaves((prev) => prev.filter((x) => x.id !== id));
    setMovimientosLlave((prev) => prev.filter((m) => m.llaveId !== id));
    if (!supabase) return SIN_BASE;
    await aviso("delete en potente_movimientos_llave", supabase.from("potente_movimientos_llave").delete().eq("llaveId", id));
    return aviso("delete en potente_llaves", supabase.from("potente_llaves").delete().eq("id", id));
  };
  const addMovimientoLlave = async (m: MovimientoLlave): Promise<Resultado> => {
    setMovimientosLlave((prev) => [m, ...prev]);
    if (!supabase) return SIN_BASE;
    return aviso("upsert en potente_movimientos_llave", supabase.from("potente_movimientos_llave").upsert(m));
  };
  const deleteMovimientoLlave = async (id: string): Promise<Resultado> => {
    setMovimientosLlave((prev) => prev.filter((x) => x.id !== id));
    if (!supabase) return SIN_BASE;
    return aviso("delete en potente_movimientos_llave", supabase.from("potente_movimientos_llave").delete().eq("id", id));
  };
  const deleteVisita = async (id: string): Promise<Resultado> => {
    const anterior = visitas.find((x) => x.id === id);
    setVisitas((prev) => prev.filter((x) => x.id !== id));
    if (!supabase) return SIN_BASE;
    const r = await aviso("delete en potente_visitas", supabase.from("potente_visitas").delete().eq("id", id));
    if (!r.ok && anterior) setVisitas((prev) => (prev.some((x) => x.id === id) ? prev : [anterior, ...prev]));
    return r;
  };
  const deleteArrendamiento = async (id: string): Promise<Resultado> => {
    const anterior = arrendamientos.find((x) => x.id === id);
    setArrendamientos((prev) => prev.filter((x) => x.id !== id));
    if (!supabase) return SIN_BASE;
    const r = await aviso("delete en potente_arrendamientos", supabase.from("potente_arrendamientos").delete().eq("id", id));
    if (!r.ok && anterior) setArrendamientos((prev) => (prev.some((x) => x.id === id) ? prev : [anterior, ...prev]));
    return r;
  };
  /* 🔴 ESTA es la que MENOS puede fallar en silencio de todo el módulo.
   * La base tiene un constraint de exclusión que RECHAZA dos reservas solapadas
   * sobre la misma unidad (23P01, probado en `verificar-db`). El chequeo que hace
   * el panel antes de llamar acá mira el estado LOCAL, que queda viejo apenas otra
   * oficina seña algo. O sea: el rechazo de la base no es un caso raro, es el
   * camino normal de una carrera entre dos oficinas — y si se traga, Mateo cree
   * que señó una quincena que en realidad está tomada. */
  const addReservaTemporada = async (r: ReservaTemporada): Promise<Resultado> => {
    setReservasTemporada((prev) => [r, ...prev]);
    if (!supabase) return SIN_BASE;
    const res = await aviso("upsert en potente_reservas_temporada", supabase.from("potente_reservas_temporada").upsert(r));
    if (!res.ok) setReservasTemporada((prev) => prev.filter((x) => x.id !== r.id));
    return res;
  };
  const updateReservaTemporada = async (id: string, patch: Partial<ReservaTemporada>): Promise<Resultado> => {
    const anterior = reservasTemporada.find((x) => x.id === id);
    setReservasTemporada((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (!supabase) return SIN_BASE;
    const r = await aviso("update en potente_reservas_temporada", supabase.from("potente_reservas_temporada").update(patch).eq("id", id));
    if (!r.ok && anterior) setReservasTemporada((prev) => prev.map((x) => (x.id === id ? anterior : x)));
    return r;
  };

  // ===== Bandeja de conversaciones =====
  // Toda edición reescribe la conversación completa (los mensajes viven adentro).
  const guardarConv = async (conv: Conversacion) => {
    if (supabase) await aviso("upsert en potente_conversaciones", supabase.from("potente_conversaciones").upsert(conv));
  };
  const patchConv = async (convId: string, fn: (c: Conversacion) => Conversacion) => {
    let actualizada: Conversacion | undefined;
    setConversaciones((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        actualizada = fn(c);
        return actualizada;
      })
    );
    if (actualizada) await guardarConv(actualizada);
  };

  const marcarLeida = (convId: string) =>
    setConversaciones((prev) => prev.map((c) => (c.id === convId && c.noLeida ? { ...c, noLeida: false } : c)));

  const agregarMensaje = (convId: string, msg: MensajeConv) =>
    patchConv(convId, (c) => ({ ...c, mensajes: [...c.mensajes, msg], noLeida: false }));

  const actualizarMensaje = (convId: string, msgId: string, patch: Partial<MensajeConv>) =>
    patchConv(convId, (c) => ({ ...c, mensajes: c.mensajes.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) }));

  const borrarMensaje = (convId: string, msgId: string) =>
    patchConv(convId, (c) => ({ ...c, mensajes: c.mensajes.filter((m) => m.id !== msgId) }));

  // Al cerrar o devolver a la IA, el motivo de derivación deja de aplicar.
  const setEstadoConversacion = (convId: string, estado: EstadoConv) =>
    patchConv(convId, (c) => ({ ...c, estado, noLeida: false, ...(estado === "ia" ? { motivo: undefined } : {}) }));

  // Derivación del orquestador: mover la conversación a una oficina (o traerla al central).
  const setOficinaConversacion = (convId: string, oficina?: "chauvin" | "puntamogotes") =>
    patchConv(convId, (c) => ({ ...c, oficina }));

  const conversacionesNoLeidas = useMemo(() => conversaciones.filter((c) => c.noLeida).length, [conversaciones]);

  const kpis = useMemo(() => computeKpis(propiedades, leads, operaciones, clientes), [propiedades, leads, operaciones, clientes]);

  const leadsPorCanal = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => (map[l.canal] = (map[l.canal] || 0) + 1));
    const label: Record<string, string> = { web: "Web propia", whatsapp: "WhatsApp", mail: "Mail", telefono: "Teléfono", portal: "Portales" };
    return Object.entries(map).map(([k, v]) => ({ name: label[k] || k, value: v }));
  }, [leads]);

  const embudo = useMemo(() => {
    const etapas = [
      { key: "consulta", label: "Consulta" }, { key: "visita", label: "Visita" }, { key: "oferta", label: "Oferta" },
      { key: "reserva", label: "Reserva" }, { key: "boleto", label: "Boleto" }, { key: "escritura", label: "Escritura" },
    ];
    return etapas.map((e) => ({ etapa: e.label, cantidad: operaciones.filter((o) => o.etapa === e.key).length }));
  }, [operaciones]);

  const carteraPorAptitud = useMemo(() => {
    const map: Record<string, number> = {};
    propiedades.filter((c) => !ESTADOS_CERRADOS.includes(c.estado)).forEach((c) => {
      const k = c.categoria === "campo" ? c.aptitud || "campo" : c.categoria;
      map[k] = (map[k] || 0) + (c.precioUSD || 0);
    });
    return Object.entries(map).map(([k, v]) => ({ name: k, value: v }));
  }, [propiedades]);

  // Con base, la tendencia sale de los leads reales; sin base, el seed (la demo
  // se ve viva). Nunca el seed en producción: era utilería pintada como dato.
  const consultasPorMes = useMemo(
    () => (supabase ? computeConsultasPorMes(leads) : seedConsultasMes),
    [leads]
  );

  return (
    <Ctx.Provider
      value={{
        loading, online, propiedades, leads, clientes, operaciones, visitas, tasaciones, arrendamientos,
        getProp: (id) => propiedades.find((p) => p.id === id),
        addPropiedad, updatePropiedad, deletePropiedad, addLead, updateLead, deleteLead, updateOperacion, addCliente, updateCliente, deleteCliente,
        addVisita, updateVisita, deleteVisita, addTasacion, updateTasacion, deleteTasacion, addArrendamiento, updateArrendamiento, deleteArrendamiento,
        llaves, movimientosLlave, addLlave, updateLlave, deleteLlave, addMovimientoLlave, deleteMovimientoLlave,
        unidadesTemporada, reservasTemporada, addUnidadTemporada, updateUnidadTemporada, deleteUnidadTemporada, addReservaTemporada, updateReservaTemporada, deleteReservaTemporada,
        conversaciones, conversacionesNoLeidas, marcarLeida, agregarMensaje, actualizarMensaje, borrarMensaje, setEstadoConversacion, setOficinaConversacion,
        kpis, consultasPorMes, leadsPorCanal, embudo, carteraPorAptitud,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
