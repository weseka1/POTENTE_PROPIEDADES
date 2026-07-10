// Detector de botones muertos, v2.
// Antes de CADA click: datos de demo reseteados + pagina recargada.
// "Paso algo" = navego | modal | toast | descarga | window.open | confirm |
//               el HTML cambio (comparacion exacta) | los datos guardados cambiaron.
import { sesion } from "./cdp2.mjs";
import fs from "node:fs";

const APP = process.env.APP || "http://localhost:5177";
const DESCARGAS = process.env.DESCARGAS || path.join(os.tmpdir(), "potente-e2e-bajadas");

const RUTAS = [
  "/panel", "/panel/asistente", "/panel/cargar", "/panel/fichas", "/panel/planos",
  "/panel/temporada", "/panel/cartera", "/panel/leads", "/panel/crm", "/panel/pipeline",
  "/panel/agenda", "/panel/tasaciones", "/panel/arrendamientos", "/panel/reportes",
];

const s = await sesion({ descargasEn: DESCARGAS });
await s.metrica(1440, 950);
await s.ir(APP + "/", 1000);

const SEL = "main button";

// borra solo los datos de demo; deja la sesion y el perfil
const LIMPIAR = `
  Object.keys(localStorage).filter(k => k.startsWith('potente_demo_') && k !== 'potente_demo_auth').forEach(k => localStorage.removeItem(k));
  localStorage.setItem('potente_demo_auth','1');
  localStorage.setItem('potente_perfil_activo','mateo');
  return 1;
`;

const listar = `
  await new Promise(r => setTimeout(r, 900));
  const NL = String.fromCharCode(10);
  return [...document.querySelectorAll(${JSON.stringify(SEL)})]
    .filter(b => b.offsetParent && !b.disabled)
    .map((b, i) => ({ i, txt: ((b.innerText||'').trim() || b.getAttribute('aria-label') || b.title || '(icono)').split(NL).join(' ').slice(0,36) }));
`;

const clickear = (i) => `
  await new Promise(r => setTimeout(r, 900));
  const NL = String.fromCharCode(10);
  const snapLS = () => JSON.stringify(Object.keys(localStorage).filter(k=>k.startsWith('potente_demo_')).sort().map(k=>[k, localStorage.getItem(k)]));
  const antesUrl = location.href;
  const antesHtml = document.body.innerHTML;
  const antesLS = snapLS();
  const b = [...document.querySelectorAll(${JSON.stringify(SEL)})].filter(x => x.offsetParent && !x.disabled)[${i}];
  if (!b) return { falta: true };
  const etiqueta = ((b.innerText||'').trim() || b.getAttribute('aria-label') || b.title || '(icono)').split(NL).join(' ').slice(0,36);
  b.click();
  await new Promise(r => setTimeout(r, 900));
  const toasts = document.querySelector('[data-toasts]');
  return {
    etiqueta,
    errores: (window.__errs||[]).filter(e => !/Warning:|DevTools/.test(e)),
    navego: location.href !== antesUrl,
    modal: !!document.querySelector('[role=dialog]'),
    toast: !!(toasts && toasts.children.length),
    htmlCambio: document.body.innerHTML !== antesHtml,
    datosCambio: snapLS() !== antesLS,
    abrio: (window.__abiertos||[]).length > 0,
    confirms: window.__confirms || 0,
    roto: /algo salió mal|Se rompió/i.test(document.body.innerText||''),
  };
`;

let total = 0;
const muertos = [], rotos = [];
const lineas = [];
const log = (t) => { lineas.push(t); console.log(t); };

for (const ruta of RUTAS) {
  await s.ir(APP + ruta, 1200);
  await s.evaluar(LIMPIAR);
  await s.ir(APP + ruta, 3000);
  const lista = await s.evaluar(listar);
  log(`\n===== ${ruta}  (${lista.length} botones) =====`);
  for (const { i } of lista) {
    await s.ir(APP + ruta, 1000);
    await s.evaluar(LIMPIAR);
    await s.ir(APP + ruta, 2400);
    s.limpiarEventos();
    const r = await s.evaluar(clickear(i));
    if (r.falta) continue;
    total++;
    const bajo = s.descargas().length > 0;
    const paso = r.navego || r.modal || r.toast || r.htmlCambio || r.datosCambio || r.abrio || bajo || r.confirms > 0;
    if (r.roto || r.errores.length) {
      rotos.push({ ruta, etiqueta: r.etiqueta, err: r.errores.slice(0, 2) });
      log(`  ROTO   [${String(i).padStart(2)}] "${r.etiqueta}" ${r.errores.slice(0,1).join("").slice(0,90)}`);
    } else if (!paso) {
      muertos.push({ ruta, etiqueta: r.etiqueta });
      log(`  MUERTO [${String(i).padStart(2)}] "${r.etiqueta}"`);
    } else {
      const que = [r.navego && "navega", r.modal && "modal", r.toast && "toast", bajo && "descarga", r.abrio && "abre", r.confirms && "confirm", r.datosCambio && "guarda", r.htmlCambio && "cambia"].filter(Boolean).join("+");
      log(`  ok     [${String(i).padStart(2)}] "${r.etiqueta}" -> ${que}`);
    }
  }
}

log(`\n######## ${total} botones probados | ${muertos.length} sin efecto | ${rotos.length} rotos ########`);
if (muertos.length) { log("\nSIN EFECTO:"); muertos.forEach((m) => log(` - ${m.ruta} · "${m.etiqueta}"`)); }
if (rotos.length) { log("\nROTOS:"); rotos.forEach((m) => log(` - ${m.ruta} · "${m.etiqueta}" · ${m.err.join(" | ").slice(0,120)}`)); }

fs.writeFileSync("informe-botones.txt", lineas.join("\n"));
fs.writeFileSync("informe-botones.json", JSON.stringify({ total, muertos, rotos }, null, 1));
await s.cerrar();
