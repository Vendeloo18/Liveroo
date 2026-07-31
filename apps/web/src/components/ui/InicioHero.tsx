"use client";
import { SIMBOLO_PATH } from "@subastas-ve/shared";
import { useCountdown } from "../../hooks/useCountdown";
import type { AuctionCardData } from "../auction/AuctionCard";

// =============================================================
// InicioHero — el banner de bienvenida del Inicio
// =============================================================
// Inicio y Explorar eran la misma grilla y se veían iguales. Este hero le
// da al Inicio una identidad de "portada": franja naranja con la etiqueta
// de marca de agua, titular en display, y la subasta que CIERRA PRIMERO
// como gancho — dato real, no un ejemplo inventado. Si no hay ninguna
// activa, el gancho no se muestra.
// =============================================================

export function InicioHero({
  destacada,
  onExplorar,
  onDestacada,
}: {
  destacada: AuctionCardData | null;
  onExplorar: () => void;
  onDestacada: (id: string) => void;
}) {
  const { texto, urgente, vencida } = useCountdown((destacada as any)?.endsAt);
  const foto = destacada?.imageURL ?? destacada?.imageURLs?.[0];
  const precio = destacada?.currentBidUsd ?? destacada?.startingPriceUsd ?? 0;

  return (
    <div style={{ padding: "10px 16px 4px" }}>
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--r-card, 22px)",
        background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong, #dc5a00) 100%)",
        padding: "20px 18px",
        color: "#fff",
      }}>
        {/* Etiqueta gigante de marca de agua */}
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{
          position: "absolute", right: "-14%", top: "-30%",
          width: "72%", height: "auto",
          fill: "var(--accent-light, #ff7d21)", opacity: 0.5, pointerEvents: "none",
        }}>
          <path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/>
        </svg>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.14em",
            textTransform: "uppercase", opacity: 0.9, marginBottom: 8,
          }}>
            Subastas en vivo · Venezuela
          </div>

          <h1 className="lv-display" style={{
            color: "#fff", fontSize: "clamp(1.9rem, 9vw, 2.5rem)", lineHeight: 0.94, letterSpacing: "0.01em",
          }}>
            Entra al vivo.<br/>Puja. Gana.
          </h1>

          <p style={{
            fontSize: "0.82rem", lineHeight: 1.45, opacity: 0.94, marginTop: 10, maxWidth: 320,
          }}>
            Precios en dólares, pago en bolívares. Puja en segundos y págalo cuando lo ganes.
          </p>

          {/* Gancho: la subasta que cierra primero (dato real) */}
          {destacada && foto && !vencida && (
            <button
              onClick={() => onDestacada(destacada.id)}
              style={{
                display: "flex", alignItems: "center", gap: 11, width: "100%",
                marginTop: 16, padding: 8, borderRadius: 16, textAlign: "left",
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.22)",
                backdropFilter: "blur(2px)",
              }}
            >
              <div style={{
                width: 54, height: 54, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                background: "rgba(255,255,255,0.2)",
              }}>
                <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85 }}>
                  Cierra pronto
                </div>
                <div style={{ fontSize: "0.82rem", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                  {destacada.title ?? "Subasta"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
                  <span className="lv-mono" style={{ fontSize: "0.82rem", fontWeight: 800 }}>${precio.toFixed(2)}</span>
                  <span style={{
                    fontSize: "0.64rem", fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                    background: urgente ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.22)",
                  }}>
                    {texto}
                  </span>
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.9 }}>
                <path d="M9 6l6 6-6 6"/>
              </svg>
            </button>
          )}

          <button
            onClick={onExplorar}
            style={{
              marginTop: 14, background: "#fff", color: "var(--accent-strong, #dc5a00)",
              fontWeight: 800, fontSize: "0.85rem", border: "none",
              borderRadius: 999, padding: "11px 22px", cursor: "pointer",
            }}
          >
            Explorar todas las subastas →
          </button>
        </div>
      </div>
    </div>
  );
}
