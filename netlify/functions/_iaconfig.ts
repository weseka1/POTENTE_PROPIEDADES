/**
 * EL CEREBRO QUE CARGA MATEO — leído desde la base, no desde su navegador.
 * ─────────────────────────────────────────────────────────────────────────────
 * Hasta el 27-ago todo lo que Mateo escribía en la pestaña "Cerebro" del panel
 * (el interruptor, el contexto, el conocimiento, las reglas) vivía SOLO en el
 * localStorage de su navegador. El server nunca lo leía: el Probador aprobaba
 * una Marina que no existía, y el interruptor "Activada" no apagaba nada.
 * Juani: «está activado que Marina responde sola, pero no responde nada».
 *
 * Migración 022: `potente_ia_config` (una fila, jsonb). El panel escribe ahí;
 * acá se lee y se normaliza a lo que el prompt necesita. Se lee con la llave
 * pública: la config no tiene secretos, y el visitante de la web la usa igual
 * (a través de Marina) en cada consulta.
 *
 * Si la base no responde, Marina NO se apaga: se usa lo último leído o la
 * identidad base de `_config.ts`. Un hipo de red no puede dejar a la web muda.
 */
export type Cerebro = {
  /** El interruptor del panel. En pausa, Marina no atiende en ningún canal. */
  activa: boolean;
  /** 023 · Qué hace cuando entra un mensaje que ella atiende:
   *   automatico  = responde y ENVÍA sola.
   *   supervisado = redacta, deja el borrador y lo pasa a una persona. No envía. */
  modo: "automatico" | "supervisado";
  nombre: string;
  tono: "cercano" | "formal";
  emojis: boolean;
  firma: string;
  /** Texto libre: quiénes son, cómo trabajan, condiciones. */
  contexto: string;
  conocimiento: { tema?: string; texto: string }[];
  reglas: Record<string, boolean>;
};

const BASE: Cerebro = { activa: true, modo: "automatico", nombre: "Marina", tono: "cercano", emojis: true, firma: "", contexto: "", conocimiento: [], reglas: {} };

const TTL_MS = 20_000;
let cache: { hasta: number; datos: Cerebro } | null = null;

/* 🔴 28-ago · EL CEREBRO DE MATEO ENTRABA POR LA MITAD, Y NADIE SE ENTERABA.
 *
 * El tope de cada ficha era 8.000 caracteres. Mateo cargó UNA de 24.735: entraban
 * 12 de sus 39 secciones y se tiraban 27 —reservas, requisitos, venta,
 * administración, y hasta su "REGLA ABSOLUTA: NO INVENTAR"—, o sea el 68%. Sin un
 * error, sin un log, sin un cartel. Arriba, el panel le decía "Cargá TODO lo que
 * sepas de tu negocio — no hay límite", y el medidor le pedía que sumara MÁS de
 * justo lo que se estaba tirando.
 *
 * Es el bug del "megaprompt trucho" con otra cara: el cliente enseña y el sistema
 * no aprende. Los topes se fueron a `src/lib/cerebro.ts` para que el panel pueda
 * mostrarlos (un límite que el cliente no ve lo agarra de sorpresa), y un recorte
 * dejó de ser mudo: se cuenta y se avisa. */
import { TOPE_FICHA, TOPE_CONOCIMIENTO, TOPE_CONTEXTO } from "../../src/lib/cerebro";

/** Lo que se recortó en la última lectura, para poder contarlo en vez de tragarlo. */
let ultimoRecorte = 0;
export const recorteDelCerebro = (): number => ultimoRecorte;

const texto = (v: unknown, max: number): string => {
  if (typeof v !== "string") return "";
  const limpio = v.trim();
  if (limpio.length <= max) return limpio;
  ultimoRecorte += limpio.length - max;
  return limpio.slice(0, max);
};

/** De lo que haya en la fila a un Cerebro completo: cualquier campo que falte toma el valor base. */
export function normalizarCerebro(cfg: unknown): Cerebro {
  ultimoRecorte = 0;
  const c = (cfg && typeof cfg === "object" ? cfg : {}) as Record<string, unknown>;

  /* El presupuesto se reparte por orden de carga: cada ficha entra entera hasta
   * que se acaba, y la que no entra NO se mete a medias — media ficha es peor
   * que ninguna, porque el corte cae a mitad de una frase y Marina la lee como
   * si terminara ahí. Lo que quedó afuera se cuenta y se avisa. */
  let presupuesto = TOPE_CONOCIMIENTO;
  const conocimiento = Array.isArray(c.conocimiento)
    ? c.conocimiento
        .map((k: any) => ({ tema: texto(k?.tema, 80) || undefined, texto: texto(k?.texto, TOPE_FICHA) }))
        .filter((k) => k.texto)
        .slice(0, 40)
        .filter((k) => {
          if (k.texto.length > presupuesto) {
            ultimoRecorte += k.texto.length;
            return false;
          }
          presupuesto -= k.texto.length;
          return true;
        })
    : [];
  const reglas = c.reglas && typeof c.reglas === "object"
    ? Object.fromEntries(Object.entries(c.reglas as Record<string, unknown>).map(([k, v]) => [k, v === true]))
    : {};
  // El panel guardó "auto" desde el día uno: se acepta y se normaliza. Cualquier
  // valor que no sea supervisado cae en automático — el default es atender.
  const modoCrudo = texto(c.modo, 20).toLowerCase();
  return {
    activa: c.activa !== false,
    modo: modoCrudo.startsWith("super") ? "supervisado" : "automatico",
    nombre: texto(c.nombre, 40) || BASE.nombre,
    tono: c.tono === "formal" ? "formal" : "cercano",
    emojis: c.emojis !== false,
    firma: texto(c.firma, 80),
    contexto: texto(c.contexto, TOPE_CONTEXTO),
    conocimiento,
    reglas,
  };
}

export async function leerCerebro(): Promise<Cerebro> {
  const ahora = Date.now();
  if (cache && cache.hasta > ahora) return cache.datos;

  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) return cache?.datos ?? BASE;

  try {
    const r = await fetch(`${base}/rest/v1/potente_ia_config?select=cfg&id=eq.true&limit=1`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const filas = (await r.json()) as { cfg?: unknown }[];
    const datos = normalizarCerebro(filas[0]?.cfg);
    /* Un recorte NO es una curiosidad: es conocimiento que el cliente escribió y
     * Marina no va a tener. Si vuelve a pasar, que quede escrito. */
    if (recorteDelCerebro() > 0) {
      console.warn(
        `Cerebro · se recortaron ${recorteDelCerebro()} caracteres de lo que cargó el cliente ` +
          `(tope por ficha ${TOPE_FICHA}, total ${TOPE_CONOCIMIENTO}). Marina NO tiene esa parte.`
      );
    }
    cache = { hasta: ahora + TTL_MS, datos };
    return datos;
  } catch (e: any) {
    console.error("Cerebro · no se pudo leer potente_ia_config:", e?.message ?? e);
    return cache?.datos ?? BASE;
  }
}

/** Para las pruebas y el vigía: olvida la caché (la config recién cambió). */
export function olvidarCerebro(): void {
  cache = null;
}
