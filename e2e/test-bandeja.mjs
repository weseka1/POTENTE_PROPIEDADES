import { nuevaPestania, chequear, resumen } from "./cdp.mjs";

const APP = process.env.APP || "http://localhost:5177";
const p = await nuevaPestania();
const { evaluar, ir } = p;

const LISTA = "[data-bandeja=lista]";
const HILO = "[data-bandeja=hilo]";

const HELPERS = `
window.__q = (sel) => document.querySelector(sel);
window.__all = (sel) => [...document.querySelectorAll(sel)];
window.__txt = () => document.body.innerText;
window.__vis = (el) => !!el && !!el.offsetParent;
window.__norm = (s) => (s || '').split(/[\\s\\u00a0]+/).filter(Boolean).join(' ');
window.__btnPorTexto = (t) => [...document.querySelectorAll('button,a')].find(b => (b.innerText||'').trim().toLowerCase().includes(t.toLowerCase()));
window.__click = (t) => { const b = window.__btnPorTexto(t); if(!b) throw new Error('no encontre boton: '+t); b.click(); return true; };
window.__esperar = (ms=350) => new Promise(r=>setTimeout(r,ms));
window.__escribir = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
  setter.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true}));
};
window.__abiertos = [];
if (!window.__openParcheado) { window.open = (u)=>{ window.__abiertos.push(u); return null; }; window.__openParcheado = 1; }
`;

const cargar = async () => {
  await ir(APP + "/panel/asistente", 3400);
  await evaluar(HELPERS + " return 1;");
};

await p.metrica(1440, 900); // escritorio: las burbujas muestran el nombre del canal
await ir(APP + "/", 900);
await evaluar(`localStorage.clear(); localStorage.setItem("potente_demo_auth","1"); return 1;`);
await cargar();

/* 1. La pestana vieja se fue */
const t = await evaluar(`return __txt();`);
chequear("Ya no existe 'Trabajo del dia'", !t.includes("Trabajo del día"));
chequear("Existe la pestana 'Conversaciones'", t.includes("Conversaciones"));

/* 2. Burbujas por canal con los conteos reales */
const burbujas = await evaluar(`
  await __esperar(500);
  const nombres = ['Todos','WhatsApp','Instagram','Messenger','Web','Mail','Teléfono'];
  return __all('button')
    .map(x => __norm(x.innerText))
    .filter(txt => nombres.some(n => txt.startsWith(n + ' ')))
    .map(txt => txt.split(' ').slice(0,2).join(' '));
`);
chequear("Hay 7 burbujas de canal", burbujas.length === 7, JSON.stringify(burbujas));
chequear("Todos = 8", burbujas.includes("Todos 8"), burbujas.join(" | "));
chequear("WhatsApp = 3", burbujas.includes("WhatsApp 3"));
chequear("Instagram = 1", burbujas.includes("Instagram 1"));
chequear("Messenger = 1", burbujas.includes("Messenger 1"));
chequear("Telefono = 1", burbujas.includes("Teléfono 1"));

/* 3. Badge del sidebar: la primera se abre sola, quedan 3 sin leer */
const badge = await evaluar(`
  const a = __all('a').find(x => (x.innerText||'').includes('Asistente IA'));
  return a ? __norm(a.innerText) : 'no encontrado';
`);
chequear("Sidebar muestra las no leidas restantes", badge.endsWith("3"), badge);

/* 4. Filtrar por Instagram */
const insta = await evaluar(`
  __click('Instagram'); await __esperar(500);
  return { lista: __all('${LISTA} button').length, hilo: __norm(__q('${HILO} header').innerText) };
`);
chequear("Filtro Instagram deja 1 conversacion", insta.lista === 1, String(insta.lista));
chequear("Filtro Instagram abre a Sofia", insta.hilo.includes("Sofía"), insta.hilo.slice(0, 60));
chequear("El hilo cambia de canal al filtrar", insta.hilo.includes("Instagram"));

/* 5. Conversacion derivada: contexto visible */
const nico = await evaluar(`
  __click('Todos'); await __esperar(450);
  __all('${LISTA} button').find(x => x.innerText.includes('Nicolás')).click();
  await __esperar(500);
  const sec = __q('${HILO}');
  return {
    motivo: sec.innerText.includes('te la pasó'),
    marcaIA: sec.innerText.includes('· IA'),
    teToca: __all('${LISTA} button').some(x => x.innerText.toLowerCase().includes('te toca a vos')),
    prop: !!sec.querySelector('a[href^="/propiedad/"]'),
    mensajes: __all('${HILO} .whitespace-pre-wrap').length,
  };
`);
chequear("Muestra por que la IA la derivo", nico.motivo);
chequear("Los mensajes de la IA estan marcados", nico.marcaIA);
chequear("La lista marca 'Te toca a vos'", nico.teToca);
chequear("Linkea la propiedad consultada", nico.prop);
chequear("Se ve la conversacion completa (6 mensajes)", nico.mensajes === 6, String(nico.mensajes));

/* 6. Responder abre WhatsApp y NO afirma que se envio */
const envio = await evaluar(`
  __escribir(__q('${HILO} textarea'), 'Hola Nico, te confirmo cochera y expensas.');
  await __esperar(250);
  __click('Abrir WhatsApp'); await __esperar(700);
  const sec = __q('${HILO}');
  return {
    url: window.__abiertos[window.__abiertos.length-1] || '',
    pregunta: sec.innerText.includes('¿Lo mandaste?'),
    si: !!__btnPorTexto('Sí, lo mandé'),
    no: !!__btnPorTexto('No lo mandé'),
  };
`);
chequear("Abre wa.me al numero correcto", envio.url.startsWith("https://wa.me/5492235528811"), envio.url.slice(0, 55));
chequear("Lleva el texto que escribi", decodeURIComponent(envio.url).includes("te confirmo cochera y expensas"));
chequear("Pregunta si lo mandaste (no lo asume)", envio.pregunta);
chequear("Ofrece 'Si, lo mande'", envio.si);
chequear("Ofrece 'No lo mande'", envio.no);

