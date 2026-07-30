"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../lib/firebase";
import { useAuthStore } from "../../../store/authStore";
import { useCountdown } from "../../../hooks/useCountdown";
import { BRAND, MOTIVO_RECHAZO } from "@subastas-ve/shared";

interface Auction {
  id: string; title?: string; description?: string; imageURL?: string; imageURLs?: string[];
  currentBidUsd: number; startingPriceUsd: number; minIncrementUsd: number;
  sellerName?: string; sellerId?: string; endsAt?: any; bidsCount?: number;
  status?: string; currentBidderId?: string; currentBidderName?: string;
  category?: string; mode?: string; winnerName?: string; finalPriceUsd?: number;
}

interface Bid { id: string; bidderName?: string; amountUsd: number; placedAt?: any }

type EstadoPuja = "idle" | "pending" | "ok" | "err";

export default function AuctionPage() {
  const { auctionId } = useParams() as { auctionId: string };
  const router = useRouter();
  const { profile } = useAuthStore();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidInput, setBidInput] = useState("");
  const [estado, setEstado] = useState<EstadoPuja>("idle");
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState(false);

  const { texto: cuenta, urgente, vencida } = useCountdown(auction?.endsAt);

  useEffect(() => {
    return onSnapshot(doc(db, "auctions", auctionId), s => {
      if (!s.exists()) return;
      const a = { id: s.id, ...s.data() } as Auction;
      setAuction(a);
      setBidInput(prev => prev || (a.currentBidUsd + a.minIncrementUsd).toFixed(2));
    }, e => setError(`No se pudo cargar la subasta (${e.code})`));
  }, [auctionId]);

  useEffect(() => {
    const q = query(collection(db, "auctions", auctionId, "bids"), orderBy("placedAt", "desc"), limit(30));
    return onSnapshot(q, s => setBids(s.docs.map(d => ({ id: d.id, ...d.data() } as Bid))), () => undefined);
  }, [auctionId]);

  // Cloud Scheduler no baja de 1 minuto. Cuando a quien está mirando se
  // le acaba el reloj, le avisa al servidor; el servidor revalida por su
  // cuenta y si todavía no vencía, ignora el aviso.
  const cierrePedido = useRef(false);
  useEffect(() => {
    if (!auction?.endsAt || auction.status !== "active" || cierrePedido.current) return;
    const fin = auction.endsAt?.toMillis?.() ?? new Date(auction.endsAt).getTime();
    if (Date.now() < fin) return;
    cierrePedido.current = true;
    httpsCallable(functions, "closeAuctionNow")({ auctionId })
      .catch(e => console.warn("closeAuctionNow:", e?.message));
  }, [auction?.status, auction?.endsAt, vencida, auctionId]);

  // El cliente no escribe el precio: deja una solicitud en /pendingBids
  // y el motor responde en ese mismo documento.
  const pujar = async () => {
    if (!auction) return;
    if (!profile) { router.push("/login"); return; }

    const monto = parseFloat(bidInput);
    const minimo = auction.currentBidUsd + auction.minIncrementUsd;
    if (!isFinite(monto) || monto < minimo) {
      setError(`La puja mínima es $${minimo.toFixed(2)}`);
      setEstado("err");
      setTimeout(() => setEstado("idle"), 3000);
      return;
    }

    setEstado("pending");
    setError(null);
    try {
      const ref = await addDoc(collection(db, "pendingBids"), {
        auctionId, bidderId: profile.uid, amountUsd: monto,
        status: "pending", submittedAt: serverTimestamp(),
      });

      const unsub = onSnapshot(doc(db, "pendingBids", ref.id), s => {
        const d = s.data();
        if (!d || d.status === "pending") return;
        unsub();
        if (d.status === "processed") setEstado("ok");
        else { setError(MOTIVO_RECHAZO[d.rejectedReason] ?? "Puja rechazada"); setEstado("err"); }
        setTimeout(() => setEstado("idle"), 3500);
      });

      setTimeout(() => { unsub(); setEstado(p => p === "pending" ? "idle" : p); }, 15000);
    } catch {
      setError("No se pudo enviar la puja");
      setEstado("err");
      setTimeout(() => setEstado("idle"), 3000);
    }
  };

  if (!auction) {
    return (
      <div className="lv-app">
        <div className="lv-empty"><div className="lv-empty__text">{error ?? "Cargando…"}</div></div>
      </div>
    );
  }

  const foto = auction.imageURL ?? auction.imageURLs?.[0];
  const activa = auction.status === "active" && !vencida;
  const voyGanando = !!profile && auction.currentBidderId === profile.uid;
  const esMia = !!profile && auction.sellerId === profile.uid;
  const minimo = auction.currentBidUsd + auction.minIncrementUsd;
  const pujas = auction.bidsCount ?? 0;

  return (
    <div className="lv-app" style={{ paddingBottom: activa && !esMia ? 190 : 110 }}>

      {/* Imagen a sangre con la barra flotando encima */}
      <div style={{ position: "relative", aspectRatio: "1 / 1", background: "var(--surface-2)" }}>
        {foto
          ? <img src={foto} alt={auction.title ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
          : <div style={{ width: "100%", height: "100%" }}/>}

        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", gap: 8 }}>
          <button
            className="lv-icon-btn"
            style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }}
            onClick={() => router.back()}
            aria-label="Atrás"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}/>
          {auction.category && (
            <span className="lv-badge" style={{ background: "rgba(255,255,255,0.92)", color: "var(--ink)", backdropFilter: "blur(8px)" }}>
              {auction.category}
            </span>
          )}
        </div>

        <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 8 }}>
          <span className={`lv-badge lv-badge--float${urgente && activa ? " lv-badge--urgent" : ""}`} style={{ position: "static", fontSize: "0.8rem", padding: "8px 12px" }}>
            {activa ? `⏱ ${cuenta}` : "Finalizada"}
          </span>
          {pujas > 0 && (
            <span className="lv-badge lv-badge--float" style={{ position: "static", fontSize: "0.8rem", padding: "8px 12px" }}>
              {pujas} {pujas === 1 ? "puja" : "pujas"}
            </span>
          )}
        </div>
      </div>

      <div className="lv-pad" style={{ paddingTop: 18, display: "grid", gap: 16 }}>

        <div>
          <h1 className="lv-display" style={{ fontSize: "1.6rem" }}>
            {auction.title}
          </h1>
          {auction.description && (
            <p className="lv-muted" style={{ fontSize: "0.86rem", lineHeight: 1.55, marginTop: 8 }}>
              {auction.description}
            </p>
          )}
        </div>

        {/* Vendedor */}
        <button
          onClick={() => auction.sellerId && router.push(`/seller/${auction.sellerId}`)}
          style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}
        >
          <span className="lv-avatar">{(auction.sellerName ?? "?")[0]}</span>
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 700 }}>{auction.sellerName}</div>
            <div className="lv-dim" style={{ fontSize: "0.72rem" }}>Ver perfil del vendedor</div>
          </div>
        </button>

        {/* Precio */}
        <section className="lv-panel">
          <div className="lv-eyebrow">{pujas > 0 ? "Puja actual" : "Precio inicial"}</div>
          <div className="lv-price lv-price--xl" style={{ margin: "2px 0 6px" }}>
            ${auction.currentBidUsd.toFixed(2)}
          </div>
          <div className="lv-dim" style={{ fontSize: "0.78rem" }}>
            Salió en ${auction.startingPriceUsd.toFixed(2)} · sube de ${auction.minIncrementUsd.toFixed(2)} en ${auction.minIncrementUsd.toFixed(2)}
          </div>

          {auction.currentBidderName && (
            <div className="lv-row" style={{ marginTop: 10, borderTop: "1px solid var(--line)", borderBottom: "none", paddingBottom: 0 }}>
              <span className="lv-muted" style={{ fontSize: "0.82rem" }}>Va ganando</span>
              <strong style={{ fontSize: "0.86rem" }}>{voyGanando ? "Tú" : auction.currentBidderName}</strong>
            </div>
          )}
        </section>

        {/* Resultado si ya cerró */}
        {!activa && (
          <div className={`lv-note${auction.status === "sold" ? " lv-note--ok" : ""}`}>
            {auction.status === "sold"
              ? <span>🏆 Ganó <strong>{auction.winnerName}</strong> por ${auction.finalPriceUsd?.toFixed(2)}</span>
              : auction.status === "unsold" ? "Cerró sin ganador."
              : auction.status === "cancelled" ? "Esta subasta fue cancelada."
              : "El tiempo terminó. Estamos cerrando la subasta…"}
          </div>
        )}

        {voyGanando && activa && (
          <div className="lv-note lv-note--ok">Vas ganando. Te avisamos si alguien te supera.</div>
        )}

        {esMia && (
          <div className="lv-note">Esta subasta es tuya, no puedes pujar en ella.</div>
        )}

        {/* Cómo se paga — refleja el flujo real: no hay custodia de fondos */}
        <div className="lv-note">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <div>
            <strong style={{ color: "var(--ink)" }}>Cómo se paga.</strong>{" "}
            Si ganas, coordinas pago y entrega directamente con el vendedor por WhatsApp.
            {BRAND.name} registra la orden con el monto congelado en bolívares.
          </div>
        </div>

        {/* Historial */}
        {bids.length > 0 && (
          <section className="lv-panel">
            <button
              onClick={() => setHistorial(h => !h)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <span className="lv-eyebrow">Historial de pujas · {bids.length}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round"
                   style={{ transform: historial ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {historial && (
              <div style={{ marginTop: 6 }}>
                {bids.map((b, i) => (
                  <div className="lv-row" key={b.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="lv-avatar" style={{ width: 26, height: 26, fontSize: "0.65rem", background: i === 0 ? "var(--accent)" : undefined, color: i === 0 ? "var(--accent-ink)" : undefined }}>
                        {i + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: i === 0 ? 700 : 500 }}>{b.bidderName ?? "Anónimo"}</div>
                        <div className="lv-dim" style={{ fontSize: "0.68rem" }}>
                          {b.placedAt?.toDate?.()?.toLocaleString("es-VE") ?? ""}
                        </div>
                      </div>
                    </div>
                    <strong style={{ fontSize: "0.92rem" }}>${b.amountUsd?.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Barra fija de puja */}
      {activa && !esMia && (
        <div style={{
          position: "fixed", bottom: "var(--nav-h)", left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: "var(--app-max)", background: "var(--bg)",
          borderTop: "1px solid var(--line)", padding: "12px 16px 14px", zIndex: 50,
          boxShadow: "0 -6px 20px rgba(11,11,13,0.05)",
        }}>
          {estado === "ok" && <div className="lv-note lv-note--ok" style={{ marginBottom: 10 }}>Puja aceptada</div>}
          {estado === "err" && error && <div className="lv-note lv-note--bad" style={{ marginBottom: 10 }}>{error}</div>}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="lv-eyebrow">Mínimo ${minimo.toFixed(2)}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 5, 10, 25].map(inc => (
                <button
                  key={inc}
                  className="lv-chip"
                  style={{ padding: "5px 10px", fontSize: "0.72rem" }}
                  onClick={() => setBidInput((Math.max(minimo, parseFloat(bidInput) || 0) + inc).toFixed(2))}
                >
                  +${inc}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontWeight: 800, color: "var(--ink-3)" }}>$</span>
              <input
                className="lv-input"
                style={{ paddingLeft: 28, fontSize: "1.15rem", fontWeight: 800, height: 52 }}
                type="number" inputMode="decimal" step={auction.minIncrementUsd} min={minimo}
                value={bidInput} onChange={e => setBidInput(e.target.value)}
                aria-label="Monto de tu puja"
              />
            </div>
            <button
              className="lv-btn lv-btn--accent lv-btn--lg"
              disabled={estado === "pending" || voyGanando}
              onClick={pujar}
              style={{ minWidth: 128 }}
            >
              {estado === "pending" ? "Validando…" : voyGanando ? "Vas ganando" : "Pujar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
