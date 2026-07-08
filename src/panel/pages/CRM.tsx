import { useState, useMemo } from "react";
import { Phone, Mail, MapPin, Target, Wallet, Briefcase, UserPlus } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import type { Cliente, TipoCliente, Aptitud } from "@/data/types";
import { fmtUSD, fmtFecha, fmtHa } from "@/lib/format";
import { PageHeader, EmptyState } from "../components/PageShell";
import { SearchInput, Segmented, Btn } from "../components/Controls";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useToast } from "../components/Toast";
import { tipoCliente } from "../ui/estados";

function busca(c: Cliente): string {
  const partes: string[] = [];
  if (c.buscaZona) partes.push(c.buscaZona);
  if (c.buscaHasMin || c.buscaHasMax)
    partes.push(`${fmtHa(c.buscaHasMin ?? 0)}–${fmtHa(c.buscaHasMax ?? 0)}`);
  if (c.buscaAptitud) partes.push(c.buscaAptitud);
  return partes.join(" · ");
}

const BLANK = { nombre: "", tipo: "comprador", telefono: "", email: "", localidad: "", buscaZona: "", buscaHasMin: "", buscaHasMax: "", buscaAptitud: "", presupuestoUSD: "", notas: "" };

export default function CRM() {
  const { push } = useToast();
  const { clientes: allClientes, addCliente } = useData();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [sel, setSel] = useState<Cliente | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState(BLANK);
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const guardarCliente = () => {
    if (!form.nombre.trim()) { push("Poné al menos el nombre del cliente", "info"); return; }
    const c: Cliente = {
      id: "CLI-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
      nombre: form.nombre.trim(),
      tipo: form.tipo as TipoCliente,
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      localidad: form.localidad.trim(),
      buscaZona: form.buscaZona.trim() || undefined,
      buscaHasMin: form.buscaHasMin ? Number(form.buscaHasMin) : undefined,
      buscaHasMax: form.buscaHasMax ? Number(form.buscaHasMax) : undefined,
      buscaAptitud: (form.buscaAptitud || undefined) as Aptitud | undefined,
      presupuestoUSD: form.presupuestoUSD ? Number(form.presupuestoUSD) : undefined,
      operaciones: 0,
      desdeISO: new Date().toISOString().slice(0, 10),
      notas: form.notas.trim(),
    };
    addCliente(c);
    push("Cliente agregado ✓", "success");
    setForm(BLANK); setNuevo(false);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: allClientes.length };
    (["comprador", "propietario", "inversor"] as const).forEach(
      (t) => (c[t] = allClientes.filter((x) => x.tipo === t).length)
    );
    return c;
  }, [allClientes]);

  const filtrados = useMemo(
    () =>
      allClientes
        .filter((c) => (tipo === "todos" ? true : c.tipo === tipo))
        .filter((c) => (q ? `${c.nombre} ${c.localidad} ${c.email}`.toLowerCase().includes(q.toLowerCase()) : true)),
    [allClientes, q, tipo]
  );

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${allClientes.length} clientes · compradores, propietarios e inversores`}
        actions={
          <Btn variant="primary" onClick={() => setNuevo(true)}>
            <UserPlus size={16} /> Nuevo cliente
          </Btn>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tipo}
          onChange={setTipo}
          options={[
            { value: "todos", label: "Todos", count: counts.todos },
            { value: "comprador", label: "Compradores", count: counts.comprador },
            { value: "propietario", label: "Propietarios", count: counts.propietario },
            { value: "inversor", label: "Inversores", count: counts.inversor },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Buscar cliente…" className="w-full sm:w-72" />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState msg="No hay clientes con esos filtros." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((c) => {
            const t = tipoCliente[c.tipo];
            const b = busca(c);
            return (
              <button
                key={c.id}
                onClick={() => setSel(c)}
                className="group pcard pcard-hover p-5 text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-graph/[0.06] font-display text-sm font-semibold text-graph ring-1 ring-inset ring-graph/10">
                      {c.nombre.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-1 font-semibold text-graph">{c.nombre}</p>
                      <p className="flex items-center gap-1 text-xs text-graph-400">
                        <MapPin size={11} /> {c.localidad}
                      </p>
                    </div>
                  </div>
                  <Badge tone={t.tone}>{t.label}</Badge>
                </div>

                {b && (
                  <div className="mt-4 rounded-xl bg-graph/[0.03] px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-graph-400">
                      <Target size={11} /> Busca
                    </p>
                    <p className="mt-0.5 text-sm capitalize text-graph-500">{b}</p>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-graph/[0.07] pt-3 text-xs text-graph-400">
                  <span className="inline-flex items-center gap-1">
                    <Briefcase size={13} /> {c.operaciones} op.
                  </span>
                  {c.presupuestoUSD && (
                    <span className="inline-flex items-center gap-1 font-semibold text-graph-500">
                      <Wallet size={13} /> {fmtUSD(c.presupuestoUSD, { short: true })}
                    </span>
                  )}
                  <span>Desde {new Date(c.desdeISO).getFullYear()}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* detalle */}
      <Modal
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.nombre}
        subtitle={sel ? `${tipoCliente[sel.tipo].label} · ${sel.localidad}` : ""}
        size="lg"
      >
        {sel && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info icon={<Phone size={14} />} label="Teléfono" value={sel.telefono} />
              <Info icon={<Mail size={14} />} label="Email" value={sel.email} />
              <Info icon={<MapPin size={14} />} label="Localidad" value={sel.localidad} />
              <Info icon={<Briefcase size={14} />} label="Operaciones" value={`${sel.operaciones}`} />
            </div>

            {busca(sel) && (
              <div className="rounded-xl border border-graph/[0.07] bg-graph/[0.03] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-graph-400">
                  <Target size={12} /> Perfil de búsqueda
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {sel.buscaZona && <Mini label="Zona" value={sel.buscaZona} />}
                  {(sel.buscaHasMin || sel.buscaHasMax) && (
                    <Mini label="Superficie" value={`${sel.buscaHasMin ?? 0}–${sel.buscaHasMax ?? 0} ha`} />
                  )}
                  {sel.buscaAptitud && <Mini label="Aptitud" value={sel.buscaAptitud} />}
                  {sel.presupuestoUSD && <Mini label="Presupuesto" value={fmtUSD(sel.presupuestoUSD, { short: true })} />}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-graph-400">Notas</p>
              <p className="text-sm leading-relaxed text-graph-500">{sel.notas}</p>
              <p className="mt-3 text-xs text-graph-400">Cliente desde {fmtFecha(sel.desdeISO)}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* alta de cliente */}
      <Modal
        open={nuevo}
        onClose={() => setNuevo(false)}
        title="Nuevo cliente"
        subtitle="Cargá los datos del cliente. Lo que busca es opcional, pero ayuda a la IA a cruzarlo con las propiedades."
        size="lg"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setNuevo(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={guardarCliente}>Guardar cliente</Btn>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre y apellido" full>
              <input value={form.nombre} onChange={(e) => setF("nombre", e.target.value)} placeholder="Ej: Jorge Lemos" className={INP} autoFocus />
            </Field>
            <Field label="Tipo de cliente">
              <select value={form.tipo} onChange={(e) => setF("tipo", e.target.value)} className={INP}>
                <option value="comprador">Comprador</option>
                <option value="propietario">Propietario</option>
                <option value="inversor">Inversor</option>
              </select>
            </Field>
            <Field label="Localidad">
              <input value={form.localidad} onChange={(e) => setF("localidad", e.target.value)} placeholder="Ej: Mar del Plata" className={INP} />
            </Field>
            <Field label="Teléfono">
              <input value={form.telefono} onChange={(e) => setF("telefono", e.target.value)} placeholder="Ej: 223 555-1234" className={INP} />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={(e) => setF("email", e.target.value)} placeholder="cliente@mail.com" className={INP} />
            </Field>
          </div>

          <div className="rounded-xl border border-graph/[0.07] bg-graph/[0.02] p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-graph-400">
              <Target size={12} className="text-brand" /> Qué busca <span className="font-normal normal-case text-graph-400">(opcional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Zona">
                <input value={form.buscaZona} onChange={(e) => setF("buscaZona", e.target.value)} placeholder="Playa Grande" className={INP} />
              </Field>
              <Field label="Aptitud">
                <select value={form.buscaAptitud} onChange={(e) => setF("buscaAptitud", e.target.value)} className={INP}>
                  <option value="">—</option>
                  <option value="agrícola">Agrícola</option>
                  <option value="ganadera">Ganadera</option>
                  <option value="mixta">Mixta</option>
                </select>
              </Field>
              <Field label="Ha (desde)">
                <input value={form.buscaHasMin} onChange={(e) => setF("buscaHasMin", e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="100" className={INP} />
              </Field>
              <Field label="Ha (hasta)">
                <input value={form.buscaHasMax} onChange={(e) => setF("buscaHasMax", e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="500" className={INP} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Presupuesto (U$S)">
                <input value={form.presupuestoUSD} onChange={(e) => setF("presupuestoUSD", e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="1500000" className={INP} />
              </Field>
            </div>
          </div>

          <Field label="Notas" full>
            <textarea value={form.notas} onChange={(e) => setF("notas", e.target.value)} rows={3} placeholder="Datos sueltos, preferencias, de dónde lo conocemos…" className={INP + " h-auto resize-y py-2.5"} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

const INP = "h-10 w-full rounded-xl border border-graph/15 bg-paper-100 px-3 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand/60 focus:bg-white focus:ring-2 focus:ring-brand/15";

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-graph-400">{label}</span>
      {children}
    </label>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-graph/[0.07] bg-graph/[0.03] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-graph-400">
        {icon} {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium text-graph">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-graph-400">{label}</p>
      <p className="font-medium capitalize text-graph">{value}</p>
    </div>
  );
}
