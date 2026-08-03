"use client";
import { useState } from "react";

// =============================================================
// Copiable — un dato que se toca y queda copiado
// =============================================================
// Un pago móvil se hace en la app del banco, no aquí: hay que llevarse el
// teléfono, la cédula y el monto. Sin un botón de copiar, la persona tiene
// que memorizar y transcribir cada dato saltando entre dos aplicaciones —
// y un dígito mal escrito significa un pago perdido y un reclamo.
//
// Toda la fila es el botón: en el teléfono, apuntarle a un enlace pequeño
// al lado del texto es justo lo que falla.
// =============================================================

export function Copiable({ etiqueta, valor, destacado = false }: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      // Safari sin permiso de portapapeles: se selecciona para copiar a mano.
      const t = document.createElement("textarea");
      t.value = valor;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); } catch { /* nada que hacer */ }
      document.body.removeChild(t);
    }
    setCopiado(true);
    try { navigator.vibrate?.(20); } catch { /* no todos vibran */ }
    setTimeout(() => setCopiado(false), 1800);
  };

  return (
    <button
      onClick={copiar}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        padding: "10px 12px", borderRadius: 12,
        background: copiado ? "var(--ok-tint, #e7f6ec)" : "var(--surface-2)",
        transition: "background 0.18s",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)" }}>
          {etiqueta}
        </div>
        <div style={{
          fontSize: destacado ? "1.05rem" : "0.92rem", fontWeight: 800, marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}>
          {valor}
        </div>
      </div>
      <span style={{
        fontSize: "0.78rem", fontWeight: 800, flexShrink: 0,
        color: copiado ? "var(--ok, #17a34a)" : "var(--accent-strong)",
      }}>
        {copiado ? "¡Copiado!" : "Copiar"}
      </span>
    </button>
  );
}
