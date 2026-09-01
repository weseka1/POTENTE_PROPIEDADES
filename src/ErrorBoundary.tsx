import React from "react";
import { hayVersionNueva } from "@/lib/version";

// Red de seguridad: si una sección tira un error de render, en vez de pantalla en blanco
// muestra el mensaje real (para poder diagnosticar) + un botón para recargar.
//
// 🔴 31-ago · LA PESTAÑA VIEJA SE CURA SOLA — pero SOLO acá adentro.
// El centinela de versión avisa y nunca recarga por su cuenta: alguien puede
// estar escribiendo. Esa regla tiene UNA excepción legítima, y es esta pantalla:
// si el render ya reventó, la sección está muerta y no hay borrador que perder.
// Pasó dos veces el mismo día: arreglamos un crash, deployamos, y Juani lo
// "volvió a ver" — era su pestaña corriendo el bundle de ANTES del arreglo
// (los hashes de la captura lo probaron). Un cliente no distingue "tu pestaña
// es vieja" de "el sistema está roto": ve el cartel y pierde la confianza.
// Así que al capturar un error se consulta /version.json: si hay una versión
// más nueva publicada, se recarga UNA vez (candado en sessionStorage para no
// ciclar si el crash persiste en la versión nueva). Si la versión es la misma,
// el error es real y se muestra como siempre — taparlo sería peor.
const CANDADO_RECARGA = "potente_boundary_recargo";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // queda en consola también
    console.error("ErrorBoundary capturó:", error, info);
    void this.recargarSiLaPestanaEsVieja();
  }

  async recargarSiLaPestanaEsVieja() {
    try {
      if (sessionStorage.getItem(CANDADO_RECARGA)) return; // ya lo intentamos: el error es de verdad
      if (!(await hayVersionNueva())) return;              // misma versión: bug real, que se vea
      sessionStorage.setItem(CANDADO_RECARGA, "1");
      window.location.reload();
    } catch {
      /* sin sessionStorage o sin red: se muestra el cartel, como siempre */
    }
  }

  componentDidMount() {
    /* El candado se libera recién cuando la app anduvo SANA un rato después de
     * la recarga. Si se limpiara al toque, un crash persistente ciclaría; si no
     * se limpiara nunca, cada pestaña podría curarse UNA sola vez en su vida y
     * el deploy del mes que viene volvería a mostrar el cartel. */
    setTimeout(() => {
      try {
        if (!this.state.error) sessionStorage.removeItem(CANDADO_RECARGA);
      } catch { /* sin sessionStorage: nada que liberar */ }
    }, 15_000);
  }

  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.stack || this.state.error?.message || this.state.error);
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F6F2E9", color: "#11100B", fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
          <div style={{ maxWidth: 560, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#0C4DA2" }}>Potente Propiedades</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "8px 0 6px" }}>Se rompió esta sección</h1>
            <pre style={{ fontSize: 12, color: "#555", whiteSpace: "pre-wrap", textAlign: "left", background: "#fff", border: "1px solid #0001", borderRadius: 10, padding: 12, maxHeight: 260, overflow: "auto" }}>{msg}</pre>
            <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 10, background: "#0C4DA2", color: "#fff", border: 0, fontWeight: 600, cursor: "pointer" }}>Recargar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
