import { useEffect, useRef, useState } from "react";
import {
  Minus, Spline, Pencil, Square, Eraser, Hand, Type, MoveHorizontal,
  Undo2, Redo2, Trash2, Download, Save, Grid3x3, Magnet, Check, Ruler, Box,
  Image as ImageIcon, Upload, ZoomIn, ZoomOut, Move, X, Crosshair,
  DoorOpen, AppWindow, Home, GitCommitHorizontal, MoreHorizontal, StretchHorizontal,
  Columns2, Layers, Plus, Copy, Maximize2, Minimize2,
} from "lucide-react";
import Plan3D from "./Plan3D";
import Select from "@/components/Select";

type Pt = { x: number; y: number };
type Shape = {
  type: "recta" | "curva" | "lapiz" | "rect" | "cota" | "label" | "puerta" | "ventana" | "eje" | "oculta" | "escalera" | "columna";
  pts: Pt[];
  color: string;
  width: number;
  text?: string;
};

/* nombre de piso por índice */
const floorName = (i: number) => (i === 0 ? "Planta baja" : `${i}° piso`);

const COLORS = ["#11100B", "#0C4DA2", "#C9A24E", "#9C6B3C", "#1d4ed8", "#9aa0a6"];
const GRID = 26; // px por cuadro de la grilla (fijo)

/* presets de escala: cuántos metros mide UN cuadro de la grilla */
const SCALES = [
  { m: 0.25, label: "0,25 m" },
  { m: 0.5, label: "0,50 m" },
  { m: 1, label: "1 m" },
  { m: 2, label: "2 m" },
  { m: 5, label: "5 m" },
  { m: 10, label: "10 m" },
  { m: 25, label: "25 m" },
  { m: 50, label: "50 m" },
];

type Hooks = {
  onChange?: () => void;
  onTextRequest?: (screen: Pt, world: Pt) => void;
  onCalibrate?: (screen: Pt) => void;
};

/* ============ planta de ejemplo (casa de campo, vista desde arriba) ============
   1 cuadro = 0,50 m → 1 metro = 52 px. Casa de 10 × 7 m, estar-cocina + 2 dormitorios. */
const EXAMPLE_PLAN: Shape[] = [
  { type: "rect", pts: [{ x: 130, y: 130 }, { x: 650, y: 494 }], color: "#11100B", width: 5 },      // contorno exterior
  { type: "recta", pts: [{ x: 442, y: 130 }, { x: 442, y: 494 }], color: "#11100B", width: 4 },     // divisoria estar | dormitorios
  { type: "recta", pts: [{ x: 442, y: 312 }, { x: 650, y: 312 }], color: "#11100B", width: 4 },     // divisoria entre dormitorios
  { type: "puerta", pts: [{ x: 264, y: 494 }, { x: 311, y: 494 }], color: "#11100B", width: 2 },    // entrada
  { type: "puerta", pts: [{ x: 442, y: 210 }, { x: 442, y: 258 }], color: "#11100B", width: 2 },    // estar → dormitorio
  { type: "puerta", pts: [{ x: 520, y: 312 }, { x: 568, y: 312 }], color: "#11100B", width: 2 },    // entre dormitorios
  { type: "ventana", pts: [{ x: 130, y: 200 }, { x: 130, y: 260 }], color: "#11100B", width: 2 },   // estar (oeste)
  { type: "ventana", pts: [{ x: 220, y: 130 }, { x: 280, y: 130 }], color: "#11100B", width: 2 },   // estar (norte)
  { type: "ventana", pts: [{ x: 650, y: 180 }, { x: 650, y: 240 }], color: "#11100B", width: 2 },   // dormitorio 1 (este)
  { type: "ventana", pts: [{ x: 650, y: 380 }, { x: 650, y: 440 }], color: "#11100B", width: 2 },   // dormitorio 2 (este)
  { type: "label", pts: [{ x: 286, y: 312 }], color: "#0C4DA2", width: 0, text: "Estar · Cocina" },
  { type: "label", pts: [{ x: 546, y: 221 }], color: "#0C4DA2", width: 0, text: "Dormitorio" },
  { type: "label", pts: [{ x: 546, y: 403 }], color: "#0C4DA2", width: 0, text: "Dormitorio" },
];

