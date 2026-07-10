import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import type { Propiedad } from "@/data/propiedadTypes";
import type { Lead, Cliente, Operacion_, Visita, Tasacion, Arrendamiento, UnidadTemporada, ReservaTemporada } from "@/data/types";
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
const SEED_VERSION = "2026-07-09b";
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
    ].forEach((n) => localStorage.removeItem(lsKey(n)));
  } catch { /* noop */ }
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
  addPropiedad: (p: Propiedad) => Promise<void>;
  updatePropiedad: (id: string, patch: Partial<Propiedad>) => Promise<void>;
  deletePropiedad: (id: string) => Promise<void>;
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
    camposActivos: propiedades.filter((c) => c.estado === "disponible").length,
    camposTotal: propiedades.length,
    valorCarteraUSD: propiedades.filter((c) => c.estado !== "vendido" && c.precioUSD).reduce((a, c) => a + (c.precioUSD || 0), 0),
    leadsNuevos: leads.filter((l) => l.estado === "nueva").length,
    leadsTotal: leads.length,
    enNegociacion: leads.filter((l) => l.estado === "negociacion").length,
    clientes: clientes.length,
    comisionPipelineUSD: operaciones.filter((o) => o.etapa !== "escritura").reduce((a, o) => a + (o.valorUSD * o.comisionPct) / 100, 0),
    conversion: leads.length ? Math.round((leads.filter((l) => l.estado === "cerrado").length / leads.length) * 100) : 0,
  };
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

  // Sincronizar desde Supabase (en segundo plano; si falla, quedan los datos locales)
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!supabase) { setLoading(false); return; }
      try {
        const [p, l, c, o, v, t, a, ut, rt, cv] = await Promise.all([
          supabase.from("potente_propiedades").select("*"),
          supabase.from("potente_leads").select("*"),
          supabase.from("potente_clientes").select("*"),
          supabase.from("potente_operaciones").select("*"),
          supabase.from("potente_visitas").select("*"),
          supabase.from("potente_tasaciones").select("*"),
          supabase.from("potente_arrendamientos").select("*"),
          supabase.from("potente_unidades_temporada").select("*"),
          supabase.from("potente_reservas_temporada").select("*"),
          supabase.from("potente_conversaciones").select("*"),
        ]);
        if (cancel) return;
        if (p.data?.length) setPropiedades(p.data as Propiedad[]);
        if (l.data) setLeads(l.data as Lead[]);
        if (c.data) setClientes(c.data as Cliente[]);
        if (o.data) setOperaciones(o.data as Operacion_[]);
        if (v.data) setVisitas(v.data as Visita[]);
        if (t.data) setTasaciones(t.data as Tasacion[]);
        if (a.data) setArrendamientos(a.data as Arrendamiento[]);
        // Temporada: si la tabla existe y responde, manda la base (aunque esté vacía).
        if (!ut.error && ut.data) setUnidadesTemporada(ut.data as UnidadTemporada[]);
        if (!rt.error && rt.data) setReservasTemporada(rt.data as ReservaTemporada[]);
        if (!cv.error && cv.data) setConversaciones(cv.data as Conversacion[]);
        if (!p.error) setOnline(true);
      } catch {
        /* offline → datos locales */
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // ===== mutaciones (actualizan estado local SIEMPRE + DB si hay conexión) =====
  const addPropiedad = async (p: Propiedad) => {
    setPropiedades((prev) => [p, ...prev]);
    if (supabase) await supabase.from("potente_propiedades").upsert(p).then(() => {}, () => {});
  };
  const updatePropiedad = async (id: string, patch: Partial<Propiedad>) => {
    setPropiedades((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await supabase.from("potente_propiedades").update(patch).eq("id", id).then(() => {}, () => {});
  };
  const deletePropiedad = async (id: string) => {
    setPropiedades((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await supabase.from("potente_propiedades").delete().eq("id", id).then(() => {}, () => {});
  };
  const addLead = async (l: Lead) => {
    setLeads((prev) => [l, ...prev]);
    if (supabase) await supabase.from("potente_leads").upsert(l).then(() => {}, () => {});
  };
  const updateLead = async (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await supabase.from("potente_leads").update(patch).eq("id", id).then(() => {}, () => {});
  };
  const updateOperacion = async (id: string, patch: Partial<Operacion_>) => {
    setOperaciones((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await supabase.from("potente_operaciones").update(patch).eq("id", id).then(() => {}, () => {});
  };
  const addCliente = async (c: Cliente) => {
    setClientes((prev) => [c, ...prev]);
    if (supabase) await supabase.from("potente_clientes").upsert(c).then(() => {}, () => {});
  };
  const updateCliente = async (id: string, patch: Partial<Cliente>) => {
    setClientes((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await supabase.from("potente_clientes").update(patch).eq("id", id).then(() => {}, () => {});
  };
  const deleteCliente = async (id: string) => {
    setClientes((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await supabase.from("potente_clientes").delete().eq("id", id).then(() => {}, () => {});
  };
  const addVisita = async (v: Visita) => {
    setVisitas((prev) => [v, ...prev]);
    if (supabase) await supabase.from("potente_visitas").upsert(v).then(() => {}, () => {});
  };
  const updateVisita = async (id: string, patch: Partial<Visita>) => {
    setVisitas((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await supabase.from("potente_visitas").update(patch).eq("id", id).then(() => {}, () => {});
  };
  const addTasacion = async (t: Tasacion) => {
    setTasaciones((prev) => [t, ...prev]);
    if (supabase) await supabase.from("potente_tasaciones").upsert(t).then(() => {}, () => {});
  };
  const updateTasacion = async (id: string, patch: Partial<Tasacion>) => {
    setTasaciones((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await supabase.from("potente_tasaciones").update(patch).eq("id", id).then(() => {}, () => {});
  };
  const addArrendamiento = async (a: Arrendamiento) => {
    setArrendamientos((prev) => [a, ...prev]);
    if (supabase) await supabase.from("potente_arrendamientos").upsert(a).then(() => {}, () => {});
  };
  const updateArrendamiento = async (id: string, patch: Partial<Arrendamiento>) => {
    setArrendamientos((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await supabase.from("potente_arrendamientos").update(patch).eq("id", id).then(() => {}, () => {});
  };
  const addUnidadTemporada = async (u: UnidadTemporada) => {
    setUnidadesTemporada((prev) => [u, ...prev]);
    if (supabase) await supabase.from("potente_unidades_temporada").upsert(u).then(() => {}, () => {});
  };
  const updateUnidadTemporada = async (id: string, patch: Partial<UnidadTemporada>) => {
    setUnidadesTemporada((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await supabase.from("potente_unidades_temporada").update(patch).eq("id", id).then(() => {}, () => {});
  };
  // Sacar una unidad de temporada también borra sus reservas (no dejamos huérfanas).
  const deleteUnidadTemporada = async (id: string) => {
    setUnidadesTemporada((prev) => prev.filter((x) => x.id !== id));
    setReservasTemporada((prev) => prev.filter((r) => r.unidadId !== id));
    if (supabase) {
      await supabase.from("potente_reservas_temporada").delete().eq("unidadId", id).then(() => {}, () => {});
      await supabase.from("potente_unidades_temporada").delete().eq("id", id).then(() => {}, () => {});
    }
  };
  const deleteReservaTemporada = async (id: string) => {
    setReservasTemporada((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await supabase.from("potente_reservas_temporada").delete().eq("id", id).then(() => {}, () => {});
  };
  const deleteLead = async (id: string) => {
    setLeads((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await supabase.from("potente_leads").delete().eq("id", id).then(() => {}, () => {});
  };
  const deleteTasacion = async (id: string) => {
    setTasaciones((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await supabase.from("potente_tasaciones").delete().eq("id", id).then(() => {}, () => {});
  };
  const deleteVisita = async (id: string) => {
    setVisitas((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await supabase.from("potente_visitas").delete().eq("id", id).then(() => {}, () => {});
  };
  const deleteArrendamiento = async (id: string) => {
    setArrendamientos((prev) => prev.filter((x) => x.id !== id));
    if (supabase) await supabase.from("potente_arrendamientos").delete().eq("id", id).then(() => {}, () => {});
  };
  const addReservaTemporada = async (r: ReservaTemporada) => {
    setReservasTemporada((prev) => [r, ...prev]);
    if (supabase) await supabase.from("potente_reservas_temporada").upsert(r).then(() => {}, () => {});
  };
  const updateReservaTemporada = async (id: string, patch: Partial<ReservaTemporada>) => {
    setReservasTemporada((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (supabase) await supabase.from("potente_reservas_temporada").update(patch).eq("id", id).then(() => {}, () => {});
  };

  // ===== Bandeja de conversaciones =====
  // Toda edición reescribe la conversación completa (los mensajes viven adentro).
  const guardarConv = async (conv: Conversacion) => {
    if (supabase) await supabase.from("potente_conversaciones").upsert(conv).then(() => {}, () => {});
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
    propiedades.filter((c) => c.estado !== "vendido").forEach((c) => {
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
        unidadesTemporada, reservasTemporada, addUnidadTemporada, updateUnidadTemporada, deleteUnidadTemporada, addReservaTemporada, updateReservaTemporada, deleteReservaTemporada,
        conversaciones, conversacionesNoLeidas, marcarLeida, agregarMensaje, actualizarMensaje, borrarMensaje, setEstadoConversacion,
        kpis, consultasPorMes: seedConsultasMes, leadsPorCanal, embudo, carteraPorAptitud,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
