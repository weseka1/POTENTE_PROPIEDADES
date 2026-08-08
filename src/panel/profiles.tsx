import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import { usePanelAuth } from "./auth";
import { supabase } from "@/lib/supabase";

/* ── PIN de cada perfil ───────────────────────────────────────────────────────
   El login ya separa a cada oficina. El PIN cubre el otro caso: que alguien
   aproveche una sesión abierta para cambiarse de perfil. Vive en la base
   (hasheado) para que valga desde cualquier computadora y no se pueda borrar
   desde el navegador. Ver 02_INFRA/supabase (migración potente_09_pin_por_perfil). */

/** ¿Ese perfil pide PIN? Sin base de datos, nunca.
 *
 *  ⚠️ Si la consulta FALLA no se asume "no pide PIN": eso haría que un problema
 *  de red o una función faltante desactive el control sin que nadie se entere.
 *  Ante la duda se pide el PIN, y quien lo sepa entra igual. */
export async function perfilPideePin(perfilId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("potente_pin_puesto", { p_perfil: perfilId });
  if (error) {
    console.error("No se pudo consultar el PIN del perfil:", error.message);
    return true; // fallar cerrado
  }
  return data === true;
}

/** Prueba un PIN. La base compara contra el hash; el PIN nunca viaja de vuelta. */
export async function verificarPin(perfilId: string, pin: string): Promise<boolean> {
  if (!supabase) return true;
  const { data, error } = await supabase.rpc("potente_pin_ok", { p_perfil: perfilId, p_pin: pin });
  return !error && data === true;
}