/* ============ motor de dibujo (canvas vanilla, manejado por React) ============ */
function makeEngine(canvas: HTMLCanvasElement, wrap: HTMLElement, hooks: Hooks) {
  const ctx = canvas.getContext("2d")!;
  let DPR = 1, CW = 0, CH = 0;

  const opts = {
    tool: "recta", color: "#11100B", width: 3,
    grid: true, snap: true, measures: true, frame: true,
    mPerCell: 0.5, unit: "auto" as "auto" | "m2" | "ha",
    bgOpacity: 0.5,
    meta: { propName: "Plano", dateText: "" },
  };
  const mpu = () => opts.mPerCell / GRID; // world units → metros

  const st: any = {
    shapes: [] as Shape[], current: null as Shape | null, undo: [] as string[], redo: [] as string[],
    view: { scale: 1, ox: 0, oy: 0 }, pointers: new Map(), gesture: null, panning: null,
    drawing: false, activePen: false, snapInd: null as Pt | null, editIdx: null as number | null,
    bg: null as any, adjustBg: false, bgDrag: null as any,
    calibrating: false, lastCalibLen: 0,
    floors: [] as { name: string; shapes: Shape[] }[], active: 0,
  };
  st.floors = [{ name: floorName(0), shapes: st.shapes }]; // el piso activo comparte el array con st.shapes
  // reasignar el array de formas manteniendo el vínculo con el piso activo
  const setShapesArr = (arr: Shape[]) => { st.shapes = arr; if (st.floors[st.active]) st.floors[st.active].shapes = arr; };
  const changed = () => hooks.onChange?.();

  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const toWorld = (sx: number, sy: number) => ({ x: (sx - st.view.ox) / st.view.scale, y: (sy - st.view.oy) / st.view.scale });
  const w2s = (p: Pt) => ({ x: p.x * st.view.scale + st.view.ox, y: p.y * st.view.scale + st.view.oy });
  const snap = (p: Pt) => opts.snap ? { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID } : { x: p.x, y: p.y };

  // ----- snapping profesional: engancha a extremos + traba perpendicular/45° + grilla -----
  function rectCorners(sh: Shape) { const a = sh.pts[0], b = sh.pts[1]; return [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]; }
  function endpoints(): Pt[] { const o: Pt[] = []; for (const sh of st.shapes) { if (sh.type === "rect") o.push(...rectCorners(sh)); else if (sh.type === "label" || sh.type === "puerta" || sh.type === "ventana") continue; else if (sh.pts.length) { o.push(sh.pts[0]); o.push(sh.pts[sh.pts.length - 1]); } } return o; }
  function nearestVertex(p: Pt): Pt | null { const tol = 26 / st.view.scale; let best: Pt | null = null, bd = tol; for (const v of endpoints()) { const d = Math.hypot(v.x - p.x, v.y - p.y); if (d < bd) { bd = d; best = v; } } return best ? { x: best.x, y: best.y } : null; }
  function resolveStart(w: Pt): Pt { if (!opts.snap) return { ...w }; return nearestVertex(w) || snap(w); }
  function resolveEnd(start: Pt, w: Pt): { p: Pt; snap: boolean } {
    if (!opts.snap) return { p: { ...w }, snap: false };
    const v = nearestVertex(w); if (v) return { p: v, snap: true };
    let end = { x: w.x, y: w.y };
    const dx = end.x - start.x, dy = end.y - start.y, len = Math.hypot(dx, dy);
    if (len > 2) {
      let ang = Math.atan2(dy, dx); const sa = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
      let d = Math.abs(sa - ang); if (d > Math.PI) d = 2 * Math.PI - d; if (d < 0.39) ang = sa;
      end = { x: start.x + Math.cos(ang) * len, y: start.y + Math.sin(ang) * len };
    }
    return { p: snap(end), snap: false };
  }
  function resolveRect(w: Pt): { p: Pt; snap: boolean } { if (!opts.snap) return { p: { ...w }, snap: false }; const v = nearestVertex(w); if (v) return { p: v, snap: true }; return { p: snap(w), snap: false }; }

  function pushUndo() { st.undo.push(JSON.stringify(st.shapes)); if (st.undo.length > 80) st.undo.shift(); st.redo.length = 0; }

  /* ---- formato de medidas (respeta escala y unidad) ---- */
  function fmtLen(m: number) {
    if (m >= 1000) return (m / 1000).toFixed(m >= 10000 ? 1 : 2).replace(".", ",") + " km";
    return (m < 10 ? m.toFixed(2) : m.toFixed(1)).replace(".", ",") + " m";
  }
  function fmtArea(m2: number) {
    const ha = opts.unit === "ha" || (opts.unit === "auto" && m2 >= 10000);
    if (ha) return (m2 / 10000).toFixed(2).replace(".", ",") + " ha";
    return (m2 >= 100 ? m2.toFixed(0) : m2.toFixed(1)).replace(".", ",") + " m²";
  }

  /* Catmull-Rom → bézier */
  function smoothPath(pts: Pt[]) {
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      ctx.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
    }
  }
  // ----- aberturas (símbolo de plano: vano + jambas + barrido/marco) -----
  function drawOpening(sh: Shape) {
    if (sh.pts.length < 2) return;
    const a = sh.pts[0], b = sh.pts[1];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy); if (L < 1) return;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hw = 3.4; // medio espesor del muro
    ctx.lineJoin = "round";
    // 1) abrir el vano (borra el muro y la grilla que pasa por debajo)
    ctx.strokeStyle = "#fbfbf8"; ctx.lineCap = "butt"; ctx.lineWidth = hw * 2 + 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // 2) jambas (las caras del muro a cada lado del vano)
    ctx.strokeStyle = "#11100B"; ctx.lineCap = "round"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * hw, a.y + ny * hw); ctx.lineTo(a.x - nx * hw, a.y - ny * hw);
    ctx.moveTo(b.x + nx * hw, b.y + ny * hw); ctx.lineTo(b.x - nx * hw, b.y - ny * hw);
    ctx.stroke();
    if (sh.type === "ventana") {
      ctx.strokeStyle = "#11100B"; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(a.x + nx * hw, a.y + ny * hw); ctx.lineTo(b.x + nx * hw, b.y + ny * hw);
      ctx.moveTo(a.x - nx * hw, a.y - ny * hw); ctx.lineTo(b.x - nx * hw, b.y - ny * hw);
      ctx.stroke();
      ctx.strokeStyle = "#1d4ed8"; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else {
      // puerta: hoja (bisagra en a) + arco de barrido de 90°
      ctx.strokeStyle = "#11100B"; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + nx * L, a.y + ny * L); ctx.stroke();
      ctx.strokeStyle = "rgba(17,16,11,0.45)"; ctx.lineWidth = 1;
      const a0 = Math.atan2(uy, ux), a1 = Math.atan2(ny, nx);
      let dd = a1 - a0; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
      ctx.beginPath(); ctx.arc(a.x, a.y, L, a0, a0 + dd, dd < 0); ctx.stroke();
    }
  }

  // ----- columna (pilar): cuadrado relleno -----
  function drawColumna(sh: Shape) {
    const c = sh.pts[0]; const s = sh.width || 10;
    ctx.setLineDash([]); ctx.fillStyle = "#11100B"; ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(c.x - s / 2, c.y - s / 2, s, s);
  }
  // ----- escalera: contorno + peldaños + flecha de subida -----
  function drawEscalera(sh: Shape) {
    if (sh.pts.length < 2) return;
    const a = sh.pts[0], b = sh.pts[1];
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const w = x1 - x0, h = y1 - y0; if (w < 2 || h < 2) return;
    ctx.setLineDash([]); ctx.strokeStyle = "#11100B"; ctx.lineWidth = 1.5; ctx.lineJoin = "round";
    ctx.strokeRect(x0, y0, w, h);
    const alongX = w >= h, n = Math.max(3, Math.round((alongX ? w : h) / 12));
    ctx.lineWidth = 1;
    for (let i = 1; i < n; i++) { const t = i / n; ctx.beginPath(); if (alongX) { const x = x0 + w * t; ctx.moveTo(x, y0); ctx.lineTo(x, y1); } else { const y = y0 + h * t; ctx.moveTo(x0, y); ctx.lineTo(x1, y); } ctx.stroke(); }
    // flecha "sube" en el eje largo (de a → b)
    ctx.strokeStyle = "#0C4DA2"; ctx.lineWidth = 1.7;
    let sx, sy, ex, ey;
    if (alongX) { sx = (a.x <= b.x ? x0 : x1); ex = (a.x <= b.x ? x1 : x0); sy = ey = (y0 + y1) / 2; }
    else { sy = (a.y <= b.y ? y0 : y1); ey = (a.y <= b.y ? y1 : y0); sx = ex = (x0 + x1) / 2; }
    sx += (ex - sx) * 0.12; sy += (ey - sy) * 0.12; ex -= (ex - sx) * 0.04; ey -= (ey - sy) * 0.04;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    const ang = Math.atan2(ey - sy, ex - sx);
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(ang - 0.4) * 7, ey - Math.sin(ang - 0.4) * 7); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(ang + 0.4) * 7, ey - Math.sin(ang + 0.4) * 7); ctx.stroke();
  }

  function drawShape(sh: Shape) {
    if (sh.type === "label" || sh.type === "cota") return; // se dibujan aparte en pantalla
    if (sh.type === "puerta" || sh.type === "ventana") { drawOpening(sh); return; }
    if (sh.type === "columna") { drawColumna(sh); return; }
    if (sh.type === "escalera") { drawEscalera(sh); return; }
    ctx.strokeStyle = sh.color; ctx.lineWidth = sh.width; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.setLineDash([]);
    if (sh.type === "eje") { ctx.strokeStyle = "#8a938a"; ctx.lineWidth = Math.max(1, sh.width * 0.5); ctx.setLineDash([16, 5, 3, 5]); ctx.lineCap = "butt"; }
    else if (sh.type === "oculta") { ctx.setLineDash([9, 6]); ctx.lineCap = "butt"; }
    if (sh.type === "rect") {
      const a = sh.pts[0], b = sh.pts[1];
      ctx.beginPath(); ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); ctx.stroke(); ctx.setLineDash([]); return;
    }
    if (sh.pts.length < 2) { ctx.beginPath(); ctx.arc(sh.pts[0].x, sh.pts[0].y, sh.width * .5, 0, 7); ctx.fillStyle = sh.color; ctx.fill(); return; }
    ctx.beginPath();
    if (sh.type === "recta" || sh.type === "eje" || sh.type === "oculta") { ctx.moveTo(sh.pts[0].x, sh.pts[0].y); for (let i = 1; i < sh.pts.length; i++) ctx.lineTo(sh.pts[i].x, sh.pts[i].y); }
    else smoothPath(sh.pts);
    ctx.stroke(); ctx.setLineDash([]);
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = "#fbfbf8"; ctx.fillRect(0, 0, CW, CH);
    if (opts.grid) drawGrid();
    ctx.setTransform(DPR * st.view.scale, 0, 0, DPR * st.view.scale, DPR * st.view.ox, DPR * st.view.oy);
    if (st.bg?.img) { ctx.save(); ctx.globalAlpha = opts.bgOpacity; ctx.drawImage(st.bg.img, st.bg.x, st.bg.y, st.bg.img.width * st.bg.scale, st.bg.img.height * st.bg.scale); ctx.restore(); }
    for (const sh of st.shapes) drawShape(sh);
    if (st.current) drawShape(st.current);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (opts.measures) drawMeasures();
    drawLabels();
    if (st.drawing && st.current && ["recta", "cota", "puerta", "ventana", "eje", "oculta"].includes(st.current.type) && st.current.pts.length === 2) lenLabel(st.current);
    if (st.snapInd) {
      const s = w2s(st.snapInd);
      ctx.strokeStyle = "#0C4DA2"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, 7); ctx.stroke();
      ctx.fillStyle = "#0C4DA2"; ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, 7); ctx.fill();
    }
    if (opts.frame) drawFrame(ctx, CW, CH, st.view.scale / mpu(), DPR);
  }
  function drawGrid() {
    const tl = toWorld(0, 0), br = toWorld(CW, CH);
    const x0 = Math.floor(tl.x / GRID) * GRID, y0 = Math.floor(tl.y / GRID) * GRID;
    ctx.lineWidth = 1;
    for (let x = x0; x <= br.x; x += GRID) { const sx = x * st.view.scale + st.view.ox; ctx.strokeStyle = Math.round(x / GRID) % 5 === 0 ? "#dfe3da" : "#eef1ea"; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, CH); ctx.stroke(); }
    for (let y = y0; y <= br.y; y += GRID) { const sy = y * st.view.scale + st.view.oy; ctx.strokeStyle = Math.round(y / GRID) % 5 === 0 ? "#dfe3da" : "#eef1ea"; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(CW, sy); ctx.stroke(); }
  }
  function lenLabel(sh: Shape) {
    const a = sh.pts[0], b = sh.pts[1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) * mpu();
    const mid = w2s({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const txt = fmtLen(len);
    ctx.font = "600 12px Inter, sans-serif"; const w = ctx.measureText(txt).width + 14;
    ctx.fillStyle = "rgba(17,16,11,.92)"; roundRect(mid.x - w / 2, mid.y - 28, w, 20, 6); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, mid.x, mid.y - 18); ctx.textAlign = "left";
  }
  function roundRect(x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ----- acotación profesional (líneas de cota con marcas) -----
  function dimSeg(a: Pt, b: Pt, off = 16) {
    const A = w2s(a), B = w2s(b);
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy); if (len < 6) return;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const oA = { x: A.x + nx * off, y: A.y + ny * off }, oB = { x: B.x + nx * off, y: B.y + ny * off };
    ctx.strokeStyle = "#7d8a73"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(A.x + nx * 3, A.y + ny * 3); ctx.lineTo(oA.x + nx * 4, oA.y + ny * 4);
    ctx.moveTo(B.x + nx * 3, B.y + ny * 3); ctx.lineTo(oB.x + nx * 4, oB.y + ny * 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(oA.x, oA.y); ctx.lineTo(oB.x, oB.y); ctx.stroke();
    const t = 4.5; // marcas a 45°
    for (const P of [oA, oB]) { ctx.beginPath(); ctx.moveTo(P.x - (ux + nx) * t, P.y - (uy + ny) * t); ctx.lineTo(P.x + (ux + nx) * t, P.y + (uy + ny) * t); ctx.stroke(); }
    const meters = Math.hypot(b.x - a.x, b.y - a.y) * mpu();
    meas((oA.x + oB.x) / 2, (oA.y + oB.y) / 2, fmtLen(meters), "#ffffff", "#11100b", "#d4dcc9", true);
  }
  function meas(sx: number, sy: number, txt: string, bg?: string, fg?: string, border?: string, screen?: boolean) {
    const px = screen ? sx : sx; const py = screen ? sy : sy;
    ctx.font = "600 11px Inter, sans-serif"; const w = ctx.measureText(txt).width + 12;
    ctx.fillStyle = bg || "rgba(17,16,11,.95)"; roundRect(px - w / 2, py - 9, w, 18, 5); ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = fg || "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, px, py); ctx.textAlign = "left";
  }
  function drawMeasures() {
    for (const sh of st.shapes) {
      if (sh.type === "recta" && sh.pts.length === 2) dimSeg(sh.pts[0], sh.pts[1]);
      else if (sh.type === "recta" && sh.pts.length > 2) { let len = 0; for (let i = 0; i < sh.pts.length - 1; i++) len += Math.hypot(sh.pts[i + 1].x - sh.pts[i].x, sh.pts[i + 1].y - sh.pts[i].y); len *= mpu(); const m = w2s(sh.pts[Math.floor(sh.pts.length / 2)]); if (len > 0.1) meas(m.x, m.y, fmtLen(len)); }
      else if (sh.type === "cota" && sh.pts.length === 2) dimSeg(sh.pts[0], sh.pts[1]);
      else if (sh.type === "rect") {
        const a = sh.pts[0], b = sh.pts[1];
        const wm = Math.abs(b.x - a.x) * mpu(), hm = Math.abs(b.y - a.y) * mpu();
        if (wm > 0.02 && hm > 0.02) {
          const tl = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }, tr = { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) }, bl = { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) };
          dimSeg(tl, tr); dimSeg(bl, tl);
          const c = w2s({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          meas(c.x, c.y, fmtArea(wm * hm), "#0C4DA2", "#fff");
        }
      } else if ((sh.type === "curva" || sh.type === "lapiz") && sh.pts.length > 2) {
        let len = 0; for (let i = 0; i < sh.pts.length - 1; i++) len += Math.hypot(sh.pts[i + 1].x - sh.pts[i].x, sh.pts[i + 1].y - sh.pts[i].y); len *= mpu();
        const m = w2s(sh.pts[Math.floor(sh.pts.length / 2)]); if (len > 0.1) meas(m.x, m.y, fmtLen(len));
      } else if ((sh.type === "eje" || sh.type === "oculta") && sh.pts.length === 2) {
        const len = Math.hypot(sh.pts[1].x - sh.pts[0].x, sh.pts[1].y - sh.pts[0].y) * mpu();
        const m = w2s({ x: (sh.pts[0].x + sh.pts[1].x) / 2, y: (sh.pts[0].y + sh.pts[1].y) / 2 }); if (len > 0.05) meas(m.x, m.y, fmtLen(len));
      } else if (sh.type === "escalera" && sh.pts.length === 2) {
        const a = sh.pts[0], b = sh.pts[1]; const run = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * mpu();
        const m = w2s({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); meas(m.x, m.y, "Escalera · " + fmtLen(run), "rgba(12,77,162,.93)", "#fff");
      } else if ((sh.type === "puerta" || sh.type === "ventana") && sh.pts.length === 2) {
        const a = sh.pts[0], b = sh.pts[1]; const len = Math.hypot(b.x - a.x, b.y - a.y) * mpu();
        if (len > 0.01) {
          const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
          const m = w2s({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          // El cartel va corrido perpendicular al vano para no tapar el símbolo de la abertura.
          if (sh.type === "ventana") meas(m.x + nx * 15, m.y + ny * 15, fmtLen(len), "#1d4ed8", "#fff");
          else meas(m.x + nx * 15, m.y + ny * 15, fmtLen(len));
        }
      } else if (sh.type === "columna") {
        const lado = (sh.width || 10) * mpu();
        if (lado > 0.01) { const c = w2s(sh.pts[0]); meas(c.x, c.y - 14, fmtLen(lado)); }
      }
    }
  }
  function drawLabels() {
    for (const sh of st.shapes) {
      if (sh.type !== "label" || !sh.text) continue;
      const s = w2s(sh.pts[0]);
      ctx.font = "700 13px Inter, sans-serif"; const w = ctx.measureText(sh.text).width + 16;
      ctx.fillStyle = "#ffffff"; roundRect(s.x - w / 2, s.y - 12, w, 24, 7); ctx.fill();
      ctx.strokeStyle = sh.color; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = "#11100b"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(sh.text, s.x, s.y + 1); ctx.textAlign = "left";
    }
  }

  // ----- cajetín + norte + escala gráfica (pantalla y export) -----
  function drawFrame(c: CanvasRenderingContext2D, W: number, H: number, pxPerM: number, k = 1) {
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    // --- escala gráfica (abajo izq) ---
    let niceM = 1; const target = 92 / pxPerM;
    const pow = Math.pow(10, Math.floor(Math.log10(target))); const cand = [1, 2, 5, 10].map((m) => m * pow);
    niceM = cand.reduce((p, x) => (Math.abs(x - target) < Math.abs(p - target) ? x : p), cand[0]);
    const barW = niceM * pxPerM, bx = 18, by = H - 22;
    c.strokeStyle = "#11100b"; c.fillStyle = "#11100b"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(bx, by - 5); c.lineTo(bx, by); c.lineTo(bx + barW, by); c.lineTo(bx + barW, by - 5); c.stroke();
    c.fillRect(bx, by - 4, barW / 2, 4);
    c.font = "600 10px Inter, sans-serif"; c.textAlign = "left";
    c.fillText("0", bx - 2, by + 12); c.fillText(fmtLen(niceM), bx + barW - 8, by + 12);
    // --- norte (arriba der) ---
    const nx = W - 30, ny = 34;
    c.strokeStyle = "#11100b"; c.fillStyle = "#11100b"; c.lineWidth = 1.4;
    c.beginPath(); c.arc(nx, ny, 15, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(nx, ny - 11); c.lineTo(nx - 5, ny + 5); c.lineTo(nx, ny + 1); c.lineTo(nx + 5, ny + 5); c.closePath(); c.fill();
    c.font = "700 9px Inter, sans-serif"; c.textAlign = "center"; c.fillText("N", nx, ny + 12);
    // --- cajetín (abajo der) ---
    const m = opts.meta; const cw = 196, ch = 52, cx = W - cw - 16, cy = H - ch - 16;
    c.fillStyle = "rgba(255,255,255,.95)"; roundRect2(c, cx, cy, cw, ch, 8); c.fill();
    c.strokeStyle = "#11100b"; c.lineWidth = 1; c.stroke();
    c.fillStyle = "#0C4DA2"; c.fillRect(cx, cy, 4, ch);
    c.textAlign = "left";
    c.fillStyle = "#11100b"; c.font = "700 12px Inter, sans-serif";
    c.fillText(trunc(c, m.propName || "Plano", cw - 24), cx + 12, cy + 18);
    c.fillStyle = "#6b7280"; c.font = "500 10px Inter, sans-serif";
    c.fillText(`Escala gráfica · 1 cuadro = ${fmtLen(opts.mPerCell)}`, cx + 12, cy + 33);
    c.fillText(`${m.dateText || ""}`, cx + 12, cy + 45);
    c.textAlign = "right"; c.fillStyle = "#11100b"; c.font = "800 11px Inter, sans-serif";
    c.fillText("POTENTE", cx + cw - 12, cy + 45);
    c.restore();
  }
  function roundRect2(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function trunc(c: CanvasRenderingContext2D, s: string, max: number) { if (c.measureText(s).width <= max) return s; let t = s; while (t.length > 1 && c.measureText(t + "…").width > max) t = t.slice(0, -1); return t + "…"; }

  function rdp(pts: Pt[], eps: number): Pt[] { if (pts.length < 3) return pts; const a = pts[0], b = pts[pts.length - 1]; let idx = -1, dmax = 0; for (let i = 1; i < pts.length - 1; i++) { const d = distSeg(pts[i], a, b); if (d > dmax) { dmax = d; idx = i; } } if (dmax > eps && idx > 0) { const l = rdp(pts.slice(0, idx + 1), eps), r = rdp(pts.slice(idx), eps); return l.slice(0, -1).concat(r); } return [a, b]; }
  function distSeg(p: Pt, a: Pt, b: Pt) { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; if (!l2) return Math.hypot(p.x - a.x, p.y - a.y); let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); }
  function hitShape(p: Pt) {
    for (let i = st.shapes.length - 1; i >= 0; i--) {
      const sh = st.shapes[i], tol = Math.max(9, (sh.width || 3) + 7) / st.view.scale;
      if (sh.type === "label") { if (Math.hypot(p.x - sh.pts[0].x, p.y - sh.pts[0].y) < 22 / st.view.scale) return i; continue; }
      if (sh.type === "rect") { const a = sh.pts[0], b = sh.pts[1], e = [[a, { x: b.x, y: a.y }], [{ x: b.x, y: a.y }, b], [b, { x: a.x, y: b.y }], [{ x: a.x, y: b.y }, a]];
        for (const s of e as any) if (distSeg(p, s[0], s[1]) < tol) return i;
      } else for (let j = 0; j < sh.pts.length - 1; j++) if (distSeg(p, sh.pts[j], sh.pts[j + 1]) < tol) return i;
    } return -1;
  }

  // ----- aberturas: pegar la abertura al muro más cercano (queda colineal y prolija) -----
  function wallSegments(): [Pt, Pt][] {
    const segs: [Pt, Pt][] = [];
    for (const sh of st.shapes) {
      if (sh.type === "rect") { const a = sh.pts[0], b = sh.pts[1], k = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]; for (let i = 0; i < 4; i++) segs.push([k[i], k[(i + 1) % 4]]); }
      else if (sh.type === "recta" || sh.type === "curva") { for (let i = 0; i < sh.pts.length - 1; i++) segs.push([sh.pts[i], sh.pts[i + 1]]); }
    }
    return segs;
  }
  function snapOpeningToWall(cur: Shape) {
    const a = cur.pts[0], b = cur.pts[1];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let best: [Pt, Pt] | null = null, bd = 26 / st.view.scale;
    for (const [p, q] of wallSegments()) { const d = distSeg(mid, p, q); if (d < bd) { bd = d; best = [p, q]; } }
    if (!best) return;
    const [p, q] = best, dx = q.x - p.x, dy = q.y - p.y, l2 = dx * dx + dy * dy; if (!l2) return;
    const proj = (pt: Pt) => { let t = ((pt.x - p.x) * dx + (pt.y - p.y) * dy) / l2; t = Math.max(0, Math.min(1, t)); return { x: p.x + t * dx, y: p.y + t * dy }; };
    cur.pts[0] = proj(a); cur.pts[1] = proj(b);
  }

  /* ---------- pointers ---------- */
  const two = () => { const a = [...st.pointers.values()]; return [a[0], a[1]]; };
  function onDown(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    const l = local(e); st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, lx: l.x, ly: l.y, type: e.pointerType });
    if (e.pointerType === "pen") st.activePen = true;
    if (st.pointers.size === 2) { startGesture(); st.current = null; st.drawing = false; return; }
    if (st.pointers.size > 2) return;
    if (e.pointerType === "touch" && st.activePen) return; // palm rejection
    // Ctrl/⌘ + arrastrar (o botón del medio) = mover el lienzo, desde cualquier herramienta (estilo AutoCAD)
    if (e.button === 1 || e.ctrlKey || e.metaKey) { st.panning = { x: l.x, y: l.y, ox: st.view.ox, oy: st.view.oy }; st.current = null; st.drawing = false; return; }
    const w = toWorld(l.x, l.y);
    if (st.adjustBg && st.bg) { st.bgDrag = { lx: l.x, ly: l.y, x: st.bg.x, y: st.bg.y }; return; } // mover imagen de fondo
    if (opts.tool === "mano") { st.panning = { x: l.x, y: l.y, ox: st.view.ox, oy: st.view.oy }; return; }
    if (opts.tool === "texto") { hooks.onTextRequest?.({ x: l.x, y: l.y }, opts.snap ? snap(w) : w); return; }
    if (opts.tool === "borrar") { const i = hitShape(w); if (i >= 0) { pushUndo(); st.shapes.splice(i, 1); st.editIdx = null; draw(); changed(); } return; }
    if (opts.tool === "calibrar") { st.editIdx = null; st.drawing = true; st.calibrating = true; const s = resolveStart(w); st.current = { type: "recta", color: "#0C4DA2", width: 2, pts: [s, { ...s }] }; draw(); return; }
    if (opts.tool === "columna") { const p = opts.snap ? snap(w) : w; pushUndo(); st.shapes.push({ type: "columna", color: "#11100B", width: Math.max(6, Math.round(0.2 / mpu())), pts: [p] }); draw(); changed(); return; }
    st.editIdx = null;
    st.drawing = true;
    if (opts.tool === "recta" || opts.tool === "cota" || opts.tool === "eje" || opts.tool === "oculta") { const s = resolveStart(w); st.current = { type: opts.tool, color: opts.color, width: opts.width, pts: [s, { ...s }] }; }
    else if (opts.tool === "puerta" || opts.tool === "ventana") { const s = resolveStart(w); st.current = { type: opts.tool, color: "#11100B", width: 2, pts: [s, { ...s }] }; }
    else if (opts.tool === "rect" || opts.tool === "escalera") { const s = opts.snap ? snap(w) : { ...w }; st.current = { type: opts.tool, color: opts.color, width: opts.width, pts: [s, { ...s }] }; }
    else { st.current = { type: opts.tool, color: opts.color, width: opts.tool === "lapiz" ? opts.width * (0.5 + (e.pressure || .5)) : opts.width, pts: [w] }; }
    draw();
  }
  function onMove(e: PointerEvent) {
    if (!st.pointers.has(e.pointerId)) return;
    const l = local(e); st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, lx: l.x, ly: l.y, type: e.pointerType });
    if (st.gesture) { moveGesture(); return; }
    if (st.bgDrag && st.bg) { st.bg.x = st.bgDrag.x + (l.x - st.bgDrag.lx) / st.view.scale; st.bg.y = st.bgDrag.y + (l.y - st.bgDrag.ly) / st.view.scale; draw(); return; }
    if (st.panning) { st.view.ox = st.panning.ox + (l.x - st.panning.x); st.view.oy = st.panning.oy + (l.y - st.panning.y); draw(); return; }
    if (!st.drawing || !st.current) return;
    const w = toWorld(l.x, l.y), c = st.current;
    if (c.type === "recta" || c.type === "cota" || c.type === "puerta" || c.type === "ventana" || c.type === "eje" || c.type === "oculta") { const rr = resolveEnd(c.pts[0], w); c.pts[1] = rr.p; st.snapInd = rr.snap ? rr.p : null; }
    else if (c.type === "rect" || c.type === "escalera") { const rr = resolveRect(w); c.pts[1] = rr.p; st.snapInd = rr.snap ? rr.p : null; }
    else { const last = c.pts[c.pts.length - 1]; if (Math.hypot(w.x - last.x, w.y - last.y) > 3 / st.view.scale) c.pts.push(w); if (c.type === "lapiz") c.width = opts.width * (0.5 + (e.pressure || .5)); }
    draw();
  }
  function onUp(e: PointerEvent) {
    if (!st.pointers.has(e.pointerId)) return;
    st.pointers.delete(e.pointerId);
    if (![...st.pointers.values()].some((p: any) => p.type === "pen")) st.activePen = false;
    if (st.gesture && st.pointers.size < 2) st.gesture = null;
    if (st.bgDrag) { st.bgDrag = null; changed(); }
    if (st.panning) { st.panning = null; changed(); }
    if (st.calibrating && st.current) {
      const a = st.current.pts[0], b = st.current.pts[1];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      st.current = null; st.drawing = false; st.calibrating = false; st.snapInd = null; draw();
      if (L > 3) { st.lastCalibLen = L; hooks.onCalibrate?.(w2s({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })); }
      return;
    }
    if (st.drawing && st.current) {
      const c = st.current; let ok = true;
      if (c.type === "recta" || c.type === "rect" || c.type === "cota" || c.type === "puerta" || c.type === "ventana" || c.type === "eje" || c.type === "oculta" || c.type === "escalera") { if (Math.hypot(c.pts[1].x - c.pts[0].x, c.pts[1].y - c.pts[0].y) < 3) ok = false; }
      else if (c.pts.length < 2) ok = false;
      if (ok) {
        if (c.type === "curva" && c.pts.length > 3) c.pts = rdp(c.pts, 5 / st.view.scale);
        if (c.type === "puerta" || c.type === "ventana") snapOpeningToWall(c);
        pushUndo(); st.shapes.push(c);
        if (c.type === "recta" || c.type === "cota" || c.type === "eje" || c.type === "oculta") st.editIdx = st.shapes.length - 1;
      } else if (c.type === "recta" || c.type === "cota" || c.type === "eje" || c.type === "oculta") {
        // Tap sin arrastre con una herramienta de línea → seleccionar la línea de abajo
        // para PODER VOLVER a editar su medida en cualquier momento (no sólo al recién trazarla).
        const lp = local(e); const hi = hitShape(toWorld(lp.x, lp.y));
        st.editIdx = hi >= 0 && ["recta", "cota", "eje", "oculta"].includes(st.shapes[hi].type) ? hi : null;
      }
      st.current = null; st.drawing = false; st.snapInd = null; draw(); changed();
    }
  }
  function startGesture() { const [p1, p2] = two(); st.gesture = { dist: Math.hypot(p1.lx - p2.lx, p1.ly - p2.ly), mid: { x: (p1.lx + p2.lx) / 2, y: (p1.ly + p2.ly) / 2 }, view: { ...st.view } }; }
  function moveGesture() { const [p1, p2] = two(); const g = st.gesture; if (!g) return;
    const dist = Math.hypot(p1.lx - p2.lx, p1.ly - p2.ly), mid = { x: (p1.lx + p2.lx) / 2, y: (p1.ly + p2.ly) / 2 };
    let sc = Math.max(0.2, Math.min(8, g.view.scale * (dist / g.dist)));
    const wx = (g.mid.x - g.view.ox) / g.view.scale, wy = (g.mid.y - g.view.oy) / g.view.scale;
    st.view.scale = sc; st.view.ox = mid.x - wx * sc; st.view.oy = mid.y - wy * sc; draw();
  }
  function onWheel(e: WheelEvent) { e.preventDefault(); const r = canvas.getBoundingClientRect(); const l = { x: e.clientX - r.left, y: e.clientY - r.top };
    let sc = Math.max(0.2, Math.min(8, st.view.scale * Math.exp(-e.deltaY * 0.0015)));
    const wx = (l.x - st.view.ox) / st.view.scale, wy = (l.y - st.view.oy) / st.view.scale;
    st.view.scale = sc; st.view.ox = l.x - wx * sc; st.view.oy = l.y - wy * sc; draw(); changed();
  }

  const onCtx = (e: Event) => e.preventDefault(); // sin menú contextual durante el Ctrl+arrastre
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onCtx);

  // Encuadrar la vista sobre todo lo dibujado en el piso activo (centrar + escala cómoda).
  function fitToContent() {
    if (!(CW > 0) || !(CH > 0)) return false;
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9, n = 0;
    for (const sh of st.shapes) for (const p of sh.pts) { mnx = Math.min(mnx, p.x); mny = Math.min(mny, p.y); mxx = Math.max(mxx, p.x); mxy = Math.max(mxy, p.y); n++; }
    if (!n || !isFinite(mnx)) { st.pendingFit = false; return false; }
    const w = (mxx - mnx) || 1, h = (mxy - mny) || 1, margin = 120;
    let sc = Math.min((CW - margin) / w, (CH - margin) / h); sc = Math.max(0.4, Math.min(1.6, sc || 1));
    st.view = { scale: sc, ox: (CW - w * sc) / 2 - mnx * sc, oy: (CH - h * sc) / 2 - mny * sc };
    st.pendingFit = false; return true;
  }

  const ro = new ResizeObserver(() => {
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    CW = wrap.clientWidth; CH = wrap.clientHeight;
    canvas.width = Math.round(CW * DPR); canvas.height = Math.round(CH * DPR);
    canvas.style.width = CW + "px"; canvas.style.height = CH + "px";
    if (st.pendingFit) fitToContent();
    draw();
  });
  ro.observe(wrap);

  return {
    setOpts(o: any) { Object.assign(opts, o); if (o.tool && !["recta", "cota", "eje", "oculta"].includes(o.tool)) st.editIdx = null; draw(); },
    getShapes() { return JSON.parse(JSON.stringify(st.shapes)) as Shape[]; },
    addLabel(world: Pt, text: string, color: string) { if (!text.trim()) return; pushUndo(); st.shapes.push({ type: "label", pts: [world], color, width: 0, text: text.trim() }); draw(); changed(); },
    setBackground(src: string) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const fit = (CW * 0.72) / img.width / st.view.scale; // ~72% del viewport
        const c = toWorld(CW / 2, CH / 2);
        st.bg = { img, src, x: c.x - (img.width * fit) / 2, y: c.y - (img.height * fit) / 2, scale: fit };
        draw(); changed();
      };
      img.onerror = () => { st.bg = null; draw(); changed(); };
      img.src = src;
    },
    removeBackground() { st.bg = null; st.adjustBg = false; draw(); changed(); },
    setBgOpacity(v: number) { opts.bgOpacity = v; draw(); },
    setAdjustBg(v: boolean) { st.adjustBg = v; if (!v) st.bgDrag = null; },
    zoomBg(mult: number) { if (!st.bg) return; const img = st.bg.img; const cx = st.bg.x + (img.width * st.bg.scale) / 2, cy = st.bg.y + (img.height * st.bg.scale) / 2; st.bg.scale *= mult; st.bg.x = cx - (img.width * st.bg.scale) / 2; st.bg.y = cy - (img.height * st.bg.scale) / 2; draw(); changed(); },
    getBg() { return { has: !!st.bg, opacity: opts.bgOpacity, adjust: st.adjustBg }; },
    applyCalibration(meters: number) {
      if (!(st.lastCalibLen > 0) || !(meters > 0)) return null;
      opts.mPerCell = (meters / st.lastCalibLen) * GRID;
      draw(); changed(); return opts.mPerCell;
    },
    getLineEditor() {
      if (st.editIdx == null) return null;
      const sh = st.shapes[st.editIdx]; if (!sh || !["recta", "cota", "eje", "oculta"].includes(sh.type) || sh.pts.length < 2) return null;
      const a = sh.pts[0], b = sh.pts[1];
      const mid = w2s({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const meters = Math.hypot(b.x - a.x, b.y - a.y) * mpu();
      return { x: mid.x, y: mid.y, meters };
    },
    setLineLength(meters: number) {
      if (st.editIdx == null || !(meters > 0)) return;
      const sh = st.shapes[st.editIdx]; if (!sh || sh.pts.length < 2) return;
      const a = sh.pts[0], b = sh.pts[1];
      let ux = b.x - a.x, uy = b.y - a.y; const l = Math.hypot(ux, uy);
      if (l < 0.001) { ux = 1; uy = 0; } else { ux /= l; uy /= l; }
      const wpx = meters / mpu();
      pushUndo(); sh.pts[1] = { x: a.x + ux * wpx, y: a.y + uy * wpx }; draw(); changed();
    },
    deselect() { if (st.editIdx == null) return; st.editIdx = null; draw(); changed(); },
    fmtLen, fmtArea,
    undo() { if (!st.undo.length) return; st.redo.push(JSON.stringify(st.shapes)); setShapesArr(JSON.parse(st.undo.pop())); st.editIdx = null; draw(); changed(); },
    redo() { if (!st.redo.length) return; st.undo.push(JSON.stringify(st.shapes)); setShapesArr(JSON.parse(st.redo.pop())); st.editIdx = null; draw(); changed(); },
    clear() { if (!st.shapes.length) return; pushUndo(); setShapesArr([]); st.editIdx = null; draw(); changed(); },
    // ----- pisos -----
    getFloors() { return st.floors.map((f: any) => f.name); },
    activeFloor() { return st.active; },
    setActiveFloor(i: number) { if (i < 0 || i >= st.floors.length || i === st.active) return; st.active = i; st.shapes = st.floors[i].shapes; st.undo = []; st.redo = []; st.editIdx = null; draw(); changed(); },
    addFloor(copyContour: boolean) {
      const shapes: Shape[] = copyContour
        ? JSON.parse(JSON.stringify(st.floors[st.active].shapes.filter((s: Shape) => s.type === "recta" || s.type === "curva" || s.type === "rect")))
        : [];
      st.floors.push({ name: floorName(st.floors.length), shapes });
      st.active = st.floors.length - 1; st.shapes = shapes; st.undo = []; st.redo = []; st.editIdx = null; draw(); changed();
      return st.floors.map((f: any) => f.name);
    },
    removeFloor(i: number) {
      if (st.floors.length <= 1) { setShapesArr([]); st.editIdx = null; draw(); changed(); return st.floors.map((f: any) => f.name); }
      st.floors.splice(i, 1);
      st.floors.forEach((f: any, k: number) => { f.name = floorName(k); });
      st.active = Math.max(0, Math.min(st.active, st.floors.length - 1));
      st.shapes = st.floors[st.active].shapes; st.undo = []; st.redo = []; st.editIdx = null; draw(); changed();
      return st.floors.map((f: any) => f.name);
    },
    getStack() { return st.floors.map((f: any) => JSON.parse(JSON.stringify(f.shapes))) as Shape[][]; },
    copyFromBelow() {
      if (st.active <= 0) return;
      const contour: Shape[] = JSON.parse(JSON.stringify(st.floors[st.active - 1].shapes.filter((s: Shape) => s.type === "recta" || s.type === "curva" || s.type === "rect")));
      if (!contour.length) return;
      pushUndo(); for (const s of contour) st.shapes.push(s); st.editIdx = null; draw(); changed();
    },
    loadExample() {
      // PB completa (con escalera) + 1° piso = contorno de paredes (el hueco de la escalera se abre solo en 3D)
      const stair: Shape = { type: "escalera", color: "#11100B", width: 2, pts: [{ x: 150, y: 470 }, { x: 230, y: 360 }] };
      const pb: Shape[] = JSON.parse(JSON.stringify(EXAMPLE_PLAN)); pb.push(JSON.parse(JSON.stringify(stair)));
      const arriba: Shape[] = JSON.parse(JSON.stringify(EXAMPLE_PLAN.filter((s) => s.type === "recta" || s.type === "curva" || s.type === "rect")));
      arriba.push({ type: "ventana", color: "#11100B", width: 2, pts: [{ x: 650, y: 200 }, { x: 650, y: 260 }] });
      arriba.push({ type: "label", color: "#0C4DA2", width: 0, text: "Planta alta", pts: [{ x: 390, y: 250 }] });
      st.floors = [{ name: floorName(0), shapes: pb }, { name: floorName(1), shapes: arriba }];
      st.active = 0; st.shapes = pb;
      opts.mPerCell = 0.5; opts.unit = "auto"; st.editIdx = null; st.undo = []; st.redo = [];
      let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      for (const sh of st.shapes) for (const p of sh.pts) { mnx = Math.min(mnx, p.x); mny = Math.min(mny, p.y); mxx = Math.max(mxx, p.x); mxy = Math.max(mxy, p.y); }
      const w = mxx - mnx, h = mxy - mny, margin = 120;
      let sc = Math.min((CW - margin) / w, (CH - margin) / h); sc = Math.max(0.4, Math.min(1.6, sc || 1));
      st.view.scale = sc; st.view.ox = (CW - w * sc) / 2 - mnx * sc; st.view.oy = (CH - h * sc) / 2 - mny * sc;
      draw(); changed();
      return { mPerCell: opts.mPerCell, unit: opts.unit, floors: st.floors.map((f: any) => f.name) };
    },
    load(id: string) {
      let mPerCell = opts.mPerCell, unit = opts.unit; let rawBg: any = null;
      let floors: { name: string; shapes: Shape[] }[] | null = null;
      try {
        const raw = JSON.parse(localStorage.getItem("potente_plano_" + id) || "null");
        if (raw == null) floors = null;
        else if (Array.isArray(raw)) floors = [{ name: floorName(0), shapes: raw }]; // formato viejísimo (array)
        else if (Array.isArray(raw.floors)) { floors = raw.floors; if (raw.mPerCell) mPerCell = raw.mPerCell; if (raw.unit) unit = raw.unit; rawBg = raw.bg || null; }
        else { floors = [{ name: floorName(0), shapes: raw.shapes || [] }]; if (raw.mPerCell) mPerCell = raw.mPerCell; if (raw.unit) unit = raw.unit; rawBg = raw.bg || null; } // formato 1 plano
      } catch { floors = null; }
      if (!floors || !floors.length) floors = [{ name: floorName(0), shapes: [] }];
      floors = floors.map((f, i) => ({ name: f?.name || floorName(i), shapes: Array.isArray(f?.shapes) ? f.shapes : [] }));
      st.floors = floors; st.active = 0; st.shapes = st.floors[0].shapes;
      opts.mPerCell = mPerCell; opts.unit = unit;
      st.undo = []; st.redo = []; st.editIdx = null; st.bg = null; st.adjustBg = false;
      // Encuadrar lo cargado para que NUNCA aparezca en blanco/fuera de pantalla. Si el canvas todavía
      // no tiene tamaño (montaje inicial), queda pendiente y lo encuadra el ResizeObserver al medir.
      st.view = { scale: 1, ox: (CW / 2) % GRID, oy: (CH / 2) % GRID };
      st.pendingFit = true; fitToContent(); draw();
      if (rawBg?.src) { const b = rawBg; const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { st.bg = { img, src: b.src, x: b.x, y: b.y, scale: b.scale }; draw(); changed(); }; img.src = b.src; }
      return { mPerCell, unit, floors: st.floors.map((f: any) => f.name), active: 0 };
    },
    save(id: string) {
      const payload = { v: 2, floors: st.floors, active: st.active, mPerCell: opts.mPerCell, unit: opts.unit, bg: st.bg ? { src: st.bg.src, x: st.bg.x, y: st.bg.y, scale: st.bg.scale } : null };
      try { localStorage.setItem("potente_plano_" + id, JSON.stringify(payload)); return true; }
      catch {
        // Cuota de localStorage llena (casi siempre por la imagen de fondo en base64): guardamos el
        // dibujo SIN el fondo para no perder el trabajo del plano.
        try { localStorage.setItem("potente_plano_" + id, JSON.stringify({ ...payload, bg: null })); return "sin-fondo" as const; }
        catch { return false; }
      }
    },
    exportPNG(name: string, onData?: (url: string) => void) {
      const pad = 90; let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      for (const sh of st.shapes) for (const p of sh.pts) { mnx = Math.min(mnx, p.x); mny = Math.min(mny, p.y); mxx = Math.max(mxx, p.x); mxy = Math.max(mxy, p.y); }
      if (!isFinite(mnx)) return false;
      const w = (mxx - mnx) + pad * 2, h = (mxy - mny) + pad * 2 + 30, sc = 2;
      const oc = document.createElement("canvas"); oc.width = w * sc; oc.height = h * sc; const o = oc.getContext("2d")!;
      o.setTransform(sc, 0, 0, sc, 0, 0); o.fillStyle = "#fff"; o.fillRect(0, 0, w, h); o.translate(pad - mnx, pad - mny); o.lineCap = "round"; o.lineJoin = "round";
      for (const sh of st.shapes) {
        if (sh.type === "label") { o.font = "700 13px Inter, sans-serif"; o.fillStyle = "#11100b"; o.textAlign = "center"; o.fillText(sh.text || "", sh.pts[0].x, sh.pts[0].y); o.textAlign = "left"; continue; }
        if (sh.type === "cota") { o.strokeStyle = "#7d8a73"; o.lineWidth = 1; o.beginPath(); o.moveTo(sh.pts[0].x, sh.pts[0].y); o.lineTo(sh.pts[1].x, sh.pts[1].y); o.stroke(); continue; }
        if (sh.type === "puerta" || sh.type === "ventana") {
          const a = sh.pts[0], b = sh.pts[1], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy); if (L < 1) continue;
          const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hw = 3.4;
          o.strokeStyle = "#fff"; o.lineWidth = hw * 2 + 3; o.beginPath(); o.moveTo(a.x, a.y); o.lineTo(b.x, b.y); o.stroke();
          o.strokeStyle = "#11100b"; o.lineWidth = 1.5; o.beginPath();
          o.moveTo(a.x + nx * hw, a.y + ny * hw); o.lineTo(a.x - nx * hw, a.y - ny * hw);
          o.moveTo(b.x + nx * hw, b.y + ny * hw); o.lineTo(b.x - nx * hw, b.y - ny * hw); o.stroke();
          if (sh.type === "ventana") {
            o.beginPath(); o.moveTo(a.x + nx * hw, a.y + ny * hw); o.lineTo(b.x + nx * hw, b.y + ny * hw); o.moveTo(a.x - nx * hw, a.y - ny * hw); o.lineTo(b.x - nx * hw, b.y - ny * hw); o.stroke();
            o.strokeStyle = "#1d4ed8"; o.lineWidth = 1; o.beginPath(); o.moveTo(a.x, a.y); o.lineTo(b.x, b.y); o.stroke();
          } else {
            o.strokeStyle = "#11100b"; o.lineWidth = 1.7; o.beginPath(); o.moveTo(a.x, a.y); o.lineTo(a.x + nx * L, a.y + ny * L); o.stroke();
            let a0 = Math.atan2(uy, ux), a1 = Math.atan2(ny, nx), dd = a1 - a0; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
            o.strokeStyle = "rgba(17,16,11,0.45)"; o.lineWidth = 1; o.beginPath(); o.arc(a.x, a.y, L, a0, a0 + dd, dd < 0); o.stroke();
          }
          continue;
        }
        if (sh.type === "columna") { const cc = sh.pts[0], s = sh.width || 10; o.setLineDash([]); o.fillStyle = "#11100b"; o.fillRect(cc.x - s / 2, cc.y - s / 2, s, s); continue; }
        if (sh.type === "escalera") {
          const a = sh.pts[0], b = sh.pts[1], x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), w2 = x1 - x0, h2 = y1 - y0; if (w2 < 2 || h2 < 2) continue;
          o.setLineDash([]); o.strokeStyle = "#11100b"; o.lineWidth = 1.5; o.strokeRect(x0, y0, w2, h2);
          const alongX = w2 >= h2, n = Math.max(3, Math.round((alongX ? w2 : h2) / 12)); o.lineWidth = 1;
          for (let i = 1; i < n; i++) { const t = i / n; o.beginPath(); if (alongX) { const x = x0 + w2 * t; o.moveTo(x, y0); o.lineTo(x, y1); } else { const y = y0 + h2 * t; o.moveTo(x0, y); o.lineTo(x1, y); } o.stroke(); }
          continue;
        }
        o.strokeStyle = sh.color; o.lineWidth = sh.width; o.setLineDash([]);
        if (sh.type === "eje") { o.strokeStyle = "#8a938a"; o.lineWidth = Math.max(1, sh.width * 0.5); o.setLineDash([16, 5, 3, 5]); }
        else if (sh.type === "oculta") { o.setLineDash([9, 6]); }
        if (sh.type === "rect") { const a = sh.pts[0], b = sh.pts[1]; o.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); o.setLineDash([]); continue; }
        o.beginPath();
        if (sh.type === "recta" || sh.type === "eje" || sh.type === "oculta" || sh.pts.length < 3) { o.moveTo(sh.pts[0].x, sh.pts[0].y); for (let i = 1; i < sh.pts.length; i++) o.lineTo(sh.pts[i].x, sh.pts[i].y); }
        else { o.moveTo(sh.pts[0].x, sh.pts[0].y); for (let i = 0; i < sh.pts.length - 1; i++) { const p0 = sh.pts[i - 1] || sh.pts[i], p1 = sh.pts[i], p2 = sh.pts[i + 1], p3 = sh.pts[i + 2] || p2; o.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y); } }
        o.stroke(); o.setLineDash([]);
      }
      if (opts.frame) drawFrame(o, w, h, 1 / mpu(), sc); // cajetín + norte + escala a resolución del export
      const url = oc.toDataURL("image/png");
      if (onData) { onData(url); return true; }
      const a = document.createElement("a"); a.href = url; a.download = (name || "plano").replace(/\s+/g, "_") + ".png"; a.click(); return true;
    },
    destroy() {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); canvas.removeEventListener("wheel", onWheel as any);
      canvas.removeEventListener("contextmenu", onCtx);
    },
  };
}

