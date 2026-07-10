// Una sola verificacion: ¿produccion ya sirve la Temporada en tarjetas (fix) o todavia la tabla vieja?
import { sesion } from "./cdp2.mjs";
const APP = process.env.APP || "https://potente-propiedades.onrender.com";
const s = await sesion();
await s.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 780, deviceScaleFactor: 1, mobile: true });
await s.ir(APP + "/", 1200);
await s.evaluar(`localStorage.clear(); localStorage.setItem("potente_demo_auth","1"); localStorage.setItem("potente_perfil_activo","mateo"); return 1;`);
await s.ir(APP + "/panel/temporada", 4500);
const r = await s.evaluar(`
  await new Promise(r=>setTimeout(r,700));
  return { tablaVisible: [...document.querySelectorAll('main table')].some(t => t.offsetParent) };
`);
await s.cerrar();
process.exit(r.tablaVisible ? 1 : 0); // 0 = fix ya vivo, 1 = todavia la vieja
