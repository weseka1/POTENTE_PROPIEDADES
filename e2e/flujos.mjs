// Flujos reales del panel: alta, edicion, baja, persistencia y exportaciones.
// El oraculo son los datos guardados (localStorage), no el DOM: si el dato no
// quedo, el boton no sirvio por mas lindo que se vea.
import { sesion, chequear, resumen } from "./cdp2.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP || "http://localhost:5177";
const DESCARGAS = process.env.DESCARGAS || path.join(os.tmpdir(), "potente-e2e-bajadas");

fs.rmSync(DESCARGAS, { recursive: true, force: true });
fs.mkdirSync(DESCARGAS, { recursive: true });

const s = await sesion({ descargasEn: DESCARGAS });
await s.metrica(1440, 950);

const AYUDA = `
window.__esperar = (ms=400) => new Promise(r=>setTimeout(r,ms));
window.__btn = (t, raiz) => [...(raiz||document).querySelectorAll('button')].find(b => (b.innerText||'').trim().toLowerCase().includes(t.toLowerCase()));
window.__click = (t, raiz) => { const b = window.__btn(t, raiz); if(!b) throw new Error('sin boton: '+t); b.click(); return true; };
window.__clickSuave = (t, raiz) => { const b = window.__btn(t, raiz); if(!b) return false; b.click(); return true; };
// El ÚLTIMO [role=dialog] del DOM, que es el que ve y toca una persona.
// 🔴 Desde el 12-ago puede haber DOS a la vez: la confirmación de borrado sale
// por portal al final del <body>, encima del modal de detalle (que vive en
// #root). Con `querySelector` esta suite agarraba el de ABAJO y volvía a
// clickear "Eliminar" del detalle en vez de confirmar: el borrado nunca pasaba
// y el chequeo quedaba rojo sin que hubiera un bug en la app.
window.__modal = () => [...document.querySelectorAll('[role=dialog]')].pop() || null;
window.__escribir = (el, v) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el, v);
  el.dispatchEvent(new Event('input',{bubbles:true}));
};
window.__porPh = (ph, raiz) => [...(raiz||document).querySelectorAll('input,textarea')].find(i => (i.placeholder||'').toLowerCase().includes(ph.toLowerCase()));
window.__llenar = (ph, v, raiz) => { const el = window.__porPh(ph, raiz); if(!el) throw new Error('sin campo: '+ph); window.__escribir(el, v); return true; };
window.__elegir = async (etiquetaParcial, raiz) => {
  const t = (raiz||document).querySelector('[aria-haspopup=listbox]');
  if (!t) throw new Error('sin select');
  t.click(); await window.__esperar(400);
  const op = [...document.querySelectorAll('[role=option]')].find(o => (o.innerText||'').toLowerCase().includes(etiquetaParcial.toLowerCase()));
  if (!op) throw new Error('sin opcion: '+etiquetaParcial);
  (op.querySelector('button') || op).click();
  await window.__esperar(400);
  return true;
};
window.__datos = (n) => { try { return (JSON.parse(localStorage.getItem('potente_demo_'+n)||'{}').data)||[]; } catch { return []; } };
`;

const limpiar = async (ruta) => {
  await s.ir(APP + "/", 800);
  await s.evaluar(`
    Object.keys(localStorage).filter(k => k.startsWith('potente_demo_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('potente_demo_auth','1');
    localStorage.setItem('potente_perfil_activo','mateo');
    return 1;
  `);
  await s.ir(APP + ruta, 3000);
  await s.evaluar(AYUDA + " return 1;");
};
const recargar = async (ruta) => { await s.ir(APP + ruta, 3000); await s.evaluar(AYUDA + " return 1;"); };

/* ================= CLIENTES (alta / edicion / baja / persistencia) ================= */
await limpiar("/panel/crm");
const antesCli = await s.evaluar(`return __datos('clientes').length;`);
const altaCli = await s.evaluar(`
  __click('Nuevo cliente'); await __esperar(700);
  const m = __modal(); if (!m) return { error: 'no abrio el modal' };
  __llenar('Jorge Lemos', 'TEST Juana Pruebas', m);
  await __esperar(300);
  __click('Guardar cliente', m); await __esperar(900);
  const d = __datos('clientes');
  return { total: d.length, existe: d.some(c => c.nombre === 'TEST Juana Pruebas'), modalCerrado: !__modal() };
`);
chequear("Clientes · se crea y se guarda", altaCli.existe === true && altaCli.total === antesCli + 1, JSON.stringify(altaCli));
chequear("Clientes · el modal se cierra al guardar", altaCli.modalCerrado === true);

