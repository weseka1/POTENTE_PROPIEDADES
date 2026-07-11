import { sesion } from "./cdp2.mjs";
const APP = process.env.APP || "https://potente-propiedades.onrender.com";
const s = await sesion();
await s.send("Network.enable");
await s.send("Network.clearBrowserCache");
await s.send("Network.setCacheDisabled", { cacheDisabled: true });
await s.metrica(1440, 950);
await s.ir(APP + "/?n=" + Math.floor(Math.random()*1e9), 1600);
// inyectamos datos VIEJOS (reserva sin fechas, version vieja) = lo que rompia
await s.evaluar(`
  localStorage.clear();
  localStorage.setItem("potente_demo_auth","1");
  localStorage.setItem("potente_perfil_activo","mateo");
  localStorage.setItem("potente_demo_reservas_temporada", JSON.stringify({ v:"2026-07-09b", data:[{ id:"OLD-1", unidadId:"TMP-01", tramoId:"ene-2", inquilino:"Viejo", contacto:"x", personas:2, montoTotalARS:100000, senaARS:0, garantiaARS:0, estado:"confirmada", creadaISO:"2026-09-20" }] }));
  return 1;
`);
await s.ir(APP + "/panel/temporada", 5000);
const r = await s.evaluar(`
  await new Promise(r=>setTimeout(r,900));
  const txt = document.body.innerText||'';
  return { roto: /Se rompió esta sección|Cannot read properties/i.test(txt), calendario: /Diciembre 2026/.test(txt) };
`);
await s.cerrar();
console.log("roto:", r.roto, "| calendario:", r.calendario);
process.exit((!r.roto && r.calendario) ? 0 : 1);
