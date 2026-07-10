// Reserva por fechas libres: elegir entrada/salida, noches correctas, anti-solape, persistencia.
import { sesion, chequear, resumen } from "./cdp2.mjs";
const APP = process.env.APP || "http://localhost:5177";

const s = await sesion();
await s.metrica(1440, 950);
await s.ir(APP + "/", 900);
await s.evaluar(`Object.keys(localStorage).filter(k=>k.startsWith('potente_demo_')).forEach(k=>localStorage.removeItem(k));
  localStorage.setItem('potente_demo_auth','1'); localStorage.setItem('potente_perfil_activo','mateo'); return 1;`);
await s.ir(APP + "/panel/temporada", 3600);

const AYUDA = `
  window.__mesCard = (nombre) => [...document.querySelectorAll('section .rounded-xl')].find(c => (c.querySelector('p')?.innerText||'').includes(nombre));
  window.__diaEn = (mesNombre, dia) => {
    const card = __mesCard(mesNombre);
    if (!card) return null;
    return [...card.querySelectorAll('button')].find(b => b.innerText.trim() === String(dia));
  };
  window.__reservas = () => { try { return (JSON.parse(localStorage.getItem('potente_demo_reservas_temporada')||'{}').data)||[]; } catch { return []; } };
  window.__modal = () => document.querySelector('[role=dialog]');
`;
await s.evaluar(AYUDA + " return 1;");

/* 1. Reservar del 12 al 15 de enero (unidad 1 = Piso alto, esos días están libres) */
const alta = await s.evaluar(`
  await new Promise(r=>setTimeout(r,600));
  const d12 = __diaEn('Enero 2027', 12); if (!d12) return { error: 'sin dia 12 enero' };
  d12.click(); await new Promise(r=>setTimeout(r,200));
  const d15 = __diaEn('Enero 2027', 15); d15.click(); await new Promise(r=>setTimeout(r,500));
  const m = __modal(); if (!m) return { error: 'no abrio el modal de reserva' };
  const txt = m.innerText;
  const inq = [...m.querySelectorAll('input')].find(i => /Nombre o familia/.test(i.placeholder||''));
  const setV = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  setV.call(inq, 'TEST Veraneante'); inq.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,200));
  [...m.querySelectorAll('button')].find(b => /Señar reserva/.test(b.innerText||'')).click();
  await new Promise(r=>setTimeout(r,700));
  const r = __reservas().find(x => x.inquilino === 'TEST Veraneante');
  return { muestra3Noches: /3\\s*noches/.test(txt), rango: /12\\/1 al 15\\/1/.test(txt.replace(/\\s+/g,' ')), reserva: r ? { desde: r.desdeISO, hasta: r.hastaISO, noches: r.noches, monto: r.montoTotalARS } : null };
`);
chequear("El modal muestra 3 noches", alta.muestra3Noches === true, JSON.stringify(alta));
chequear("El modal muestra el rango 12/1 al 15/1", alta.rango === true, JSON.stringify(alta));
chequear("Se guarda la reserva con fechas y noches", alta.reserva && alta.reserva.desde === "2027-01-12" && alta.reserva.hasta === "2027-01-15" && alta.reserva.noches === 3, JSON.stringify(alta.reserva));
chequear("El monto sugerido se calculó (>0)", alta.reserva && alta.reserva.monto > 0, JSON.stringify(alta.reserva));

/* 2. Solape: reservar del 1 al 15 de enero. Extremos libres, pero el rango cruza
      Solís (5-11) y la reserva nueva (12-14) → debe rechazar. */
const solape = await s.evaluar(`
  const d1 = __diaEn('Enero 2027', 1); d1.click(); await new Promise(r=>setTimeout(r,200));
  const d15 = __diaEn('Enero 2027', 15); d15.click(); await new Promise(r=>setTimeout(r,500));
  const sec = document.querySelector('section');
  const aviso = /pisa una reserva/i.test(sec.innerText||'');
  const modalAbierto = !!__modal();
  return { aviso, modalAbierto };
`);
chequear("Un rango que solapa NO abre reserva", solape.modalAbierto === false, JSON.stringify(solape));
chequear("Un rango que solapa avisa 'pisa una reserva'", solape.aviso === true, JSON.stringify(solape));

/* 3. Click en un día ocupado abre el detalle de esa reserva */
const detalle = await s.evaluar(`
  const d6 = __diaEn('Enero 2027', 6); // ocupado por Solís (5-10)
  d6.click(); await new Promise(r=>setTimeout(r,500));
  const m = __modal();
  const ok = m && /Solís/.test(m.innerText||'');
  if (m) [...m.querySelectorAll('button')].find(b=>/Listo/.test(b.innerText||''))?.click();
  return { abre: !!m, esSolis: !!ok };
`);
chequear("Tocar un día ocupado abre el detalle de la reserva", detalle.abre && detalle.esSolis, JSON.stringify(detalle));

/* 4. Persistencia tras refresh */
await s.ir(APP + "/panel/temporada", 3600);
const persiste = await s.evaluar(`
  await new Promise(r=>setTimeout(r,600));
  const r = (JSON.parse(localStorage.getItem('potente_demo_reservas_temporada')||'{}').data||[]).find(x=>x.inquilino==='TEST Veraneante');
  return { existe: !!r, noches: r?.noches };
`);
chequear("La reserva sobrevive al refresh", persiste.existe && persiste.noches === 3, JSON.stringify(persiste));

/* 5. Mobile: sin desborde, sin tabla */
await s.metrica(390, 800);
await s.ir(APP + "/panel/temporada", 3200);
const movil = await s.evaluar(`
  await new Promise(r=>setTimeout(r,600));
  return { desborde: document.documentElement.scrollWidth > window.innerWidth + 2, tablas: document.querySelectorAll('main table').length };
`);
chequear("Mobile: sin desborde horizontal", movil.desborde === false, JSON.stringify(movil));

await s.cerrar();
resumen();