/* ============ componente React ============ */
const TOOLS = [
  { t: "recta", Icon: Minus, label: "Pared recta — se pega a la grilla para que quede derecha. Después tocá la pared para editar su medida." },
  { t: "curva", Icon: Spline, label: "Curva suave — trazá una línea curva (tipo bezier)." },
  { t: "eje", Icon: GitCommitHorizontal, label: "Eje — línea de trazo y punto (para ejes o medianeras)." },
  { t: "oculta", Icon: MoreHorizontal, label: "Línea oculta — punteada, para lo que va por detrás o proyectado." },
  { t: "lapiz", Icon: Pencil, label: "Lápiz — dibujo a mano alzada, con presión del Apple Pencil." },
  { t: "rect", Icon: Square, label: "Rectángulo — dibujá un ambiente cerrado de una." },
  { t: "escalera", Icon: StretchHorizontal, label: "Escalera." },
  { t: "columna", Icon: Columns2, label: "Columna o pilar." },
  { t: "puerta", Icon: DoorOpen, label: "Puerta — colocala sobre una pared ya dibujada." },
  { t: "ventana", Icon: AppWindow, label: "Ventana — colocala sobre una pared ya dibujada." },
  { t: "cota", Icon: MoveHorizontal, label: "Cota — acotá una medida a mano donde quieras." },
  { t: "texto", Icon: Type, label: "Texto — poné un rótulo (ej. “Dormitorio”)." },
  { t: "borrar", Icon: Eraser, label: "Borrar — tocá un trazo para eliminarlo." },
  { t: "mano", Icon: Hand, label: "Mover — arrastrá para desplazar el pizarrón." },
];

