import { useEffect, useRef, useState } from "react";
import { X, Camera, Pencil, Trash2, Plus, Check, ShieldCheck, Lock, Loader2 } from "lucide-react";
import {
  useProfiles, Avatar, fileToAvatar, EXTRA_SECCIONES, type Perfil,
  perfilPideePin, verificarPin, definirPin,
} from "../profiles";
import { usePanelAuth } from "../auth";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-graph/20"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export default function ProfileGate() {
  const { perfiles, activo, gateOpen, pick, add, update, remove, bloqueado, conSesion } = useProfiles();
  const { esDireccion } = usePanelAuth();
  const [manage, setManage] = useState(false);
  // Perfil que está pidiendo PIN para entrar (null = nadie).
  const [pidiendoPin, setPidiendoPin] = useState<Perfil | null>(null);

  // Manda la CUENTA. `esDireccion` es null solo en la demo sin base: ahí se cae
  // al perfil elegido, como fue siempre.
  const puedeAdministrar = esDireccion ?? Boolean(activo.admin);

  // Con el PIN de la Dirección pendiente, el gate se dibuja aunque nadie lo haya
  // abierto: ES la puerta. Sin eso, un frame de panel completo se escapa antes
  // del candado.
  if (!gateOpen && !bloqueado) return null;

  const onPhoto = async (id: string, file?: File) => { if (file) { try { update(id, { foto: await fileToAvatar(file) }); } catch { /* noop */ } } };

  /** Entrar a un perfil: si tiene PIN, primero lo pide.
   *  ⚠️ El atajo de "ya estás en ese" NO corre estando bloqueado: volver a la
   *  Dirección con el PIN pendiente pasa por el PIN, siempre. */
  const elegir = async (p: Perfil) => {
    if (p.id === activo.id && !bloqueado) return pick(p.id);
    if (await perfilPideePin(p.id)) setPidiendoPin(p);
    else pick(p.id);
  };

  return (
    <div className="panel-bg fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 py-10">
      {/* Bloqueado no hay X: la única salida es un perfil (el de la Dirección,
          con su PIN, o el de una oficina). */}
      {!bloqueado && (
        <button onClick={() => pick(activo.id)} aria-label="Cerrar" className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full text-graph-400 transition hover:bg-graph/5 hover:text-graph">
          <X size={20} />
        </button>
      )}

      <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest2 text-brand">Potente Propiedades · Panel</div>
      <h1 className="text-center font-display text-3xl font-semibold tracking-tight text-graph sm:text-4xl">¿Quién está usando Potente?</h1>
      <p className="mt-2 text-center text-sm text-graph-500">
        {conSesion
          ? "Elegí con qué sombrero entrás. Volver a Dirección pide el PIN."
          : "Elegí tu perfil. Cada uno puede poner su foto."}
      </p>

      <div className="mt-10 flex max-w-3xl flex-wrap items-start justify-center gap-7 sm:gap-9">
        {perfiles.map((p) => (
          <ProfileTile key={p.id} p={p} manage={manage} conSesion={conSesion} active={p.id === activo.id} onPick={() => elegir(p)} onPhoto={onPhoto} update={update} remove={remove} canRemove={!conSesion && perfiles.length > 1} />
        ))}

        {/* Agregar perfil es de la DEMO. Con sesión real, los perfiles son los
            tres del negocio y punto: un perfil nuevo acá era una vía para
            saltarse el PIN de la Dirección (se creaba uno "admin" a mano). */}
        {!conSesion && (
          <button onClick={add} className="group flex w-28 flex-col items-center gap-3 sm:w-32">
            <span className="grid h-24 w-24 place-items-center rounded-full border-2 border-dashed border-graph/25 text-graph-400 transition duration-300 ease-out group-hover:scale-105 group-hover:border-brand group-hover:text-brand sm:h-28 sm:w-28">
              <Plus size={30} />
            </span>
            <span className="text-sm font-medium text-graph-400 transition group-hover:text-graph">Agregar perfil</span>
          </button>
        )}
      </div>

      {/* Permisos y PIN: los administra la DIRECCIÓN.
          ⚠️ `puedeAdministrar` mira primero la CUENTA (app_metadata.rol, que es lo
          que también usa el RLS de la base) y solo cae al perfil del navegador en
          la demo sin base. Antes miraba únicamente `activo.admin`, y eso escondía
          esta sección si Mateo alguna vez tocaba el perfil "Oficina Mogotes":
          seguía siendo la dirección en la base, pero el panel dejaba de ofrecerle
          los PIN y no había forma obvia de recuperarlos. */}
      {manage && puedeAdministrar && (
        <div className="mt-9 w-full max-w-2xl rounded-2xl border border-graph/10 bg-paper-100 p-5 text-left shadow-soft">
          <p className="flex items-center gap-2 font-display text-base font-semibold text-graph"><ShieldCheck size={17} className="text-brand" /> Permisos del equipo</p>
          <p className="mt-0.5 text-xs text-graph-400">Todos ven Clientes, Cargar propiedad, Consultas, Visitas, Tasaciones y Reportes. Sumales secciones o hacelos administradores.</p>
          <div className="mt-4 space-y-2.5">
            {perfiles.map((p) => (
              <div key={p.id} className="rounded-xl border border-graph/[0.07] bg-graph/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Avatar p={p} size={26} />
                    <span className="text-sm font-semibold text-graph">{p.nombre}</span>
                    {p.admin && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-inset ring-brand/20">Admin</span>}
                  </span>
                  {/* El interruptor de "Administrador" y los permisos a dedo son
                      de la DEMO: viven en localStorage y con sesión real no
                      deciden nada (el permiso sale del perfil blindado + el
                      token). Mostrarlos con sesión era vender un control falso. */}
                  {!conSesion && (
                    <label className="flex items-center gap-2 text-[11px] font-medium text-graph-500">Administrador<Toggle on={!!p.admin} onChange={(v) => update(p.id, { admin: v })} /></label>
                  )}
                </div>
                {!conSesion && !p.admin && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {EXTRA_SECCIONES.map((s) => {
                      const on = (p.permisos || []).includes(s.key);
                      return (
                        <button key={s.key} onClick={() => {
                          const cur = new Set(p.permisos || []);
                          if (on) cur.delete(s.key); else cur.add(s.key);
                          update(p.id, { permisos: [...cur] });
                        }} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${on ? "bg-brand text-white" : "bg-graph/[0.05] text-graph-500 hover:bg-graph/10 hover:text-graph"}`}>{s.label}</button>
                      );
                    })}
                  </div>
                )}
                {/* PIN: la segunda llave. Protege el caso de la sesión abierta. */}
                <ConfigurarPin perfil={p} />
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => setManage((v) => !v)}
        className={`mt-12 inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold tracking-wide transition ${manage ? "border-brand bg-brand text-white" : "border-graph/20 text-graph-500 hover:border-brand hover:text-brand"}`}>
        {manage ? <><Check size={15} /> Listo</> : <><Pencil size={14} /> Administrar perfiles</>}
      </button>

      {pidiendoPin && (
        <PedirPin
          perfil={pidiendoPin}
          onCancelar={() => setPidiendoPin(null)}
          onOk={() => { pick(pidiendoPin.id); setPidiendoPin(null); }}
        />
      )}
    </div>
  );
}

/* ── Pedir el PIN para entrar a un perfil ─────────────────────────────────── */

function PedirPin({ perfil, onOk, onCancelar }: { perfil: Perfil; onOk: () => void; onCancelar: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [probando, setProbando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { campo.current?.focus(); }, []);

  const probar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return;
    setProbando(true);
    const ok = await verificarPin(perfil.id, pin);
    setProbando(false);
    if (ok) return onOk();
    setError("PIN incorrecto");
    setPin("");
    campo.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-brand-950/50 p-4 backdrop-blur-sm" onClick={onCancelar}>
      <form
        onSubmit={probar}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl border border-white/40 bg-paper-100/95 p-7 text-center shadow-card backdrop-blur-xl"
      >
        <Avatar p={perfil} size={64} className="mx-auto" />
        <p className="mt-4 font-display text-lg font-semibold text-graph">{perfil.nombre}</p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-graph-400">
          <Lock size={12} className="text-brand" /> Este perfil pide PIN
        </p>

        <input
          ref={campo}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="••••"
          className={`mt-5 h-12 w-full rounded-xl border bg-white px-4 text-center font-display text-2xl tracking-[0.5em] text-graph outline-none transition focus:ring-2 ${
            error ? "border-red-400 focus:ring-red-200" : "border-graph/15 focus:border-brand/60 focus:ring-brand/15"
          }`}
        />
        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancelar} className="h-10 flex-1 rounded-xl border border-graph/15 text-sm font-semibold text-graph-500 transition hover:border-graph/30">
            Cancelar
          </button>
          <button type="submit" disabled={pin.length < 4 || probando} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50">
            {probando ? <Loader2 size={15} className="animate-spin" /> : "Entrar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Definir el PIN de un perfil (solo Dirección) ─────────────────────────── */

function ConfigurarPin({ perfil }: { perfil: Perfil }) {
  const [tiene, setTiene] = useState<boolean | null>(null);
  // 🔑 La llave maestra: si la Dirección tiene PIN, administrar CUALQUIER PIN lo
  // exige (lo fuerza la base — migración 008). Acá solo se pide el dato; el que
  // decide es el servidor: sin esto, en una sesión abierta se podía QUITAR el
  // PIN de Mateo sin conocerlo, y el candado quedaba con la llave puesta.
  const [maestroPuesto, setMaestroPuesto] = useState<boolean | null>(null);
  const [editando, setEditando] = useState(false);
  const [pin, setPin] = useState("");
  const [pinActual, setPinActual] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { perfilPideePin(perfil.id).then(setTiene); }, [perfil.id]);
  useEffect(() => { perfilPideePin("mateo").then(setMaestroPuesto); }, []);

  const guardar = async (valor: string) => {
    const r = await definirPin(perfil.id, valor, pinActual || undefined);
    if (!r.ok) return setMsg(r.error ?? "No se pudo guardar");
    setTiene(valor.length >= 4);
    if (perfil.id === "mateo") setMaestroPuesto(valor.length >= 4);
    setEditando(false);
    setPin("");
    setPinActual("");
    setMsg(valor ? "PIN guardado ✓" : "PIN quitado");
    setTimeout(() => setMsg(""), 2500);
  };

  if (tiene === null) return null;

  const pideMaestro = maestroPuesto === true;
  const faltaMaestro = pideMaestro && pinActual.length < 4;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-graph/[0.07] pt-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-graph-500">
        <Lock size={12} className={tiene ? "text-brand" : "text-graph-400"} />
        {tiene ? "Pide PIN para entrar" : "Sin PIN"}
      </span>

      {editando ? (
        <>
          {pideMaestro && (
            <input
              value={pinActual}
              onChange={(e) => setPinActual(e.target.value.replace(/\D/g, "").slice(0, 8))}
              type="password"
              inputMode="numeric"
              placeholder="PIN actual de Dirección"
              className="h-8 w-40 rounded-lg border border-brand/30 bg-white px-2 text-center text-sm tracking-widest text-graph outline-none focus:border-brand/60"
            />
          )}
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            type="password"
            inputMode="numeric"
            placeholder="Nuevo (4 a 8 números)"
            className="h-8 w-36 rounded-lg border border-graph/15 bg-white px-2 text-center text-sm tracking-widest text-graph outline-none focus:border-brand/60"
          />
          <button onClick={() => guardar(pin)} disabled={pin.length < 4 || faltaMaestro}
            className="h-8 rounded-lg bg-brand px-3 text-[11px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40">
            Guardar
          </button>
          {tiene && (
            <button onClick={() => guardar("")} disabled={faltaMaestro}
              className="text-[11px] text-graph-400 transition hover:text-red-600 disabled:opacity-40">
              Quitar el PIN
            </button>
          )}
          <button onClick={() => { setEditando(false); setPin(""); setPinActual(""); }} className="text-[11px] text-graph-400 hover:text-graph">
            Cancelar
          </button>
        </>
      ) : (
        <button onClick={() => setEditando(true)} className="text-[11px] font-semibold text-brand hover:underline">
          {tiene ? "Cambiar o quitar PIN" : "Poner PIN"}
        </button>
      )}
      {msg && <span className="text-[11px] font-medium text-brand-700">{msg}</span>}
    </div>
  );
}

function ProfileTile({ p, manage, active, conSesion, onPick, onPhoto, update, remove, canRemove }: {
  p: Perfil; manage: boolean; active: boolean; conSesion: boolean; onPick: () => void;
  onPhoto: (id: string, file?: File) => void; update: (id: string, patch: Partial<Perfil>) => void; remove: (id: string) => void; canRemove: boolean;
}) {
  return (
    <div className="flex w-28 flex-col items-center gap-3 sm:w-32">
      <div className="group relative">
        <button onClick={manage ? undefined : onPick} disabled={manage}
          className={`relative grid place-items-center rounded-full ring-2 transition duration-300 ease-out ${active ? "ring-brand" : "ring-transparent"} ${manage ? "" : "group-hover:scale-105 group-hover:ring-brand"}`}>
          <Avatar p={p} size={112} className="shadow-[0_14px_34px_-16px_rgba(23,26,23,0.5)]" />
        </button>
        {/* cambiar foto */}
        <label title="Cambiar foto" className={`absolute -bottom-1 -right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-graph/10 bg-paper-100 text-graph-500 shadow-md transition hover:text-brand ${manage ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <Camera size={16} />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(p.id, e.target.files?.[0])} />
        </label>
        {manage && p.foto && (
          <button onClick={() => update(p.id, { foto: null })} title="Quitar foto" className="absolute -bottom-1 -left-1 grid h-9 w-9 place-items-center rounded-full border border-graph/10 bg-paper-100 text-graph-500 shadow-md transition hover:text-red-600">
            <X size={15} />
          </button>
        )}
      </div>

      {manage ? (
        <div className="flex w-full flex-col items-center gap-1">
          <input value={p.nombre} onChange={(e) => update(p.id, { nombre: e.target.value })}
            className="w-full rounded-lg border border-graph/15 bg-paper-100 px-2 py-1 text-center text-sm font-semibold text-graph outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15" />
          {/* El ROL con sesión es del negocio (Dirección / Oficina 1 / Oficina 2),
              no un texto libre: editable solo en la demo. */}
          {conSesion ? (
            <span className="text-[11px] text-graph-400">{p.rol}</span>
          ) : (
            <input value={p.rol} onChange={(e) => update(p.id, { rol: e.target.value })}
              className="w-full rounded-lg border border-graph/10 bg-paper-100 px-2 py-1 text-center text-[11px] text-graph-500 outline-none focus:border-brand/60" />
          )}
          {canRemove && (
            <button onClick={() => remove(p.id)} className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-graph-400 transition hover:text-red-600">
              <Trash2 size={12} /> Eliminar
            </button>
          )}
        </div>
      ) : (
        <button onClick={onPick} className="flex flex-col items-center leading-tight">
          <span className="text-sm font-semibold text-graph">{p.nombre}</span>
          <span className="text-[11px] text-graph-400">{p.rol}</span>
        </button>
      )}
    </div>
  );
}
