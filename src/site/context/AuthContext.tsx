import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface Usuario {
  nombre: string;
  email: string;
  telefono?: string;
}

interface AuthCtx {
  user: Usuario | null;
  registrar: (u: Usuario & { password: string }) => { ok: boolean; error?: string };
  ingresar: (email: string, password: string) => { ok: boolean; error?: string };
  salir: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);
const LS_USERS = "potente_users";
const LS_SESSION = "potente_session";

function leerUsers(): Record<string, Usuario & { password: string }> {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS) || "{}");
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_SESSION);
      if (s) setUser(JSON.parse(s));
    } catch {}
  }, []);

  const persistSession = (u: Usuario | null) => {
    setUser(u);
    if (u) localStorage.setItem(LS_SESSION, JSON.stringify(u));
    else localStorage.removeItem(LS_SESSION);
  };

  const registrar: AuthCtx["registrar"] = ({ nombre, email, telefono, password }) => {
    const e = email.trim().toLowerCase();
    if (!nombre || !e || !password) return { ok: false, error: "Completá todos los campos." };
    const users = leerUsers();
    if (users[e]) return { ok: false, error: "Ya existe una cuenta con ese email." };
    users[e] = { nombre, email: e, telefono, password };
    localStorage.setItem(LS_USERS, JSON.stringify(users));
    persistSession({ nombre, email: e, telefono });
    return { ok: true };
  };

  const ingresar: AuthCtx["ingresar"] = (email, password) => {
    const e = email.trim().toLowerCase();
    const users = leerUsers();
    const u = users[e];
    if (!u || u.password !== password)
      return { ok: false, error: "Email o contraseña incorrectos." };
    persistSession({ nombre: u.nombre, email: u.email, telefono: u.telefono });
    return { ok: true };
  };

  const salir = () => persistSession(null);

  return <Ctx.Provider value={{ user, registrar, ingresar, salir }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
