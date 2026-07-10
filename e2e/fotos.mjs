// ¿Sobrevive una foto cargada desde el panel al cierre del navegador?
// Sin Supabase Storage guardábamos URL.createObjectURL(), que muere con la
// pestaña: la propiedad quedaba y la foto aparecía rota.
import { sesion, chequear, resumen } from "./cdp2.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP || "http://localhost:5177";

// Un JPEG mínimo, de verdad.
const jpg = path.join(os.tmpdir(), "potente-e2e-foto.jpg");
fs.writeFileSync(
  jpg,
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAQABABAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/AL+AAAAAAAAAf//Z",
    "base64"
  )
);

const TITULO = "TEST Foto E2E";

/* ---- 1. Subir la foto y publicar ---- */
const a = await sesion();
await a.metrica(1440, 950);
await a.ir(APP + "/", 900);
await a.evaluar(`Object.keys(localStorage).filter(k=>k.startsWith('potente_demo_')).forEach(k=>localStorage.removeItem(k));
  localStorage.setItem('potente_demo_auth','1'); localStorage.setItem('potente_perfil_activo','mateo'); return 1;`);
await a.ir(APP + "/panel/cargar", 3400);

const doc = await a.send("DOM.getDocument");
const input = await a.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "main input[type=file]" });
if (!input.nodeId) { console.log("FAIL: no hay input de fotos en /panel/cargar"); process.exit(1); }
await a.send("DOM.setFileInputFiles", { files: [jpg], nodeId: input.nodeId });
await new Promise((r) => setTimeout(r, 1500));

const guardado = await a.evaluar(`
  const setV = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  const t = [...document.querySelectorAll('main input')].find(i => /Ej: Departamento/.test(i.placeholder||''));
  const z = [...document.querySelectorAll('main input')].find(i => /Punta Mogotes/.test(i.placeholder||''));
  setV.call(t, ${JSON.stringify(TITULO)}); t.dispatchEvent(new Event('input',{bubbles:true}));
  setV.call(z, 'Chauvín');                 z.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,400));
  [...document.querySelectorAll('main button')].find(b=>/Publicar propiedad/i.test(b.innerText||'')).click();
  await new Promise(r=>setTimeout(r,1400));
  const props = JSON.parse(localStorage.getItem('potente_demo_propiedades')||'{}').data||[];
  const p = props.find(x => (x.titulo||'').includes(${JSON.stringify(TITULO)}));
  const url = p && p.fotos && p.fotos[0] ? p.fotos[0] : '';
  return { guardada: !!p, tieneFoto: !!url, esBlob: url.startsWith('blob:'), esDataUrl: url.startsWith('data:image/'), pesoKB: Math.round(url.length/1024) };
`);
chequear("Se publica la propiedad con foto", guardado.guardada && guardado.tieneFoto, JSON.stringify(guardado));
chequear("La foto NO es un blob: (moriría al cerrar el navegador)", guardado.esBlob === false, JSON.stringify(guardado));
chequear("La foto queda como data URL comprimida", guardado.esDataUrl === true, `peso ${guardado.pesoKB} KB`);
chequear("La foto pesa poco (no revienta el navegador)", guardado.pesoKB < 800, `peso ${guardado.pesoKB} KB`);
await a.cerrar();

/* ---- 2. Pestaña nueva: como si volviera al día siguiente ---- */
const b = await sesion();
await b.metrica(1440, 950);
await b.ir(APP + "/panel/cartera", 3400);
const trasCerrar = await b.evaluar(`
  await new Promise(r=>setTimeout(r,900));
  const props = JSON.parse(localStorage.getItem('potente_demo_propiedades')||'{}').data||[];
  const p = props.find(x => (x.titulo||'').includes(${JSON.stringify(TITULO)}));
  if (!p) return { noEsta: true };
  const url = p.fotos[0];
  const carga = await new Promise(res => { const im=new Image(); im.onload=()=>res(true); im.onerror=()=>res(false); im.src=url; setTimeout(()=>res(false),2500); });
  const rotas = [...document.querySelectorAll('main img')].filter(i => i.complete && i.naturalWidth === 0).length;
  return { carga, rotas };
`);
chequear("La propiedad sigue ahí en una sesión nueva", !trasCerrar.noEsta, JSON.stringify(trasCerrar));
chequear("La foto todavía se ve", trasCerrar.carga === true, JSON.stringify(trasCerrar));
chequear("No hay imágenes rotas en la Cartera", trasCerrar.rotas === 0, JSON.stringify(trasCerrar));
await b.cerrar();

resumen();
