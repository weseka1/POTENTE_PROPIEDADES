import { Link } from "react-router-dom";
import {
  Landmark,
  Map,
  Inbox,
  Handshake,
  Percent,
  TrendingUp,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useData } from "@/lib/DataProvider";
import { fmtUSD, fmtFecha, fmtNum, desde } from "@/lib/format";
import KpiCard from "../components/KpiCard";
import ChartCard from "../components/ChartCard";
import Badge from "../components/Badge";
import ChannelIcon from "../components/ChannelIcon";
import { PageHeader } from "../components/PageShell";
import { estadoLead, estadoVisita } from "../ui/estados";
import { COLORS, SERIE, tooltipStyle } from "../ui/chartTheme";

export default function Dashboard() {
  const {
    kpis,
    leads,
    visitas,
    propiedades,
    consultasPorMes,
    leadsPorCanal,
    embudo,
    carteraPorAptitud,
    getProp,
  } = useData();

  const ultimasConsultas = [...leads]
    .sort((a, b) => +new Date(b.fechaISO) - +new Date(a.fechaISO))
    .slice(0, 5);

  const proximasVisitas = [...visitas]
    .filter((v) => v.estado !== "realizada" && v.estado !== "cancelada")
    .sort((a, b) => +new Date(a.fechaISO) - +new Date(b.fechaISO))
    .slice(0, 4);

  // Superficie total de la cartera en m² (metros totales o cubiertos de cada propiedad).
  const m2Cartera = propiedades.reduce((a, p) => a + (p.m2totales ?? p.m2cubiertos ?? 0), 0);
  const hoyLargo = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Único delta calculable con datos reales: el ingreso de consultas de este mes vs. el mes
  // anterior, contando por la fecha de cada consulta. Solo se muestra si el mes pasado tiene
  // consultas (sin base de comparación no inventamos un número). Los demás KPIs no tienen
  // histórico cargado, así que van sin delta antes que con un número mentiroso.
  const ahora = new Date();
  const enMes = (iso: string, y: number, m: number) => {
    const d = new Date(iso);
    return d.getFullYear() === y && d.getMonth() === m;
  };
  const mesPrevio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const consultasMesActual = leads.filter((l) => enMes(l.fechaISO, ahora.getFullYear(), ahora.getMonth())).length;
  const consultasMesPrevio = leads.filter((l) => enMes(l.fechaISO, mesPrevio.getFullYear(), mesPrevio.getMonth())).length;
  const deltaConsultas = consultasMesActual - consultasMesPrevio;
  const consultasDelta = consultasMesPrevio > 0 && deltaConsultas !== 0 ? `${deltaConsultas > 0 ? "+" : ""}${deltaConsultas}` : undefined;
  const consultasDeltaDir: "up" | "down" = deltaConsultas >= 0 ? "up" : "down";

  return (
    <div>
      <PageHeader
        title="Buen día, Mateo 👋"
        subtitle={`Resumen operativo de Potente Propiedades · ${hoyLargo}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Valor de cartera"
          value={fmtUSD(kpis.valorCarteraUSD, { short: true })}
          icon={Landmark}
          hint="activos en venta"
          accent="wheat"
        />
        <KpiCard
          label="Propiedades activas"
          value={`${kpis.camposActivos}`}
          icon={Map}
          hint={`de ${kpis.camposTotal} en cartera`}
          accent="field"
        />
        <KpiCard
          label="Consultas nuevas"
          value={`${kpis.leadsNuevos}`}
          icon={Inbox}
          delta={consultasDelta}
          deltaDir={consultasDeltaDir}
          hint={`${consultasMesActual} este mes`}
          accent="clay"
        />
        <KpiCard
          label="En negociación"
          value={`${kpis.enNegociacion}`}
          icon={Handshake}
          hint="operaciones calientes"
          accent="wheat"
        />
        <KpiCard
          label="Comisión proyectada"
          value={fmtUSD(kpis.comisionPipelineUSD, { short: true })}
          icon={TrendingUp}
          hint="proyectado"
          accent="field"
        />
        <KpiCard
          label="Efectividad"
          value={`${kpis.conversion}%`}
          icon={Percent}
          hint="de consulta a venta"
          accent="clay"
        />
      </div>

      {/* Charts + panel lateral */}
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* columna izquierda: gráficos */}
        <div className="space-y-4 xl:col-span-2">
          <ChartCard
            title="Consultas vs. cierres"
            subtitle="Evolución mensual de la demanda"
            right={
              <span className="inline-flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-graph-400">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.wheat }} /> Consultas
                </span>
                <span className="inline-flex items-center gap-1.5 text-graph-400">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.field }} /> Cierres
                </span>
              </span>
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={consultasPorMes} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.ink10} vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: COLORS.ink60 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: COLORS.ink60 }} width={28} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="consultas" name="Consultas" fill={COLORS.wheat} radius={[6, 6, 0, 0]} maxBarSize={34} />
                <Bar dataKey="cierres" name="Cierres" fill={COLORS.field} radius={[6, 6, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ChartCard title="De dónde llegan las consultas" subtitle="WhatsApp, web, mail, teléfono…">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={leadsPorCanal}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {leadsPorCanal.map((_, i) => (
                      <Cell key={i} fill={SERIE[i % SERIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span style={{ color: COLORS.ink60, fontSize: 12 }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Cartera por tipo" subtitle="Valor U$S por tipo de propiedad">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={carteraPorAptitud}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {carteraPorAptitud.map((_, i) => (
                      <Cell key={i} fill={SERIE[i % SERIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: number) => fmtUSD(val, { short: true })}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => (
                      <span style={{ color: COLORS.ink60, fontSize: 12, textTransform: "capitalize" }}>{v}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Embudo de operaciones" subtitle="Cantidad de operaciones por etapa">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={embudo} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.ink10} horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: COLORS.ink60 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="etapa"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: COLORS.ink60 }}
                  width={72}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="cantidad" name="Operaciones" fill={COLORS.clay} radius={[0, 6, 6, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* columna derecha: actividad */}
        <div className="space-y-4">
          {/* últimas consultas */}
          <div className="pcard">
            <div className="flex items-center justify-between border-b border-graph/[0.07] px-5 py-4">
              <h3 className="font-display text-base font-semibold text-graph">Últimas consultas</h3>
              <Link to="/panel/leads" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-600">
                Ver todas <ArrowRight size={13} />
              </Link>
            </div>
            <ul className="divide-y divide-graph/[0.07]">
              {ultimasConsultas.map((l) => {
                const campo = l.campoId ? getProp(l.campoId) : null;
                const e = estadoLead[l.estado];
                return (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-graph/[0.03]">
                    <ChannelIcon canal={l.canal} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-graph">{l.nombre}</p>
                      <p className="truncate text-xs text-graph-400">
                        {campo ? campo.zona : "Consulta general"} · {desde(l.fechaISO)}
                      </p>
                    </div>
                    <Badge tone={e.tone} dot>{e.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* próximas visitas */}
          <div className="pcard">
            <div className="flex items-center justify-between border-b border-graph/[0.07] px-5 py-4">
              <h3 className="font-display text-base font-semibold text-graph">Próximas visitas</h3>
              <Link to="/panel/agenda" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-600">
                Agenda <ArrowRight size={13} />
              </Link>
            </div>
            <ul className="divide-y divide-graph/[0.07]">
              {proximasVisitas.map((v) => {
                const campo = getProp(v.campoId);
                const e = estadoVisita[v.estado];
                return (
                  <li key={v.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-graph/[0.03]">
                    <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-graph/[0.06] text-graph ring-1 ring-inset ring-graph/10">
                      <CalendarClock size={14} className="text-brand" />
                      <span className="text-[10px] font-semibold leading-none">{v.hora}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-graph">{v.clienteNombre}</p>
                      <p className="truncate text-xs text-graph-400">
                        {campo?.zona ?? v.campoId} · {fmtFecha(v.fechaISO)}
                      </p>
                    </div>
                    <Badge tone={e.tone} dot>{e.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* resumen rápido */}
          <div className="rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/[0.12] to-transparent p-5 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-widest2 text-brand">Cartera total</p>
            <p className="mt-2 font-display text-2xl font-semibold text-graph">{fmtNum(m2Cartera)} m²</p>
            <p className="mt-1 text-sm text-graph-400">
              {kpis.camposTotal} propiedades · {kpis.clientes} clientes activos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