/** Pone o quita el PIN (vacío = lo quita). La base solo deja hacerlo a Dirección. */
export async function definirPin(perfilId: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Hace falta la base de datos para guardar el PIN." };
  const { error } = await supabase.rpc("potente_pin_definir", { p_perfil: perfilId, p_pin: pin });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type Perfil = { id: string; nombre: string; rol: string; foto: string | null; color: string; admin?: boolean; permisos?: string[]; oficina?: "chauvin" | "puntamogotes" };

/* Secciones del panel. basic=true → la ven TODOS. El resto solo el admin (o quien él habilite). */
export const SECCIONES = [
  { key: "inicio", label: "Inicio", basic: false },
  { key: "asistente", label: "Asistente IA", basic: false },
  { key: "cartera", label: "Cartera", basic: false },
  { key: "fichas", label: "Fichas", basic: true },
  { key: "cargar", label: "Cargar propiedad", basic: true },
  { key: "temporada", label: "Temporada", basic: false },
  { key: "leads", label: "Consultas", basic: true },
  { key: "crm", label: "Clientes", basic: true },
  { key: "pipeline", label: "Embudo de ventas", basic: false },
  { key: "agenda", label: "Agenda de visitas", basic: true },
  { key: "tasaciones", label: "Tasaciones", basic: true },
  { key: "arrendamientos", label: "Alquileres", basic: false },
  { key: "reportes", label: "Reportes", basic: true },
] as const;
export const EXTRA_SECCIONES = SECCIONES.filter((s) => !s.basic);

/**
 * ¿Se puede ver esta sección?
 *
 * 🔒 `esDireccion` sale del TOKEN (app_metadata.rol), que solo se escribe desde el
 * servidor. Es la autoridad. `p.admin` y `p.permisos` viven en localStorage, o sea
 * que los puede editar cualquiera con las herramientas del navegador — sirven para
 * organizar al equipo, NO para decidir un permiso.
 *
 * Por eso, cuando hay sesión con base:
 *   · dirección → todo
 *   · oficina    → las básicas + lo que la dirección le habilitó, y NUNCA una
 *                  sección no-básica por decir `admin: true` en el navegador.
 * En la demo sin base (`esDireccion === null`) se cae al comportamiento viejo.
 */
export function canAccess(p: Perfil | undefined, key: string, esDireccion?: boolean | null): boolean {
  if (!p) return false;

  const s = SECCIONES.find((x) => x.key === key);

  // Con sesión real, el token decide.
  if (esDireccion === true) return true;
  if (esDireccion === false) {
    if (s?.basic) return true;
    return (p.permisos || []).includes(key);
  }

  // Demo sin base: manda el perfil elegido a mano.
  if (p.admin) return true;
  if (s?.basic) return true;
  return (p.permisos || []).includes(key);
}

const PALETA = ["#0C4DA2", "#1495D8", "#083469", "#2F6FC2", "#0A4189", "#7FA9DE"];
const DEFAULTS: Perfil[] = [
  { id: "mateo", nombre: "Mateo", rol: "Dirección", foto: null, color: "#0C4DA2", admin: true, permisos: [] }, // central: ve TODO
  // Las oficinas ven su tajada de cartera y temporada (el scope las limita a lo suyo).
  // "asistente" queda afuera a propósito: la IA es solo del orquestador (pedido Mateo).
  { id: "puntamogotes", nombre: "Punta Mogotes", rol: "Oficina 2", foto: null, color: "#1495D8", admin: false, permisos: ["inicio", "cartera", "temporada"], oficina: "puntamogotes" },
  { id: "chauvin", nombre: "Chauvín", rol: "Oficina 1", foto: null, color: "#083469", admin: false, permisos: ["inicio", "cartera", "temporada"], oficina: "chauvin" },
];
const LS_PERFILES = "potente_perfiles", LS_ACTIVO = "potente_perfil_activo";

function loadPerfiles(): Perfil[] {
  try {
    const r = JSON.parse(localStorage.getItem(LS_PERFILES) || "null");
    if (Array.isArray(r) && r.length) {
      // migración de perfiles viejos (guardados antes del sistema de permisos)
      const m: Perfil[] = r.map((p: any) => ({
        ...p,
        admin: typeof p.admin === "boolean" ? p.admin : (p.id === "mateo" || p.rol === "Dirección"),
        // migración multi-oficina: perfiles guardados antes del campo oficina
        oficina: p.oficina ?? (p.id === "puntamogotes" ? "puntamogotes" : p.id === "chauvin" ? "chauvin" : undefined),
        // ...y perfiles de oficina sin los permisos del upgrade (cartera/temporada)
        permisos: (p.id === "puntamogotes" || p.id === "chauvin") && !(p.permisos || []).length
          ? ["inicio", "cartera", "temporada"]
          : (Array.isArray(p.permisos) ? p.permisos : []),
      }));
      if (!m.some((p) => p.admin)) { // siempre al menos un administrador (preferí Dirección / Mateo)
        const i = m.findIndex((p) => p.rol === "Dirección" || p.id === "mateo" || /mateo/i.test(p.nombre));
        m[i >= 0 ? i : 0].admin = true;
      }
      return m;
    }
  } catch { /* noop */ }
  return DEFAULTS;
}

/** Redimensiona una imagen subida a un cuadrado ~256px y devuelve un dataURL liviano. */
export function fileToAvatar(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
        const cv = document.createElement("canvas"); cv.width = cv.height = max;
        const c = cv.getContext("2d")!; c.drawImage(img, sx, sy, side, side, 0, 0, max, max);
        resolve(cv.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject; img.src = reader.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

type Ctx = {
  perfiles: Perfil[];
  activo: Perfil;
  gateOpen: boolean;
  openGate: () => void;
  closeGate: () => void;
  pick: (id: string) => void;
  add: () => void;
  update: (id: string, patch: Partial<Perfil>) => void;
  remove: (id: string) => void;
  /** true cuando el perfil lo fija el usuario que entró y NO se puede cambiar
   *  (una oficina no puede ponerse el sombrero de Dirección). */
  perfilFijo: boolean;
};
const ProfilesCtx = createContext<Ctx | null>(null);
export const useProfiles = () => { const c = useContext(ProfilesCtx); if (!c) throw new Error("useProfiles fuera de ProfilesProvider"); return c; };

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [perfiles, setPerfiles] = useState<Perfil[]>(loadPerfiles);
  const [activoId, setActivoId] = useState<string>(() => { try { return localStorage.getItem(LS_ACTIVO) || ""; } catch { return ""; } });
  const [gateOpen, setGateOpen] = useState<boolean>(() => { try { return !localStorage.getItem(LS_ACTIVO); } catch { return true; } });

  // ── El usuario que entró manda sobre el perfil ──────────────────────────────
  // Si alguien entra con el usuario de una oficina, el panel se pone en ESE
  // perfil y no lo deja cambiar. Antes el perfil salía de localStorage y se
  // elegía libremente: entrabas como Chauvín y podías ponerte "Mateo · Dirección".
  // Los datos igual estaban protegidos por la base, pero la pantalla mentía.
  // En la demo sin base no hay usuario, así que se sigue eligiendo a mano.
  // 🔴 BUG QUE ESTO ARREGLA (8-ago, lo encontró Juani entrando como Chauvín):
  // antes era `perfiles.find(p => p.oficina === oficinaUsuario)`, o sea que el
  // candado dependía de que un perfil guardado en el NAVEGADOR tuviera la oficina
  // puesta. Si no coincidía ninguno, `perfilFijo` quedaba en false y la oficina
  // podía elegir cualquier perfil, incluido "Mateo · Dirección".
  //
  // Romper esa coincidencia era facilísimo: la propia pantalla ofrece "Agregar
  // perfil" y "Eliminar", y un perfil creado a mano lleva un id al azar
  // (`p3f9a1`), así que la migración que asigna la oficina por id (`p.id ===
  // "chauvin"`) no lo alcanzaba. Renombrar o recrear un perfil abría el candado.
  //
  // Reproducido en producción: con los perfiles recreados, Chauvín se puso el
  // perfil de Mateo y le aparecieron las 13 secciones, incluida "Asistente IA".
  // Los DATOS seguían protegidos por el RLS (veía sus 28 propiedades, no las 103),
  // pero la pantalla le daba el sombrero de CEO. Para un cliente es inaceptable.
  //
  // Ahora manda el TOKEN: si dice que sos de una oficina, el perfil lo fija el
  // token, haya o no un perfil guardado que coincida. El navegador solo aporta lo
  // cosmético (nombre, foto, color).
  const { oficina: oficinaUsuario } = usePanelAuth();

  const perfilDelUsuario = useMemo(() => {
    if (!oficinaUsuario) return undefined;
    const base = DEFAULTS.find((p) => p.oficina === oficinaUsuario)!;
    const guardado = perfiles.find((p) => p.oficina === oficinaUsuario);

    // ⚠️ Del navegador se toma SOLO LO COSMÉTICO (nombre, foto, color). El rol,
    // el `admin` y los `permisos` salen siempre de los valores por defecto del
    // código, nunca de localStorage — que lo edita cualquiera con las
    // herramientas del navegador. Sin esto quedaba un resquicio: poner a mano
    // `{ oficina: "chauvin", permisos: ["asistente"] }` y la oficina se ganaba la
    // sección de la dirección.
    return {
      ...base,
      id: guardado?.id ?? `sesion-${oficinaUsuario}`,
      nombre: guardado?.nombre ?? base.nombre,
      foto: guardado?.foto ?? base.foto,
      color: guardado?.color ?? base.color,
    };
  }, [oficinaUsuario, perfiles]);

  // Una oficina NUNCA elige perfil. La dirección sí (para mirar cómo lo ve cada
  // oficina), y eso es a propósito. Ojo: cuelga de `oficinaUsuario`, NO de haber
  // encontrado un perfil — ahí estaba el agujero.
  const perfilFijo = Boolean(oficinaUsuario);

  useEffect(() => { try { localStorage.setItem(LS_PERFILES, JSON.stringify(perfiles)); } catch { /* noop */ } }, [perfiles]);
  useEffect(() => { try { if (activoId) localStorage.setItem(LS_ACTIVO, activoId); } catch { /* noop */ } }, [activoId]);

  // Con perfil fijo, cerrar la pantalla de selección: no hay nada que elegir.
  useEffect(() => {
    if (perfilDelUsuario) {
      setActivoId(perfilDelUsuario.id);
      setGateOpen(false);
    }
  }, [perfilDelUsuario?.id]);

  const activo = perfilDelUsuario ?? perfiles.find((p) => p.id === activoId) ?? perfiles[0];

  const pick = (id: string) => {
    if (perfilFijo) return; // una oficina no cambia de perfil
    setActivoId(id);
    setGateOpen(false);
  };
  const update = (id: string, patch: Partial<Perfil>) => setPerfiles((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const add = () => setPerfiles((ps) => {
    const id = "p" + Math.random().toString(36).slice(2, 8);
    return [...ps, { id, nombre: "Nuevo perfil", rol: "Equipo", foto: null, color: PALETA[ps.length % PALETA.length], admin: false, permisos: [] }];
  });
  const remove = (id: string) => setPerfiles((ps) => {
    if (ps.length <= 1) return ps;
    const next = ps.filter((p) => p.id !== id);
    if (id === activoId) setActivoId(next[0].id);
    return next;
  });

  return (
    <ProfilesCtx.Provider value={{
      perfiles, activo, gateOpen,
      openGate: () => { if (!perfilFijo) setGateOpen(true); },
      closeGate: () => setGateOpen(false),
      pick, add, update, remove, perfilFijo,
    }}>
      {children}
    </ProfilesCtx.Provider>
  );
}

/** Avatar reutilizable: foto si existe, si no las iniciales sobre el color del perfil. */
export function Avatar({ p, size = 40, className = "" }: { p: Perfil; size?: number; className?: string }) {
  const ini = p.nombre.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "·";
  if (p.foto) return <img src={p.foto} alt={p.nombre} style={{ width: size, height: size }} className={`rounded-full object-cover ${className}`} />;
  return (
    <span style={{ width: size, height: size, background: p.color, fontSize: Math.round(size * 0.4) }}
      className={`grid place-items-center rounded-full font-semibold text-white ${className}`}>{ini}</span>
  );
}
