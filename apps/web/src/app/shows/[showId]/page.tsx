"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  doc, collection, query, orderBy, limit, onSnapshot, addDoc,
  serverTimestamp, getDoc, updateDoc, increment,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../lib/firebase";
import { useAuthStore } from "../../../store/authStore";
import { useAgora } from "../../../hooks/useAgora";
import { useCountdown } from "../../../hooks/useCountdown";
import { useWallet } from "../../../hooks/useWallet";
import { Confetti } from "../../../components/ui/Confetti";
import { SlideToBid } from "../../../components/ui/SlideToBid";
import { BidAmount, VasGanandoPill, TeSuperaronBanner } from "../../../components/ui/BidBar";
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
interface Mensaje { id: string; authorName?: string; text?: string; type?: string; createdAt?: any; winnerName?: string; productTitle?: string }
interface Corazon { id: number; x: number; hue: number; emoji: string }

const EMOJIS = ["❤️", "🔥", "😂", "👏"];

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
  const [celebra, setCelebra] = useState<{ name: string; product: string } | null>(null);
  const [corazones, setCorazones] = useState<Corazon[]>([]);
  const [menuReacciones, setMenuReacciones] = useState(false);
  const [superado, setSuperado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const celebradoRef = useRef<string | null>(null);
  const ultimoCorazon = useRef(0);
  const eraLider = useRef(false);
  const itemRef = useRef<string | undefined>(undefined);
  const chatRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  const esHost = !!show?.sellerId && show.sellerId === profile?.uid;
  const agora = useAgora(showId, esHost ? "host" : "audience");
  const { texto: cuenta, urgente, vencida } = useCountdown(subasta?.endsAt);
  const { disponible, exigeSaldo } = useWallet();

  useEffect(() => {
    getDoc(doc(db, "exchangeRates", "current"))
      .then(s => { if (s.exists()) setTasa(s.data().usdToBs ?? null); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const ref = doc(db, "shows", showId);
    // Entra +1, sale −1 (las reglas no dejan bajar de cero). Es mejor
    // esfuerzo: si el navegador muere sin cleanup, el conteo queda alto
    // hasta que otro ciclo lo compense.
    updateDoc(ref, { viewerCount: increment(1) }).catch(() => undefined);
    const unsub = onSnapshot(ref, s => { if (s.exists()) setShow({ id: s.id, ...s.data() } as Show); });
    return () => {
      unsub();
      updateDoc(ref, { viewerCount: increment(-1) }).catch(() => undefined);
    };
  }, [showId]);

  useEffect(() => {
    if (!show?.agoraChannelName || agora.joined || show.status !== "live") return;
    // profile puede llegar después que el show; sin esperarlo, el vendedor
    // entraría como espectador y no podría transmitir.
    if (!profile) return;
    agora.join(esHost ? localVideoRef.current : remoteVideoRef.current);
  }, [show?.agoraChannelName, show?.status, profile?.uid, esHost]);

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
      setBidInput(calcMinNextBid(a.currentBidUsd, a.minIncrementUsd, (a.bidsCount ?? 0) > 0).toFixed(2));
    });
  }, [show?.currentAuctionId]);

  useEffect(() => {
    const q = query(collection(db, "shows", showId, "messages"), orderBy("createdAt", "desc"), limit(40));
    return onSnapshot(q, s => setMensajes(s.docs.map(d => ({ id: d.id, ...d.data() } as Mensaje)).reverse()));
  }, [showId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes]);

  // Corazones que mandan otros: animarlos también (no los propios, que ya se
  // animaron al instante). Se ignora la primera carga para no soltar viejos.
  useEffect(() => {
    const q = query(collection(db, "shows", showId, "reactions"), orderBy("createdAt", "desc"), limit(15));
    let primera = true;
    return onSnapshot(q, snap => {
      if (primera) { primera = false; return; }
      snap.docChanges().forEach(ch => {
        if (ch.type === "added" && ch.doc.data().authorId !== profile?.uid) soltarCorazon(ch.doc.data().emoji ?? "❤️");
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId, profile?.uid]);

  // "Te superaron": ibas ganando y otro pasó por encima. Reinicia al cambiar
  // de artículo. Dispara el aviso con re-puja de un toque.
  useEffect(() => {
    if (!subasta || !profile) { itemRef.current = undefined; eraLider.current = false; setSuperado(false); return; }
    if (subasta.id !== itemRef.current) {
      itemRef.current = subasta.id;
      eraLider.current = subasta.currentBidderId === profile.uid;
      setSuperado(false);
      return;
    }
    const lider = subasta.currentBidderId;
    if (lider === profile.uid) { eraLider.current = true; setSuperado(false); }
    else if (eraLider.current && lider && subasta.status === "active") { setSuperado(true); eraLider.current = false; }
  }, [subasta?.id, subasta?.currentBidderId, subasta?.status, profile?.uid]);

  // El menú de reacciones se cierra solo tras unos segundos.
  useEffect(() => {
    if (!menuReacciones) return;
    const t = setTimeout(() => setMenuReacciones(false), 4500);
    return () => clearTimeout(t);
  }, [menuReacciones]);

  // Confetti + nombre del ganador cuando cierra una subasta (mensaje reciente).
  useEffect(() => {
    for (let i = mensajes.length - 1; i >= 0; i--) {
      const m = mensajes[i];
      if (m.type !== "auction_won") continue;
      if (m.id !== celebradoRef.current) {
        celebradoRef.current = m.id;
        const ts = m.createdAt?.toMillis?.() ?? 0;
        if (m.winnerName && Date.now() - ts < 20000) {
          setCelebra({ name: m.winnerName, product: m.productTitle ?? "" });
          setTimeout(() => setCelebra(null), 5200);
        }
      }
      break;
    }
  }, [mensajes]);

  const pujar = async (montoArg?: number) => {
    if (!subasta) return;
    if (!profile) { router.push("/login"); return; }

    const minimo = calcMinNextBid(subasta.currentBidUsd, subasta.minIncrementUsd, (subasta.bidsCount ?? 0) > 0);
    const monto = montoArg ?? parseFloat(bidInput);
    if (!isFinite(monto) || monto < minimo) {
      setError(`Mínimo ${formatUsd(minimo)}`);
      setEstado("err");
      setTimeout(() => setEstado("idle"), 2500);
      return;
    }

    setSuperado(false); // vuelvo a la carga: quito el aviso de "te superaron"
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

  // ── Reacciones (corazones y emojis) ──
  const soltarCorazon = (emoji = "❤️") => {
    const id = Date.now() + Math.random();
    setCorazones(c => [...c.slice(-28), { id, x: Math.random() * 46, hue: Math.random(), emoji }]);
    setTimeout(() => setCorazones(c => c.filter(h => h.id !== id)), 2800);
  };

  const mandarReaccion = (emoji: string) => {
    soltarCorazon(emoji); // respuesta inmediata en tu pantalla
    const ahora = Date.now();
    if (profile && ahora - ultimoCorazon.current > 300) {
      ultimoCorazon.current = ahora;
      httpsCallable(functions, "sendReactionV2")({ showId, emoji }).catch(() => undefined);
    }
  };

  // Invitar: compartir el link del vivo (WhatsApp/redes) o copiarlo.
  const compartir = async () => {
    const url = `${window.location.origin}/shows/${showId}`;
    const texto = `🔴 ${show?.sellerName ?? "Un vendedor"} está EN VIVO en Vendeloo. ¡Entra a pujar! ${url}`;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: "Vendeloo — En vivo", text: texto, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2200);
      }
    } catch { /* el usuario canceló */ }
  };

  const voyGanando = !!profile && subasta?.currentBidderId === profile.uid;
  const activa = subasta?.status === "active" && !vencida;
  const minimo = subasta ? calcMinNextBid(subasta.currentBidUsd, subasta.minIncrementUsd, (subasta.bidsCount ?? 0) > 0) : 0;
  const saldoCorto = exigeSaldo && !!profile && !voyGanando && disponible < minimo;

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

        <button onClick={compartir} aria-label="Invitar" style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
        </button>
        {show?.status === "live" && (
          <span className="lv-badge lv-badge--live"><i className="lv-dot"/> EN VIVO</span>
        )}
        <span className="lv-badge" style={{ background: "rgba(0,0,0,0.45)", color: "#fff", backdropFilter: "blur(8px)" }}>
          {show?.viewerCount ?? 0}
        </span>
      </div>

      {copiado && (
        <div style={{ position: "absolute", top: 60, left: 0, right: 0, zIndex: 20, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <span style={{ background: "rgba(0,0,0,0.8)", color: "#fff", borderRadius: 999, padding: "8px 16px", fontSize: "0.8rem", fontWeight: 700 }}>
            Link copiado ✓
          </span>
        </div>
      )}

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
                <div style={{ fontSize: "0.72rem", fontWeight: voyGanando || superado ? 800 : 400, color: voyGanando ? "#4ade80" : superado ? "#ff6b6b" : "rgba(255,255,255,0.55)", marginTop: 2 }}>
                  {subasta.currentBidderName
                    ? (voyGanando ? "✓ Vas ganando" : superado ? "Te superaron" : `Va ganando ${subasta.currentBidderName}`)
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
          <>
            {superado && !voyGanando && <TeSuperaronBanner/>}
            {exigeSaldo && profile && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, color: "rgba(255,255,255,0.72)", fontSize: "0.76rem" }}>
                <span>
                  Saldo disponible: <strong style={{ color: saldoCorto ? "#ff6b6b" : "#fff" }}>{formatUsd(disponible)}</strong>
                </span>
                <button
                  onClick={() => router.push("/wallet")}
                  style={{ color: "#fff", fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 3 }}
                >
                  Recargar
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 9, alignItems: "center" }}>
              <BidAmount dark value={bidInput} onChange={setBidInput} step={subasta?.minIncrementUsd} min={minimo} disabled={voyGanando}/>
              <div style={{ flex: 1 }}>
                {voyGanando ? (
                  <VasGanandoPill/>
                ) : saldoCorto ? (
                  <button
                    onClick={() => router.push("/wallet")}
                    className="lv-btn lv-btn--accent"
                    style={{ width: "100%", height: 48, borderRadius: 999 }}
                  >
                    Recargar para pujar
                  </button>
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
          </>
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

          <div style={{ position: "relative", flexShrink: 0 }}>
            {menuReacciones && (
              <div style={{ position: "absolute", bottom: 52, right: 0, display: "flex", flexDirection: "column", gap: 7, animation: "reaccionesIn .18s ease-out" }}>
                {EMOJIS.map(em => (
                  <button
                    key={em}
                    onClick={() => mandarReaccion(em)}
                    aria-label={`Enviar ${em}`}
                    style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21 }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setMenuReacciones(o => !o)}
              aria-label="Reacciones"
              style={{ width: 44, height: 44, borderRadius: "50%", background: menuReacciones ? "var(--accent)" : "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}
            >
              ❤️
            </button>
          </div>

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

      {/* ── Corazoncitos flotantes ── */}
      <div style={{ position: "absolute", right: 8, bottom: 92, width: 72, height: 360, pointerEvents: "none", zIndex: 6, overflow: "hidden" }}>
        {corazones.map(h => (
          <span
            key={h.id}
            style={{
              position: "absolute", bottom: 0, right: h.x, fontSize: 20 + Math.round(h.hue * 12),
              ["--dx" as any]: `${(h.hue - 0.5) * 60}px`,
              animation: "corazonUp 2.7s ease-out forwards",
            }}
          >
            {h.emoji}
          </span>
        ))}
      </div>

      {/* ── Ganador: nombre + confetti ── */}
      {celebra && (
        <div style={{ position: "absolute", inset: 0, zIndex: 21, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.42)", pointerEvents: "none", textAlign: "center", padding: 24 }}>
          <Confetti/>
          <div style={{ animation: "ganadorPop .55s cubic-bezier(.2,1.5,.4,1) both" }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21 1.18.54 2.03 2.03 2.03 3.79M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
            <div style={{ fontFamily: "var(--f-display)", fontSize: "clamp(1.9rem,9vw,2.7rem)", color: "#fff", textTransform: "uppercase", lineHeight: 1.02, marginTop: 8, textShadow: "0 3px 16px rgba(0,0,0,0.55)" }}>
              ¡{celebra.name}<br/>ganó!
            </div>
            {celebra.product && (
              <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, marginTop: 10, fontSize: "0.95rem" }}>{celebra.product}</div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes corazonUp { 0%{transform:translateY(0) scale(.5);opacity:0} 14%{opacity:1;transform:translateY(-12px) scale(1)} 100%{transform:translateY(-330px) translateX(var(--dx,12px)) scale(1.15) rotate(10deg);opacity:0} }
        @keyframes ganadorPop { 0%{transform:scale(.3);opacity:0} 65%{opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes superadoPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.035)} }
        @keyframes reaccionesIn { 0%{transform:translateY(8px);opacity:0} 100%{transform:translateY(0);opacity:1} }
      `}</style>
    </div>
  );
}
