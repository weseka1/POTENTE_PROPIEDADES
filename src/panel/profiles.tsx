import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Perfil = { id: string; nombre: string; rol: string; foto: string | null; color: string; admin?: boolean; permisos?: string[] };

/* Secciones del panel. basic=true → la ven TODOS. El resto solo el admin (o quien él habilite). */
export const SECCIONES = [
  { key: "inicio", label: "Inicio", basic: false },
  { key: "asistente", label: "Asistente IA", basic: false },
  { key: "cartera", label: "Cartera", basic: false },
  { key: "fichas", label: "Fichas", basic: true },
  { key: "cargar", label: "Cargar propiedad", basic: true },
  { key: "planos", label: "Planos", basic: false },
  { key: "leads", label: "Consultas", basic: true },
  { key: "crm", label: "Clientes", basic: true },
  { key: "pipeline", label: "Embudo de ventas", basic: false },
  { key: "agenda", label: "Agenda de visitas", basic: true },
  { key: "tasaciones", label: "Tasaciones", basic: true },
  { key: "arrendamientos", label: "Alquileres", basic: false },
  { key: "reportes", label: "Reportes", basic: true },
] as const;
export const EXTRA_SECCIONES = SECCIONES.filter((s) => !s.basic);

/** ¿El perfil puede ver esta sección? Admin = todo. Básicas = todos. Extra = solo si está habilitada. */
export function canAccess(p: Perfil | undefined, key: string): boolean {
  if (!p) return false;
  if (p.admin) return true;
  const s = SECCIONES.find((x) => x.key === key);
  if (s?.basic) return true;
  return (p.permisos || []).includes(key);
}

const PALETA = ["#0C4DA2", "#C9A24E", "#9C6B3C", "#2F6FC2", "#083469", "#1495D8"];
const DEFAULTS: Perfil[] = [
  { id: "mateo", nombre: "Mateo", rol: "Dirección", foto: null, color: "#0C4DA2", admin: true, permisos: [] },
  { id: "puntamogotes", nombre: "Punta Mogotes", rol: "Sucursal", foto: null, color: "#C9A24E", admin: false, permisos: [] },
  { id: "chauvin", nombre: "Chauvín", rol: "Sucursal", foto: null, color: "#9C6B3C", admin: false, permisos: [] },
];
const LS_PERFILES = "potente_perfiles", LS_ACTIVO = "potente_perfil_activo";

function loadPerfiles(): Perfil[] {
  try {
    const r = JSON.parse(localStorage.getItem(LS_PERFILES) || "null");
    if (Array.isArray(r) && r.length) {
      // migración de perfiles viejos (guardados antes del sistema de permisos)
      const m: Perfil[] = r.map((p: any) => ({
        ...p,
        permisos: Array.isArray(p.permisos) ? p.permisos : [],
        admin: typeof p.admin === "boolean" ? p.admin : (p.id === "mateo" || p.rol === "Dirección"),
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
};
const ProfilesCtx = createContext<Ctx | null>(null);
export const useProfiles = () => { const c = useContext(ProfilesCtx); if (!c) throw new Error("useProfiles fuera de ProfilesProvider"); return c; };

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [perfiles, setPerfiles] = useState<Perfil[]>(loadPerfiles);
  const [activoId, setActivoId] = useState<string>(() => { try { return localStorage.getItem(LS_ACTIVO) || ""; } catch { return ""; } });
  const [gateOpen, setGateOpen] = useState<boolean>(() => { try { return !localStorage.getItem(LS_ACTIVO); } catch { return true; } });

  useEffect(() => { try { localStorage.setItem(LS_PERFILES, JSON.stringify(perfiles)); } catch { /* noop */ } }, [perfiles]);
  useEffect(() => { try { if (activoId) localStorage.setItem(LS_ACTIVO, activoId); } catch { /* noop */ } }, [activoId]);

  const activo = perfiles.find((p) => p.id === activoId) || perfiles[0];

  const pick = (id: string) => { setActivoId(id); setGateOpen(false); };
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
    <ProfilesCtx.Provider value={{ perfiles, activo, gateOpen, openGate: () => setGateOpen(true), closeGate: () => setGateOpen(false), pick, add, update, remove }}>
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
