// La grilla de Temporada NO debe tener tabla con scroll horizontal en celular:
// esa tabla + columna sticky se "pisaba" en Chrome de escritorio angosto.
import { sesion, chequear, resumen } from "./cdp2.mjs";
const APP = process.env.APP || "http://localhost:5177";

const s = await sesion();
for (const [w, h, mob, etiqueta] of [[390, 780, true, "iPhone"], [502, 760, false, "Chrome angosto"]]) {
  await s.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: mob });
  await s.ir(APP + "/", 800);
  await s.evaluar(`localStorage.clear(); localStorage.setItem("potente_demo_auth","1"); localStorage.setItem("potente_perfil_activo","mateo"); return 1;`);
  await s.ir(APP + "/panel/temporada", 3400);
  const r = await s.evaluar(`
    await new Promise(r=>setTimeout(r,600));
    const desborde = document.documentElement.scrollWidth > window.innerWidth + 2;
    const tablaVisible = [...document.querySelectorAll('main table')].some(t => t.offsetParent);
    // ¿hay tarjetas de unidad con sus quincenas?
    const chips = [...document.querySelectorAll('main button')].filter(b => /LIBRE|Señada|Confirmada|Finalizada/i.test(b.innerText||'')).length;
    return { desborde, tablaVisible, chips, ancho: document.documentElement.scrollWidth };
  `);
  chequear(`Temporada ${etiqueta} (${w}px): sin desborde`, r.desborde === false, JSON.stringify(r));
  chequear(`Temporada ${etiqueta} (${w}px): sin tabla con scroll (usa tarjetas)`, r.tablaVisible === false, JSON.stringify(r));
  chequear(`Temporada ${etiqueta} (${w}px): se ven las quincenas`, r.chips >= 8, `chips=${r.chips}`);
}
await s.cerrar();
resumen();
