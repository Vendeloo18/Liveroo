"use client";

// =============================================================
// Piezas COMPARTIDAS de la fila de puja
// =============================================================
// La subasta suelta (fondo claro) y el show en vivo (fondo oscuro) usan
// estas mismas piezas, así la fila de puja se ve idéntica en ambas:
// misma altura (56), mismo radio (píldora), mismos verdes y rojos.
// Antes cada página tenía su copia y los tamaños se desalineaban.

export const BID_H = 48;

/** Caja del monto: píldora con "$" fijo y el número alineado, sin cortes. */
export function BidAmount({
  value, onChange, step, min, disabled, dark,
}: {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  disabled?: boolean;
  dark?: boolean;
}) {
  return (
    <div style={{
      width: 100, height: BID_H, borderRadius: 999, flexShrink: 0,
      display: "flex", alignItems: "center", padding: "0 14px", gap: 4,
      background: dark ? "rgba(0,0,0,0.5)" : "var(--surface-2)",
      border: dark ? "1px solid rgba(255,255,255,0.18)" : "1.5px solid var(--line)",
      backdropFilter: dark ? "blur(8px)" : undefined,
      opacity: disabled ? 0.5 : 1,
    }}>
      <span style={{ fontWeight: 800, fontSize: "0.95rem", color: dark ? "rgba(255,255,255,0.55)" : "var(--ink-3)" }}>$</span>
      <input
        type="number" inputMode="decimal" step={step} min={min} disabled={disabled}
        value={value} onChange={e => onChange(e.target.value)}
        aria-label="Monto de tu puja"
        style={{
          flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
          fontSize: "0.98rem", fontWeight: 800, color: dark ? "#fff" : "var(--ink)", padding: 0,
        }}
      />
    </div>
  );
}

/** Píldora verde "Vas ganando" — ocupa el lugar del botón de pujar. */
export function VasGanandoPill() {
  return (
    <div style={{
      height: BID_H, borderRadius: 999,
      background: "linear-gradient(180deg, #1ec763, #0f9a45)", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
      fontWeight: 800, fontSize: "0.92rem",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -3px 8px rgba(0,0,0,0.15), 0 8px 22px rgba(16,154,69,0.45)",
    }}>
      <span style={{ width: 21, height: 21, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </span>
      Vas ganando
    </div>
  );
}

/** Aviso rojo pulsante "te superaron", con sus keyframes incluidos. */
export function TeSuperaronBanner() {
  return (
    <div style={{
      marginBottom: 9, textAlign: "center", color: "#fff", fontWeight: 800, fontSize: "0.92rem",
      background: "linear-gradient(180deg, #f5514b, #d61f2b)", borderRadius: 999, padding: "11px 14px",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 8px 22px rgba(224,44,57,0.5)",
      animation: "superadoPulse 1.1s ease-in-out infinite",
    }}>
      ¡Te superaron! Desliza para volver
      <style>{`@keyframes superadoPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}`}</style>
    </div>
  );
}
