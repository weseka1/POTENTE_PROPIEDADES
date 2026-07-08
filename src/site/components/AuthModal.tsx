import { useState, useEffect } from "react";
import { X, Mail, Lock, User, Phone, ArrowRight, Sprout } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AuthModal({
  open,
  onClose,
  modoInicial = "ingresar",
}: {
  open: boolean;
  onClose: () => void;
  modoInicial?: "ingresar" | "registrar";
}) {
  const { registrar, ingresar } = useAuth();
  const [modo, setModo] = useState<"ingresar" | "registrar">(modoInicial);
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setModo(modoInicial);
      setError("");
      setForm({ nombre: "", email: "", telefono: "", password: "" });
    }
  }, [open, modoInicial]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r =
      modo === "registrar"
        ? registrar(form)
        : ingresar(form.email, form.password);
    if (r.ok) onClose();
    else setError(r.error || "Algo salió mal.");
  };

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-graph/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: "fadeIn .2s ease" }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-graph/10 bg-paper-100 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-graph-400 transition hover:text-graph">
          <X size={20} />
        </button>

        <div className="px-8 pt-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand text-white">
            <Sprout size={22} />
          </span>
          <h2 className="mt-4 font-display text-2xl text-graph">
            {modo === "registrar" ? "Creá tu cuenta" : "Ingresá a tu cuenta"}
          </h2>
          <p className="mt-1 text-sm text-graph-500">
            {modo === "registrar"
              ? "Guardá favoritos y seguí tus consultas."
              : "Accedé a tus favoritos y consultas."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 p-8 pt-6">
          {modo === "registrar" && (
            <Campo icon={User} placeholder="Nombre y apellido" value={form.nombre} onChange={(v) => set("nombre", v)} />
          )}
          <Campo icon={Mail} type="email" placeholder="Email" value={form.email} onChange={(v) => set("email", v)} />
          {modo === "registrar" && (
            <Campo icon={Phone} placeholder="Teléfono (opcional)" value={form.telefono} onChange={(v) => set("telefono", v)} />
          )}
          <Campo icon={Lock} type="password" placeholder="Contraseña" value={form.password} onChange={(v) => set("password", v)} />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" className="btn-primary w-full">
            {modo === "registrar" ? "Crear cuenta" : "Ingresar"} <ArrowRight size={16} />
          </button>

          <p className="pt-2 text-center text-sm text-graph-500">
            {modo === "registrar" ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?"}{" "}
            <button
              type="button"
              onClick={() => {
                setError("");
                setModo(modo === "registrar" ? "ingresar" : "registrar");
              }}
              className="font-semibold text-brand hover:underline"
            >
              {modo === "registrar" ? "Ingresá" : "Registrate"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

function Campo({
  icon: Icon,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  icon: any;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-graph/15 bg-paper-100 px-4 transition focus-within:border-brand">
      <Icon size={18} className="text-graph-400" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full bg-transparent text-sm text-graph outline-none placeholder:text-graph-400"
      />
    </div>
  );
}
