// ¿Alguna ruta estira el viewport (se deforma) en pantallas angostas?
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";

const APP = process.env.APP || "http://localhost:5177";
const p = await nuevaPestania();
await p.ir(APP + "/", 900);
await p.evaluar(`localStorage.clear(); localStorage.setItem("potente_demo_auth","1"); localStorage.setItem("potente_perfil_activo","mateo"); return 1;`);

const RUTAS = [
  "/panel", "/panel/asistente", "/panel/cargar", "/panel/fichas", "/panel/planos",
  "/panel/temporada", "/panel/cartera", "/panel/leads", "/panel/crm", "/panel/pipeline",
  "/panel/agenda", "/panel/tasaciones", "/panel/llaves", "/panel/arrendamientos", "/panel/reportes",
  "/", "/propiedades", "/propiedad/URB-001", "/temporada", "/temporada/playa-grande", "/favoritos",
];

const MEDIR = `
  await new Promise(r => setTimeout(r, 500));
  return { iw: window.innerWidth, sw: document.documentElement.scrollWidth };
`;

for (const w of [320, 390]) {
  console.log(`\n########## ${w}px ##########`);
  await p.metrica(w, 800);
  for (const ruta of RUTAS) {
    await p.ir(APP + ruta, 2400);
    const r = await p.evaluar(MEDIR);
    const ok = r.iw === w && r.sw <= w + 2;
    chequear(`${String(w)}px ${ruta}`, ok, ok ? "" : `innerWidth=${r.iw} scrollWidth=${r.sw} (deberia ser ${w})`);
  }
}
await p.cerrar();
resumen();
