import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Eye, EyeOff, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Modal from "./Modal";
import { useToast } from "./Toast";
import { cn } from "../ui/cn";

/**
 * CAMBIAR CONTRASEÑA — el paso 2 de la entrega (02_INFRA/RUNBOOK_pin_y_contrasenas.md):
 * WESEKA entrega contraseñas iniciales generadas y NO conoce las finales — cada usuario
 * entra y la cambia acá. Si la olvida, la vuelta es el reseteo por mail de Supabase Auth.
 * Solo existe con sesión real: en la demo sin base el ítem del menú no se ofrece.
 */

// La política de la entrega (cerrar-puerta --reforzar-claves): 12+ caracteres
// con mayúsculas, minúsculas y números.
const REGLAS = [
  { id: "largo", label: "12 caracteres o más", ok: (p: string) => p.length >= 12 },
  { id: "mayus", label: "Al menos una mayúscula", ok: (p: string) => /[A-Z]/.test(p) },
  { id: "minus", label: "Al menos una minúscula", ok: (p: string) => /[a-z]/.test(p) },
  { id: "numero", label: "Al menos un número", ok: (p: string) => /[0-9]/.test(p) },
] as const;

export default function CambiarPassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { push } = useToast();
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cumple = REGLAS.every((r) => r.ok(nueva));
  const coinciden = nueva === repetir;
  const listo = cumple && coinciden && repetir.length > 0 && !enviando;

  const limpiar = () => { setNueva(""); setRepetir(""); setVer(false); setError(null); };
  const cerrar = () => { if (enviando) return; limpiar(); onClose(); };

  const guardar = async () => {
    if (!listo) return;
    if (!supabase) { setError("No hay base de datos conectada: en la demo la contraseña no se puede cambiar."); return; }
    setEnviando(true);
    setError(null);
    try {
      const { error: e } = await supabase.auth.updateUser({ password: nueva });
      if (e) { setError(e.message); return; } // el mensaje de la base, tal cual
      push("Contraseña actualizada. Ya entrás con la nueva.");
      limpiar();
      onClose();
    } catch {
      setError("No se pudo conectar. Revisá la conexión e intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // Portal al body, como el confirmador: montado adentro de algo con transform,
  // un modal fixed queda atrapado en ese ancestro.
  return createPortal(
    <Modal
      open={open}
      onClose={cerrar}
      title="Cambiar contraseña"
      subtitle="La cuenta queda con la que elijas acá"
      footer={
        <>
          <button
            onClick={cerrar}
            disabled={enviando}
            className="inline-flex h-9 items-center rounded-lg border border-graph/15 px-4 text-sm font-medium text-graph-500 transition hover:text-graph disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-cambiar-password"
            disabled={!listo}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <KeyRound size={15} /> {enviando ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </>
      }
    >
      <form
        id="form-cambiar-password"
        onSubmit={(e) => { e.preventDefault(); void guardar(); }}
        className="space-y-4"
      >
        <CampoClave
          label="Nueva contraseña"
          value={nueva}
          onChange={setNueva}
          ver={ver}
          onVer={() => setVer((v) => !v)}
          autoFocus
        />
        <div>
          <CampoClave
            label="Repetir contraseña"
            value={repetir}
            onChange={setRepetir}
            ver={ver}
            onVer={() => setVer((v) => !v)}
          />
          {repetir.length > 0 && !coinciden && (
            <p className="mt-1.5 text-[12px] font-medium text-red-600">Las contraseñas no coinciden.</p>
          )}
        </div>

        <ul className="space-y-1.5 rounded-xl bg-graph/[0.03] px-3.5 py-3">
          {REGLAS.map((r) => {
            const ok = r.ok(nueva);
            return (
              <li key={r.id} className={cn("flex items-center gap-2 text-[12px] font-medium transition", ok ? "text-brand-700" : "text-graph-400")}>
                <Check size={13} className={ok ? "opacity-100" : "opacity-30"} /> {r.label}
              </li>
            );
          })}
        </ul>

        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        <p className="text-[12px] text-graph-400">
          Si algún día la olvidás, se recupera con el reseteo por mail que llega a la casilla de la cuenta.
        </p>
      </form>
    </Modal>,
    document.body,
  );
}

function CampoClave({
  label,
  value,
  onChange,
  ver,
  onVer,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ver: boolean;
  onVer: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-graph-400">{label}</label>
      <div className="relative">
        <input
          type={ver ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete="new-password"
          className="h-11 w-full rounded-xl border border-graph/15 bg-paper-100 pl-3 pr-11 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand/60 focus:bg-white focus:ring-2 focus:ring-brand/15"
        />
        <button
          type="button"
          onClick={onVer}
          aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-graph-400 transition hover:bg-graph/5 hover:text-graph"
        >
          {ver ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