/* 7. Confirmar el envio mueve el lead */
const confirmado = await evaluar(`
  __click('Sí, lo mandé'); await __esperar(700);
  const leads = JSON.parse(localStorage.getItem('potente_demo_leads')||'{}');
  const l = (leads.data||[]).find(x => x.id === 'LEAD-102');
  return { estado: l && l.estado, yaNoPregunta: !__q('${HILO}').innerText.includes('¿Lo mandaste?') };
`);
chequear("Al confirmar, el lead pasa a contactado", confirmado.estado === "contactado", String(confirmado.estado));
chequear("Deja de preguntar una vez confirmado", confirmado.yaNoPregunta);

/* 8. 'No lo mande' borra el mensaje */
const descartado = await evaluar(`
  __escribir(__q('${HILO} textarea'), 'MENSAJE QUE NO VOY A MANDAR');
  await __esperar(250);
  __click('Abrir WhatsApp'); await __esperar(600);
  const antes = __q('${HILO}').innerText.includes('MENSAJE QUE NO VOY A MANDAR');
  __click('No lo mandé'); await __esperar(600);
  const despues = __q('${HILO}').innerText.includes('MENSAJE QUE NO VOY A MANDAR');
  return { antes, despues };
`);
chequear("El borrador entra al hilo al abrir el canal", descartado.antes);
chequear("'No lo mande' lo saca del hilo", !descartado.despues);

/* 9. Tomar / devolver / cerrar / reabrir */
const control = await evaluar(`
  __click('Todos'); await __esperar(400);
  __all('${LISTA} button').find(x => x.innerText.includes('Martín')).click(); await __esperar(500);
  __click('Tomar la conversación'); await __esperar(500);
  const tomada = !!__btnPorTexto('Devolver a');
  __click('Devolver a'); await __esperar(500);
  const devuelta = !!__btnPorTexto('Tomar la conversación');
  __q('${HILO} header button[title="Cerrar conversación"]').click(); await __esperar(500);
  const cerrada = __q('${HILO}').innerText.includes('Conversación cerrada');
  const hayReabrir = !!__btnPorTexto('Reabrir');
  __click('Reabrir'); await __esperar(500);
  const reabierta = !!__btnPorTexto('Tomar la conversación');
  return { tomada, devuelta, cerrada, hayReabrir, reabierta };
`);
chequear("Se puede tomar la conversacion", control.tomada);
chequear("Se puede devolver a la IA", control.devuelta);
chequear("Se puede cerrar", control.cerrada && control.hayReabrir);
chequear("Se puede reabrir", control.reabierta);

/* 10. Telefono no promete mandar texto */
const tel = await evaluar(`
  __click('Teléfono'); await __esperar(600);
  return { boton: !!__btnPorTexto('Llamar'), aviso: __q('${HILO}').innerText.includes('Se abre el teléfono') };
`);
chequear("Telefono muestra 'Llamar'", tel.boton);
chequear("Telefono aclara que solo abre el telefono", tel.aviso);

/* 11. Chat web si envia de verdad */
const web = await evaluar(`
  __click('Web'); await __esperar(600);
  return { aviso: __q('${HILO}').innerText.includes('se envía de verdad'), boton: !!__btnPorTexto('Enviar por el chat') };
`);
chequear("El chat web dice que sale de verdad", web.aviso);
chequear("El chat web tiene su propio boton", web.boton);

/* 12. Canal sin conectar lo avisa */
const sinConectar = await evaluar(`
  __click('Mail'); await __esperar(600);
  return { aviso: __q('${HILO}').innerText.includes('no está conectado'), link: !!__btnPorTexto('Conectar canal') };
`);
chequear("Avisa si el canal no esta conectado", sinConectar.aviso);
chequear("Ofrece ir a conectarlo", sinConectar.link);

/* 13. Persistencia */
await cargar();
const persistido = await evaluar(`
  await __esperar(600);
  __all('${LISTA} button').find(x => x.innerText.includes('Nicolás')).click();
  await __esperar(500);
  return __q('${HILO}').innerText.includes('cochera y expensas');
`);
chequear("La respuesta enviada sobrevive al refresh", persistido);

/* 14. Mobile 390px */
await p.metrica(390, 780);
await cargar();
const movil = await evaluar(`
  await __esperar(700);
  const desborde = document.documentElement.scrollWidth > window.innerWidth + 2;
  const listaVisible = __vis(__all('${LISTA} button')[0]);
  __all('${LISTA} button')[0].click(); await __esperar(600);
  const hiloVisible = __vis(__q('${HILO} textarea'));
  __q('${HILO} header button[aria-label="Volver"]').click(); await __esperar(600);
  const vuelve = __vis(__all('${LISTA} button')[0]) && !__vis(__q('${HILO} textarea'));
  return { desborde, listaVisible, hiloVisible, vuelve, ancho: document.documentElement.scrollWidth };
`);
chequear("Mobile: sin scroll horizontal", !movil.desborde, "scrollWidth=" + movil.ancho);
chequear("Mobile: se ve la lista", movil.listaVisible);
chequear("Mobile: al tocar se abre el hilo", movil.hiloVisible);
chequear("Mobile: 'Volver' regresa a la lista", movil.vuelve);

await p.cerrar();
resumen();
