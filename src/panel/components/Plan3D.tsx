import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Pt = { x: number; y: number };
type Shape = { type: string; pts: Pt[]; color: string; width: number };

/* ============ texturas procedurales (sin assets externos) ============ */
function gradientTex() {
  const c = document.createElement("canvas"); c.width = 2; c.height = 256;
  const g = c.getContext("2d")!; const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, "#f4eee2"); grd.addColorStop(0.55, "#ece3d2"); grd.addColorStop(1, "#dcd0bb");
  g.fillStyle = grd; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function woodTex() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b98a55"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) {
    g.strokeStyle = `rgba(${110 + Math.random() * 40},${78 + Math.random() * 30},${42 + Math.random() * 24},${0.05 + Math.random() * 0.08})`;
    g.lineWidth = 0.6 + Math.random() * 1.2; g.beginPath();
    const y = Math.random() * 512; g.moveTo(0, y);
    g.bezierCurveTo(170, y + (Math.random() - 0.5) * 14, 340, y + (Math.random() - 0.5) * 14, 512, y + (Math.random() - 0.5) * 10);
    g.stroke();
  }
  for (let p = 0; p <= 512; p += 64) { g.strokeStyle = "rgba(70,48,26,0.45)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function contactTex() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!; const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, "rgba(35,28,16,0.42)"); r.addColorStop(0.6, "rgba(35,28,16,0.16)"); r.addColorStop(1, "rgba(35,28,16,0)");
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* resta rectangular: rects[] menos el hueco h -> rects[] (para huecos de escalera en la losa) */
type Rect = { x0: number; z0: number; x1: number; z1: number };
function subtractRect(rects: Rect[], h: Rect): Rect[] {
  const out: Rect[] = [];
  for (const r of rects) {
    if (h.x1 <= r.x0 || h.x0 >= r.x1 || h.z1 <= r.z0 || h.z0 >= r.z1) { out.push(r); continue; }
    const ix0 = Math.max(r.x0, h.x0), ix1 = Math.min(r.x1, h.x1), iz0 = Math.max(r.z0, h.z0), iz1 = Math.min(r.z1, h.z1);
    if (iz0 > r.z0) out.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: iz0 });
    if (iz1 < r.z1) out.push({ x0: r.x0, z0: iz1, x1: r.x1, z1: r.z1 });
    if (ix0 > r.x0) out.push({ x0: r.x0, z0: iz0, x1: ix0, z1: iz1 });
    if (ix1 < r.x1) out.push({ x0: ix1, z0: iz0, x1: r.x1, z1: iz1 });
  }
  return out;
}

