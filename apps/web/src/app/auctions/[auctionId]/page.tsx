"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../lib/firebase";
import { useAuthStore } from "../../../store/authStore";
import { useCountdown } from "../../../hooks/useCountdown";
import { useWallet } from "../../../hooks/useWallet";
import { SlideToBid } from "../../../components/ui/SlideToBid";
import { BidAmount, VasGanandoPill, TeSuperaronBanner, BID_H } from "../../../components/ui/BidBar";
import { Confetti } from "../../../components/ui/Confetti";
import { formatUsd, MOTIVO_RECHAZO } from "@subastas-ve/shared";

interface Auction {
  id: string; title?: string; description?: string; imageURL?: string; imageURLs?: string[];
  currentBidUsd: number; startingPriceUsd: number; minIncrementUsd: number;
  sellerName?: string; sellerId?: string; endsAt?: any; bidsCount?: number;
  status?: string; currentBidderId?: string; currentBidderName?: string;
  category?: string; mode?: string; winnerName?: string; finalPriceUsd?: number;
  winnerId?: string; orderId?: string; isDemo?: boolean;
}
interface Bid { id: string; bidderName?: string; amountUsd: number; placedAt?: any }
type EstadoPuja = "idle" | "pending" | "ok" | "err";

// Carrusel de fotos: se desliza en horizontal (scroll-snap) con puntitos.
function Carrusel({ fotos, children }: { fotos: string[]; children?: React.ReactNode }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const onScroll = () => { const el = ref.current; if (el) setIdx(Math.round(el.scrollLeft / el.offsetWidth)); };

  return (
    <div style={{ position: "relative", aspectRatio: "1 / 1", background: "var(--surface-2)" }}>
      {fotos.length > 0 ? (
        <div ref={ref} onScroll={onScroll} style={{ display: "flex", height: "100%", overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {fotos.map((f, i) => (
            <img key={i} src={f} alt="" style={{ width: "100%", height: "100%", flexShrink: 0, objectFit: "cover", scrollSnapAlign: "center", display: "block" }}/>
          ))}
        </div>
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent-disabled)" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        </div>
      )}
      {children}
      {fotos.length > 1 && (
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5, zIndex: 2 }}>
          {fotos.map((_, i) => (
            <span key={i} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 999, background: i === idx ? "#fff" : "rgba(255,255,255,0.6)", transition: "width 0.22s", boxShadow: "0 1px 3px rgba(0,0,0,0.35)" }}/>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AuctionPage() {
  const { auctionId } = useParams() as { auctionId: string };
  const router = useRouter();
  const { profile } = useAuthStore();
  const { disponible, exigeSaldo } = useWallet();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidInput, setBidInput] = useState("");
  const [estado, setEstado] = useState<EstadoPuja>("idle");
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState(false);
  const [superado, setSuperado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cierrePedido = useRef(false);
  const eraLider = useRef(false);
  const { texto: cuenta, urgente, vencida } = useCountdown(auction?.endsAt);

  useEffect(() => {
    return onSnapshot(doc(db, "auctions", auctionId), s => {
      if (!s.exists()) return;
      const a = { id: s.id, ...s.data() } as Auction;
      setAuction(a);
      setBidInput(prev => prev || ((a.bidsCount ?? 0) > 0 ? a.currentBidUsd + a.minIncrementUsd : a.startingPriceUsd).toFixed(2));
    }, e => setError(`No se pudo cargar la subasta (${e.code})`));
  }, [auctionId]);

  useEffect(() => {
    const q = query(collection(db, "auctions", auctionId, "bids"), orderBy("placedAt", "desc"), limit(30));
    return onSnapshot(q, s => setBids(s.docs.map(d => ({ id: d.id, ...d.data() } as Bid))), () => undefined);
  }, [auctionId]);

  useEffect(() => {
    if (!auction || !profile || auction.status !== "active") { eraLider.current = false; setSuperado(false); return; }
    const lider = auction.currentBidderId;
    if (lider === profile.uid) { eraLider.current = true; setSuperado(false); }
    else if (eraLider.current && lider) { setSuperado(true); eraLider.current = false; }
  }, [auction?.currentBidderId, auction?.status, profile?.uid]);

  useEffect(() => {
    if (!auction?.endsAt || auction.status !== "active" || cierrePedido.current) return;
    const fin = auction.endsAt?.toMillis?.() ?? new Date(auction.endsAt).getTime();
    if (Date.now() < fin) return;
    cierrePedido.current = true;
    httpsCallable(functions, "closeAuctionNow")({ auctionId }).catch(e => console.warn("closeAuctionNow:", e?.message));
  }, [auction?.status, auction?.endsAt, vencida, auctionId]);

  const pujar = async (montoArg?: number) => {
    if (!auction) return;
    if (!profile) { router.push("/login"); return; }
    const minimo = (auction.bidsCount ?? 0) > 0 ? auction.currentBidUsd + auction.minIncrementUsd : auction.startingPriceUsd;
    const monto = montoArg ?? parseFloat(bidInput);
    if (!isFinite(monto) || monto < minimo) {
      setError(`La puja mínima es ${formatUsd(minimo)}`);
      setEstado("err"); setTimeout(() => setEstado("idle"), 3000);
      return;
    }
    setSuperado(false);
    setEstado("pending"); setError(null);
    try {
      const ref = await addDoc(collection(db, "pendingBids"), {
        auctionId, bidderId: profile.uid, amountUsd: monto, status: "pending", submittedAt: serverTimestamp(),
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
      setEstado("err"); setTimeout(() => setEstado("idle"), 3000);
    }
  };

  const compartir = async () => {
    const url = `${window.location.origin}/auctions/${auctionId}`;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: "Vendeloo", text: `Mira esta subasta: ${auction?.title ?? ""}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiado(true); setTimeout(() => setCopiado(false), 2200);
      }
    } catch { /* cancelado */ }
  };

  if (!auction) {
    return <div className="lv-app"><div className="lv-empty"><div className="lv-empty__text">{error ?? "Cargando…"}</div></div></div>;
  }

  const fotos = auction.imageURLs?.length ? auction.imageURLs : auction.imageURL ? [auction.imageURL] : [];
  const activa = auction.status === "active" && !vencida;
  const voyGanando = !!profile && auction.currentBidderId === profile.uid;
  const esMia = !!profile && auction.sellerId === profile.uid;
  const pujas = auction.bidsCount ?? 0;
  const minimo = pujas > 0 ? auction.currentBidUsd + auction.minIncrementUsd : auction.startingPriceUsd;
  const gane = auction.status === "sold" && !!profile && auction.winnerId === profile.uid;
  const saldoCorto = exigeSaldo && !!profile && !voyGanando && disponible < minimo;
  const puedePujar = activa && !esMia;

  return (
    <div className="lv-app" style={{ paddingBottom: puedePujar ? 210 : 100 }}>

      {/* Carrusel de fotos con la barra flotando encima */}
      <Carrusel fotos={fotos}>
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", gap: 8, zIndex: 2 }}>
          <button className="lv-icon-btn" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }} onClick={() => router.back()} aria-label="Atrás">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div style={{ flex: 1 }}/>
          <button className="lv-icon-btn" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }} onClick={compartir} aria-label="Compartir">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          </button>
          {auction.category && <span className="lv-badge" style={{ background: "rgba(255,255,255,0.92)", color: "var(--ink)", backdropFilter: "blur(8px)" }}>{auction.category}</span>}
        </div>

        <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 8, zIndex: 2 }}>
          <span className={`lv-badge lv-badge--float${urgente && activa ? " lv-badge--urgent" : ""}`} style={{ position: "static", fontSize: "0.8rem", padding: "8px 12px" }}>
            {activa ? cuenta : "Finalizada"}
          </span>
          {pujas > 0 && <span className="lv-badge lv-badge--float" style={{ position: "static", fontSize: "0.8rem", padding: "8px 12px" }}>{pujas} {pujas === 1 ? "puja" : "pujas"}</span>}
        </div>

        {copiado && (
          <div style={{ position: "absolute", top: 58, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 3, pointerEvents: "none" }}>
            <span style={{ background: "rgba(11,11,13,0.82)", color: "#fff", borderRadius: 999, padding: "8px 16px", fontSize: "0.8rem", fontWeight: 700 }}>Link copiado ✓</span>
          </div>
        )}
      </Carrusel>

      <div className="lv-pad" style={{ paddingTop: 18, display: "grid", gap: 16 }}>
        <div>
          <h1 className="lv-display" style={{ fontSize: "1.6rem" }}>{auction.title}</h1>
          {auction.description && <p className="lv-muted" style={{ fontSize: "0.86rem", lineHeight: 1.55, marginTop: 8 }}>{auction.description}</p>}
        </div>

        <button onClick={() => auction.sellerId && router.push(`/seller/${auction.sellerId}`)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
          <span className="lv-avatar">{(auction.sellerName ?? "?")[0]}</span>
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 700 }}>{auction.sellerName}</div>
            <div className="lv-dim" style={{ fontSize: "0.72rem" }}>Ver perfil del vendedor</div>
          </div>
        </button>

        {/* Precio */}
        <section className="lv-panel">
          <div className="lv-eyebrow">{pujas > 0 ? "Puja actual" : "Precio inicial"}</div>
          <div className="lv-price lv-price--xl" style={{ margin: "2px 0 6px" }}>{formatUsd(auction.currentBidUsd)}</div>
          <div className="lv-dim" style={{ fontSize: "0.78rem" }}>
            Salió en {formatUsd(auction.startingPriceUsd)} · sube de {formatUsd(auction.minIncrementUsd)} en {formatUsd(auction.minIncrementUsd)}
          </div>
          {auction.currentBidderName && (
            <div className="lv-row" style={{ marginTop: 10, borderTop: "1px solid var(--line)", borderBottom: "none", paddingBottom: 0 }}>
              <span className="lv-muted" style={{ fontSize: "0.82rem" }}>{voyGanando ? "Vas ganando" : superado ? "Te superaron" : "Va ganando"}</span>
              <strong style={{ fontSize: "0.86rem", color: voyGanando ? "var(--ok)" : superado ? "var(--error)" : "var(--ink)" }}>
                {voyGanando ? "Tú ✓" : auction.currentBidderName}
              </strong>
            </div>
          )}
        </section>

        {/* Resultado si cerró */}
        {!activa && (
          gane ? (
            <div className="lv-note lv-note--ok" style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><strong>¡Ganaste!</strong> por {formatUsd(auction.finalPriceUsd ?? 0)}</div>
              {auction.orderId && <button className="lv-btn lv-btn--accent lv-btn--block" style={{ marginTop: 12 }} onClick={() => router.push(`/orders/${auction.orderId}`)}>Ver mi orden</button>}
            </div>
          ) : (
            <div className={`lv-note${auction.status === "sold" ? " lv-note--ok" : ""}`}>
              {auction.status === "sold" ? <span>Ganó <strong>{auction.winnerName}</strong> por {formatUsd(auction.finalPriceUsd ?? 0)}</span>
                : auction.status === "unsold" ? "Cerró sin ganador."
                : auction.status === "cancelled" ? "Esta subasta fue cancelada."
                : "El tiempo terminó. Estamos cerrando la subasta…"}
            </div>
          )
        )}

        {esMia && activa && <div className="lv-note">Esta subasta es tuya, no puedes pujar en ella.</div>}

        {/* Historial */}
        {bids.length > 0 && (
          <section className="lv-panel">
            <button onClick={() => setHistorial(h => !h)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="lv-eyebrow">Historial de pujas · {bids.length}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" style={{ transform: historial ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {historial && (
              <div style={{ marginTop: 6 }}>
                {bids.map((b, i) => (
                  <div className="lv-row" key={b.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="lv-avatar" style={{ width: 26, height: 26, fontSize: "0.65rem", background: i === 0 ? "var(--accent)" : undefined, color: i === 0 ? "var(--accent-ink)" : undefined }}>{i + 1}</span>
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: i === 0 ? 700 : 500 }}>{b.bidderName ?? "Anónimo"}</div>
                        <div className="lv-dim" style={{ fontSize: "0.68rem" }}>{b.placedAt?.toDate?.()?.toLocaleString("es-VE") ?? ""}</div>
                      </div>
                    </div>
                    <strong style={{ fontSize: "0.92rem" }}>{formatUsd(b.amountUsd ?? 0)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Barra fija de puja */}
      {puedePujar && (
        <div style={{ position: "fixed", bottom: "var(--nav-h)", left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "var(--app-max)", background: "var(--bg)", borderTop: "1px solid var(--line)", padding: "12px 16px 14px", zIndex: 50, boxShadow: "0 -6px 20px rgba(11,11,13,0.05)" }}>
          {estado === "ok" && <div className="lv-note lv-note--ok" style={{ marginBottom: 10 }}>Puja aceptada</div>}
          {estado === "err" && error && <div className="lv-note lv-note--bad" style={{ marginBottom: 10 }}>{error}</div>}

          {exigeSaldo && profile && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="lv-dim" style={{ fontSize: "0.78rem" }}>Saldo: <strong style={{ color: saldoCorto ? "var(--error)" : "var(--ink)" }}>{formatUsd(disponible)}</strong> disponible</span>
              <button className="lv-chip" style={{ padding: "5px 12px", fontSize: "0.72rem" }} onClick={() => router.push("/wallet")}>Recargar</button>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="lv-eyebrow">Mínimo {formatUsd(minimo)}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 5, 10, 25].map(inc => (
                <button key={inc} className="lv-chip" style={{ padding: "5px 10px", fontSize: "0.72rem" }} onClick={() => setBidInput((Math.max(minimo, parseFloat(bidInput) || 0) + inc).toFixed(2))}>+${inc}</button>
              ))}
            </div>
          </div>

          {superado && !voyGanando && <TeSuperaronBanner/>}

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <BidAmount value={bidInput} onChange={setBidInput} step={auction.minIncrementUsd} min={minimo} disabled={voyGanando}/>
            <div style={{ flex: 1 }}>
              {voyGanando ? (
                <VasGanandoPill/>
              ) : saldoCorto ? (
                <button onClick={() => router.push("/wallet")} className="lv-btn lv-btn--accent" style={{ width: "100%", height: BID_H, borderRadius: 999 }}>Recargar para pujar</button>
              ) : (
                <SlideToBid
                  label={estado === "pending" ? "Validando…" : `Puja ${formatUsd(parseFloat(bidInput) || minimo)}`}
                  color={superado ? "var(--error)" : "var(--accent)"}
                  disabled={estado === "pending"}
                  onConfirm={() => pujar(parseFloat(bidInput) || minimo)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {gane && <Confetti/>}
    </div>
  );
}
