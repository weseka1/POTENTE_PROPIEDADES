import React from "react";

// Red de seguridad: si una sección tira un error de render, en vez de pantalla en blanco
// muestra el mensaje real (para poder diagnosticar) + un botón para recargar.
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
