import { useCallback, useState } from "react";
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

  const dialogo = (
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
    </Modal>
  );

  return { confirmar, dialogo };
}
