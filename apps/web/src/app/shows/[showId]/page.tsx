"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { doc, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuthStore } from "../../../store/authStore";
import { useAgora } from "../../../hooks/useAgora";
import { formatUsd, formatBs, calcMinNextBid, isValidBidAmount, formatTimer, isUrgent } from "@subastas-ve/shared";

interface Show { id:string; sellerName:string; title:string; status:string; viewerCount:number; currentAuctionId?:string; agoraChannelName?:string; sellerId?:string; }
interface Product { id:string; title:string; currentBidUsd:number; startingPriceUsd:number; minIncrementUsd:number; auctionStatus:string; auctionEndsAt?:any; currentBidderName?:string; currentBidderId?:string; }
interface Message { id:string; authorName:string; text:string; type:string; createdAt?:any; }
interface Wallet { balanceUsd:number; frozenUsd:number; }

export default function ShowPage() {
  const { showId } = useParams() as { showId: string };
  const router = useRouter();
  const { profile } = useAuthStore();
  const [show, setShow] = useState<Show|null>(null);
  const [product, setProduct] = useState<Product|null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [wallet, setWallet] = useState<Wallet>({ balanceUsd:0, frozenUsd:0 });
  const [seconds, setSeconds] = useState(0);
  const [bidInput, setBidInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [bidStatus, setBidStatus] = useState<"idle"|"pending"|"ok"|"err"|"no_funds">("idle");
  const [bidError, setBidError] = useState("");
  const [exchangeRate, setExchangeRate] = useState(36.5);
  const [chatOpen, setChatOpen] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  const channelName = show?.agoraChannelName ?? "";
  const isHost = show?.sellerId === profile?.uid;
  const agora = useAgora(channelName, isHost ? "host" : "audience");

  useEffect(() => {
    getDoc(doc(db,"exchangeRates","current")).then(s => { if(s.exists()) setExchangeRate(s.data().usdToBs); });
  }, []);

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(doc(db,"wallets",profile.uid), s => { if(s.exists()) setWallet(s.data() as Wallet); });
  }, [profile]);

  useEffect(() => {
    const showRef = doc(db,"shows",showId);
    import("firebase/firestore").then(({updateDoc, increment: inc}) => {
      updateDoc(showRef, { viewerCount: inc(1) }).catch(()=>{});
    });
    return onSnapshot(showRef, s => { if(s.exists()) setShow({id:s.id,...s.data()} as Show); });
  }, [showId]);

  // Unirse al canal cuando tengamos el show
  useEffect(() => {
    if (!show?.agoraChannelName || agora.joined) return;
    if (show.status !== "live") return;
    const ref = isHost ? localVideoRef.current : remoteVideoRef.current;
    agora.join(ref);
  }, [show?.agoraChannelName, show?.status]);

  // Mostrar video remoto
  useEffect(() => {
    if (agora.remoteUsers.length > 0 && remoteVideoRef.current) {
      const user = agora.remoteUsers[0];
      if (user.videoTrack) user.videoTrack.play(remoteVideoRef.current);
    }
  }, [agora.remoteUsers]);

  useEffect(() => {
    if(!show?.currentAuctionId) return;
    return onSnapshot(doc(db,"shows",showId,"products",show.currentAuctionId), s => {
      if(s.exists()) {
        const p = {id:s.id,...s.data()} as Product;
        setProduct(p);
        setBidInput(calcMinNextBid(p.currentBidUsd, p.minIncrementUsd).toFixed(2));
      }
    });
  }, [show?.currentAuctionId]);

  useEffect(() => {
    const q = query(collection(db,"shows",showId,"messages"), orderBy("createdAt","desc"), limit(50));
    return onSnapshot(q, s => setMessages(s.docs.map(d => ({id:d.id,...d.data()} as Message)).reverse()));
  }, [showId]);

  useEffect(() => {
    const t = setInterval(() => {
      if(!product?.auctionEndsAt) return setSeconds(0);
      const ms = product.auctionEndsAt.toMillis?.() ?? 0;
      setSeconds(Math.max(0, Math.floor((ms - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [product]);

  useEffect(() => {
    if(chatOpen) chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages, chatOpen]);

  const handleBid = async () => {
    if(!profile || !show || !product) return;
    const amt = parseFloat(bidInput);
    const v = isValidBidAmount(amt, product.currentBidUsd, product.minIncrementUsd);
    if(!v.valid) { setBidError(v.reason ?? "Puja inválida"); setBidStatus("err"); setTimeout(() => setBidStatus("idle"), 3000); return; }
    if(wallet.balanceUsd < amt) { setBidStatus("no_funds"); setBidError(`Saldo insuficiente. Tienes $${wallet.balanceUsd.toFixed(2)}`); setTimeout(() => setBidStatus("idle"), 4000); return; }
    setBidStatus("pending");
    try {
      await addDoc(collection(db,"pendingBids"), { showId, productId:product.id, bidderId:profile.uid, bidderName:profile.displayName, amountUsd:amt, submittedAt:serverTimestamp(), status:"pending" });
      setBidStatus("ok");
      setTimeout(() => setBidStatus("idle"), 3000);
    } catch { setBidStatus("err"); setBidError("Error enviando la puja"); setTimeout(() => setBidStatus("idle"), 3000); }
  };

  const handleChat = async () => {
    if(!profile || !chatInput.trim()) return;
    await addDoc(collection(db,"shows",showId,"messages"), { showId, authorId:profile.uid, authorName:profile.displayName, type:"chat", text:chatInput.trim(), createdAt:serverTimestamp() });
    setChatInput("");
  };

  const handleToggleMic = async () => { await agora.toggleMic(); setMicOn(!micOn); };
  const handleToggleCam = async () => { await agora.toggleCamera(); setCamOn(!camOn); };

  const urgent = isUrgent(seconds);
  const isMyBid = product?.currentBidderId === profile?.uid;
  const minBid = product ? calcMinNextBid(product.currentBidUsd, product.minIncrementUsd) : 0;
  const hasEnoughFunds = wallet.balanceUsd >= minBid;
  const msgColor = (type:string) => type==="bid_placed"?"#a855f7":type==="auction_won"?"#00c8ff":type==="system"?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.85)";

  return (
    <div style={{ height:"100vh", background:"#080818", fontFamily:"'Inter',-apple-system,sans-serif", display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"rgba(8,8,24,0.95)", borderBottom:"1px solid rgba(168,85,247,0.08)", flexShrink:0, zIndex:10 }}>
        <button onClick={() => { agora.leave(); router.push("/"); }} style={{ width:36, height:36, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:"0.85rem", fontWeight:800, color:"#fff", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{show?.title ?? "Cargando..."}</div>
          <div style={{ fontSize:"0.62rem", color:"rgba(255,255,255,0.35)", marginTop:1 }}>{show?.sellerName}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {show?.status==="live" && (
            <div style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(255,45,45,0.12)", border:"1px solid rgba(255,45,45,0.25)", borderRadius:20, padding:"4px 10px" }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"#ff2d2d", boxShadow:"0 0 6px #ff2d2d" }}/>
              <span style={{ fontSize:"0.62rem", fontWeight:700, color:"#ff2d2d" }}>EN VIVO</span>
            </div>
          )}
          <div onClick={() => router.push("/wallet")} style={{ background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.2)", borderRadius:20, padding:"4px 10px", cursor:"pointer" }}>
            <span style={{ fontSize:"0.65rem", fontWeight:700, color:"#a855f7" }}>${wallet.balanceUsd.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Video */}
      <div style={{ position:"relative", background:"#000", flexShrink:0, height:220 }}>
        {/* Remote video (audiencia ve al host) */}
        <div ref={remoteVideoRef} style={{ position:"absolute", inset:0, background:"#000" }}/>
        {/* Local video (host se ve a sí mismo) */}
        {isHost && <div ref={localVideoRef} style={{ position:"absolute", inset:0, background:"#000" }}/>}

        {/* Placeholder si no hay video */}
        {!agora.joined && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"linear-gradient(180deg,#0d0d1e,#080818)" }}>
            {agora.loading ? (
              <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.3)" }}>Conectando...</div>
            ) : agora.error ? (
              <div style={{ fontSize:"0.72rem", color:"rgba(255,100,100,0.6)", textAlign:"center", padding:"0 20px" }}>{agora.error}</div>
            ) : show?.status === "live" ? (
              <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.2)" }}>Conectando transmisión...</div>
            ) : (
              <div style={{ textAlign:"center" }}>
                <div style={{ width:52, height:52, background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.4)" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                </div>
                <div style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.15)" }}>Show no iniciado</div>
              </div>
            )}
          </div>
        )}

        {/* Timer */}
        {product?.auctionStatus==="active" && (
          <div style={{ position:"absolute", top:12, right:12, background:urgent?"rgba(255,45,45,0.95)":"rgba(8,8,24,0.85)", border:`1px solid ${urgent?"rgba(255,45,45,0.4)":"rgba(168,85,247,0.2)"}`, borderRadius:12, padding:"6px 14px", backdropFilter:"blur(10px)", boxShadow:urgent?"0 0 20px rgba(255,45,45,0.3)":"none" }}>
            <span style={{ fontSize:"1.3rem", fontWeight:900, color:"#fff", fontVariantNumeric:"tabular-nums" }}>{formatTimer(seconds)}</span>
          </div>
        )}

        {/* Viewer count */}
        <div style={{ position:"absolute", top:12, left:12, display:"flex", alignItems:"center", gap:5, background:"rgba(8,8,24,0.7)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:20, padding:"4px 10px" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span style={{ fontSize:"0.62rem", color:"rgba(255,255,255,0.4)", fontWeight:600 }}>{show?.viewerCount ?? 0}</span>
        </div>

        {/* Host controls */}
        {isHost && agora.joined && (
          <div style={{ position:"absolute", bottom:12, left:12, display:"flex", gap:8 }}>
            <button onClick={handleToggleMic} style={{ width:34, height:34, background:micOn?"rgba(168,85,247,0.2)":"rgba(255,45,45,0.3)", border:`1px solid ${micOn?"rgba(168,85,247,0.3)":"rgba(255,45,45,0.4)"}`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                {micOn ? <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></> : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8"/></>}
              </svg>
            </button>
            <button onClick={handleToggleCam} style={{ width:34, height:34, background:camOn?"rgba(168,85,247,0.2)":"rgba(255,45,45,0.3)", border:`1px solid ${camOn?"rgba(168,85,247,0.3)":"rgba(255,45,45,0.4)"}`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                {camOn ? <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></> : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56"/></>}
              </svg>
            </button>
          </div>
        )}

        {/* Chat toggle */}
        <button onClick={() => setChatOpen(!chatOpen)} style={{ position:"absolute", bottom:12, right:12, width:36, height:36, background:"rgba(8,8,24,0.85)", border:`1px solid ${chatOpen?"rgba(168,85,247,0.4)":"rgba(168,85,247,0.15)"}`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={chatOpen?"#a855f7":"rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>

      {/* Chat */}
      {chatOpen && (
        <div style={{ background:"rgba(8,8,24,0.96)", borderBottom:"1px solid rgba(168,85,247,0.08)", display:"flex", flexDirection:"column", height:160, flexShrink:0 }}>
          <div ref={chatRef} style={{ flex:1, overflowY:"auto", padding:"8px 16px", display:"flex", flexDirection:"column", gap:3 }}>
            {messages.length===0 && <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.15)", textAlign:"center", paddingTop:8 }}>Sé el primero en escribir...</div>}
            {messages.map(m => (
              <div key={m.id} style={{ fontSize:"0.72rem", lineHeight:1.5 }}>
                {m.type==="chat" && <span style={{ fontWeight:700, color:"#a855f7", marginRight:5 }}>{m.authorName}</span>}
                <span style={{ color:msgColor(m.type) }}>{m.text}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, padding:"8px 12px", borderTop:"1px solid rgba(168,85,247,0.06)" }}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleChat()} placeholder="Escribe un mensaje..." style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:20, padding:"8px 14px", color:"#fff", fontSize:"0.78rem", fontFamily:"inherit", outline:"none" }}/>
            <button onClick={handleChat} style={{ width:34, height:34, background:"linear-gradient(135deg,#00c8ff,#a855f7)", border:"none", borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Bid Panel */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
        {product ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:18, padding:"18px" }}>
              <div style={{ fontSize:"0.95rem", fontWeight:800, color:"#fff", marginBottom:12 }}>{product.title}</div>
              <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.3)", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>Puja actual</div>
                  <div style={{ fontSize:"2rem", fontWeight:900, color:"#fff", letterSpacing:"-0.04em", lineHeight:1 }}>{formatUsd(product.currentBidUsd)}</div>
                  <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.3)", marginTop:4 }}>≈ {formatBs(product.currentBidUsd * exchangeRate)}</div>
                </div>
                {product.currentBidderName && (
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.3)", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:4 }}>Líder</div>
                    <div style={{ fontSize:"0.78rem", fontWeight:700, color:isMyBid?"#00c8ff":"#a855f7" }}>{isMyBid?"Tú":product.currentBidderName}</div>
                  </div>
                )}
              </div>
            </div>

            {!hasEnoughFunds && product.auctionStatus==="active" && !isMyBid && (
              <div onClick={() => router.push("/wallet")} style={{ background:"rgba(245,197,24,0.06)", border:"1px solid rgba(245,197,24,0.15)", borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#F5C518" }}>Saldo insuficiente</div>
                  <div style={{ fontSize:"0.68rem", color:"rgba(245,197,24,0.5)" }}>Tienes ${wallet.balanceUsd.toFixed(2)} · Toca para depositar</div>
                </div>
              </div>
            )}

            {product.auctionStatus==="active" && !isMyBid && (
              <div style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:18, padding:"16px" }}>
                <div style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.3)", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>
                  Mínimo {formatUsd(minBid)} · Saldo ${wallet.balanceUsd.toFixed(2)}
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  <div style={{ flex:1, position:"relative" }}>
                    <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.4)", fontSize:"1rem", fontWeight:700 }}>$</span>
                    <input type="number" value={bidInput} onChange={e=>setBidInput(e.target.value)} style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${hasEnoughFunds?"rgba(168,85,247,0.2)":"rgba(245,197,24,0.2)"}`, borderRadius:12, padding:"13px 14px 13px 28px", color:"#fff", fontSize:"1.1rem", fontWeight:800, fontFamily:"inherit", outline:"none" }}/>
                  </div>
                  <button onClick={handleBid} disabled={bidStatus==="pending"||!hasEnoughFunds} style={{ background:!hasEnoughFunds?"rgba(245,197,24,0.1)":bidStatus==="pending"?"rgba(168,85,247,0.3)":"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)", border:`1px solid ${!hasEnoughFunds?"rgba(245,197,24,0.2)":"transparent"}`, borderRadius:12, padding:"0 22px", fontSize:"0.82rem", fontWeight:800, color:"#fff", cursor:(!hasEnoughFunds||bidStatus==="pending")?"not-allowed":"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                    {bidStatus==="pending"?"...":!hasEnoughFunds?"Sin saldo":"PUJAR"}
                  </button>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {[1,5,10,25].map(inc => (
                    <button key={inc} onClick={() => setBidInput((parseFloat(bidInput||"0")+inc).toFixed(2))} style={{ flex:1, background:"rgba(168,85,247,0.06)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:8, padding:"7px 0", fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.5)", cursor:"pointer", fontFamily:"inherit" }}>+${inc}</button>
                  ))}
                </div>
              </div>
            )}

            {bidStatus==="ok" && <div style={{ background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:12, padding:"12px 16px", fontSize:"0.82rem", color:"#4ade80", fontWeight:600, textAlign:"center" }}>Puja registrada</div>}
            {(bidStatus==="err"||bidStatus==="no_funds") && <div onClick={bidStatus==="no_funds"?()=>router.push("/wallet"):undefined} style={{ background:"rgba(255,68,68,0.06)", border:"1px solid rgba(255,68,68,0.15)", borderRadius:12, padding:"12px 16px", fontSize:"0.82rem", color:"#ff8080", fontWeight:600, textAlign:"center", cursor:bidStatus==="no_funds"?"pointer":"default" }}>{bidError}{bidStatus==="no_funds"&&" → Depositar"}</div>}
            {isMyBid && product.auctionStatus==="active" && <div style={{ background:"rgba(0,200,255,0.06)", border:"1px solid rgba(0,200,255,0.15)", borderRadius:12, padding:"12px 16px", fontSize:"0.82rem", color:"#00c8ff", fontWeight:600, textAlign:"center" }}>Eres el mayor postor</div>}
          </div>
        ) : (
          <div style={{ textAlign:"center", padding:"40px 20px" }}>
            <div style={{ fontSize:"0.85rem", color:"rgba(255,255,255,0.15)" }}>Esperando que comience la subasta...</div>
          </div>
        )}
      </div>

      <div style={{ padding:"10px 16px 20px", borderTop:"1px solid rgba(168,85,247,0.06)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(8,8,24,0.95)" }}>
        <span style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.15)" }}>Tasa: {exchangeRate} Bs/USD</span>
        <button onClick={() => router.push("/wallet")} style={{ background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:20, padding:"5px 14px", fontSize:"0.68rem", fontWeight:700, color:"#a855f7", cursor:"pointer", fontFamily:"inherit" }}>+ Depositar</button>
      </div>
    </div>
  );
}
