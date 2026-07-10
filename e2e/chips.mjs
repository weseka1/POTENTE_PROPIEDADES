import { nuevaPestania, chequear, resumen } from "./cdp.mjs";

const APP = process.env.APP || "http://localhost:5177";
const p = await nuevaPestania();

await p.ir(APP + "/", 1000);
await p.evaluar(`localStorage.clear(); localStorage.setItem("potente_demo_auth","1"); localStorage.setItem("potente_perfil_activo","mateo"); return 1;`);

const MEDIR = `
  await new Promise(r=>setTimeout(r,600));
  const nombres = ['Todos los canales','WhatsApp','Instagram','Messenger','Chat en tu web','Email','Teléfono'];
  const chips = [...document.querySelectorAll('button[aria-label]')].filter(b =>
    nombres.some(n => (b.getAttribute('aria-label')||'').startsWith(n))
  );
  if (!chips.length) return { error: 'no encontre chips' };
  const fila = chips[0].parentElement;
  const cr = fila.getBoundingClientRect();
  const cs = getComputedStyle(fila);
  const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
  const izq = cr.left + padL - 1, der = cr.right - padR + 1;
  const detalle = chips.map(b => {
    const r = b.getBoundingClientRect();
    return {
      txt: (b.getAttribute('aria-label')||'').split(' ')[0],
      visible: !!b.offsetParent && r.width > 0,
      dentro: r.left >= izq && r.right <= der,
      top: Math.round(r.top),
    };
  });
  const filas = new Set(detalle.map(d => d.top)).size;
  return {
    n: chips.length,
    todosVisibles: detalle.every(d => d.visible),
    todosDentro: detalle.every(d => d.dentro),
    cortados: detalle.filter(d => !d.dentro).map(d => d.txt),
    filas,
    scrollH: fila.scrollWidth > fila.clientWidth + 1,
    desbordePagina: document.documentElement.scrollWidth > window.innerWidth + 2,
    alto: Math.round(cr.height),
  };
`;

for (const w of [360, 390, 430, 490, 640, 768, 900, 1024, 1280, 1440]) {
  await p.metrica(w, 860);
  await p.ir(APP + "/panel/asistente", 3000);
  const r = await p.evaluar(MEDIR);
  if (r.error) { chequear(`${w}px`, false, r.error); continue; }
  const bien = r.n === 7 && r.todosVisibles && r.todosDentro && !r.scrollH && !r.desbordePagina;
  chequear(
    `${String(w).padStart(4)}px · 7 canales visibles y sin cortar`,
    bien,
    `chips=${r.n} filas=${r.filas} alto=${r.alto}px${r.cortados.length ? " cortados=" + r.cortados.join(",") : ""}${r.scrollH ? " SCROLL-H" : ""}${r.desbordePagina ? " DESBORDE-PAGINA" : ""}`
  );
}

await p.cerrar();
resumen();
