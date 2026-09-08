/**
 * LA COMPOSICIÓN DE UN EDIFICIO, PROBADA EN FRÍO.
 * ─────────────────────────────────────────────────────────────────────────────
 * `describirComposicion()` es lógica pura y es la ÚNICA fuente de la frase que
 * ven la ficha, la tarjeta, la cartera, el drawer, el buscador y Marina. Si se
 * rompe, se rompe en seis lugares a la vez — y del lado del server, un throw
 * tira el catálogo entero de Marina. Por eso se prueba acá, sin navegador, en
 * un segundo. Molde: `verificar-derivacion.ts`.
 *
 *   npm run verificar-composicion
 */
import { describirComposicion, normalizarComposicion, totalUnidades, resumenComposicion } from "../src/lib/composicion";

let ok = 0;
const fallos: string[] = [];
const igual = (nombre: string, real: unknown, esperado: unknown) => {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  if (r === e) { ok++; console.log(`  ✓ ${nombre}`); }
  else fallos.push(`  ✗ ${nombre}\n      esperado ${e}\n      real     ${r}`);
};

console.log("\n🏢 La composición de un edificio\n");

/* El caso de Mateo, textual del video */
const MATEO = [{ cantidad: 2, ambientes: 3 }, { cantidad: 3, ambientes: 2 }, { cantidad: 1, ambientes: 1 }];
igual("el ejemplo de Mateo, tal cual lo dictó", describirComposicion(MATEO), "6 unidades: 2 de 3 amb., 3 de 2 amb., 1 monoambiente");
igual("…y el total", totalUnidades(MATEO), 6);
igual("…y el resumen corto", resumenComposicion(MATEO), "6 unidades");

/* Orden y agrupación */
igual("se ordena de más ambientes a menos, venga como venga",
  describirComposicion([{ cantidad: 1, ambientes: 1 }, { cantidad: 2, ambientes: 3 }]), "3 unidades: 2 de 3 amb., 1 monoambiente");
igual("dos filas con los mismos ambientes se suman (2 de 3 + 1 de 3 = 3 de 3)",
  normalizarComposicion([{ cantidad: 2, ambientes: 3 }, { cantidad: 1, ambientes: 3 }]), [{ cantidad: 3, ambientes: 3 }]);

/* Singulares y plurales */
igual("una sola unidad, en singular", describirComposicion([{ cantidad: 1, ambientes: 2 }]), "1 unidad: 1 de 2 amb.");
igual("dos monoambientes, en plural", describirComposicion([{ cantidad: 2, ambientes: 1 }]), "2 unidades: 2 monoambientes");

/* 🔴 TOTAL: nada de esto puede tirar, y nada de esto puede inventar */
for (const [nombre, feo] of [
  ["null (así llega del server)", null],
  ["undefined", undefined],
  ["un string", "12 unidades"],
  ["un objeto suelto", { cantidad: 2, ambientes: 3 }],
  ["un array vacío", []],
  ["un array de basura", [null, 3, "x", {}]],
  ["cantidad 0", [{ cantidad: 0, ambientes: 2 }]],
  ["ambientes 0", [{ cantidad: 2, ambientes: 0 }]],
  ["negativos", [{ cantidad: -1, ambientes: 2 }]],
  ["decimales", [{ cantidad: 1.5, ambientes: 2 }]],
  ["fuera de tope", [{ cantidad: 1000, ambientes: 2 }, { cantidad: 1, ambientes: 51 }]],
] as const) {
  let resultado: unknown = "TIRÓ";
  try { resultado = describirComposicion(feo); } catch { /* queda "TIRÓ" */ }
  igual(`no tira ni inventa con ${nombre}`, resultado, undefined);
}

/* Lo válido sobrevive a lo inválido en la misma lista */
igual("se queda con lo válido y descarta el resto",
  describirComposicion([{ cantidad: 2, ambientes: 3 }, { cantidad: "x", ambientes: 2 }, null, { cantidad: 1, ambientes: 1 }]),
  "3 unidades: 2 de 3 amb., 1 monoambiente");

/* Los números como texto (así vienen del formulario) valen igual */
igual("acepta números escritos como texto", describirComposicion([{ cantidad: "2", ambientes: "3" }]), "2 unidades: 2 de 3 amb.");
igual("…pero no un texto vacío", describirComposicion([{ cantidad: "", ambientes: "3" }]), undefined);

console.log(`\n${"═".repeat(66)}\n  ${ok} correctas · ${fallos.length} fallaron\n${"═".repeat(66)}`);
if (fallos.length) { console.log(fallos.join("\n")); process.exit(1); }
