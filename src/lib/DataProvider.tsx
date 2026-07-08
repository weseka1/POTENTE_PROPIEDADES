import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import type { Propiedad } from "@/data/propiedadTypes";
import type { Lead, Cliente, Operacion_, Visita, Tasacion, Arrendamiento } from "@/data/types";
import { propiedades as seedPropiedades } from "@/data/propiedades";
import { leads as seedLeads } from "@/data/leads";
import { clientes as seedClientes } from "@/data/clientes";
import { operaciones as seedOps, visitas as seedVisitas, tasaciones as seedTas, arrendamientos as seedArr } from "@/data/operaciones";
import { consultasPorMes as seedConsultasMes } from "@/data/kpis";
import { generarSugerencias, type Sugerencia } from "./sugerencias";
import { rebaseISO } from "./fechas";

// Demo "siempre actual": las fechas del dataset de ejemplo se desplazan al día real (ver lib/fechas).
const seedLeadsR = seedLeads.map((l) => ({ ...l, fechaISO: rebaseISO(l.fechaISO) }));
const seedClientesR = seedClientes.map((c) => ({ ...c, desdeISO: rebaseISO(c.desdeISO) }));
const seedOpsR = seedOps.map((o) => ({ ...o, actualizadoISO: rebaseISO(o.actualizadoISO) }));
const seedVisitasR = seedVisitas.map((v) => ({ ...v, fechaISO: rebaseISO(v.fechaISO) }));
const seedTasR = seedTas.map((t) => ({ ...t, fechaISO: rebaseISO(t.fechaISO) }));
const seedArrR = seedArr.map((a) => ({ ...a, inicioISO: rebaseISO(a.inicioISO), vencimientoISO: rebaseISO(a.vencimientoISO) }));

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
  updateOperacion: (id: string, patch: Partial<Operacion_>) => Promise<void>;
  addCliente: (c: Cliente) => Promise<void>;
  updateCliente: (id: string, patch: Partial<Cliente>) => Promise<void>;
  addVisita: (v: Visita) => Promise<void>;
  updateVisita: (id: string, patch: Partial<Visita>) => Promise<void>;
  addTasacion: (t: Tasacion) => Promise<void>;
  updateTasacion: (id: string, patch: Partial<Tasacion>) => Promise<void>;
  addArrendamiento: (a: Arrendamiento) => Promise<void>;
  // asistente IA
  sugerencias: Sugerencia[];
  sugerenciasPendientes: number;
  resolverSugerencia: (id: string) => void;
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
  const [propiedades, setPropiedades] = useState<Propiedad[]>(seedPropiedades);
  const [leads, setLeads] = useState<Lead[]>(seedLeadsR);
  const [clientes, setClientes] = useState<Cliente[]>(seedClientesR);
  const [operaciones, setOperaciones] = useState<Operacion_[]>(seedOpsR);
  const [visitas, setVisitas] = useState<Visita[]>(seedVisitasR);
  const [tasaciones, setTasaciones] = useState<Tasacion[]>(seedTasR);
  const [arrendamientos, setArrendamientos] = useState<Arrendamiento[]>(seedArrR);

  // Sincronizar desde Supabase (en segundo plano; si falla, quedan los datos locales)
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!supabase) { setLoading(false); return; }
      try {
        const [p, l, c, o, v, t, a] = await Promise.all([
          supabase.from("potente_propiedades").select("*"),
          supabase.from("potente_leads").select("*"),
          supabase.from("potente_clientes").select("*"),
          supabase.from("potente_operaciones").select("*"),
          supabase.from("potente_visitas").select("*"),
          supabase.from("potente_tasaciones").select("*"),
          supabase.from("potente_arrendamientos").select("*"),
        ]);
        if (cancel) return;
        if (p.data?.length) setPropiedades(p.data as Propiedad[]);
        if (l.data) setLeads(l.data as Lead[]);
        if (c.data) setClientes(c.data as Cliente[]);
        if (o.data) setOperaciones(o.data as Operacion_[]);
        if (v.data) setVisitas(v.data as Visita[]);
        if (t.data) setTasaciones(t.data as Tasacion[]);
        if (a.data) setArrendamientos(a.data as Arrendamiento[]);
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

  // ===== Asistente IA: sugerencias derivadas + las que el humano ya resolvió =====
  const [resueltas, setResueltas] = useState<string[]>([]);
  const resolverSugerencia = (id: string) => setResueltas((p) => (p.includes(id) ? p : [...p, id]));
  const sugerencias = useMemo(
    () =>
      generarSugerencias({ propiedades, leads, clientes, visitas, arrendamientos }).filter(
        (s) => !resueltas.includes(s.id)
      ),
    [propiedades, leads, clientes, visitas, arrendamientos, resueltas]
  );

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
        addPropiedad, updatePropiedad, deletePropiedad, addLead, updateLead, updateOperacion, addCliente, updateCliente,
        addVisita, updateVisita, addTasacion, updateTasacion, addArrendamiento,
        sugerencias, sugerenciasPendientes: sugerencias.length, resolverSugerencia,
        kpis, consultasPorMes: seedConsultasMes, leadsPorCanal, embudo, carteraPorAptitud,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
