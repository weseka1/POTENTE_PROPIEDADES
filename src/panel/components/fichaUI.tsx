// ===== UI compartida de la ficha (estilo papel Potente) =====
// Constantes + piezas de formulario + las secciones campo/urbano/interno.
// Se usa en la sección "Fichas" del panel. Lo interno queda marcado "no se publica".
import { Lock, ClipboardCheck, Ruler, FileText } from "lucide-react";
import type { Ficha } from "@/data/propiedadTypes";

// ── Opciones (réplica del papel) ──
export const TIPOS_CAMPO = [
  { v: "agrícola", l: "Agrícola" }, { v: "ganadero", l: "Ganadero" }, { v: "mixto", l: "Mixto" }, { v: "monte", l: "Monte" },
];
export const NIVEL = [{ v: "bueno", l: "Bueno" }, { v: "regular", l: "Regular" }, { v: "malo", l: "Malo" }];
export const RIEGO = [{ v: "pivote central", l: "Pivote central" }, { v: "subterráneo", l: "Subterráneo" }, { v: "cañón", l: "Cañón" }];
export const CANCHAS = ["Fútbol", "Básquet", "Tenis"];
export const PLANTACION = ["Olivos", "Almendras", "Nogales"];
export const MEJORAS_CAMPO = [
  "Canon de riego", "Feedlot", "Tanques australianos", "Galpones", "Potreros", "Molinos", "Tajamar",
  "Tinglados", "Perforaciones", "Silos", "Cuadros", "Bomba sumergible", "Manga y corrales",
  "Casa principal", "Casa para encargado", "Casa para personal", "Forestación", "Parque", "Pileta",
  "Electrificación rural", "Internet", "Turismo", "Pista de aterrizaje", "Arroyo", "Acueducto", "Balanza", "Zeppelin",
];
export const SERVICIOS = ["Luz", "Agua", "Gas", "Cloacas", "Asfalto"];
export const ORIENTACION = [{ v: "frente", l: "Frente" }, { v: "contrafrente", l: "Contrafrente" }];
export const ACCESO = [{ v: "escalera", l: "Escalera" }, { v: "ascensor", l: "Ascensor" }];
export const MEJORAS_URB = [
  "Lavadero", "Quincho", "Pileta", "Aire acondicionado", "Calefacción", "Pisos", "Perforación",
  "Riego", "Expensas", "Ascensores", "Patio", "Amenities", "Cochera", "Balcón", "Living", "Comedor", "Cocina",
];
export const SUBTIPOS = [
  { v: "casa", l: "Casa" }, { v: "departamento", l: "Departamento" }, { v: "local", l: "Local" },
  { v: "oficina", l: "Oficina" }, { v: "lote", l: "Lote" }, { v: "cochera", l: "Cochera" },
  { v: "galpón", l: "Galpón" }, { v: "dúplex", l: "Dúplex" }, { v: "complejo", l: "Complejo" },
  { v: "fondo de comercio", l: "Fondo de comercio" },
];

