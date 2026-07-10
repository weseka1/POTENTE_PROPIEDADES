// Reproduce el bug de produccion: datos VIEJOS cacheados (reservas con quincena,
// sin desdeISO/hastaISO) rompian la seccion Temporada al llegar el calendario.
// Verifica que ya NO se rompe: ni con cache viejo (se descarta por SEED_VERSION),
// ni con una reserva malformada que igual llegue (los guards la ignoran).
import { sesion, chequear, resumen } from "./cdp2.mjs";
const APP = process.env.APP || "http://localhost:5177";

const s = await sesion();
await s.metrica(1440, 950);

const roto = `/Se rompió esta sección|Cannot read properties/i.test(document.body.innerText||'')`;

/* Caso 1: cache con la VERSION VIEJA + reservas estilo quincena (sin fechas). */
await s.ir(APP + "/", 900);
await s.evaluar(`
  localStorage.clear();
  localStorage.setItem("potente_demo_auth","1");
  localStorage.setItem("potente_perfil_activo","mateo");
  // version vieja + reserva vieja (tramoId, sin desdeISO/hastaISO)
  localStorage.setItem("potente_demo_reservas_temporada", JSON.stringify({
    v: "2026-07-09b",
    data: [{ id:"OLD-1", unidadId:"TMP-01", tramoId:"ene-2", inquilino:"Viejo Dato", contacto:"x", personas:2, montoTotalARS:100000, senaARS:30000, garantiaARS:0, estado:"confirmada", creadaISO:"2026-09-20" }]
  }));
  return 1;
`);
await s.ir(APP + "/panel/temporada", 3500);
const c1 = await s.evaluar(`await new Promise(r=>setTimeout(r,800)); return { roto: ${roto}, hayCalendario: /Diciembre 2026/.test(document.body.innerText||'') };`);
chequear("Cache viejo (version vieja): la sección NO se rompe", c1.roto === false, JSON.stringify(c1));
chequear("Cache viejo: se descarta y aparece el calendario", c1.hayCalendario === true, JSON.stringify(c1));

/* Caso 2: reserva malformada bajo la version ACTUAL (guards defensivos). */
await s.ir(APP + "/", 900);
await s.evaluar(`
  localStorage.clear();
  localStorage.setItem("potente_demo_auth","1");
  localStorage.setItem("potente_perfil_activo","mateo");
  localStorage.setItem("potente_demo_reservas_temporada", JSON.stringify({
    v: "2026-07-10-fechas",
    data: [
      { id:"BAD-1", unidadId:"TMP-01", inquilino:"Sin Fechas", contacto:"x", personas:2, montoTotalARS:100000, senaARS:0, garantiaARS:0, estado:"confirmada", creadaISO:"2026-09-20" },
      { id:"OK-1", unidadId:"TMP-01", desdeISO:"2027-01-05", hastaISO:"2027-01-10", noches:5, inquilino:"Con Fechas", contacto:"y", personas:3, montoTotalARS:300000, senaARS:0, garantiaARS:0, estado:"senada", creadaISO:"2026-09-20" }
    ]
  }));
  return 1;
`);
await s.ir(APP + "/panel/temporada", 3500);
const c2 = await s.evaluar(`await new Promise(r=>setTimeout(r,800)); return { roto: ${roto}, hayCalendario: /Diciembre 2026/.test(document.body.innerText||'') };`);
chequear("Reserva malformada: la sección NO se rompe", c2.roto === false, JSON.stringify(c2));
chequear("Reserva malformada: el calendario igual renderiza", c2.hayCalendario === true, JSON.stringify(c2));

await s.cerrar();
resumen();
