/**
 * LA BANDEJA AGUANTA LO QUE MANDA REALTIME — el crash del 31-ago, embotellado.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Lo que pasó: Postgres NO mete en el WAL las columnas TOASTeadas (jsonb de
 * +2 KB) que un UPDATE no tocó. Marcar leída o cambiar el estado de un hilo
 * LARGO dispara un evento de realtime cuyo `payload.new` viene SIN `mensajes`
 * (medido: 15 claves de 16). El panel reemplazaba la fila entera con eso y el
 * siguiente render reventaba la pantalla: "Se rompió esta sección", en el panel
 * de Mateo. Intermitente: hizo falta que los hilos reales pasaran los 2 KB.
 *
 * Esta suite reproduce EXACTAMENTE esa secuencia contra la pantalla real:
 * siembra un hilo gordo (sonda, se barre en el finally), lo actualiza sin tocar
 * los mensajes con la pestaña abierta, y afirma que la pantalla sigue viva.
 *
 * USO: APP=https://potentepropiedades.com node e2e/bandeja-en-vivo.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { nuevaPestania, chequear, resumen } from "./cdp.mjs";
import { pedirSesion, guionSesion, CUENTAS } from "./login.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(readFileSync(resolve(AQUI, "..", ".env.local"), "utf8")
  .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: eAuth } = await sb.auth.signInWithPassword(CUENTAS.mateo);
if (eAuth) { console.error("login:", eAuth.message); process.exit(1); }

// Sonda GORDA: texto aleatorio (incomprimible) para pasar seguro el umbral TOAST.
const ID = `CONV-VIVO-${Date.now().toString(36).toUpperCase()}`;
const azar = (n) => Array.from({ length: n }, () => Math.random().toString(36).slice(2)).join(" ");
const mensajes = Array.from({ length: 10 }, (_, i) => ({
  id: `M-${i}`, de: i % 2 ? "humano" : "cliente", texto: azar(40),
  horaISO: new Date(Date.now() - (10 - i) * 60000).toISOString(),
}));

// barrer sondas viejas de corridas cortadas ANTES de empezar
await sb.from("potente_conversaciones").delete().like("id", "CONV-VIVO-%");

const { send, evaluar, ir, cerrar, URL_APP } = await nuevaPestania();
try {
  await ir(URL_APP + "/", 3000);
  const sesion = await pedirSesion("mateo");
  await evaluar(guionSesion(sesion));
  await ir(URL_APP + "/panel/asistente", 9000);

  const vivaAntes = await evaluar(`return !/Se rompió esta sección/i.test(document.body.innerText || "")`);
  chequear("La pantalla arranca viva", Boolean(vivaAntes), "ya estaba rota al cargar");

  // 1 · nace el hilo gordo con la pestaña ABIERTA (evento INSERT: trae todo)
  const { error: eIns } = await sb.from("potente_conversaciones").insert({
    id: ID, canal: "web", nombre: "Sonda en vivo", contacto: "sonda-vivo",
    estado: "ia", noLeida: false, mensajes,
  });
  chequear("Siembra el hilo gordo (~5 KB de mensajes)", !eIns, eIns?.message ?? "");
  await new Promise((r) => setTimeout(r, 4000));

  // 2 · EL GATILLO: un update que NO toca los mensajes → realtime lo manda sin ellos
  const { error: eUp } = await sb.from("potente_conversaciones").update({ motivo: "sonda: toque de columna" }).eq("id", ID);
  chequear("Update de una columna sola (como marcar leída)", !eUp, eUp?.message ?? "");
  await new Promise((r) => setTimeout(r, 5000));

  const estado = await evaluar(`
    const t = document.body.innerText || "";
    return JSON.stringify({
      rota: /Se rompió esta sección/i.test(t),
      bandeja: /Bandeja|conversaci/i.test(t),
    });
  `);
  const e = JSON.parse(estado);
  chequear("🔑 La pantalla SIGUE VIVA tras el update del hilo gordo (el crash del 31-ago)", !e.rota, e.rota ? "SE ROMPIÓ: payload sin mensajes reemplazó la fila" : "");
  chequear("…y la bandeja sigue en pantalla", e.bandeja, "");

  // 3 · RÁFAGA: tres updates de columnas seguidos, sin respiro — como cuando
  //     la oficina marca leída, deriva y anota el motivo en el mismo minuto.
  await sb.from("potente_conversaciones").update({ motivo: "sonda: rafaga 1" }).eq("id", ID);
  await sb.from("potente_conversaciones").update({ noLeida: true }).eq("id", ID);
  await sb.from("potente_conversaciones").update({ motivo: "sonda: rafaga 2", noLeida: false }).eq("id", ID);
  await new Promise((r) => setTimeout(r, 5000));
  const vivaRafaga = await evaluar(`return !/Se rompió esta sección/i.test(document.body.innerText || "")`);
  chequear("Aguanta una RÁFAGA de tres updates seguidos", Boolean(vivaRafaga), "se rompió en la ráfaga");

  // 4 · update del hilo gordo mientras la pestaña NAVEGA a otra pantalla del panel
  //     (el provider vive arriba de todas: el evento llega igual, con otra vista montada)
  await ir(URL_APP + "/panel/cartera", 4000);
  await sb.from("potente_conversaciones").update({ motivo: "sonda: en otra pantalla" }).eq("id", ID);
  await new Promise((r) => setTimeout(r, 4000));
  await ir(URL_APP + "/panel/asistente", 7000);
  const vivaNav = await evaluar(`return !/Se rompió esta sección/i.test(document.body.innerText || "")`);
  chequear("Aguanta el evento llegando con OTRA pantalla montada (y volver)", Boolean(vivaNav), "se rompió al volver");

  // 5 · DELETE del hilo gordo con la pestaña mirando la bandeja
  await sb.from("potente_conversaciones").delete().eq("id", ID);
  await new Promise((r) => setTimeout(r, 4000));
  const vivaDel = await evaluar(`return !/Se rompió esta sección/i.test(document.body.innerText || "")`);
  chequear("Aguanta el BORRADO del hilo en vivo", Boolean(vivaDel), "se rompió con el DELETE");

  // 6 · y el último toque de siempre, sobre una fila que YA NO existe (update sin filas)
  // (bis) · y otro toque más, sobre la MISMA fila ya "vieja" en memoria
  await sb.from("potente_conversaciones").update({ noLeida: false }).eq("id", ID);
  await new Promise((r) => setTimeout(r, 4000));
  const viva2 = await evaluar(`return !/Se rompió esta sección/i.test(document.body.innerText || "")`);
  chequear("Aguanta un update sobre una fila que YA NO existe (0 filas, sin evento)", Boolean(viva2), "se rompió con el update huérfano");
} finally {
  // En el FINALLY: si una aserción explota, la sonda no queda en la bandeja de Mateo.
  await sb.from("potente_conversaciones").delete().eq("id", ID);
  await cerrar();
}
resumen();