// ── Piezas de formulario ──
export function Campo({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-full" : ""}`}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest2 text-graph-400">{label}</span>
      {children}
    </label>
  );
}
export function SubLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[11px] font-medium uppercase tracking-widest2 text-graph-400">{children}</span>;
}
export function Inp({ value, onChange, ph, type = "text" }: { value: any; onChange: (v: string) => void; ph?: string; type?: string }) {
  return <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={ph} className="h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60" />;
}
export function Sel({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: { v: string; l: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph outline-none transition focus:border-brand/60">
      {opts.map((o) => <option key={o.v} value={o.v} className="bg-paper-100 text-graph">{o.l}</option>)}
    </select>
  );
}
export function Toggle({ label, v, on }: { label: string; v: boolean; on: () => void }) {
  return (
    <button type="button" onClick={on} className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm text-graph">
      <span>{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${v ? "bg-brand" : "bg-graph/15"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${v ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
export function Chips({ opts, value = [], onToggle }: { opts: string[]; value?: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => {
        const on = value.includes(o);
        return (
          <button type="button" key={o} onClick={() => onToggle(o)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-brand bg-brand text-white" : "border-graph/15 bg-graph/[0.03] text-graph-500 hover:border-brand/40 hover:text-graph"}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
export function Seg({ opts, value, onChange }: { opts: { v: string; l: string }[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <button type="button" key={o.v} onClick={() => onChange(on ? "" : o.v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${on ? "border-brand bg-brand text-white" : "border-graph/15 bg-graph/[0.03] text-graph-500 hover:border-brand/40 hover:text-graph"}`}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

// ── Secciones de la ficha (campo/urbano + interno) ──
export function FichaSecciones({
  ficha,
  esCampo,
  setFicha,
  toggleFicha,
  num,
}: {
  ficha: Ficha;
  esCampo: boolean;
  setFicha: (k: keyof Ficha, v: any) => void;
  toggleFicha: (k: keyof Ficha, item: string) => void;
  num: (v: any) => number | undefined;
}) {
  return (
    <>
      {/* Datos principales (cabecera del papel) */}
      <section className="pcard p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-graph"><FileText size={16} className="text-brand" /> Datos principales</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo label="Fecha"><Inp type="date" value={ficha.fecha} onChange={(v) => setFicha("fecha", v)} /></Campo>
          <Campo label="Precio (U$S) — vacío = A consultar"><Inp type="number" value={ficha.precioUSD ?? ""} onChange={(v) => setFicha("precioUSD", v === "" ? null : num(v))} ph="A consultar" /></Campo>
          {esCampo && <Campo label="Hectáreas"><Inp type="number" value={ficha.hectareas} onChange={(v) => setFicha("hectareas", num(v))} ph="800" /></Campo>}
        </div>
        {esCampo && (
          <div className="mt-4"><SubLabel>Operación</SubLabel><Seg opts={[{ v: "venta", l: "Venta" }, { v: "arrendamiento", l: "Arrendamiento" }]} value={ficha.operacion} onChange={(v) => setFicha("operacion", v)} /></div>
        )}
      </section>

      {/* Ficha CAMPO */}
      {esCampo && (
        <section className="pcard p-5">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-graph"><ClipboardCheck size={16} className="text-brand" /> Ficha del campo</h3>
          <div className="space-y-5">
            <div><SubLabel>Tipo de campo</SubLabel><Seg opts={TIPOS_CAMPO} value={ficha.tipoCampo} onChange={(v) => setFicha("tipoCampo", v)} /></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><SubLabel>Alambrado perimetral</SubLabel><Seg opts={NIVEL} value={ficha.alambradoPerimetral} onChange={(v) => setFicha("alambradoPerimetral", v)} /></div>
              <div><SubLabel>Alambrado interno</SubLabel><Seg opts={NIVEL} value={ficha.alambradoInterno} onChange={(v) => setFicha("alambradoInterno", v)} /></div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><SubLabel>Equipo de riego</SubLabel><Seg opts={RIEGO} value={ficha.equipoRiego} onChange={(v) => setFicha("equipoRiego", v)} /></div>
              <div><SubLabel>Cancha de</SubLabel><Chips opts={CANCHAS} value={ficha.cancha} onToggle={(v) => toggleFicha("cancha", v)} /></div>
            </div>
            <div><SubLabel>Plantación de</SubLabel><Chips opts={PLANTACION} value={ficha.plantacion} onToggle={(v) => toggleFicha("plantacion", v)} /></div>
            <div><SubLabel>Mejoras e instalaciones</SubLabel><Chips opts={MEJORAS_CAMPO} value={ficha.mejorasCampo} onToggle={(v) => toggleFicha("mejorasCampo", v)} /></div>
          </div>
        </section>
      )}

      {/* Ficha URBANA */}
      {!esCampo && (
        <section className="pcard p-5">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-graph"><Ruler size={16} className="text-brand" /> Ficha de la propiedad</h3>
          <div className="space-y-5">
            <div><SubLabel>Tipo</SubLabel><Seg opts={SUBTIPOS} value={ficha.subtipo} onChange={(v) => setFicha("subtipo", v)} /></div>
            <Campo label="Dirección"><Inp value={ficha.direccion} onChange={(v) => setFicha("direccion", v)} ph="Av. Colón 3537" /></Campo>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Barrio"><Inp value={ficha.barrio} onChange={(v) => setFicha("barrio", v)} ph="Centro" /></Campo>
              <Campo label="Ciudad"><Inp value={ficha.ciudad} onChange={(v) => setFicha("ciudad", v)} ph="Mar del Plata" /></Campo>
              <Campo label="Antigüedad"><Inp value={ficha.antiguedad} onChange={(v) => setFicha("antiguedad", v)} ph="Ej: 10 años / a estrenar" /></Campo>
              <Campo label="Piso N°"><Inp value={ficha.piso} onChange={(v) => setFicha("piso", v)} ph="3" /></Campo>
              <Campo label="Depto"><Inp value={ficha.depto} onChange={(v) => setFicha("depto", v)} ph="B" /></Campo>
              <Campo label="Estado general"><Inp value={ficha.estadoGeneral} onChange={(v) => setFicha("estadoGeneral", v)} ph="Muy bueno" /></Campo>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><SubLabel>Orientación</SubLabel><Seg opts={ORIENTACION} value={ficha.orientacion} onChange={(v) => setFicha("orientacion", v)} /></div>
              <div><SubLabel>Acceso</SubLabel><Seg opts={ACCESO} value={ficha.acceso} onChange={(v) => setFicha("acceso", v)} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Sup. lote (m²)"><Inp value={ficha.superficieLote} onChange={(v) => setFicha("superficieLote", num(v))} ph="300" type="number" /></Campo>
              <Campo label="Sup. cubierta (m²)"><Inp value={ficha.superficieCubierta} onChange={(v) => setFicha("superficieCubierta", num(v))} ph="120" type="number" /></Campo>
              <Campo label="Sup. semicubierta (m²)"><Inp value={ficha.superficieSemicubierta} onChange={(v) => setFicha("superficieSemicubierta", num(v))} ph="20" type="number" /></Campo>
              <Campo label="Dimensiones"><Inp value={ficha.dimensiones} onChange={(v) => setFicha("dimensiones", v)} ph="10 x 30" /></Campo>
              <Campo label="Dormitorios"><Inp value={ficha.dormitorios} onChange={(v) => setFicha("dormitorios", num(v))} ph="3" type="number" /></Campo>
              <Campo label="Baños"><Inp value={ficha.banos} onChange={(v) => setFicha("banos", num(v))} ph="2" type="number" /></Campo>
            </div>
            <div><SubLabel>Servicios</SubLabel><Chips opts={SERVICIOS} value={ficha.servicios} onToggle={(v) => toggleFicha("servicios", v)} /></div>
            <div><SubLabel>Comodidades</SubLabel><Chips opts={MEJORAS_URB} value={ficha.mejorasUrbanas} onToggle={(v) => toggleFicha("mejorasUrbanas", v)} /></div>
          </div>
        </section>
      )}

      {/* Flags de la ficha */}
      <section className="pcard p-5">
        <h3 className="mb-3 font-display text-base font-semibold text-graph">Autorización</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Autorización de venta" v={!!ficha.autorizacionVenta} on={() => setFicha("autorizacionVenta", !ficha.autorizacionVenta)} />
          <Toggle label="Cartel" v={!!ficha.cartel} on={() => setFicha("cartel", !ficha.cartel)} />
          <Toggle label="Apta crédito" v={!!ficha.aptaCredito} on={() => setFicha("aptaCredito", !ficha.aptaCredito)} />
          <Toggle label="Llaves" v={!!ficha.llaves} on={() => setFicha("llaves", !ficha.llaves)} />
        </div>
      </section>

      {/* 🔒 DATOS INTERNOS — no se publican */}
      <section className="pcard border-amber-500/25 bg-amber-500/[0.03] p-5">
        <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-graph"><Lock size={15} className="text-amber-600" /> Datos internos</h3>
        <p className="mb-4 text-xs text-amber-700/90">🔒 Solo Potente — <b>NO aparecen en la web</b>.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo label="Propietario"><Inp value={ficha.propietario} onChange={(v) => setFicha("propietario", v)} ph="Nombre del dueño" /></Campo>
          <Campo label="Contacto del dueño"><Inp value={ficha.contacto} onChange={(v) => setFicha("contacto", v)} ph="Teléfono / email" /></Campo>
          <Campo label="Captador"><Inp value={ficha.captador} onChange={(v) => setFicha("captador", v)} ph="Quién captó" /></Campo>
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest2 text-graph-400">Observaciones internas</span>
          <textarea
            value={ficha.observaciones || ""}
            onChange={(e) => setFicha("observaciones", e.target.value)}
            rows={3}
            placeholder="Notas internas de la captación…"
            className="w-full rounded-xl border border-graph/10 bg-graph/[0.04] p-3 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand/60"
          />
        </label>
      </section>
    </>
  );
}
