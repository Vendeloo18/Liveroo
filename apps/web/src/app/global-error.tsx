"use client";

// Sin esto, cualquier excepción de cliente mostraba la pantalla blanca de
// Next con "Application error" en inglés y sin forma de volver.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#fff" }}>
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#141416" }}>Algo se rompió</div>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.5, color: "#6b6b74", maxWidth: 320, margin: 0 }}>
            No pudimos cargar esta pantalla. Tu saldo y tus órdenes están a salvo.
          </p>
          <button
            onClick={reset}
            style={{ background: "#ff6a00", color: "#fff", border: "none", borderRadius: 999, padding: "13px 26px", fontSize: "0.95rem", fontWeight: 800, cursor: "pointer" }}
          >
            Intentar de nuevo
          </button>
          <a href="/" style={{ color: "#c85200", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" }}>
            Volver al inicio
          </a>
        </div>
      </body>
    </html>
  );
}
