// Dispositivos reales, con touch activado y sin mouse.
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";

const APP = process.env.APP || "http://localhost:5177";
const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const UA_AND = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

const DISPOSITIVOS = [
  { n: "iPhone SE (2016)", w: 320, h: 568, dpr: 2, ua: UA_IOS },
  { n: "iPhone SE (2022)", w: 375, h: 667, dpr: 2, ua: UA_IOS },
  { n: "iPhone 14/15", w: 393, h: 852, dpr: 3, ua: UA_IOS },
  { n: "iPhone 15 Pro Max", w: 430, h: 932, dpr: 3, ua: UA_IOS },
  { n: "Galaxy S22", w: 360, h: 780, dpr: 3, ua: UA_AND },
  { n: "Pixel 8", w: 412, h: 915, dpr: 2.6, ua: UA_AND },
  { n: "iPad mini", w: 768, h: 1024, dpr: 2, ua: UA_IOS },
];

const p = await nuevaPestania();
await p.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await p.send("Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" });

await p.ir(APP + "/", 900);
await p.evaluar(`localStorage.clear(); localStorage.setItem("potente_demo_auth","1"); localStorage.setItem("potente_perfil_activo","mateo"); return 1;`);

const REVISAR = `
  await new Promise(r => setTimeout(r, 800));
  const W = window.innerWidth;
  const chips = [...document.querySelectorAll('button[aria-label]')].filter(b =>
    /Todos los canales|WhatsApp|Instagram|Messenger|Chat en tu web|Email|Teléfono/.test(b.getAttribute('aria-label')||''));
  const composer = document.querySelector('[data-bandeja=hilo] textarea');
  const fuente = composer ? parseFloat(getComputedStyle(composer).fontSize) : 0;
  // tamaño de los blancos tocables principales
  const chicos = [];
  for (const b of document.querySelectorAll('[data-bandeja=hilo] button, [data-bandeja=lista] button')) {
    const r = b.getBoundingClientRect();
    if (r.height > 0 && r.height < 28) chicos.push({ t: (b.innerText||b.title||'').slice(0,22), h: Math.round(r.height) });
  }
  return {
    iw: W,
    sw: document.documentElement.scrollWidth,
    chips: chips.length,
    chipsVisibles: chips.every(c => !!c.offsetParent),
    fuenteComposer: fuente,
    tactilesChicos: chicos.slice(0, 4),
  };
`;

for (const d of DISPOSITIVOS) {
  await p.send("Emulation.setDeviceMetricsOverride", { width: d.w, height: d.h, deviceScaleFactor: d.dpr, mobile: true });
  await p.send("Emulation.setUserAgentOverride", { userAgent: d.ua });
  await p.ir(APP + "/panel/asistente", 3200);
  const r = await p.evaluar(REVISAR);
  const sinDeformar = r.iw === d.w && r.sw <= d.w + 2;
  const chipsOk = r.chips === 7 && r.chipsVisibles;
  const fuenteOk = r.fuenteComposer >= 16 || d.w >= 768;
  const tactilOk = r.tactilesChicos.length === 0;
  chequear(
    `${d.n} (${d.w}px)`,
    sinDeformar && chipsOk && fuenteOk && tactilOk,
    `viewport=${r.iw}/${r.sw} chips=${r.chips} fuente=${r.fuenteComposer}px chicos=${r.tactilesChicos.map((c) => c.t + ":" + c.h + "px").join(",") || "ninguno"}`
  );
}

await p.cerrar();
resumen();
