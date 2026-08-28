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
/* 🔴 28-ago · La lista decia "/temporada/playa-grande", un barrio que dejo de existir
 * el 13-ago (Mateo: «temporada hacemos unicamente en Punta Mogotes»). Esa ruta
 * redirige, y la prueba daba un rojo que no era un desborde real: scrollWidth ===
 * innerWidth, o sea cero desborde, pero el ancho medido no era el pedido. Un rojo
 * cronico que no significa nada entrena a mirar la suite para otro lado.
 * Ahora apunta al barrio que SI existe, que ademas es el que esta en el sitemap. */
  "/", "/propiedades", "/propiedad/URB-001", "/temporada", "/temporada/punta-mogotes", "/favoritos",
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
