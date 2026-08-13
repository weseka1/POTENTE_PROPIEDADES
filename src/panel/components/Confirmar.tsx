import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";
import { Btn } from "./Controls";

/**
 * CONFIRMACIÓN de la casa — reemplaza a `window.confirm`.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Por qué existe: el cuadro gris del navegador ("potente-propiedades.onrender.com
 * dice…") no es nuestro sistema. Lo marcó Juani el 12-ago probando el registro
 * de llaves: *"¿por qué salen anotaciones desde Google? Nada que ver, debe pasar
 * TODO por el sistema"*. Y tiene razón por dos motivos, no uno:
 *   · Estética: rompe el estándar de la casa (nivel estudio, cero look de IA).
 *   · Confianza: un cartel del navegador con el dominio adelante parece un aviso
 *     del sistema operativo, no una decisión de la herramienta que se está usando.
 *
 * Uso (dos líneas):
 *   const { confirmar, dialogo } = useConfirmar();
 *   ...
 *   confirmar({ titulo: "¿Borrar la ficha?", detalle: "No se puede deshacer.",
 *               boton: "Borrar", peligro: true, onOk: async () => { ... } });
 *   ...
 *   return (<div>…{dialogo}</div>);
 *
 * El `onOk` puede ser async: el botón queda deshabilitado mientras corre, así
 * nadie borra dos veces por doble click.
 */
type Pedido = {
  titulo: string;
  detalle?: string;
  /** Texto del botón que ejecuta. Default: "Confirmar". */
  boton?: string;
  /** Rojo para lo destructivo (borrar). */
  peligro?: boolean;
  onOk: () => void | Promise<void>;
};

export function useConfirmar() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const confirmar = useCallback((p: Pedido) => setPedido(p), []);
  const cerrar = useCallback(() => { if (!trabajando) setPedido(null); }, [trabajando]);

  // 🔴 Con la confirmación abierta, Escape la cierra SOLO A ELLA. Sin esto,
  // cuando la confirmación está encima de otro modal (borrar desde el detalle
  // de un cliente), los dos escuchan `keydown` en window y un Escape cerraba
  // los DOS: cancelabas y de paso perdías la ficha que estabas mirando.
  // Fase de captura + stopImmediatePropagation = el de arriba gana.
  useEffect(() => {
    if (!pedido) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (!trabajando) setPedido(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pedido, trabajando]);

  const ejecutar = async () => {
    if (!pedido || trabajando) return;
    setTrabajando(true);
    try {
      await pedido.onOk();
      setPedido(null);
    } finally {
      setTrabajando(false);
    }
  };

  // 🔴 Va por PORTAL al <body>. Sin esto, un `{dialogo}` puesto adentro de algo
  // con `transform` (el Drawer de Cartera se desliza con transform, los
  // `reveal` de la web también) queda ATRAPADO en ese ancestro: `position:
  // fixed` deja de ser relativo a la ventana y el cartel aparece corrido o
  // recortado. Con el portal, el confirmador se puede usar en cualquier lugar
  // del panel sin pensar dónde está montado.
  const dialogo = createPortal(
    <Modal
      open={Boolean(pedido)}
      onClose={cerrar}
      title={pedido?.titulo}
      footer={
        <>
          <Btn variant="ghost" onClick={cerrar}>Cancelar</Btn>
          <Btn
            variant="primary"
            onClick={ejecutar}
            className={pedido?.peligro ? "!bg-red-600 hover:!bg-red-700" : undefined}
          >
            {trabajando ? "Un segundo…" : pedido?.boton ?? "Confirmar"}
          </Btn>
        </>
      }
    >
      <p className="text-sm text-graph-500">{pedido?.detalle ?? "Esta acción no se puede deshacer."}</p>
    </Modal>,
    document.body,
  );

  return { confirmar, dialogo };
}
