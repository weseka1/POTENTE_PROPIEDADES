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

/** Pone o quita el PIN (vacío = lo quita). La base solo deja hacerlo a Dirección
 *  y, desde la migración 008, exige la LLAVE MAESTRA: si la dirección ya tiene
 *  PIN, hay que presentarlo para administrar cualquier PIN. Cierra el agujero
 *  que encontró Juani (10-ago): en una sesión abierta se podía QUITAR el PIN de
 *  Mateo sin conocerlo — un candado con la llave puesta. */
export async function definirPin(
  perfilId: string,
  pin: string,
  pinActual?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Hace falta la base de datos para guardar el PIN." };
  const { error } = await supabase.rpc("potente_pin_definir", {
    p_perfil: perfilId,
    p_pin: pin,
    p_pin_actual: pinActual ?? null,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type Perfil = { id: string; nombre: string; rol: string; foto: string | null; color: string; admin?: boolean; permisos?: string[]; oficina?: "chauvin" | "puntamogotes" };

/* Secciones del panel. basic=true → la ven TODOS. El resto solo el admin (o quien él habilite). */
/**
 * LA MATRIZ DE PERMISOS — quién ve qué, y por qué.
 * ─────────────────────────────────────────────────────────────────────────────
 * La regla (Juani, 17-ago): las oficinas OPERAN, la dirección ANALIZA. Textual:
 * «ellos solo pueden cargar propiedades, ver y cargar el crm, cargar fichas,
 * llaves, etc». Todo lo que agregue números del negocio (reportes, embudo,
 * alquileres anuales, la IA del orquestador) es de la dirección.
 *
 * `basic: true`  = herramienta de mostrador: la ve cualquier oficina, siempre
 *                  con SUS datos (el scope + RLS recortan a su oficina).
 * `basic: false` = del orquestador. Una oficina la ve SOLO si la dirección se
 *                  la habilitó en `permisos` (cartera/temporada/inicio hoy).
 *
 * ⚠️ Lo que la pantalla esconde lo REFUERZA la base: verificado 17-ago por API
 * — Chauvín lee 46 propiedades de 103 (las suyas), CERO fichas internas de
 * Mogotes, cero leads/clientes/llaves ajenos. El menú es UX; el candado es RLS.
 */
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
  // El llavero es herramienta de todos los días de cualquiera que atienda:
  // basic. El aislamiento por oficina lo hace el RLS, no el menú.
  { key: "llaves", label: "Llaves", basic: true },
  { key: "arrendamientos", label: "Alquileres", basic: false },
  /* 🔴 17-ago · Reportes DEJÓ de ser básica. Era la fuga que vio Juani
   * («todas las oficinas tienen la misma información que mateo»): cualquier
   * oficina abría Reportes y veía valores de cartera en plata — análisis del
   * negocio, no herramienta de mostrador. Los datos que mostraba ya venían
   * recortados a su oficina por el scope, pero el análisis del negocio es de
   * quien lo dirige, aunque sea sobre la tajada propia. */
  { key: "reportes", label: "Reportes", basic: false },
] as const;
export const EXTRA_SECCIONES = SECCIONES.filter((s) => !s.basic);

/**
 * ¿Se puede ver esta sección?
 *
 * LA REGLA (corregida el 10-ago con Juani): **el PERFIL manda la vista y el
 * TOKEN pone el techo.**
 *
 * · Perfil de OFICINA → vista de oficina, sea quien sea el que entró. Esto hace
 *   dos cosas a la vez: cuando Mateo "va a ver una oficina", ve EXACTAMENTE lo
 *   que ve la oficina (antes seguía viendo las 13 secciones y el paseo no
 *   servía de nada); y alguien parado frente a una sesión de la dirección
 *   abierta solo alcanza vistas de oficina — para volver al panel completo está
 *   el PIN.
 * · Perfil de DIRECCIÓN → todo, pero SOLO si el token dice dirección
 *   (app_metadata.rol, que se escribe únicamente desde el servidor). Una
 *   oficina jamás llega acá: su perfil lo fija el token.
 * · En la demo sin base (`esDireccion === null`) manda el perfil elegido a
 *   mano, como fue siempre — el enlatado de demos depende de esto.
 *
 * ⚠️ `p.admin` y `p.permisos` de localStorage NO deciden nada cuando hay sesión:
 * los edita cualquiera con las herramientas del navegador. Con sesión, los
 * permisos del perfil salen de los DEFAULTS del código (ver `blindar()` en el
 * provider).
 */
export function canAccess(p: Perfil | undefined, key: string, esDireccion?: boolean | null): boolean {
  if (!p) return false;

  const s = SECCIONES.find((x) => x.key === key);

  // Perfil de oficina: vista de oficina. Para todos.
  if (p.oficina) {
    if (s?.basic) return true;
    return (p.permisos || []).includes(key);
  }

  // Perfil de dirección (sin oficina): el token es la autoridad.
  if (esDireccion === true) return true;
  if (esDireccion === false) {
    // Una oficina con un perfil sin oficina no debería existir (el token le fija
    // el suyo), pero si aparece, no gana nada: solo lo básico.
    return s?.basic === true;
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
  /** true mientras la Dirección está parada en su perfil SIN haber pasado el
   *  PIN en esta pestaña: la pantalla de perfiles no se puede cerrar. */
  bloqueado: boolean;
  /** true = hay sesión real (con base). El gate esconde lo de la demo. */
  conSesion: boolean;
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
  const { oficina: oficinaUsuario, esDireccion } = usePanelAuth();
  // Con base y usuario real. En la demo sin base es false y todo sigue como era.
  const conSesion = esDireccion !== null;

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

  /* ── El PIN de la Dirección, por pestaña ────────────────────────────────────
     El flujo que pidió Juani (10-ago): Mateo puede pasearse por las vistas de
     las oficinas, y PARA VOLVER a su perfil pone el PIN. La marca de "ya lo
     puso" vive en sessionStorage: dura lo que dura la pestaña, así que cerrar
     el navegador o abrir otra pestaña vuelve a pedirlo. Cambiarse a una oficina
     la borra — volver SIEMPRE pide PIN. */
  const [pinOk, setPinOk] = useState<boolean>(() => {
    try { return sessionStorage.getItem("potente_pin_direccion_ok") === "1"; } catch { return false; }
  });
  const marcarPin = (ok: boolean) => {
    setPinOk(ok);
    try {
      if (ok) sessionStorage.setItem("potente_pin_direccion_ok", "1");
      else sessionStorage.removeItem("potente_pin_direccion_ok");
    } catch { /* noop */ }
  };

  // ¿La dirección tiene PIN puesto? (async, una vez por sesión de dirección).
  // Mientras no se sabe (null) se asume que SÍ: fallar cerrado.
  const [direccionTienePin, setDireccionTienePin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!conSesion || esDireccion !== true) return;
    let vivo = true;
    perfilPideePin("mateo").then((v) => { if (vivo) setDireccionTienePin(v); });
    return () => { vivo = false; };
  }, [conSesion, esDireccion]);

  /* Con sesión, los perfiles que el gate puede ofrecer son LOS TRES del negocio,
     blindados: rol/permisos/oficina salen del código; del navegador solo lo
     cosmético. "Agregar perfil" y los permisos por localStorage son de la demo. */
  const perfilesPanel = useMemo(() => {
    if (!conSesion) return perfiles;
    return DEFAULTS.map((base) => {
      // Primero el id exacto (es donde escribe `update` con sesión); si no, el
      // perfil viejo que tenga esa oficina (cosmética guardada antes del cambio).
      const guardado =
        perfiles.find((p) => p.id === base.id) ??
        perfiles.find((p) => (base.oficina ? p.oficina === base.oficina : p.rol === "Dirección"));
      return {
        ...base,
        nombre: guardado?.nombre ?? base.nombre,
        foto: guardado?.foto ?? base.foto,
        color: guardado?.color ?? base.color,
      };
    });
  }, [conSesion, perfiles]);

  useEffect(() => { try { localStorage.setItem(LS_PERFILES, JSON.stringify(perfiles)); } catch { /* noop */ } }, [perfiles]);
  useEffect(() => { try { if (activoId) localStorage.setItem(LS_ACTIVO, activoId); } catch { /* noop */ } }, [activoId]);

  // Con perfil fijo, cerrar la pantalla de selección: no hay nada que elegir.
  useEffect(() => {
    if (perfilDelUsuario) {
      setActivoId(perfilDelUsuario.id);
      setGateOpen(false);
    }
  }, [perfilDelUsuario?.id]);

  const activo = perfilDelUsuario
    ?? (conSesion
      ? (perfilesPanel.find((p) => p.id === activoId) ?? perfilesPanel[0])
      : (perfiles.find((p) => p.id === activoId) ?? perfiles[0]));

  /* La Dirección parada en su perfil sin haber puesto el PIN en esta pestaña:
     el gate queda clavado abierto (el contenido de atrás queda tapado). Si la
     dirección no tiene PIN, no hay nada que pedir. */
  const bloqueado =
    conSesion &&
    esDireccion === true &&
    !activo.oficina &&
    direccionTienePin !== false &&
    !pinOk;

  /* ⚠️ Acá NO va un `if (bloqueado) setGateOpen(true)`. El patch original lo
   * tenía y era un bug: `bloqueado` arranca en true A PROPÓSITO (fallar cerrado
   * mientras se consulta si la Dirección tiene PIN), así que ese efecto disparaba
   * en el montaje y dejaba `gateOpen` clavado aunque el chequeo volviera con "no
   * hay PIN" — el selector de perfiles aparecía en CADA carga del panel y se
   * comía los clicks de atrás. No hace falta: el gate ya se dibuja solo con
   * `bloqueado` (su condición de render es `gateOpen || bloqueado`), y cuando el
   * chequeo resuelve que no hay PIN, se va solo sin dejar estado pegado. */

  const pick = (id: string) => {
    if (perfilFijo) return; // una oficina no cambia de perfil
    if (conSesion) {
      const destino = perfilesPanel.find((p) => p.id === id);
      if (!destino) return; // con sesión solo existen los tres del negocio
      // Volver a la Dirección deja la marca (el gate ya verificó el PIN antes de
      // llamar acá); irse a una oficina LA BORRA — volver pedirá PIN de nuevo.
      marcarPin(!destino.oficina);
    }
    setActivoId(id);
    setGateOpen(false);
  };
  const update = (id: string, patch: Partial<Perfil>) => setPerfiles((ps) => {
    if (ps.some((p) => p.id === id)) return ps.map((p) => (p.id === id ? { ...p, ...patch } : p));
    // Con sesión, el gate edita los perfiles blindados por su id de código
    // ("mateo", "chauvin"...) que puede no existir aún en lo guardado: se crea
    // la entrada para que la foto o el nombre persistan.
    const base = DEFAULTS.find((d) => d.id === id);
    return base ? [...ps, { ...base, ...patch }] : ps;
  });
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
      // Con sesión, el gate ofrece SOLO los tres perfiles del negocio, blindados.
      perfiles: conSesion ? perfilesPanel : perfiles,
      activo, gateOpen,
      openGate: () => { if (!perfilFijo) setGateOpen(true); },
      // Con el PIN pendiente, el gate no se cierra: es la puerta.
      closeGate: () => { if (!bloqueado) setGateOpen(false); },
      pick, add, update, remove, perfilFijo, bloqueado, conSesion,
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