export default function PlanEditor({ propId, propName, propImg, onUsar }: { propId: string; propName: string; propImg?: string; onUsar?: (dataUrl: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const eng = useRef<ReturnType<typeof makeEngine> | null>(null);

  const [tool, setTool] = useState("recta");
  const [color, setColor] = useState("#11100B");
  const [width, setWidth] = useState(3);
  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [measures, setMeasures] = useState(true);
  const [mPerCell, setMPerCell] = useState(0.5);
  const [unit, setUnit] = useState<"auto" | "m2" | "ha">("auto");
  const [saved, setSaved] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [stack3d, setStack3d] = useState<any[][]>([]);
  const [floor3d, setFloor3d] = useState(-1); // -1 = todo el edificio
  const [height3d, setHeight3d] = useState(2.6);
  const [floors, setFloors] = useState<string[]>(["Planta baja"]);
  const [active, setActive] = useState(0);
  const [bgPanel, setBgPanel] = useState(false);
  const [bgOpacity, setBgOpacity] = useState(0.5);
  const [adjustBg, setAdjustBg] = useState(false);
  const [, setVersion] = useState(0);
  const [lenInput, setLenInput] = useState("");
  const [textPrompt, setTextPrompt] = useState<{ open: boolean; screen: { x: number; y: number }; world: { x: number; y: number }; value: string }>({ open: false, screen: { x: 0, y: 0 }, world: { x: 0, y: 0 }, value: "" });
  const [calibPrompt, setCalibPrompt] = useState<{ open: boolean; screen: { x: number; y: number }; value: string }>({ open: false, screen: { x: 0, y: 0 }, value: "" });

  const dateText = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  useEffect(() => {
    if (!cvRef.current || !wrapRef.current) return;
    const e = makeEngine(cvRef.current, wrapRef.current, {
      onChange: () => setVersion((v) => v + 1),
      onTextRequest: (screen, world) => setTextPrompt({ open: true, screen, world, value: "" }),
      onCalibrate: (screen) => setCalibPrompt({ open: true, screen, value: "" }),
    });
    eng.current = e;
    const loaded = e.load(propId);
    if (loaded) { setMPerCell(loaded.mPerCell); setUnit(loaded.unit); setFloors(loaded.floors || ["Planta baja"]); setActive(loaded.active || 0); }
    setAdjustBg(false); setBgPanel(false);
    return () => { e.destroy(); eng.current = null; };
  }, [propId]);

  useEffect(() => { eng.current?.setOpts({ tool, color, width, grid, snap, measures, mPerCell, unit, meta: { propName, dateText } }); }, [tool, color, width, grid, snap, measures, mPerCell, unit, propName, dateText]);

  // Atajos: Ctrl/⌘+Z deshacer · Ctrl/⌘+Shift+Z o Ctrl+Y rehacer (sin pisar los campos de texto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target as HTMLElement; const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); eng.current?.undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); eng.current?.redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const doSave = () => {
    const r = eng.current?.save(propId);
    if (r === false) { alert("No se pudo guardar: el almacenamiento del navegador está lleno. Quitá la imagen de fondo o liberá espacio e intentá de nuevo."); return; }
    if (r === "sin-fondo") alert("Plano guardado. La imagen de fondo era demasiado pesada y no se pudo guardar (el dibujo sí quedó). Para conservar el calco, usá una imagen más liviana.");
    setSaved(true); setTimeout(() => setSaved(false), 1600);
  };
  const go3d = () => { setStack3d((eng.current as any)?.getStack() || []); setFloor3d(-1); setView3d(true); };
  const doExport = () => eng.current?.exportPNG(propName);
  const doExample = () => {
    if (view3d) setView3d(false);
    const r = (eng.current as any)?.loadExample();
    if (r) { setMPerCell(r.mPerCell); setUnit(r.unit); setFloors(r.floors || ["Planta baja"]); setActive(0); }
  };
  // ----- pisos -----
  const switchFloor = (i: number) => { (eng.current as any)?.setActiveFloor(i); setActive(i); };
  const addFloor = (copy: boolean) => { const f = (eng.current as any)?.addFloor(copy); if (f) { setFloors(f); setActive(f.length - 1); } };
  const delFloor = () => {
    if (floors.length <= 1) return;
    if (!window.confirm(`¿Eliminar "${floors[active]}"?\nSe borra todo lo dibujado en ese piso y no se puede deshacer.`)) return;
    const f = (eng.current as any)?.removeFloor(active); if (f) { setFloors(f); setActive((eng.current as any)?.activeFloor?.() ?? 0); }
  };
  const copyBelow = () => { (eng.current as any)?.copyFromBelow?.(); };

  const editor = ["recta", "cota", "eje", "oculta"].includes(tool) ? eng.current?.getLineEditor() ?? null : null;
  const commitLen = () => {
    const v = parseFloat(lenInput.replace(",", ".")); if (v > 0) eng.current?.setLineLength(v);
    setLenInput("");
  };
  const commitText = () => { if (textPrompt.value.trim()) eng.current?.addLabel(textPrompt.world, textPrompt.value, color); setTextPrompt((t) => ({ ...t, open: false, value: "" })); };

  const bg = eng.current?.getBg();
  const loadPropImg = () => { if (propImg) eng.current?.setBackground(propImg); };
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const im = new window.Image();
      im.onload = () => {
        const max = 1600, sc = Math.min(1, max / Math.max(im.width, im.height));
        const cv = document.createElement("canvas"); cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
        cv.getContext("2d")!.drawImage(im, 0, 0, cv.width, cv.height);
        eng.current?.setBackground(cv.toDataURL("image/jpeg", 0.82));
      };
      im.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const changeOpacity = (v: number) => { setBgOpacity(v); eng.current?.setBgOpacity(v); };
  const toggleAdjust = () => { const v = !adjustBg; setAdjustBg(v); eng.current?.setAdjustBg(v); };

  const commitCalib = () => {
    const v = parseFloat(calibPrompt.value.replace(",", "."));
    const nm = eng.current?.applyCalibration(v);
    if (nm) setMPerCell(nm);
    setCalibPrompt((p) => ({ ...p, open: false, value: "" }));
    setTool("recta");
  };
  const scaleOpts = SCALES.some((s) => Math.abs(s.m - mPerCell) < 1e-6)
    ? SCALES
    : [{ m: mPerCell, label: `${Number(mPerCell.toFixed(4))} m · calibrado` }, ...SCALES];

  return (
    <div className={expanded ? "fixed inset-0 z-[55] overflow-x-auto bg-paper-100 p-2.5" : "pcard overflow-x-auto overflow-y-hidden"}>
      {/* lienzo + herramientas flotantes (estilo Apple). min-w garantiza que las barras nunca se encimen:
          si la ventana es más angosta, aparece scroll horizontal en vez de superponerse todo. */}
      <div ref={wrapRef} className={`relative w-full min-w-[860px] overflow-hidden bg-[#fbfbf8] ${expanded ? "h-full rounded-2xl" : "h-[72vh] min-h-[460px]"}`}>
        <canvas ref={cvRef} className="block h-full w-full touch-none" />

        {/* herramientas (izquierda, dock flotante) */}
        {!view3d && (
          <div className="absolute border border-graph/10 bg-paper-100 left-3 top-3 z-30 grid grid-cols-2 gap-1 rounded-2xl p-1.5 shadow-[0_18px_44px_-22px_rgba(23,26,23,0.4)]">
            {TOOLS.map(({ t, Icon, label }) => (
              <button key={t} data-tip={label} data-tip-side="right" onClick={() => setTool(t)}
                className={`grid h-10 w-10 place-items-center rounded-xl transition ${tool === t ? "bg-brand text-white shadow-[0_8px_18px_-8px_rgba(12,77,162,0.7)]" : "text-graph-500 hover:bg-graph/[0.06] hover:text-graph"}`}>
                <Icon size={18} />
              </button>
            ))}
            <button data-tip="Calibrar la escala — dibujá una medida que conozcas y decile cuánto mide en la realidad." data-tip-side="right" onClick={() => setTool(tool === "calibrar" ? "recta" : "calibrar")}
              className={`col-span-2 grid h-9 place-items-center rounded-xl transition ${tool === "calibrar" ? "bg-brand text-white" : "text-graph-400 hover:bg-graph/[0.06] hover:text-graph"}`}><Crosshair size={16} /></button>
          </div>
        )}

        {/* pisos (arriba centro) */}
        {!view3d && (
          <div className="absolute border border-graph/10 bg-paper-100 left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl px-2 py-1.5 shadow-[0_18px_44px_-22px_rgba(23,26,23,0.4)]">
            <Layers size={14} className="ml-1 mr-0.5 text-brand" />
            {floors.map((name, i) => (
              <button key={i} onClick={() => switchFloor(i)} data-tip={`Ir al piso: ${name}`} data-tip-side="bottom"
                className={`h-7 rounded-lg px-2.5 text-xs font-semibold transition ${active === i ? "bg-brand text-white" : "text-graph-500 hover:bg-graph/[0.06]"}`}>{i === 0 ? "PB" : `${i}°`}</button>
            ))}
            <button onClick={() => addFloor(false)} data-tip="Agregar un piso" data-tip-side="bottom" className="grid h-7 w-7 place-items-center rounded-lg text-graph-500 transition hover:bg-graph/[0.06]"><Plus size={14} /></button>
            {active > 0 && <button onClick={copyBelow} data-tip="Copiar el contorno del piso de abajo" data-tip-side="bottom" className="grid h-7 w-7 place-items-center rounded-lg text-graph-500 transition hover:bg-graph/[0.06]"><Copy size={13} /></button>}
            {floors.length > 1 && <button onClick={delFloor} data-tip="Eliminar este piso" data-tip-side="bottom" className="grid h-7 w-7 place-items-center rounded-lg text-graph-400 transition hover:bg-red-500/10 hover:text-red-600"><Trash2 size={13} /></button>}
          </div>
        )}

        {/* acciones (arriba derecha) */}
        <div className="absolute border border-graph/10 bg-paper-100 right-3 top-3 z-30 flex items-center gap-1 rounded-2xl p-1.5 shadow-[0_18px_44px_-22px_rgba(23,26,23,0.4)]">
          {!view3d && (
            <>
              {/* escala + unidad (acá arriba para que el menú del selector no lo corte la barra de abajo) */}
              <span data-tip="Escala: cuántos metros mide cada cuadro de la grilla" data-tip-side="bottom" className="relative inline-flex">
                <Select
                  value={String(mPerCell)}
                  onChange={(v) => setMPerCell(+v)}
                  options={scaleOpts.map((s) => ({ value: String(s.m), label: `1 cuadro = ${s.label}` }))}
                  size="sm"
                  align="right"
                  triggerClassName="!text-xs"
                />
              </span>
              <span data-tip="Unidad de superficie (m² o hectáreas)" data-tip-side="bottom" className="relative inline-flex">
                <Select
                  value={unit}
                  onChange={(v) => setUnit(v as any)}
                  options={[
                    { value: "auto", label: "m² / ha" },
                    { value: "m2", label: "m²" },
                    { value: "ha", label: "ha" },
                  ]}
                  size="sm"
                  align="right"
                  triggerClassName="!text-xs"
                />
              </span>
              <div className="mx-0.5 h-5 w-px bg-graph/10" />
            </>
          )}
          {!view3d && <button onClick={doExample} data-tip="Cargar una planta de ejemplo" data-tip-side="bottom" className="grid h-9 w-9 place-items-center rounded-xl text-graph-500 transition hover:bg-graph/[0.06] hover:text-graph"><Home size={16} /></button>}
          <button onClick={() => (view3d ? setView3d(false) : go3d())} data-tip={view3d ? "Volver al plano 2D" : "Ver el plano en 3D"} data-tip-side="bottom"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand/40 px-3 text-sm font-semibold text-brand transition hover:bg-brand/10"><Box size={15} /> {view3d ? "2D" : "3D"}</button>
          {!view3d && (
            <>
              <div className="mx-0.5 h-5 w-px bg-graph/10" />
              <button onClick={() => eng.current?.undo()} data-tip="Deshacer" data-tip-side="bottom" className="grid h-9 w-9 place-items-center rounded-xl text-graph-500 transition hover:bg-graph/[0.06] hover:text-graph"><Undo2 size={16} /></button>
              <button onClick={() => eng.current?.redo()} data-tip="Rehacer" data-tip-side="bottom" className="grid h-9 w-9 place-items-center rounded-xl text-graph-500 transition hover:bg-graph/[0.06] hover:text-graph"><Redo2 size={16} /></button>
              <button onClick={() => eng.current?.clear()} data-tip="Vaciar todo el pizarrón" data-tip-side="bottom" className="grid h-9 w-9 place-items-center rounded-xl text-graph-500 transition hover:bg-graph/[0.06] hover:text-graph"><Trash2 size={16} /></button>
              <button onClick={doExport} data-tip="Exportar el plano a imagen (PNG)" data-tip-side="bottom" className="grid h-9 w-9 place-items-center rounded-xl text-graph-500 transition hover:bg-graph/[0.06] hover:text-graph"><Download size={16} /></button>
              {!onUsar && <button onClick={doSave} data-tip="Guardar el plano en la propiedad" data-tip-side="bottom" className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-600">{saved ? <Check size={16} /> : <Save size={16} />}</button>}
              {onUsar && <button onClick={() => eng.current?.exportPNG(propName, onUsar)} data-tip="Usar este dibujo en la ficha" data-tip-side="bottom" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-semibold text-white transition hover:bg-brand-600"><Check size={15} /> Usar en la ficha</button>}
            </>
          )}
          <div className="mx-0.5 h-5 w-px bg-graph/10" />
          <button onClick={() => setExpanded((v) => !v)} data-tip={expanded ? "Achicar" : "Pantalla completa"} data-tip-side="bottom" className="grid h-9 w-9 place-items-center rounded-xl text-graph-500 transition hover:bg-graph/[0.06] hover:text-graph">{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        </div>

        {/* propiedades (abajo centro): colores · grosor · grilla/imán/medidas/fondo · escala */}
        {!view3d && (
          <div className="absolute border border-graph/10 bg-paper-100 bottom-3 left-1/2 z-20 flex max-w-[94%] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-2 shadow-[0_18px_44px_-22px_rgba(23,26,23,0.4)]">
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} data-tip="Color del trazo" data-tip-side="top" className={`h-5 w-5 rounded-full ring-1 ring-graph/15 transition ${color === c ? "ring-2 ring-brand" : ""}`} style={{ background: c }} />
              ))}
            </div>
            <div className="h-5 w-px bg-graph/10" />
            <input type="range" min={1} max={14} value={width} onChange={(e) => setWidth(+e.target.value)} data-tip="Grosor del trazo" data-tip-side="top" className="w-16 accent-brand" />
            <div className="h-5 w-px bg-graph/10" />
            <button onClick={() => setGrid((v) => !v)} data-tip="Mostrar u ocultar la grilla" data-tip-side="top" className={`grid h-8 w-8 place-items-center rounded-lg transition ${grid ? "text-brand" : "text-graph-400"} hover:bg-graph/[0.06]`}><Grid3x3 size={16} /></button>
            <button onClick={() => setSnap((v) => !v)} data-tip="Imán: las líneas se pegan a la grilla para que queden perfectas" data-tip-side="top" className={`grid h-8 w-8 place-items-center rounded-lg transition ${snap ? "text-brand" : "text-graph-400"} hover:bg-graph/[0.06]`}><Magnet size={16} /></button>
            <button onClick={() => setMeasures((v) => !v)} data-tip="Mostrar u ocultar las medidas de cada pared" data-tip-side="top" className={`grid h-8 w-8 place-items-center rounded-lg transition ${measures ? "text-brand" : "text-graph-400"} hover:bg-graph/[0.06]`}><Ruler size={16} /></button>
            <button onClick={() => setBgPanel((v) => !v)} data-tip="Imagen de fondo para calcar (satelital del campo o foto)" data-tip-side="top" className={`grid h-8 w-8 place-items-center rounded-lg transition ${bg?.has || bgPanel ? "text-brand" : "text-graph-400"} hover:bg-graph/[0.06]`}><ImageIcon size={16} /></button>
          </div>
        )}

        {/* panel imagen de fondo (calco) */}
        {bgPanel && !view3d && (
          <div className="absolute border border-graph/10 bg-paper-100 right-3 top-[4.5rem] z-40 w-60 rounded-2xl p-3 text-graph shadow-xl">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-graph">Imagen de fondo (calco)</span>
              <button onClick={() => setBgPanel(false)} className="text-graph-400 hover:text-graph"><X size={14} /></button>
            </div>
            <p className="mb-2.5 text-[10px] leading-snug text-graph-400">Cargá una satelital del campo o la foto de la propiedad y dibujá el plano encima.</p>
            <div className="space-y-1.5">
              {propImg && (
                <button onClick={loadPropImg} className="flex w-full items-center gap-2 rounded-lg bg-graph/5 px-2.5 py-2 text-xs font-medium transition hover:bg-graph/10">
                  <ImageIcon size={14} className="text-[#2F6FC2]" /> Foto de la propiedad
                </button>
              )}
              <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-graph/5 px-2.5 py-2 text-xs font-medium transition hover:bg-graph/10">
                <Upload size={14} className="text-[#2F6FC2]" /> Subir imagen / satelital
                <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
              </label>
            </div>
            {bg?.has && (
              <div className="mt-3 space-y-2 border-t border-graph/10 pt-3">
                <div className="flex items-center gap-2">
                  <span className="w-14 text-[10px] text-graph-400">Opacidad</span>
                  <input type="range" min={0.1} max={1} step={0.05} value={bgOpacity} onChange={(e) => changeOpacity(+e.target.value)} className="flex-1 accent-[#0C4DA2]" />
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={toggleAdjust} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${adjustBg ? "bg-[#0C4DA2] text-white" : "bg-graph/5 text-graph-500 hover:bg-graph/10"}`}><Move size={13} /> Mover</button>
                  <button onClick={() => eng.current?.zoomBg(1.1)} title="Agrandar fondo" className="grid h-7 w-7 place-items-center rounded-lg bg-graph/5 text-graph-500 transition hover:bg-graph/10"><ZoomIn size={14} /></button>
                  <button onClick={() => eng.current?.zoomBg(0.9)} title="Achicar fondo" className="grid h-7 w-7 place-items-center rounded-lg bg-graph/5 text-graph-500 transition hover:bg-graph/10"><ZoomOut size={14} /></button>
                  <button onClick={() => { eng.current?.removeBackground(); setAdjustBg(false); }} title="Quitar fondo" className="grid h-7 w-7 place-items-center rounded-lg bg-graph/5 text-graph-500 transition hover:bg-rose-500/20 hover:text-rose-300"><Trash2 size={14} /></button>
                </div>
                {adjustBg && <p className="text-[10px] leading-snug text-[#2F6FC2]">Arrastrá en el lienzo para mover la imagen. Apagá “Mover” para volver a dibujar.</p>}
              </div>
            )}
          </div>
        )}

        {/* editor de medida exacta (tipear la longitud) */}
        {editor && !view3d && (
          <div className="absolute z-30 flex items-center overflow-hidden rounded-lg border border-[#0C4DA2] bg-white shadow-lg"
            style={{ left: editor.x, top: editor.y + 18, transform: "translateX(-40px)" }}>
            <input
              autoFocus value={lenInput} onChange={(e) => setLenInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitLen(); if (e.key === "Escape") { setLenInput(""); eng.current?.deselect(); } }}
              onBlur={commitLen}
              placeholder={editor.meters.toFixed(2).replace(".", ",")}
              inputMode="decimal"
              className="w-20 bg-transparent px-2.5 py-1.5 text-sm font-semibold text-graph outline-none placeholder:text-graph/40"
            />
            <span className="py-1.5 pl-1 pr-1.5 text-xs font-medium text-graph/50">m</span>
            <button onMouseDown={(e) => e.preventDefault()} onClick={commitLen} title="Aplicar medida" className="bg-[#0C4DA2] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#083469]">OK</button>
          </div>
        )}

        {/* rótulo / texto */}
        {textPrompt.open && !view3d && (
          <div className="absolute z-30 overflow-hidden rounded-lg border border-[#0C4DA2] bg-white shadow-lg"
            style={{ left: textPrompt.screen.x, top: textPrompt.screen.y, transform: "translate(-50%,-50%)" }}>
            <input
              autoFocus value={textPrompt.value} onChange={(e) => setTextPrompt((t) => ({ ...t, value: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextPrompt((t) => ({ ...t, open: false })); }}
              onBlur={commitText}
              placeholder="Dormitorio, Galpón, Lote 3…"
              className="w-44 bg-transparent px-2.5 py-2 text-sm font-semibold text-graph outline-none placeholder:text-graph/35"
            />
          </div>
        )}

        {/* guía aberturas */}
        {(tool === "puerta" || tool === "ventana") && !view3d && (
          <div className="pointer-events-none absolute left-1/2 top-[4.5rem] z-40 -translate-x-1/2 rounded-full bg-brand px-4 py-1.5 text-[11px] font-semibold text-white shadow-lg">
            Trazá la {tool} sobre una pared — se pega sola y en 3D queda el hueco real
          </div>
        )}

        {/* calibrar escala */}
        {tool === "calibrar" && !view3d && !calibPrompt.open && (
          <div className="pointer-events-none absolute left-1/2 top-[4.5rem] z-40 -translate-x-1/2 rounded-full bg-brand px-4 py-1.5 text-[11px] font-semibold text-white shadow-lg">
            Trazá una línea sobre una medida conocida y escribí los metros reales
          </div>
        )}
        {calibPrompt.open && !view3d && (
          <div className="absolute z-30 flex items-center overflow-hidden rounded-lg border border-[#0C4DA2] bg-white shadow-lg"
            style={{ left: calibPrompt.screen.x, top: calibPrompt.screen.y + 18, transform: "translateX(-50%)" }}>
            <input autoFocus value={calibPrompt.value} onChange={(e) => setCalibPrompt((p) => ({ ...p, value: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") commitCalib(); if (e.key === "Escape") { setCalibPrompt((p) => ({ ...p, open: false })); setTool("recta"); } }}
              placeholder="metros reales" inputMode="decimal"
              className="w-28 bg-transparent px-2.5 py-1.5 text-sm font-semibold text-graph outline-none placeholder:text-graph/40" />
            <button onMouseDown={(e) => e.preventDefault()} onClick={commitCalib} className="bg-[#0C4DA2] px-2.5 py-1.5 text-xs font-semibold text-white">OK</button>
          </div>
        )}

        {view3d && (
          <div className="absolute inset-0 z-20 bg-[#14130d]">
            <Plan3D floors={stack3d} height={height3d} mPerCell={mPerCell} only={floor3d} />
            <div className="absolute left-3 top-3 z-30 flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-graph/10 bg-graph/70 px-3 py-2 backdrop-blur">
                <span className="text-[11px] font-medium text-graph-500">Altura piso</span>
                <input type="range" min={2} max={5} step={0.1} value={height3d} onChange={(e) => setHeight3d(+e.target.value)} className="w-28 accent-[#2F6FC2]" />
                <span className="w-10 text-right text-xs font-semibold text-[#2F6FC2]">{height3d.toFixed(1)} m</span>
              </div>
              {stack3d.length > 1 && (
                <div className="flex items-center gap-1 rounded-lg border border-graph/10 bg-graph/70 px-2 py-1.5 backdrop-blur">
                  <button onClick={() => setFloor3d(-1)} className={`h-6 rounded-md px-2 text-[11px] font-semibold transition ${floor3d === -1 ? "bg-[#0C4DA2] text-white" : "text-graph-500 hover:bg-graph/5 hover:text-graph"}`}>Todo</button>
                  {stack3d.map((_, i) => (
                    <button key={i} onClick={() => setFloor3d(i)} className={`h-6 rounded-md px-2 text-[11px] font-semibold transition ${floor3d === i ? "bg-[#0C4DA2] text-white" : "text-graph-500 hover:bg-graph/5 hover:text-graph"}`}>{i === 0 ? "PB" : `${i}°`}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-graph/80 px-4 py-1.5 text-[11px] font-medium text-graph backdrop-blur">Arrastrá para orbitar · rueda/pellizco para zoom</div>
          </div>
        )}
      </div>
    </div>
  );
}
