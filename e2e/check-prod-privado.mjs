import { sesion } from "./cdp2.mjs";
const APP = process.env.APP || "https://potente-propiedades.onrender.com";
const s = await sesion();
await s.send("Network.enable");
await s.send("Network.clearBrowserCache");
await s.send("Network.setCacheDisabled", { cacheDisabled: true });
await s.ir(APP + "/?n=" + Math.floor(Math.random()*1e9), 1600);
await s.evaluar(`localStorage.clear(); localStorage.setItem("potente_demo_auth","1"); localStorage.setItem("potente_perfil_activo","mateo"); return 1;`);
await s.ir(APP + "/panel/cargar", 5000);
const r = await s.evaluar(`
  await new Promise(r=>setTimeout(r,900));
  return { tieneCandado: /no se muestra en la web/i.test(document.body.innerText||'') };
`);
await s.cerrar();
console.log(r.tieneCandado ? "VIVO: el candado de privacidad esta en produccion" : "PENDIENTE: produccion todavia sin el ultimo cambio");
process.exit(r.tieneCandado ? 0 : 1);
