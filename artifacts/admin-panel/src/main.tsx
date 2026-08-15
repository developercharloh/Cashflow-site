import "./index.css";
import { StrictMode, Component, type ReactNode, type ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? `${err.name}: ${err.message}\n\n${err.stack ?? ""}` : String(err) };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("App crash:", err, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", background: "#050d1f", color: "#fff",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "24px", fontFamily: "monospace",
        }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</div>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f87171", marginBottom: "16px" }}>
            App crashed — copy this and send it
          </h2>
          <pre style={{
            background: "#111", border: "1px solid #333", borderRadius: "12px",
            padding: "16px", fontSize: "11px", color: "#fca5a5", whiteSpace: "pre-wrap",
            wordBreak: "break-all", maxWidth: "100%", maxHeight: "60vh", overflowY: "auto",
          }}>
            {this.state.error}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "20px", padding: "12px 28px", borderRadius: "12px",
              background: "#7c3aed", color: "#fff", border: "none",
              fontSize: "14px", fontWeight: 700, cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
