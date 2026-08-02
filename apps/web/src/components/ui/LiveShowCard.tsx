"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { formatUsd, SIMBOLO_PATH } from "@subastas-ve/shared";

// Tarjeta grande y llamativa de un show EN VIVO para el feed. Muestra la foto
// del producto que se está subastando AHORA (no una portada gris), con el
// precio en vivo y "SUBASTANDO". Se suscribe a la subasta actual del show, así
// el precio sube en la tarjeta mientras la gente puja.
export function LiveShowCard({ show, onClick }: { show: any; onClick: () => void }) {
  const [item, setItem] = useState<any>(null);

  useEffect(() => {
    if (!show.currentAuctionId) { setItem(null); return; }
    return onSnapshot(
      doc(db, "auctions", show.currentAuctionId),
      s => setItem(s.exists() ? s.data() : null),
      () => setItem(null),
    );
  }, [show.currentAuctionId]);

  const foto = item?.imageURL ?? item?.imageURLs?.[0] ?? show.coverImageURL ?? null;
  const titulo = item?.title ?? show.title ?? "En vivo";
  const precio = item?.currentBidUsd;

  return (
    <button
      onClick={onClick}
      style={{
        position: "relative", width: 256, minWidth: 256, flexShrink: 0, aspectRatio: "3 / 4",
        borderRadius: 20, overflow: "hidden", background: "var(--accent)", textAlign: "left",
        boxShadow: "0 10px 30px rgba(255,106,0,0.25)",
      }}
    >
      {foto ? (
        <img src={foto} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}/>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden style={{ position: "absolute", right: "-30%", top: "10%", width: "120%", fill: "var(--accent-light)", opacity: 0.5 }}>
          <path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/>
        </svg>
      )}

      {/* Degradados para leer el texto */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 26%, transparent 42%, rgba(0,0,0,0.9) 100%)" }}/>

      {/* LIVE + viewers */}
      <span className="lv-badge lv-badge--live" style={{ position: "absolute", top: 12, left: 12, fontSize: "0.62rem", padding: "5px 9px" }}>
        <i className="lv-dot"/> EN VIVO
      </span>
      <span className="lv-badge" style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.5)", color: "#fff", backdropFilter: "blur(6px)", fontSize: "0.62rem", gap: 4 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        {show.viewerCount ?? 0}
      </span>

      {/* Info abajo */}
      <div style={{ position: "absolute", left: 14, right: 14, bottom: 12, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800, flexShrink: 0 }}>
            {(show.sellerName ?? "?")[0]}
          </span>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, opacity: 0.9, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{show.sellerName}</span>
        </div>

        {precio != null ? (
          <>
            <div className="lv-eyebrow" style={{ color: "var(--accent-light)" }}>Vendiendo en vivo</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 800, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{titulo}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
              <span style={{ fontSize: "1.4rem", fontWeight: 900, letterSpacing: "-0.02em" }}>{formatUsd(precio)}</span>
              <span className="lv-badge lv-badge--live" style={{ fontSize: "0.55rem", padding: "3px 7px" }}><i className="lv-dot"/> ofertas</span>
            </div>
          </>
        ) : (
          <div style={{ fontFamily: "var(--f-display)", fontSize: "1.25rem", fontWeight: 800, textTransform: "uppercase", lineHeight: 1.05 }}>{titulo}</div>
        )}
      </div>
    </button>
  );
}
