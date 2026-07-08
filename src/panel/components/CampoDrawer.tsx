import { useState, useEffect } from "react";
import { MapPin, Maximize, Eye, Check, Globe, MessageSquare, Trash2, BedDouble, Bath, Car, Home } from "lucide-react";
import type { Propiedad } from "@/data/propiedadTypes";
import { CATEGORIAS } from "@/data/propiedadTypes";
import { fmtUSD, fmtHa } from "@/lib/format";
import Drawer from "./Drawer";
import Badge from "./Badge";
import CampoThumb from "./CampoThumb";
import { Btn } from "./Controls";
import { estadoCampo } from "../ui/estados";
import { cn } from "../ui/cn";

const catLabel = (cat: string) => CATEGORIAS.find((c) => c.key === cat)?.label ?? cat;

const inputCls =
  "h-9 w-full rounded-lg border border-graph/10 bg-graph/[0.04] px-2.5 text-sm text-graph outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15";

export default function CampoDrawer({
  prop,
  onClose,
  onUpdate,
  onDelete,
}: {
  prop: Propiedad | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Propiedad>) => void;
  onDelete: (id: string) => void;
}) {
  const [activeFoto, setActiveFoto] = useState(0);
  // edición local de los campos editables (se sincroniza al abrir)
  const [titulo, setTitulo] = useState("");
  const [precio, setPrecio] = useState<string>("");

  useEffect(() => {
    setActiveFoto(0);
    if (prop) {
      setTitulo(prop.titulo);
      setPrecio(prop.precioUSD === null || prop.precioUSD === undefined ? "" : String(prop.precioUSD));
    }
  }, [prop]);

  const e = prop ? estadoCampo[prop.estado] : null;
  const esCampo = prop?.categoria === "campo";

  const commitTitulo = () => {
    if (prop && titulo.trim() && titulo !== prop.titulo) onUpdate(prop.id, { titulo: titulo.trim() });
  };
  const commitPrecio = () => {
    if (!prop) return;
    const v = precio.trim() === "" ? null : Number(precio);
    const nuevo = v === null || Number.isNaN(v) ? null : v;
    if (nuevo !== prop.precioUSD) onUpdate(prop.id, { precioUSD: nuevo });
  };

  return (
    <Drawer open={!!prop} onClose={onClose} width="max-w-xl">
      {prop && e && (
        <div>
          {/* galería */}
          <div className="relative">
            <CampoThumb
              src={prop.fotos?.[activeFoto]}
              alt={prop.titulo}
              rounded="rounded-none"
              className="h-60 w-full"
            />
            <div className="absolute left-4 top-4 flex gap-2">
              <Badge tone={e.tone} dot className="bg-white/90 backdrop-blur">
                {e.label}
              </Badge>
              <Badge tone="neutral" className="bg-white/90 capitalize backdrop-blur">
                {catLabel(prop.categoria)}
              </Badge>
            </div>
          </div>
          {(prop.fotos?.length ?? 0) > 1 && (
            <div className="flex gap-2 border-b border-graph/[0.07] px-5 py-3">
              {(prop.fotos ?? []).map((f, i) => (
                <button key={i} onClick={() => setActiveFoto(i)} className="shrink-0">
                  <CampoThumb
                    src={f}
                    alt=""
                    className={cn(
                      "h-12 w-16 ring-2 transition",
                      i === activeFoto ? "ring-brand" : "ring-transparent opacity-70 hover:opacity-100"
                    )}
                  />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-5 p-5">
            {/* header */}
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-graph-400">
                <span>{prop.id}</span>
                <span className="capitalize">· {catLabel(prop.categoria)}</span>
                <span className="capitalize">· {prop.operacion}</span>
              </div>
              {/* título editable */}
              <input
                value={titulo}
                onChange={(ev) => setTitulo(ev.target.value)}
                onBlur={commitTitulo}
                onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
                className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-1 font-display text-xl font-semibold leading-tight text-graph outline-none transition hover:border-graph/10 focus:border-brand/60 focus:bg-graph/[0.04] focus:ring-2 focus:ring-brand/15"
              />
              <p className="mt-1.5 flex items-center gap-1.5 px-1 text-sm text-graph-400">
                <MapPin size={14} className="text-brand" /> {prop.zona}
                {prop.provincia ? `, ${prop.provincia}` : ""}
              </p>
            </div>

            {/* métricas (defensivas según categoría) */}
            <div className="grid grid-cols-3 gap-3">
              {esCampo && prop.hectareas !== undefined ? (
                <Stat icon={<Maximize size={15} />} label="Superficie" value={fmtHa(prop.hectareas)} />
              ) : prop.m2cubiertos !== undefined || prop.m2totales !== undefined ? (
                <Stat
                  icon={<Maximize size={15} />}
                  label="Superficie"
                  value={`${prop.m2cubiertos ?? prop.m2totales} m²`}
                  sub={prop.m2cubiertos !== undefined && prop.m2totales !== undefined ? `${prop.m2totales} m² tot.` : undefined}
                />
              ) : (
                <Stat icon={<Maximize size={15} />} label="Superficie" value="—" />
              )}
              {/* precio editable */}
              <div className="pcard-2 p-3">
                <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-graph-400">
                  Precio U$S
                </span>
                <input
                  type="number"
                  value={precio}
                  onChange={(ev) => setPrecio(ev.target.value)}
                  onBlur={commitPrecio}
                  onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
                  placeholder="Consultar"
                  className="mt-1 w-full rounded-md border border-graph/10 bg-graph/[0.04] px-1.5 font-display text-base font-semibold text-graph outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
                />
                {prop.precioPorHa ? <p className="text-[11px] text-graph-400">U$S {prop.precioPorHa}/ha</p> : null}
              </div>
              {esCampo && prop.aptitud ? (
                <Stat label="Aptitud" value={prop.aptitud} />
              ) : (
                <Stat
                  icon={<Home size={15} />}
                  label="Ambientes"
                  value={prop.ambientes !== undefined ? `${prop.ambientes}` : "—"}
                />
              )}
            </div>

            {/* atributos urbanos (si existen) */}
            {!esCampo && (prop.dormitorios !== undefined || prop.banos !== undefined || prop.cocheras !== undefined) && (
              <div className="flex flex-wrap gap-2">
                {prop.dormitorios !== undefined && (
                  <Pill icon={<BedDouble size={13} />}>{prop.dormitorios} dorm.</Pill>
                )}
                {prop.banos !== undefined && <Pill icon={<Bath size={13} />}>{prop.banos} baños</Pill>}
                {prop.cocheras !== undefined && <Pill icon={<Car size={13} />}>{prop.cocheras} coch.</Pill>}
              </div>
            )}

            {/* estado + destacado editables */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graph-400">Estado</span>
                <select
                  value={prop.estado}
                  onChange={(ev) => onUpdate(prop.id, { estado: ev.target.value as Propiedad["estado"] })}
                  className={inputCls}
                >
                  <option value="disponible" className="bg-paper-100 text-graph">Disponible</option>
                  <option value="reservado" className="bg-paper-100 text-graph">Reservado</option>
                  <option value="vendido" className="bg-paper-100 text-graph">Vendido</option>
                </select>
              </label>
              <div className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graph-400">Destacado</span>
                <button
                  onClick={() => onUpdate(prop.id, { destacado: !prop.destacado })}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition",
                    prop.destacado
                      ? "border-brand/40 bg-brand/15 text-brand"
                      : "border-graph/10 bg-graph/[0.04] text-graph-400 hover:text-graph"
                  )}
                >
                  ★ {prop.destacado ? "Destacado" : "Sin destacar"}
                </button>
              </div>
            </div>

            {/* descripción */}
            <div>
              <p className="mt-1 text-sm leading-relaxed text-graph-500">{prop.descripcion}</p>
            </div>

            {/* características */}
            {(prop.caracteristicas?.length ?? 0) > 0 && (
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-graph-400">
                  Características
                </span>
                <div className="flex flex-wrap gap-2">
                  {(prop.caracteristicas ?? []).map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-graph/[0.06] px-2.5 py-1 text-xs font-medium text-graph-500 ring-1 ring-inset ring-graph/10"
                    >
                      <Check size={12} className="text-brand-400" /> {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* toggle publicado en la web -> mapea a destacado */}
            <div className="flex items-center justify-between rounded-xl border border-graph/[0.07] bg-graph/[0.03] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Globe size={17} className="text-graph-400" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-graph">Destacado en la home</p>
                  <p className="text-xs text-graph-400">Aparece en los destacados de potenteprop.com.ar</p>
                </div>
              </div>
              <button
                onClick={() => onUpdate(prop.id, { destacado: !prop.destacado })}
                className={cn(
                  "relative h-6 w-11 rounded-full transition",
                  prop.destacado ? "bg-brand" : "bg-graph/15"
                )}
                aria-label="Publicado"
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                    prop.destacado ? "left-[22px]" : "left-0.5"
                  )}
                />
              </button>
            </div>

            {/* acciones */}
            <div className="flex gap-2 pt-1">
              <Btn
                variant="primary"
                className="flex-1"
                onClick={() => {
                  const precio = prop.categoria === "campo" ? "A consultar" : fmtUSD(prop.precioUSD);
                  const msg = encodeURIComponent(`${prop.titulo} — ${precio} · ${prop.zona}\nMás info: potenteprop.com.ar/propiedad/${prop.id}`);
                  window.open(`https://wa.me/?text=${msg}`, "_blank");
                }}
              >
                <MessageSquare size={15} /> Compartir por WhatsApp
              </Btn>
              <Btn
                variant="ghost"
                className="text-red-700 hover:border-red-400/40 hover:text-red-200"
                onClick={() => {
                  if (window.confirm(`¿Eliminar “${prop.titulo}” de la cartera?`)) {
                    onDelete(prop.id);
                    onClose();
                  }
                }}
              >
                <Trash2 size={15} /> Eliminar
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="pcard-2 p-3">
      <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-graph-400">
        {icon} {label}
      </span>
      <p className="mt-1 font-display text-base font-semibold capitalize text-graph">{value}</p>
      {sub && <p className="text-[11px] text-graph-400">{sub}</p>}
    </div>
  );
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-graph/[0.06] px-2.5 py-1 text-xs font-medium text-graph-500 ring-1 ring-inset ring-graph/10">
      {icon} {children}
    </span>
  );
}
