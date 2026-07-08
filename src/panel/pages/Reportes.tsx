import { useMemo } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDown, FileSpreadsheet } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
import { fmtUSD, fmtNum, fmtHa } from "@/lib/format";
import { PageHeader } from "../components/PageShell";
import ChartCard from "../components/ChartCard";
import { Btn } from "../components/Controls";
import { useToast } from "../components/Toast";
import { canalLabel } from "../ui/estados";
import { COLORS, SERIE, tooltipStyle } from "../ui/chartTheme";

export default function Reportes() {
  const { push } = useToast();
  const { propiedades, leads, consultasPorMes, carteraPorAptitud } = useData();

  // Propiedades por zona (cantidad + ha + valor) — ha sólo donde exista (rurales).
  const porZona = useMemo(() => {
    const map = new Map<string, { zona: string; campos: number; ha: number; valor: number }>();
    propiedades.forEach((c) => {
      const cur = map.get(c.zona) ?? { zona: c.zona, campos: 0, ha: 0, valor: 0 };
      cur.campos += 1;
      cur.ha += c.hectareas ?? 0;
      cur.valor += c.precioUSD ?? 0;
      map.set(c.zona, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [propiedades]);

  // Conversión por canal (consultas vs cerrados)
  const porCanal = useMemo(() => {
    const map = new Map<string, { canal: string; total: number; cerrados: number }>();
    leads.forEach((l) => {
      const cur = map.get(l.canal) ?? { canal: l.canal, total: 0, cerrados: 0 };
      cur.total += 1;
      if (l.estado === "cerrado") cur.cerrados += 1;
      map.set(l.canal, cur);
    });
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        nombre: canalLabel[r.canal] ?? r.canal,
        conv: r.total ? Math.round((r.cerrados / r.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [leads]);

  // Valor por aptitud para barras
  const valorAptitud = carteraPorAptitud.map((d) => ({ ...d, name: d.name }));

  const totProp = porZona.reduce((a, r) => a + r.campos, 0);
  const totHa = porZona.reduce((a, r) => a + r.ha, 0);
  const totVal = porZona.reduce((a, r) => a + r.valor, 0);

  // PDF real con jsPDF: cabecera de marca + resumen + dos tablas, y descarga directa.
  const exportarPDF = () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const hoy = new Date();
      const fechaTxt = hoy.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

      doc.setFillColor(12, 77, 162);
      doc.rect(0, 0, W, 72, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(18);
      doc.text("Potente Propiedades", 40, 34);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text("Inmobiliaria · Mar del Plata", 40, 51);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("Reporte de gestión", W - 40, 34, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(fechaTxt, W - 40, 51, { align: "right" });

      doc.setTextColor(35, 35, 35); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Resumen de cartera", 40, 104);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(95, 95, 95);
      doc.text(`${totProp} propiedades  ·  ${fmtNum(totHa)} ha  ·  ${fmtUSD(totVal, { short: true })} en cartera`, 40, 121);

      autoTable(doc, {
        startY: 138,
        head: [["Zona", "Propiedades", "Ticket prom.", "Valor"]],
        body: porZona.map((r) => [r.zona, String(r.campos), r.valor && r.campos ? fmtUSD(r.valor / r.campos, { short: true }) : "—", r.valor ? fmtUSD(r.valor, { short: true }) : "—"]),
        foot: [["Total", String(totProp), "—", fmtUSD(totVal, { short: true })]],
        headStyles: { fillColor: [12, 77, 162], textColor: 255, fontStyle: "bold" },
        footStyles: { fillColor: [240, 237, 228], textColor: 35, fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 5 },
        alternateRowStyles: { fillColor: [248, 246, 240] },
        columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
        margin: { left: 40, right: 40 },
      });

      const y = (doc as any).lastAutoTable.finalY + 26;
      doc.setTextColor(35, 35, 35); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Conversión por canal", 40, y);
      autoTable(doc, {
        startY: y + 12,
        head: [["Canal", "Consultas", "Cerradas", "Conversión"]],
        body: porCanal.map((r) => [r.nombre, String(r.total), String(r.cerrados), `${r.conv}%`]),
        headStyles: { fillColor: [12, 77, 162], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 5 },
        alternateRowStyles: { fillColor: [248, 246, 240] },
        columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "right" } },
        margin: { left: 40, right: 40 },
      });

      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text("Generado por el panel de Potente Propiedades · potenteprop.com.ar", 40, ph - 24);

      doc.save(`Potente-Reporte-${hoy.toISOString().slice(0, 10)}.pdf`);
      push("Reporte PDF descargado ✓", "success");
    } catch {
      push("No se pudo generar el PDF", "error");
    }
  };

  // Excel real: CSV (separador ; para que Excel en español lo abra en columnas) con BOM para acentos.
  const exportarExcel = () => {
    try {
      const hoy = new Date();
      const esc = (v: any) => {
        const s = String(v ?? "");
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows: (string | number)[][] = [];
      rows.push(["Potente Propiedades — Reporte de gestión", hoy.toLocaleDateString("es-AR")]);
      rows.push([]);
      rows.push(["Cartera por zona"]);
      rows.push(["Zona", "Propiedades", "Ticket promedio USD", "Valor USD"]);
      porZona.forEach((r) => rows.push([r.zona, r.campos, r.campos ? Math.round(r.valor / r.campos) : 0, Math.round(r.valor)]));
      rows.push(["Total", totProp, "", Math.round(totVal)]);
      rows.push([]);
      rows.push(["Conversión por canal"]);
      rows.push(["Canal", "Consultas", "Cerradas", "Conversión %"]);
      porCanal.forEach((r) => rows.push([r.nombre, r.total, r.cerrados, r.conv]));

      const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Potente-Reporte-${hoy.toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      push("Reporte Excel descargado ✓", "success");
    } catch {
      push("No se pudo generar el Excel", "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Análisis de cartera, demanda y resultados"
        actions={
          <>
            <Btn variant="ghost" onClick={exportarExcel}>
              <FileSpreadsheet size={16} /> Exportar Excel
            </Btn>
            <Btn variant="primary" onClick={exportarPDF}>
              <FileDown size={16} /> Exportar PDF
            </Btn>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* tendencia consultas (área) */}
        <ChartCard title="Tendencia de consultas" subtitle="Demanda acumulada en el semestre" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={consultasPorMes}>
              <defs>
                <linearGradient id="gWheat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.wheat} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLORS.wheat} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gField" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.field} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.field} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.ink10} vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: COLORS.ink60 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: COLORS.ink60 }} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="consultas" name="Consultas" stroke={COLORS.wheat} strokeWidth={2.5} fill="url(#gWheat)" />
              <Area type="monotone" dataKey="cierres" name="Cierres" stroke={COLORS.field} strokeWidth={2.5} fill="url(#gField)" />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: COLORS.ink60, fontSize: 12 }}>{v}</span>} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* valor por tipo (barras) */}
        <ChartCard title="Valor de cartera por tipo" subtitle="U$S por tipo de propiedad">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={valorAptitud}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.ink10} vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: COLORS.ink60, textTransform: "capitalize" } as any} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: COLORS.ink60 }} width={44} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtUSD(v, { short: true })} />
              <Bar dataKey="value" name="Valor" radius={[6, 6, 0, 0]} maxBarSize={60}>
                {valorAptitud.map((_, i) => (
                  <Cell key={i} fill={SERIE[i % SERIE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* consultas por canal (donut) */}
        <ChartCard title="Distribución de consultas" subtitle="Por dónde llegan">
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={porCanal} dataKey="total" nameKey="nombre" innerRadius={50} outerRadius={78} paddingAngle={3} stroke="none">
                {porCanal.map((_, i) => (
                  <Cell key={i} fill={SERIE[i % SERIE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: COLORS.ink60, fontSize: 12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* tablas resumen */}
      <div className="mt-4 grid grid-cols-1 gap-4">
        {/* campos por zona */}
        <div className="pcard overflow-hidden">
          <div className="border-b border-graph/[0.07] px-5 py-4">
            <h3 className="font-display text-base font-semibold text-graph">Cartera por zona</h3>
            <p className="text-xs text-graph-400">Distribución geográfica de la cartera</p>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b border-graph/[0.07] bg-graph/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-graph-400">
                <th className="px-5 py-2.5">Zona</th>
                <th className="px-5 py-2.5 text-center">Propiedades</th>
                <th className="px-5 py-2.5 text-right">Ticket prom.</th>
                <th className="px-5 py-2.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graph/[0.07]">
              {porZona.map((r) => (
                <tr key={r.zona} className="transition hover:bg-graph/[0.03]">
                  <td className="px-5 py-2.5 font-medium text-graph">{r.zona}</td>
                  <td className="px-5 py-2.5 text-center text-graph-500">{r.campos}</td>
                  <td className="px-5 py-2.5 text-right text-graph-500">{r.valor && r.campos ? fmtUSD(r.valor / r.campos, { short: true }) : "—"}</td>
                  <td className="px-5 py-2.5 text-right font-display font-semibold text-graph">
                    {r.valor ? fmtUSD(r.valor, { short: true }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-graph/[0.07] bg-graph/[0.04] font-semibold text-graph">
                <td className="px-5 py-2.5">Total</td>
                <td className="px-5 py-2.5 text-center">{porZona.reduce((a, r) => a + r.campos, 0)}</td>
                <td className="px-5 py-2.5 text-right text-graph-400">—</td>
                <td className="px-5 py-2.5 text-right font-display">{fmtUSD(porZona.reduce((a, r) => a + r.valor, 0), { short: true })}</td>
              </tr>
            </tfoot>
          </table></div>
        </div>

        {/* conversión por canal */}
        <div className="pcard overflow-hidden">
          <div className="border-b border-graph/[0.07] px-5 py-4">
            <h3 className="font-display text-base font-semibold text-graph">Conversión por canal</h3>
            <p className="text-xs text-graph-400">Efectividad de cada fuente de consultas</p>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b border-graph/[0.07] bg-graph/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-graph-400">
                <th className="px-5 py-2.5">Canal</th>
                <th className="px-5 py-2.5 text-center">Consultas</th>
                <th className="px-5 py-2.5 text-center">Cerradas</th>
                <th className="px-5 py-2.5 text-right">Conversión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graph/[0.07]">
              {porCanal.map((r) => (
                <tr key={r.canal} className="transition hover:bg-graph/[0.03]">
                  <td className="px-5 py-2.5 font-medium text-graph">{r.nombre}</td>
                  <td className="px-5 py-2.5 text-center text-graph-500">{r.total}</td>
                  <td className="px-5 py-2.5 text-center text-graph-500">{r.cerrados}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-graph/[0.08] sm:inline-block">
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(r.conv, 100)}%` }} />
                      </span>
                      <span className="font-display font-semibold text-graph">{r.conv}%</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