await recargar("/panel/crm");
const persisteCli = await s.evaluar(`return __datos('clientes').some(c => c.nombre === 'TEST Juana Pruebas');`);
chequear("Clientes · sobrevive al refresh", persisteCli === true);

// El borrado vive dentro del modal de edicion del cliente.
const bajaCli = await s.evaluar(`
  const tarjeta = [...document.querySelectorAll('main *')].find(x => x.children.length && (x.innerText||'').includes('TEST Juana Pruebas') && (x.tagName === 'BUTTON' || x.onclick || x.className.includes('pcard')));
  const abrir = tarjeta && (tarjeta.tagName === 'BUTTON' ? tarjeta : tarjeta.querySelector('button')) ;
  if (abrir) abrir.click(); else {
    const t = [...document.querySelectorAll('main button, main [role=button], main tr')].find(x => (x.innerText||'').includes('TEST Juana Pruebas'));
    if (!t) return { error: 'no encuentro al cliente en la lista' };
    t.click();
  }
  await __esperar(800);
  let m = __modal();
  if (!m) return { error: 'no abrio el modal del cliente' };
  if (!__clickSuave('Eliminar', m)) return { error: 'no hay boton Eliminar en el modal' };
  await __esperar(800);
  const m2 = __modal();
  if (m2) { __clickSuave('Eliminar', m2) || __clickSuave('Sí', m2); await __esperar(800); }
  return { queda: __datos('clientes').some(c => c.nombre === 'TEST Juana Pruebas'), confirms: window.__confirms };
`);
chequear("Clientes · se borra de verdad", bajaCli.queda === false, JSON.stringify(bajaCli));

/* ================= AGENDA (alta + cambio de estado + baja) ================= */
await limpiar("/panel/agenda");
const altaVis = await s.evaluar(`
  __click('Nueva visita'); await __esperar(700);
  const m = __modal(); if (!m) return { error: 'no abrio el modal' };
  __llenar('Nombre del cliente', 'TEST Visitante', m); await __esperar(250);
  try { await __elegir('Chalet', m); } catch (e) { return { error: 'select: ' + e.message }; }
  __click('Agendar', m); await __esperar(900);
  const d = __datos('visitas');
  return { existe: d.some(v => v.clienteNombre === 'TEST Visitante'), total: d.length };
`);
chequear("Agenda · se agenda una visita", altaVis.existe === true, JSON.stringify(altaVis));

const estadoVis = await s.evaluar(`
  const fila = [...document.querySelectorAll('main *')].find(x => x.children.length && (x.innerText||'').includes('TEST Visitante') && x.querySelector('button[title="Confirmar"]'));
  if (!fila) return { error: 'sin fila' };
  fila.querySelector('button[title="Confirmar"]').click(); await __esperar(800);
  const v = __datos('visitas').find(v => v.clienteNombre === 'TEST Visitante');
  return { estado: v && v.estado };
`);
chequear("Agenda · confirmar cambia el estado", estadoVis.estado === "confirmada", JSON.stringify(estadoVis));

const bajaVis = await s.evaluar(`
  const fila = [...document.querySelectorAll('main *')].find(x => x.children.length && (x.innerText||'').includes('TEST Visitante') && x.querySelector('button[title="Eliminar"]'));
  if (!fila) return { error: 'sin fila' };
  fila.querySelector('button[title="Eliminar"]').click(); await __esperar(700);
  const m = __modal(); if (m) { __click('Elimin', m); await __esperar(800); }
  return { queda: __datos('visitas').some(v => v.clienteNombre === 'TEST Visitante') };
`);
chequear("Agenda · se elimina la visita", bajaVis.queda === false, JSON.stringify(bajaVis));

/* ================= TASACIONES ================= */
await limpiar("/panel/tasaciones");
const altaTas = await s.evaluar(`
  __click('Nueva tasación'); await __esperar(700);
  const m = __modal(); if (!m) return { error: 'no abrio' };
  __llenar('Nombre o razón social', 'TEST Tasador', m);
  __llenar('Teléfono o mail', '223 555-0000', m);
  __llenar('Barrio', 'Chauvín', m);
  await __esperar(300);
  __click('Registrar', m); await __esperar(900);
  return { existe: __datos('tasaciones').some(t => t.solicitante === 'TEST Tasador') };
`);
chequear("Tasaciones · se crea", altaTas.existe === true, JSON.stringify(altaTas));

