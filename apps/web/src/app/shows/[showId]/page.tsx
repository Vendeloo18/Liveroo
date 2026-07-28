"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  doc, collection, query, orderBy, limit, onSnapshot, addDoc,
  serverTimestamp, getDoc, updateDoc, increment,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuthStore } from "../../../store/authStore";
import { useAgora } from "../../../hooks/useAgora";
import { useCountdown } from "../../../hooks/useCountdown";
import { formatUsd, formatBs, calcMinNextBid, MOTIVO_RECHAZO } from "@subastas-ve/shared";

interface Show {
  id: string; sellerName?: string; title?: string; status?: string;
  viewerCount?: number; currentAuctionId?: string; agoraChannelName?: string; sellerId?: string;
}
interface Subasta {
  id: string; title?: string; currentBidUsd: number; startingPriceUsd: number;
  minIncrementUsd: number; status?: string; endsAt?: any;
  currentBidderName?: string; currentBidderId?: string; bidsCount?: number;
}
interface Mensaje { id: string; authorName?: string; text?: string; type?: string; createdAt?: any }

export default function ShowPage() {
  const { showId } = useParams() as { showId: string };
  const router = useRouter();
  const { profile } = useAuthStore();

  const [show, setShow] = useState<Show | null>(null);
  const [subasta, setSubasta] = useState<Subasta | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [tasa, setTasa] = useState<number | null>(null);
  const [bidInput, setBidInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [estado, setEstado] = useState<"idle" | "pending" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const chatRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  const esHost = !!show?.sellerId && show.sellerId === profile?.uid;
  const agora = useAgora(show?.agoraChannelName ?? "", esHost ? "host" : "audience");
  const { texto: cuenta, urgente, vencida } = useCountdown(subasta?.endsAt);

  useEffect(() => {
    getDoc(doc(db, "exchangeRates", "current"))
      .then(s => { if (s.exists()) setTasa(s.data().usdToBs ?? null); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const ref = doc(db, "shows", showId);
    updateDoc(ref, { viewerCount: increment(1) }).catch(() => undefined);
    return onSnapshot(ref, s => { if (s.exists()) setShow({ id: s.id, ...s.data() } as Show); });
  }, [showId]);

  useEffect(() => {
    if (!show?.agoraChannelName || agora.joined || show.status !== "live") return;
    agora.join(esHost ? localVideoRef.current : remoteVideoRef.current);
  }, [show?.agoraChannelName, show?.status]);

  useEffect(() => {
    const u = agora.remoteUsers[0];
    if (u?.videoTrack && remoteVideoRef.current) u.videoTrack.play(remoteVideoRef.current);
  }, [agora.remoteUsers]);

  useEffect(() => {
    if (!show?.currentAuctionId) { setSubasta(null); return; }
    return onSnapshot(doc(db, "auctions", show.currentAuctionId), s => {
      if (!s.exists()) return;
      const a = { id: s.id, ...s.data() } as Subasta;
      setSubasta(a);
      setBidInput(calcMinNextBid(a.currentBidUsd, a.minIncrementUsd).toFixed(2));
    });
  }, [show?.currentAuctionId]);

  useEffect(() => {
    const q = query(collection(db, "shows", showId, "messages"), orderBy("createdAt", "desc"), limit(40));
    return onSnapshot(q, s => setMensajes(s.docs.map(d => ({ id: d.id, ...d.data() } as Mensaje)).reverse()));
  }, [showId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes]);

  const pujar = async () => {
    if (!subasta) return;
    if (!profile) { router.push("/login"); return; }

    const monto = parseFloat(bidInput);
    const minimo = calcMinNextBid(subasta.currentBidUsd, subasta.minIncrementUsd);
    if (!isFinite(monto) || monto < minimo) {
      setError(`Mínimo ${formatUsd(minimo)}`);
      setEstado("err");
      setTimeout(() => setEstado("idle"), 2500);
      return;
    }

    setEstado("pending");
    setError(null);
    try {
      const ref = await addDoc(collection(db, "pendingBids"), {
        auctionId: subasta.id, bidderId: profile.uid, amountUsd: monto,
        status: "pending", submittedAt: serverTimestamp(),
      });
      const unsub = onSnapshot(doc(db, "pendingBids", ref.id), s => {
        const d = s.data();
        if (!d || d.status === "pending") return;
        unsub();
        if (d.status === "processed") setEstado("ok");
        else { setError(MOTIVO_RECHAZO[d.rejectedReason] ?? "Puja rechazada"); setEstado("err"); }
        setTimeout(() => setEstado("idle"), 2500);
      });
      setTimeout(() => { unsub(); setEstado(p => p === "pending" ? "idle" : p); }, 15000);
    } catch {
      setError("No se pudo enviar");
      setEstado("err");
      setTimeout(() => setEstado("idle"), 2500);
    }
  };

  const enviarChat = async () => {
    if (!chatInput.trim()) return;
    if (!profile) { router.push("/login"); return; }
    const texto = chatInput.trim();
    setChatInput("");
    await addDoc(collection(db, "shows", showId, "messages"), {
      showId, authorId: profile.uid, authorName: profile.displayName,
      type: "chat", text: texto, createdAt: serverTimestamp(),
    }).catch(() => setChatInput(texto));
  };

  const voyGanando = !!profile && subasta?.currentBidderId === profile.uid;
  const activa = subasta?.status === "active" && !vencida;
  const minimo = subasta ? calcMinNextBid(subasta.currentBidUsd, subasta.minIncrementUsd) : 0;

  const colorMensaje = (t?: string) =>
    t === "bid_placed" ? "var(--accent)"
    : t === "auction_won" ? "#7dd3fc"
    : t === "system" ? "rgba(255,255,255,0.45)"
    : "#fff";

  return (
    <div className="lv-dark" style={{
      position: "fixed", inset: 0, maxWidth: "var(--app-max)", margin: "0 auto",
      background: "#000", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>

      {/* ── Video a sangre ── */}
      <div ref={remoteVideoRef} style={{ position: "absolute", inset: 0, background: "#000" }}/>
      {esHost && <div ref={localVideoRef} style={{ position: "absolute", inset: 0, background: "#000" }}/>}

      {!agora.joined && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10,
          background: "linear-gradient(180deg,#141418,#000)",
        }}>
          <div style={{ width: 54, height: 54, borderRadius: 18, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
          </div>
          <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.45)", textAlign: "center", padding: "0 30px" }}>
            {agora.loading ? "Conectando…"
              : agora.error ? agora.error
              : show?.status === "live" ? "Conectando transmisión…"
              : show?.status === "ended" ? "Este show ya terminó"
              : "El show todavía no empieza"}
          </div>
        </div>
      )}

      {/* Degradados para que el texto se lea sobre cualquier video */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 130, background: "linear-gradient(rgba(0,0,0,0.65), transparent)", pointerEvents: "none" }}/>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 420, background: "linear-gradient(transparent, rgba(0,0,0,0.85) 55%)", pointerEvents: "none" }}/>

      {/* ── Barra superior ── */}
      <div style={{ position: "relative", zIndex: 3, display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 0" }}>
        <button
          onClick={() => { agora.leave(); router.push("/"); }}
          style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-label="Salir"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        <button
          onClick={() => show?.sellerId && router.push(`/seller/${show.sellerId}`)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", borderRadius: 999, padding: "5px 12px 5px 5px", minWidth: 0 }}
        >
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {(show?.sellerName ?? "?")[0]}
          </span>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {show?.sellerName ?? "…"}
          </span>
        </button>

        <div style={{ flex: 1 }}/>

        {show?.status === "live" && (
          <span className="lv-badge lv-badge--live"><i className="lv-dot"/> EN VIVO</span>
        )}
        <span className="lv-badge" style={{ background: "rgba(0,0,0,0.45)", color: "#fff", backdropFilter: "blur(8px)" }}>
          {show?.viewerCount ?? 0}
        </span>
      </div>

      <div style={{ flex: 1 }}/>

      {/* ── Chat flotante ── */}
      <div
        ref={chatRef}
        style={{
          position: "relative", zIndex: 3, maxHeight: 190, overflowY: "auto",
          padding: "0 14px 8px", display: "flex", flexDirection: "column", gap: 6,
          scrollbarWidth: "none", maskImage: "linear-gradient(transparent, #000 22%)",
          WebkitMaskImage: "linear-gradient(transparent, #000 22%)",
        }}
      >
        {mensajes.map(m => (
          <div key={m.id} style={{ fontSize: "0.79rem", lineHeight: 1.4, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
            {m.type === "chat" && (
              <span style={{ fontWeight: 800, color: "rgba(255,255,255,0.55)", marginRight: 6 }}>{m.authorName}</span>
            )}
            <span style={{ color: colorMensaje(m.type), fontWeight: m.type === "chat" ? 500 : 700 }}>{m.text}</span>
          </div>
        ))}
      </div>

      {/* ── Subasta en curso ── */}
      {subasta && (
        <div style={{ position: "relative", zIndex: 3, padding: "0 14px 10px" }}>
          <div style={{
            background: "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16, padding: "12px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {subasta.title}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: "1.35rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
                    {formatUsd(subasta.currentBidUsd)}
                  </span>
                  {tasa && (
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)" }}>
                      {formatBs(subasta.currentBidUsd * tasa)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                  {subasta.currentBidderName
                    ? `${voyGanando ? "Vas ganando" : `Va ganando ${subasta.currentBidderName}`}`
                    : "Nadie ha pujado"}
                </div>
              </div>

              <div style={{
                textAlign: "center", flexShrink: 0, borderRadius: 12, padding: "8px 12px",
                background: urgente && activa ? "var(--live)" : "rgba(0,0,0,0.35)",
              }}>
                <div style={{ fontSize: "0.55rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em" }}>
                  {activa ? "CIERRA EN" : "ESTADO"}
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                  {activa ? cuenta : subasta.status === "sold" ? "Vendida" : "Cerrada"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Aviso de puja ── */}
      {(estado === "ok" || estado === "err") && (
        <div style={{ position: "relative", zIndex: 3, padding: "0 14px 8px" }}>
          <div style={{
            borderRadius: 12, padding: "9px 13px", fontSize: "0.78rem", fontWeight: 700, textAlign: "center",
            background: estado === "ok" ? "rgba(20,164,77,0.9)" : "rgba(245,51,63,0.9)", color: "#fff",
          }}>
            {estado === "ok" ? "Puja aceptada" : error}
          </div>
        </div>
      )}

      {/* ── Acciones ── */}
      <div style={{ position: "relative", zIndex: 3, padding: "0 14px calc(14px + env(safe-area-inset-bottom))" }}>

        {activa && !esHost && (
          <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
            <input
              type="number" inputMode="decimal" step={subasta?.minIncrementUsd} min={minimo}
              value={bidInput} onChange={e => setBidInput(e.target.value)}
              aria-label="Monto de tu puja"
              style={{
                width: 96, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.16)", borderRadius: 12, padding: "0 12px",
                height: 48, color: "#fff", fontSize: "1rem", fontWeight: 800, outline: "none",
              }}
            />
            <button
              onClick={pujar}
              disabled={estado === "pending" || voyGanando}
              className="lv-btn lv-btn--accent"
              style={{ flex: 1, height: 48, opacity: voyGanando ? 0.55 : 1 }}
            >
              {estado === "pending" ? "Validando…" : voyGanando ? "Vas ganando" : `Pujar ${formatUsd(minimo)}`}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") enviarChat(); }}
            placeholder={show?.status === "live" ? "Escribe algo…" : "El chat abre cuando empiece el show"}
            disabled={show?.status !== "live"}
            maxLength={300}
            aria-label="Mensaje del chat"
            style={{
              flex: 1, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.16)", borderRadius: 999,
              padding: "0 16px", height: 44, color: "#fff", fontSize: "0.85rem", outline: "none",
            }}
          />

          {esHost && agora.joined && (
            <>
              <button
                onClick={async () => { await agora.toggleMic(); setMicOn(m => !m); }}
                aria-label={micOn ? "Silenciar micrófono" : "Activar micrófono"}
                style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: micOn ? "rgba(255,255,255,0.16)" : "var(--live)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  {micOn
                    ? <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></>
                    : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></>}
                </svg>
              </button>
              <button
                onClick={async () => { await agora.toggleCamera(); setCamOn(c => !c); }}
                aria-label={camOn ? "Apagar cámara" : "Encender cámara"}
                style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: camOn ? "rgba(255,255,255,0.16)" : "var(--live)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