export default function Plan3D({ floors, height = 2.6, mPerCell = 0.5, only = -1 }: { floors: Shape[][]; height?: number; mPerCell?: number; only?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const MPU = mPerCell / 26;

  useEffect(() => {
    const wrap = wrapRef.current!;
    let W = wrap.clientWidth || 800, H = wrap.clientHeight || 500;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    wrap.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const grad = gradientTex();
    scene.background = grad;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // ---- pisos a renderizar ----
    const allFloors = (floors && floors.length ? floors : [[]]);
    const idxs = only >= 0 && only < allFloors.length ? [only] : allFloors.map((_, i) => i);

    type Seg = { a: Pt; b: Pt };
    const toM = (p: Pt) => ({ x: p.x * MPU, y: p.y * MPU });
    const parseFloor = (shapes: Shape[]) => {
      const wallSegs: Seg[] = [], openings: { a: Pt; b: Pt; kind: string }[] = [];
      const stairs: { a: Pt; b: Pt }[] = [], columns: { c: Pt; s: number }[] = [];
      for (const sh of shapes) {
        if (sh.type === "rect") { const a = toM(sh.pts[0]), b = toM(sh.pts[1]); const c = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]; for (let i = 0; i < 4; i++) wallSegs.push({ a: c[i], b: c[(i + 1) % 4] }); }
        else if (sh.type === "recta" || sh.type === "curva") { for (let i = 0; i < sh.pts.length - 1; i++) wallSegs.push({ a: toM(sh.pts[i]), b: toM(sh.pts[i + 1]) }); }
        else if ((sh.type === "puerta" || sh.type === "ventana") && sh.pts.length >= 2) openings.push({ a: toM(sh.pts[0]), b: toM(sh.pts[1]), kind: sh.type });
        else if (sh.type === "escalera" && sh.pts.length >= 2) stairs.push({ a: toM(sh.pts[0]), b: toM(sh.pts[1]) });
        else if (sh.type === "columna" && sh.pts.length >= 1) columns.push({ c: toM(sh.pts[0]), s: Math.max(0.12, (sh.width || 10) * MPU) });
      }
      return { wallSegs, openings, stairs, columns };
    };
    const parsed = allFloors.map(parseFloor);

    // ---- bounds globales (todas las plantas alineadas) ----
    let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
    parsed.forEach((f) => f.wallSegs.forEach(({ a, b }) => [a, b].forEach((p) => { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); minz = Math.min(minz, p.y); maxz = Math.max(maxz, p.y); })));
    if (!isFinite(minx)) { minx = minz = -3; maxx = maxz = 3; }
    const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
    const fx = Math.max(maxx - minx, 1.5), fz = Math.max(maxz - minz, 1.5);
    const nF = idxs.length;
    const span = Math.max(fx, fz, 4);
    const totalH = nF * height;
    const c = (p: Pt) => ({ x: p.x - cx, y: p.y - cz });
    const reach = Math.max(span, totalH * 1.1);

    // ---- cámara + controles ----
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 4000);
    camera.position.set(reach * 0.85, totalH * 0.6 + span * 0.7, reach * 1.15);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, totalH * 0.4, 0);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05; controls.minDistance = span * 0.3; controls.maxDistance = reach * 5;
    controls.update();

    // ---- luces ----
    scene.add(new THREE.HemisphereLight(0xfdf6e6, 0x6b6147, 0.65));
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.0);
    sun.position.set(span * 0.7, totalH + span * 1.5, span * 0.45);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    const d = span * 1.6;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d; sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d; sun.shadow.camera.far = (totalH + span) * 6;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35);
    fill.position.set(-span, totalH * 0.6 + span * 0.6, -span * 0.7); scene.add(fill);

    // ---- terreno + sombra de contacto ----
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 8, span * 8), new THREE.MeshStandardMaterial({ color: 0xe7dfcf, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(span * 8, Math.max(8, Math.round((span * 8) / 1)), 0xcdbf9f, 0xddd2bb);
    (grid.material as THREE.Material).opacity = 0.35; (grid.material as THREE.Material).transparent = true; grid.position.y = 0.001; scene.add(grid);
    const ctex = contactTex();
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(fx + span * 0.9, fz + span * 0.9), new THREE.MeshBasicMaterial({ map: ctex, transparent: true, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = 0.006; scene.add(contact);

    // ---- materiales ----
    const wtex = woodTex(); wtex.repeat.set(Math.max(1, fx / 1.1), Math.max(1, fz / 1.1));
    const floorMat = new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.72, metalness: 0 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xefe9dd, roughness: 0.82, metalness: 0 });
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0xccc1aa, roughness: 0.78, metalness: 0 });
    const slabMat = new THREE.MeshStandardMaterial({ color: 0xd8cfbb, roughness: 0.9, metalness: 0 });
    const stairMat = new THREE.MeshStandardMaterial({ color: 0xcab089, roughness: 0.7, metalness: 0 });
    const colMat = new THREE.MeshStandardMaterial({ color: 0xe3dccd, roughness: 0.85, metalness: 0 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xbcd6e0, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.34, envMapIntensity: 1.4 });
    const TH = 0.12, SLAB = 0.16;
    const DOOR_H = Math.min(2.05, height - 0.05);
    const WIN_TOP = Math.min(2.05, height - 0.12);
    const WIN_SILL = Math.max(0.35, Math.min(0.95, WIN_TOP - 0.95));

    const building = new THREE.Group();
    scene.add(building);

    const addPlate = (rect: Rect, yTop: number, mat: THREE.Material, top = true) => {
      const w = rect.x1 - rect.x0, dz = rect.z1 - rect.z0; if (w < 0.05 || dz < 0.05) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, SLAB, dz), mat);
      m.position.set((rect.x0 + rect.x1) / 2, yTop - SLAB / 2, (rect.z0 + rect.z1) / 2);
      m.castShadow = true; m.receiveShadow = true; building.add(m);
      void top;
    };

    const buildWall = (s: Seg, yBase: number, ops0: { a: Pt; b: Pt; kind: string }[]) => {
      const a = c(s.a), b = c(s.b);
      const dx = b.x - a.x, dz = b.y - a.y, L = Math.hypot(dx, dz); if (L < 0.05) return;
      const ux = dx / L, uz = dz / L, ang = -Math.atan2(dz, dx);
      const addBox = (t0: number, t1: number, yb: number, yt: number, mat: THREE.Material, e0: boolean, e1: boolean, thickMul = 1, cast = true) => {
        const a0 = e0 ? TH / 2 : 0, a1 = e1 ? TH / 2 : 0;
        const len = (t1 - t0) + a0 + a1; if (len < 0.01) return;
        const tc = ((t0 - a0) + (t1 + a1)) / 2;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, Math.max(0.002, yt - yb), TH * thickMul), mat);
        mesh.position.set(a.x + ux * tc, yBase + (yb + yt) / 2, a.y + uz * tc);
        mesh.rotation.y = ang; mesh.castShadow = cast; mesh.receiveShadow = true; building.add(mesh);
      };
      const solid = (t0: number, t1: number) => {
        addBox(t0, t1, 0, height, wallMat, t0 <= 0.02, t1 >= L - 0.02);
        addBox(t0, t1, 0, 0.09, skirtMat, t0 <= 0.02, t1 >= L - 0.02, 1.22, false);
      };
      const ops: { t0: number; t1: number; kind: string }[] = [];
      for (const o of ops0) {
        const oa = c(o.a), ob = c(o.b);
        const ta = (oa.x - a.x) * ux + (oa.y - a.y) * uz, tb = (ob.x - a.x) * ux + (ob.y - a.y) * uz;
        const pa = Math.hypot((oa.x - a.x) - ta * ux, (oa.y - a.y) - ta * uz), pb = Math.hypot((ob.x - a.x) - tb * ux, (ob.y - a.y) - tb * uz);
        if (Math.max(pa, pb) > 0.4) continue;
        const t0 = Math.max(0, Math.min(ta, tb)), t1 = Math.min(L, Math.max(ta, tb));
        if (t1 - t0 > 0.2) ops.push({ t0, t1, kind: o.kind });
      }
      ops.sort((p, q) => p.t0 - q.t0);
      let cur = 0;
      for (const op of ops) {
        if (op.t0 > cur + 0.02) solid(cur, op.t0);
        if (op.kind === "puerta") addBox(op.t0, op.t1, DOOR_H, height, wallMat, false, false);
        else { addBox(op.t0, op.t1, 0, WIN_SILL, wallMat, false, false); addBox(op.t0, op.t1, 0, 0.09, skirtMat, false, false, 1.22, false); addBox(op.t0, op.t1, WIN_TOP, height, wallMat, false, false); addBox(op.t0, op.t1, WIN_SILL + 0.02, WIN_TOP - 0.02, glassMat, false, false, 0.3, false); }
        cur = Math.max(cur, op.t1);
      }
      if (cur < L - 0.02) solid(cur, L);
      if (!ops.length) solid(0, L);
    };

    const buildStair = (st0: { a: Pt; b: Pt }, yBase: number) => {
      const a = c(st0.a), b = c(st0.b);
      const x0 = Math.min(a.x, b.x), z0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), z1 = Math.max(a.y, b.y);
      const w = x1 - x0, dz = z1 - z0; if (w < 0.2 || dz < 0.2) return;
      const alongX = w >= dz;
      const run = alongX ? w : dz, wide = alongX ? dz : w;
      const n = Math.max(6, Math.round(height / 0.18));
      const stepRun = run / n, rise = height / n;
      for (let i = 0; i < n; i++) {
        const yt = (i + 1) * rise;
        const g = new THREE.BoxGeometry(alongX ? stepRun : wide, yt, alongX ? wide : stepRun);
        const m = new THREE.Mesh(g, stairMat);
        const along0 = (alongX ? x0 : z0) + (i + 0.5) * stepRun;
        const cxp = alongX ? along0 : (x0 + x1) / 2;
        const czp = alongX ? (z0 + z1) / 2 : along0;
        m.position.set(cxp, yBase + yt / 2, czp); m.castShadow = true; m.receiveShadow = true; building.add(m);
      }
    };

    const buildColumn = (col: { c: Pt; s: number }, yBase: number) => {
      const p = c(col.c); const s = Math.max(0.12, col.s);
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, height, s), colMat);
      m.position.set(p.x, yBase + height / 2, p.y); m.castShadow = true; m.receiveShadow = true; building.add(m);
    };

    // ---- construir cada planta ----
    idxs.forEach((fi, level) => {
      const f = parsed[fi];
      const yBase = level * height;
      // losa / piso (con huecos por escaleras de la planta de abajo)
      let plates: Rect[] = [{ x0: -fx / 2 - 0.15, z0: -fz / 2 - 0.15, x1: fx / 2 + 0.15, z1: fz / 2 + 0.15 }];
      if (level > 0) {
        const below = parsed[idxs[level - 1]];
        for (const stc of below.stairs) {
          const a = c(stc.a), b = c(stc.b);
          const hole: Rect = { x0: Math.min(a.x, b.x) - 0.05, z0: Math.min(a.y, b.y) - 0.05, x1: Math.max(a.x, b.x) + 0.05, z1: Math.max(a.y, b.y) + 0.05 };
          plates = subtractRect(plates, hole);
        }
        for (const r of plates) addPlate(r, yBase, slabMat);
      }
      // piso de madera arriba de la losa (mismo recorte)
      let woodPl: Rect[] = [{ x0: -fx / 2, z0: -fz / 2, x1: fx / 2, z1: fz / 2 }];
      if (level > 0) {
        const below = parsed[idxs[level - 1]];
        for (const stc of below.stairs) { const a = c(stc.a), b = c(stc.b); woodPl = subtractRect(woodPl, { x0: Math.min(a.x, b.x) - 0.05, z0: Math.min(a.y, b.y) - 0.05, x1: Math.max(a.x, b.x) + 0.05, z1: Math.max(a.y, b.y) + 0.05 }); }
      }
      for (const r of woodPl) {
        const w = r.x1 - r.x0, dzz = r.z1 - r.z0; if (w < 0.05 || dzz < 0.05) continue;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, dzz), floorMat);
        m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2, yBase + 0.012, (r.z0 + r.z1) / 2); m.receiveShadow = true; building.add(m);
      }
      // paredes + aberturas
      for (const s of f.wallSegs) buildWall(s, yBase, f.openings);
      // escaleras + columnas
      for (const stc of f.stairs) buildStair(stc, yBase);
      for (const col of f.columns) buildColumn(col, yBase);
    });

    // animación de "levantar"
    building.scale.y = 0.001;
    const t0 = performance.now();

    function resize() { W = wrap.clientWidth; H = wrap.clientHeight; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); }
    const ro = new ResizeObserver(resize); ro.observe(wrap);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const k = Math.min(1, (performance.now() - t0) / 800);
      building.scale.y = 0.001 + (1 - 0.001) * (1 - Math.pow(1 - k, 3));
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      scene.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose()); });
      [grad, wtex, ctex].forEach((t) => t.dispose());
      pmrem.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === wrap) wrap.removeChild(renderer.domElement);
    };
  }, [floors, height, mPerCell, only]);

  return <div ref={wrapRef} className="h-full w-full" />;
}
