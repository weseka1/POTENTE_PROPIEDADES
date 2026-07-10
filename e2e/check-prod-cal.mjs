import { sesion } from "./cdp2.mjs";
const APP = process.env.APP || "https://potente-propiedades.onrender.com";
const s = await sesion();
await s.send("Network.enable");
await s.send("Network.clearBrowserCache");
await s.send("Network.setCacheDisabled", { cacheDisabled: true });
await s.metrica(1440, 950);
await s.ir(APP + "/?n=" + Math.floor(Math.random()*1e9), 1600);
await s.evaluar(`localStorage.clear(); localStorage.setItem("potente_demo_auth","1"); localStorage.setItem("potente_perfil_activo","mateo"); return 1;`);
await s.ir(APP + "/panel/temporada", 5000);
const r = await s.evaluar(`
  await new Promise(r=>setTimeout(r,900));
  const txt = document.body.innerText||'';
  return { calendario: /Diciembre 2026/.test(txt) && /\/noche/.test(txt), tabla: [...document.querySelectorAll('main table')].some(t=>t.offsetParent) };
`);
await s.cerrar();
console.log("calendario:", r.calendario, "| tabla vieja visible:", r.tabla);
process.exit(r.calendario ? 0 : 1);
