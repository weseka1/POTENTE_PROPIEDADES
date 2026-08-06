import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

/* Credencial de DEMO: solo vale cuando NO hay base de datos configurada.
   ⚠️ Con Supabase conectado este puente queda DESACTIVADO a propósito. Si dejara
   entrar, el panel abriría sin sesión real y, como el RLS filtra por usuario, se
   vería vacío: peor que no poder entrar. Con base, solo login real. */
export const DEMO_EMAIL = "demo@potenteprop.com.ar";
const DEMO_PASS = "potente2026";
/** true solo en la demo sin base de datos: la pantalla de login lo usa para
 *  decidir si muestra el acceso de prueba. Con base conectada, no se muestra. */
export const PUENTE_DEMO_ACTIVO = !supabase;

type AuthCtx = {
  authed: boolean;
  loading: boolean;
  email: string | null;
  signIn: (email: string, pass: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
};
const Ctx = createContext<AuthCtx | null>(null);
export const usePanelAuth = () => { const c = useContext(Ctx); if (!c) throw new Error("usePanelAuth fuera de PanelAuthProvider"); return c; };

export function PanelAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [demo, setDemo] = useState<boolean>(() => {
    if (!PUENTE_DEMO_ACTIVO) return false; // con base, la sesión manda
    try { return localStorage.getItem("potente_demo_auth") === "1"; } catch { return false; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub: any;
    (async () => {
      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          setSession(data.session);
          sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s)).data.subscription;
        } catch { /* offline → solo demo */ }
      }
      setLoading(false);
    })();
    return () => { sub?.unsubscribe?.(); };
  }, []);

  const authed = !!session || demo;
  const email = session?.user?.email || (demo ? DEMO_EMAIL : null);

  const signIn = async (em: string, pass: string) => {
    const e = em.trim().toLowerCase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: e, password: pass });
        if (!error && data.session) { setSession(data.session); return { ok: true }; }
        // Con base configurada NO hay puente: un error acá es el resultado final.
        return { ok: false, error: "Email o contraseña incorrectos." };
      } catch {
        return { ok: false, error: "No se pudo conectar. Revisá la conexión e intentá de nuevo." };
      }
    }
    if (PUENTE_DEMO_ACTIVO && e === DEMO_EMAIL && pass === DEMO_PASS) {
      try { localStorage.setItem("potente_demo_auth", "1"); } catch { /* noop */ }
      setDemo(true); return { ok: true };
    }
    return { ok: false, error: "Email o contraseña incorrectos." };
  };

  const signOut = async () => {
    try { localStorage.removeItem("potente_demo_auth"); } catch { /* noop */ }
    setDemo(false); setSession(null);
    if (supabase) { try { await supabase.auth.signOut(); } catch { /* noop */ } }
  };

  return <Ctx.Provider value={{ authed, loading, email, signIn, signOut }}>{children}</Ctx.Provider>;
}