/* ================= ARRENDAMIENTOS ================= */
await limpiar("/panel/arrendamientos");
const altaArr = await s.evaluar(`
  __click('Nuevo contrato'); await __esperar(700);
  const m = __modal(); if (!m) return { error: 'no abrio' };
  __llenar('Nombre o razón social', 'TEST Inquilino', m);
  try { await __elegir('Casa', m); } catch (e) { /* sigue sin propiedad */ }
  const mens = __porPh('1200', m); if (mens) __escribir(mens, '900');
  await __esperar(300);
  __click('Guardar contrato', m); await __esperar(900);
  return { existe: __datos('arrendamientos').some(a => a.arrendatario === 'TEST Inquilino') };
`);
chequear("Alquileres · se crea el contrato", altaArr.existe === true, JSON.stringify(altaArr));

/* ================= LEADS (cambio de estado) ================= */
await limpiar("/panel/leads");
const leadEstado = await s.evaluar(`
  const antes = __datos('leads')[0];
  const t = [...document.querySelectorAll('main [aria-haspopup=listbox]')].find(x => /^(Nueva|Contactado|Visita)/.test((x.innerText||'').trim()));
  if (!t) return { error: 'sin select de estado' };
  t.click(); await __esperar(400);
  const op = [...document.querySelectorAll('[role=option]')].find(o => /contactado/i.test(o.innerText||''));
  if (!op) return { error: 'sin opcion contactado' };
  op.click(); await __esperar(800);
  const d = __datos('leads');
  return { alguno: d.some(l => l.estado === 'contactado'), n: d.length };
`);
chequear("Consultas · cambiar el estado se guarda", leadEstado.alguno === true, JSON.stringify(leadEstado));

/* ================= REPORTES (descargas reales) ================= */
await limpiar("/panel/reportes");
s.limpiarEventos();
await s.evaluar(`__click('PDF'); return 1;`);
await new Promise((r) => setTimeout(r, 2500));
const pdfs = s.descargas().length;
s.limpiarEventos();
await s.evaluar(`__click('Excel'); return 1;`);
await new Promise((r) => setTimeout(r, 2500));
const excels = s.descargas().length;
const archivos = fs.existsSync(DESCARGAS) ? fs.readdirSync(DESCARGAS) : [];
chequear("Reportes · el PDF se descarga", pdfs > 0, `eventos=${pdfs}`);
chequear("Reportes · la planilla se descarga", excels > 0, `eventos=${excels}`);
chequear("Reportes · los archivos existen en disco", archivos.length >= 2, archivos.join(", "));

/* ================= CARGAR PROPIEDAD ================= */
await limpiar("/panel/cargar");
const antesProp = await s.evaluar(`return __datos('propiedades').length;`);
const altaProp = await s.evaluar(`
  const t = __porPh('Ej: Departamento') || document.querySelector('main input[type=text]');
  if (!t) return { error: 'sin campo titulo' };
  __escribir(t, 'TEST Depto de prueba');
  const z = __porPh('Punta Mogotes');
  if (!z) return { error: 'sin campo zona' };
  __escribir(z, 'Chauvín');
  await __esperar(400);
  __click('Publicar propiedad'); await __esperar(1200);
  const d = __datos('propiedades');
  return { total: d.length, existe: d.some(p => (p.titulo||'').includes('TEST Depto de prueba')) };
`);
chequear("Cargar propiedad · se publica y se guarda", altaProp.existe === true, JSON.stringify(altaProp));

await recargar("/panel/cartera");
const propEnCartera = await s.evaluar(`
  await __esperar(700);
  return { enDatos: __datos('propiedades').some(p => (p.titulo||'').includes('TEST Depto de prueba')),
           enPantalla: (document.body.innerText||'').includes('TEST Depto de prueba') };
`);
chequear("Cargar propiedad · aparece en la Cartera tras refrescar", propEnCartera.enDatos && propEnCartera.enPantalla, JSON.stringify(propEnCartera));

/* ================= FICHAS (persistencia) ================= */
await limpiar("/panel/fichas");
const fichas = await s.evaluar(`
  await __esperar(600);
  const hay = __btn('Nueva ficha');
  if (!hay) return { error: 'sin boton Nueva ficha' };
  hay.click(); await __esperar(900);
  const editorAbierto = !(document.body.innerText||'').includes('Nueva ficha') || !!document.querySelector('main input');
  const guardar = __btn('Guardar');
  if (guardar) { guardar.click(); await __esperar(900); }
  const clavesDemo = Object.keys(localStorage).filter(k => k.startsWith('potente_demo_'));
  return { editorAbierto, guardo: !!guardar, hayClaveFichas: clavesDemo.some(k => k.includes('ficha')) };
`);
chequear("Fichas · el editor abre", fichas.editorAbierto === true, JSON.stringify(fichas));
chequear("Fichas · la ficha se guarda en el navegador (persistencia)", fichas.hayClaveFichas === true, JSON.stringify(fichas));

await s.cerrar();
resumen();
