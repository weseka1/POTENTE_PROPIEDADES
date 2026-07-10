import { sesion, chequear, resumen } from "./cdp2.mjs";
const APP = process.env.APP || "http://localhost:5177";
const s = await sesion();
await s.metrica(1440, 950);

const limpiar = async (ruta) => {
  await s.ir(APP + "/", 800);
  await s.evaluar(`Object.keys(localStorage).filter(k=>k.startsWith('potente_demo_')).forEach(k=>localStorage.removeItem(k));
    localStorage.setItem('potente_demo_auth','1'); localStorage.setItem('potente_perfil_activo','mateo'); return 1;`);
  await s.ir(APP + ruta, 3200);
};

/* 1. FICHAS: crear, guardar, refrescar, sigue ahi */
await limpiar("/panel/fichas");
const creada = await s.evaluar(`
  await new Promise(r=>setTimeout(r,700));
  const b = [...document.querySelectorAll('main button')].find(x => /Nueva ficha/i.test(x.innerText||''));
  if (!b) return { error: 'sin boton' };
  b.click(); await new Promise(r=>setTimeout(r,900));
  const t = [...document.querySelectorAll('main input')].find(i => /Ej: Departamento/.test(i.placeholder||''));
  if (!t) return { error: 'sin campo Referencia' };
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  set.call(t, 'TEST Ficha Persistente'); t.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,400));
  const g = [...document.querySelectorAll('button')].find(x => /Guardar/i.test(x.innerText||''));
  if (!g) return { error: 'sin boton guardar' };
  g.click(); await new Promise(r=>setTimeout(r,1100));
  const raw = localStorage.getItem('potente_demo_fichas');
  return { hayClave: !!raw, cuantas: raw ? (JSON.parse(raw).data||[]).length : 0 };
`);
chequear("Fichas · se guardan en el navegador", creada.hayClave === true && creada.cuantas >= 1, JSON.stringify(creada));

await s.ir(APP + "/panel/fichas", 3200);
const trasRefresh = await s.evaluar(`
  await new Promise(r=>setTimeout(r,900));
  const raw = localStorage.getItem('potente_demo_fichas');
  const n = raw ? (JSON.parse(raw).data||[]).length : 0;
  const enPantalla = !/no hay fichas|todavía no/i.test(document.body.innerText||'');
  return { n, enPantalla };
`);
chequear("Fichas · sobreviven al refresh", trasRefresh.n >= 1, JSON.stringify(trasRefresh));

/* 2. PLANOS: ningun boton sin nombre accesible */
await limpiar("/panel/planos");
const planos = await s.evaluar(`
  await new Promise(r=>setTimeout(r,900));
  const bs = [...document.querySelectorAll('main button')].filter(b => b.offsetParent && !b.disabled);
  const mudos = bs.filter(b => !(b.innerText||'').trim() && !b.getAttribute('aria-label') && !b.title);
  return { total: bs.length, mudos: mudos.length };
`);
chequear("Planos · ningún botón queda sin nombre", planos.mudos === 0, `total=${planos.total} mudos=${planos.mudos}`);

/* 3. CARTERA: el panel lateral cerrado no es alcanzable con Tab */
await limpiar("/panel/cartera");
const drawer = await s.evaluar(`
  await new Promise(r=>setTimeout(r,900));
  const cerrar = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Cerrar');
  if (!cerrar) return { noExiste: true };
  // offsetParent null == visibility:hidden o display:none -> fuera del orden de tabulacion
  cerrar.focus();
  return { alcanzable: document.activeElement === cerrar, visibilidad: getComputedStyle(cerrar).visibility };
`);
chequear("Cartera · el panel cerrado no se puede tabular", drawer.noExiste === true || drawer.alcanzable === false, JSON.stringify(drawer));

/* 4. y el panel sigue abriendo bien */
const abre = await s.evaluar(`
  const tarj = [...document.querySelectorAll('main button')].find(b => (b.innerText||'').length > 25);
  tarj.click(); await new Promise(r=>setTimeout(r,900));
  const cerrar = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Cerrar');
  if (!cerrar) return { abrio: false };
  cerrar.focus();
  return { abrio: document.activeElement === cerrar && getComputedStyle(cerrar).visibility === 'visible' };
`);
chequear("Cartera · el panel abre y su botón Cerrar es usable", abre.abrio === true, JSON.stringify(abre));

await s.cerrar();
resumen();
