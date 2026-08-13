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
const SEED_VERSION = "2026-08-08-ficha-completa-5-estados";
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
  updateOperacion: (id: string, patch: Partial<Operacion_>) => Promise<void>;
  addCliente: (c: Cliente) => Promise<void>;
  updateCliente: (id: string, patch: Partial<Cliente>) => Promise<void>;
  deleteCliente: (id: string) => Promise<void>;
  addVisita: (v: Visita) => Promise<void>;
  updateVisita: (id: string, patch: Partial<Visita>) => Promise<void>;
  deleteVisita: (id: string) => Promise<void>;
  addTasacion: (t: Tasacion) => Promise<void>;
  updateTasacion: (id: string, patch: Partial<Tasacion>) => Promise<void>;
  deleteTasacion: (id: string) => Promise<void>;
  addArrendamiento: (a: Arrendamiento) => Promise<void>;
  updateArrendamiento: (id: string, patch: Partial<Arrendamiento>) => Promise<void>;
  deleteArrendamiento: (id: string) => Promise<void>;
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
  addUnidadTemporada: (u: UnidadTemporada) => Promise<void>;
  updateUnidadTemporada: (id: string, patch: Partial<UnidadTemporada>) => Promise<void>;
  deleteUnidadTemporada: (id: string) => Promise<void>;
  addReservaTemporada: (r: ReservaTemporada) => Promise<void>;
  updateReservaTemporada: (id: string, patch: Partial<ReservaTemporada>) => Promise<void>;
  deleteReservaTemporada: (id: string) => Promise<void>;
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
        const columnasTemporada = haySesion
          ? "*"
          : 'id,"propiedadId",oficina,ambientes,capacidad,barrio,"frenteAlMar",comodidades,tarifas,activa';

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
  const updateOperacion = async (id: string, patch: Partial<Operacion_>) => {
    setOperaciones((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await aviso("update en potente_operaciones", supabase.from("potente_operaciones").update(patch).eq("id", id));
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
  const addVisita = async (v: Visita) => {
    setVisitas((prev) => [v, ...prev]);
    if (supabase) await aviso("upsert en potente_visitas", supabase.from("potente_visitas").upsert(v));
  };
  const updateVisita = async (id: string, patch: Partial<Visita>) => {
    setVisitas((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await aviso("update en potente_visitas", supabase.from("potente_visitas").update(patch).eq("id", id));
  };
  const addTasacion = async (t: Tasacion) => {
    setTasaciones((prev) => [t, ...prev]);
    if (supabase) await aviso("upsert en potente_tasaciones", supabase.from("potente_tasaciones").upsert(t));
  };
  const updateTasacion = async (id: string, patch: Partial<Tasacion>) => {
    setTasaciones((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await aviso("update en potente_tasaciones", supabase.from("potente_tasaciones").update(patch).eq("id", id));
  };
  const addArrendamiento = async (a: Arrendamiento) => {
    setArrendamientos((prev) => [a, ...prev]);
    if (supabase) await aviso("upsert en potente_arrendamientos", supabase.from("potente_arrendamientos").upsert(a));
  };
  const updateArrendamiento = async (id: string, patch: Partial<Arrendamiento>) => {
    setArrendamientos((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await aviso("update en potente_arrendamientos", supabase.from("potente_arrendamientos").update(patch).eq("id", id));
  };
  const addUnidadTemporada = async (u: UnidadTemporada) => {
    setUnidadesTemporada((prev) => [u, ...prev]);
    if (supabase) await aviso("upsert en potente_unidades_temporada", supabase.from("potente_unidades_temporada").upsert(u));
  };
  const updateUnidadTemporada = async (id: string, patch: Partial<UnidadTemporada>) => {
    setUnidadesTemporada((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await aviso("update en potente_unidades_temporada", supabase.from("potente_unidades_temporada").update(patch).eq("id", id));
  };
  // Sacar una unidad de temporada también borra sus reservas (no dejamos huérfanas).
  const deleteUnidadTemporada = async (id: string) => {
    setUnidadesTemporada((prev) => prev.filter((x) => x.id !== id));
    setReservasTemporada((prev) => prev.filter((r) => r.unidadId !== id));
    if (supabase) {
      await aviso("delete en potente_reservas_temporada", supabase.from("potente_reservas_temporada").delete().eq("unidadId", id));
      await aviso("delete en potente_unidades_temporada", supabase.from("potente_unidades_temporada").delete().eq("id", id));
    }
  };
  const deleteReservaTemporada = async (id: string) => {
    setReservasTemporada((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await aviso("delete en potente_reservas_temporada", supabase.from("potente_reservas_temporada").delete().eq("id", id));
  };
  const deleteLead = async (id: string) => {
    setLeads((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await aviso("delete en potente_leads", supabase.from("potente_leads").delete().eq("id", id));
  };
  const deleteTasacion = async (id: string) => {
    setTasaciones((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await aviso("delete en potente_tasaciones", supabase.from("potente_tasaciones").delete().eq("id", id));
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
  const deleteVisita = async (id: string) => {
    setVisitas((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await aviso("delete en potente_visitas", supabase.from("potente_visitas").delete().eq("id", id));
  };
  const deleteArrendamiento = async (id: string) => {
    setArrendamientos((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await aviso("delete en potente_arrendamientos", supabase.from("potente_arrendamientos").delete().eq("id", id));
  };
  const addReservaTemporada = async (r: ReservaTemporada) => {
    setReservasTemporada((prev) => [r, ...prev]);
    if (supabase) await aviso("upsert en potente_reservas_temporada", supabase.from("potente_reservas_temporada").upsert(r));
  };
  const updateReservaTemporada = async (id: string, patch: Partial<ReservaTemporada>) => {
    setReservasTemporada((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await aviso("update en potente_reservas_temporada", supabase.from("potente_reservas_temporada").update(patch).eq("id", id));
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
        kpis, consultasPorMes: seedConsultasMes, leadsPorCanal, embudo, carteraPorAptitud,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
