import { sesion } from "./cdp2.mjs";
const APP = process.env.APP || "https://potente-propiedades.onrender.com";
const s = await sesion();
await s.send("Network.enable");
await s.send("Network.clearBrowserCache");                    // tirar cache HTTP
await s.send("Network.setCacheDisabled", { cacheDisabled: true });
await s.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 780, deviceScaleFactor: 1, mobile: true });
await s.ir(APP + "/?nocache=" + Math.floor(Math.random()*1e9), 1600);
await s.evaluar(`localStorage.clear(); localStorage.setItem("potente_demo_auth","1"); localStorage.setItem("potente_perfil_activo","mateo"); return 1;`);
await s.ir(APP + "/panel/temporada", 5000);
const r = await s.evaluar(`
  await new Promise(r=>setTimeout(r,900));
  return {
    tablaVisible: [...document.querySelectorAll('main table')].some(t => t.offsetParent),
    tieneTarjetas: !![...document.querySelectorAll('main button')].find(b => /· PICO/.test(b.innerText||'')),
  };
`);
await s.cerrar();
console.log("tablaVisible:", r.tablaVisible, "| tarjetas nuevas:", r.tieneTarjetas);
process.exit(r.tablaVisible ? 1 : 0);
