// Genera el PDF de una ficha con la estética de la ficha de papel de Potente Propiedades.
// jsPDF nativo (texto vectorial, nítido). Listo para descargar y mandar a un cliente/compañero.
import { jsPDF } from "jspdf";
import type { Ficha } from "@/data/propiedadTypes";
import { MEJORAS_CAMPO, SERVICIOS, MEJORAS_URB } from "../components/fichaUI";

export type FichaRowPDF = { id: string; tipo: "campo" | "urbano"; titulo: string; zona: string; datos: Ficha };

const GREEN: [number, number, number] = [12, 77, 162];
const GRAPH: [number, number, number] = [26, 29, 26];
const GRAY: [number, number, number] = [120, 124, 120];
const LIGHT: [number, number, number] = [236, 238, 235];

export function descargarFichaPDF(row: FichaRowPDF) {
  const d = row.datos || {};
  const esCampo = row.tipo === "campo";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const CW = W - M * 2;
  let y = 0;

  const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
  const money = (n?: number | null) => (n ? "U$S " + Number(n).toLocaleString("es-AR") : "A consultar");
  const ensure = (h: number) => { if (y + h > H - 46) { doc.addPage(); y = 46; } };

  const section = (t: string) => {
    ensure(30);
    doc.setFillColor(...LIGHT); doc.roundedRect(M, y - 11, CW, 22, 3, 3, "F");
    doc.setTextColor(...GREEN); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
    doc.text(t.toUpperCase(), M + 8, y + 3.5); y += 27;
  };
  const kv = (pairs: [string, string][]) => {
    const colW = CW / 2;
    const items = pairs.filter((p) => p[0]);
    for (let i = 0; i < items.length; i += 2) {
      ensure(30);
      for (let c = 0; c < 2; c++) {
        const p = items[i + c]; if (!p) continue;
        const x = M + c * colW;
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
        doc.text(p[0].toUpperCase(), x, y);
        doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...GRAPH);
        doc.text(doc.splitTextToSize(p[1] || "—", colW - 14), x, y + 13);
      }
      y += 32;
    }
  };
  const checklist = (opts: string[], selected: string[] = []) => {
    const cols = 3; const colW = CW / cols; const rowH = 16;
    const set = new Set(selected);
    for (let i = 0; i < opts.length; i += cols) {
      ensure(rowH);
      for (let c = 0; c < cols; c++) {
        const o = opts[i + c]; if (!o) continue;
        const x = M + c * colW; const on = set.has(o);
        if (on) { doc.setFillColor(...GREEN); doc.roundedRect(x, y - 8, 9, 9, 1.5, 1.5, "F"); }
        else { doc.setDrawColor(...GRAY); doc.setLineWidth(0.7); doc.roundedRect(x, y - 8, 9, 9, 1.5, 1.5, "S"); }
        doc.setTextColor(on ? GRAPH[0] : GRAY[0], on ? GRAPH[1] : GRAY[1], on ? GRAPH[2] : GRAY[2]);
        doc.setFont("helvetica", on ? "bold" : "normal"); doc.setFontSize(8.5);
        doc.text(doc.splitTextToSize(o, colW - 16), x + 14, y);
      }
      y += rowH;
    }
    y += 8;
  };

  // ── Header ──
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 78, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("POTENTE", M, 36);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text("PROPIEDADES  ·  Inmobiliaria  ·  Mar del Plata", M, 52);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(esCampo ? "FICHA DE CAMPO" : "FICHA DE PROPIEDAD", W - M, 36, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text("Fecha: " + (d.fecha || "—"), W - M, 52, { align: "right" });
  y = 104;

  // ── Referencia ──
  doc.setTextColor(...GRAPH); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  const tl = doc.splitTextToSize(row.titulo || "Ficha", CW); doc.text(tl, M, y); y += tl.length * 18 + 2;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GRAY);
  const sub = [esCampo ? "Campo" : cap(d.subtipo), row.zona, d.direccion].filter(Boolean).join("   ·   ");
  if (sub) { doc.text(sub, M, y); y += 8; }
  y += 16;

  // ── Datos principales ──
  section("Datos principales");
  const dp: [string, string][] = [["Operación", esCampo ? cap(d.operacion) : cap(row.tipo)], ["Precio", money(d.precioUSD)]];
  if (esCampo) { dp.push(["Hectáreas", d.hectareas ? d.hectareas + " ha" : "—"], ["Aptitud", cap(d.tipoCampo)]); }
  else { dp.push(["Tipo", cap(d.subtipo)], ["Dirección", d.direccion || "—"]); }
  kv(dp);

  // ── Autorización ──
  section("Autorización");
  checklist(["Autorización de venta", "Cartel", "Apta crédito", "Llaves"], [
    d.autorizacionVenta && "Autorización de venta", d.cartel && "Cartel", d.aptaCredito && "Apta crédito", d.llaves && "Llaves",
  ].filter(Boolean) as string[]);

  if (esCampo) {
    section("Datos del campo");
    kv([
      ["Tipo de campo", cap(d.tipoCampo)], ["Equipo de riego", cap(d.equipoRiego)],
      ["Alambrado perimetral", cap(d.alambradoPerimetral)], ["Alambrado interno", cap(d.alambradoInterno)],
      ["Cancha de", (d.cancha || []).join(", ") || "—"], ["Plantación", (d.plantacion || []).join(", ") || "—"],
    ]);
    section("Mejoras e instalaciones");
    checklist(MEJORAS_CAMPO, d.mejorasCampo || []);
  } else {
    section("Datos de la propiedad");
    kv([
      ["Barrio", d.barrio || "—"], ["Ciudad", d.ciudad || "—"],
      ["Piso / Depto", [d.piso, d.depto].filter(Boolean).join(" / ") || "—"], ["Disposición", cap(d.disposicion)], ["Orientación", d.orientacion || "—"],
      ["Acceso", cap(d.acceso)], ["Antigüedad", d.antiguedad || "—"],
      ["Estado general", d.estadoGeneral || "—"], ["Dimensiones", d.dimensiones || "—"],
      ["Dormitorios", d.dormitorios != null ? String(d.dormitorios) : "—"], ["Baños", d.banos != null ? String(d.banos) : "—"],
      ["Sup. lote", d.superficieLote ? d.superficieLote + " m²" : "—"], ["Sup. cubierta", d.superficieCubierta ? d.superficieCubierta + " m²" : "—"],
      ["Sup. semicubierta", d.superficieSemicubierta ? d.superficieSemicubierta + " m²" : "—"],
    ]);
    section("Servicios"); checklist(SERVICIOS, d.servicios || []);
    section("Comodidades"); checklist(MEJORAS_URB, d.mejorasUrbanas || []);
  }

  // ── Observaciones ──
  if (d.observaciones) {
    section("Observaciones");
    ensure(30); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...GRAPH);
    const obs = doc.splitTextToSize(d.observaciones, CW); doc.text(obs, M, y); y += obs.length * 13 + 10;
  }

  // ── Datos internos ──
  section("Datos internos · uso interno");
  kv([["Propietario", d.propietario || "—"], ["Contacto", d.contacto || "—"], ["Captador", d.captador || "—"]]);

  // ── Footer en todas las páginas ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LIGHT); doc.setLineWidth(1); doc.line(M, H - 34, W - M, H - 34);
    doc.setTextColor(...GRAY); doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    doc.text("Potente Propiedades  ·  Mar del Plata  ·  potenteprop.com.ar", M, H - 24);
    doc.text("Córdoba 3719 (Chauvín) Tel 223 512-9032  ·  Av. de los Trabajadores 2439 (Punta Mogotes) Tel 223 628-2659", M, H - 13);
    doc.text(`${i} / ${pages}`, W - M, H - 24, { align: "right" });
  }

  const nombre = (row.titulo || row.id).replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40) || "Potente";
  doc.save(`Ficha-${nombre}.pdf`);
}
