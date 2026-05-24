"use client";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/authStore";

interface Show { id:string; sellerName:string; title:string; status:string; viewerCount:number; totalProducts:number; coverImageURL?:string; }
interface Auction { id:string; title:string; imageURL:string; currentBidUsd:number; sellerName:string; sellerId:string; endsAt:any; bidsCount:number; status:string; }

const CATS = ["Para Ti","Seguidos","Moda","Electronica","Calzado","Joyas","Hogar","Deportes"];

function useCountdown(endsAt: any) {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      if (!endsAt) return;
      const ms = (endsAt.toMillis?.() ?? new Date(endsAt).getTime()) - Date.now();
      if (ms <= 0) { setText("Finalizada"); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      if (h > 0) setText(`${h}h ${m}m`);
      else setText(`${m}m ${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  return text;
}

function AuctionCard({ auction, onClick }: { auction: Auction; onClick: () => void }) {
  const countdown = useCountdown(auction.endsAt);
  const isUrgent = countdown.includes("m") && !countdown.includes("h") && parseInt(countdown) < 10;
  return (
    <div onClick={onClick} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:16, overflow:"hidden", cursor:"pointer", display:"flex", flexDirection:"column" }}>
      <div style={{ position:"relative", paddingBottom:"70%", overflow:"hidden" }}>
        <img src={auction.imageURL} alt={auction.title} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}/>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(transparent 40%,rgba(8,8,24,0.95))" }}/>
        {/* Timer */}
        <div style={{ position:"absolute", bottom:8, left:8, background: isUrgent ? "rgba(255,45,45,0.9)" : "rgba(8,8,24,0.85)", border:`1px solid ${isUrgent?"rgba(255,45,45,0.4)":"rgba(168,85,247,0.2)"}`, borderRadius:8, padding:"3px 8px" }}>
          <span style={{ fontSize:"0.65rem", fontWeight:800, color:"#fff", fontVariantNumeric:"tabular-nums" }}>⏱ {countdown}</span>
        </div>
        {/* Bids */}
        <div style={{ position:"absolute", top:8, right:8, background:"rgba(8,8,24,0.8)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"3px 8px" }}>
          <span style={{ fontSize:"0.6rem", fontWeight:700, color:"rgba(255,255,255,0.6)" }}>{auction.bidsCount} pujas</span>
        </div>
      </div>
      <div style={{ padding:"10px 12px 12px" }}>
        <div style={{ fontSize:"0.75rem", fontWeight:800, color:"#fff", lineHeight:1.3, marginBottom:6, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{auction.title}</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:"0.58rem", color:"rgba(255,255,255,0.3)", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>Puja actual</div>
            <div style={{ fontSize:"1rem", fontWeight:900, color:"#fff", letterSpacing:"-0.02em" }}>${auction.currentBidUsd.toFixed(2)}</div>
          </div>
          <div style={{ background:"linear-gradient(135deg,rgba(0,200,255,0.15),rgba(168,85,247,0.2))", border:"1px solid rgba(168,85,247,0.25)", borderRadius:8, padding:"5px 12px" }}>
            <span style={{ fontSize:"0.7rem", fontWeight:800, color:"#fff" }}>Pujar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [shows, setShows] = useState<Show[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [cat, setCat] = useState("Para Ti");
  const router = useRouter();
  const { profile } = useAuthStore();

  useEffect(() => {
    const q = query(collection(db,"shows"), where("status","in",["live","scheduled"]), orderBy("viewerCount","desc"));
    return onSnapshot(q, snap => setShows(snap.docs.map(d => ({id:d.id,...d.data()} as Show))));
  }, []);

  useEffect(() => {
    const q = query(collection(db,"auctions"), where("status","==","active"));
    return onSnapshot(q, snap => setAuctions(snap.docs.map(d => ({id:d.id,...d.data()} as Auction))));
  }, []);

  const live = shows.filter(s => s.status==="live");
  const soon = shows.filter(s => s.status==="scheduled");

  return (
    <div style={{ minHeight:"100vh", background:"#080818", fontFamily:"'Inter',-apple-system,sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:90 }}>

      <div style={{ position:"fixed", top:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, height:250, background:"radial-gradient(ellipse 80% 60% at 50% 0%, rgba(168,85,247,0.08) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }}/>

      {/* Header */}
      <div style={{ padding:"16px 20px 0", display:"flex", alignItems:"center", gap:10, position:"relative", zIndex:1 }}>
        <div style={{ fontSize:"1.7rem", fontWeight:900, letterSpacing:"-0.04em", background:"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", filter:"drop-shadow(0 0 12px rgba(168,85,247,0.4))", cursor:"pointer" }}>
          Liveroo
        </div>
        <div style={{ flex:1 }}/>
        <button onClick={() => router.push("/search")} style={{ width:40, height:40, background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </button>
        <button onClick={() => router.push("/notifications")} style={{ width:40, height:40, background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", position:"relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <div style={{ position:"absolute", top:8, right:8, width:7, height:7, borderRadius:"50%", background:"#ff2d2d", boxShadow:"0 0 6px #ff2d2d", border:"1.5px solid #080818" }}/>
        </button>
        <button onClick={() => router.push("/wallet")} style={{ background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.2)", borderRadius:20, padding:"7px 12px", display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/></svg>
          <span style={{ fontSize:"0.72rem", fontWeight:700, color:"#a855f7" }}>Billetera</span>
        </button>
      </div>

      {/* Categories */}
      <div style={{ display:"flex", gap:8, padding:"16px 20px 0", overflowX:"auto", scrollbarWidth:"none", position:"relative", zIndex:1 }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{ background:cat===c?"linear-gradient(135deg,rgba(0,200,255,0.15),rgba(168,85,247,0.2))":"rgba(13,13,32,0.8)", border:`1px solid ${cat===c?"rgba(168,85,247,0.4)":"rgba(168,85,247,0.08)"}`, color:"#fff", borderRadius:20, padding:"8px 18px", fontSize:"0.78rem", fontWeight:cat===c?700:400, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit", flexShrink:0 }}>{c}</button>
        ))}
      </div>

      {/* Live Shows */}
      {live.length > 0 && (
        <div style={{ padding:"24px 20px 0", position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#ff2d2d", boxShadow:"0 0 10px #ff2d2d" }}/>
            <span style={{ fontSize:"0.7rem", fontWeight:800, color:"rgba(255,255,255,0.5)", letterSpacing:"0.12em", textTransform:"uppercase" }}>En vivo ahora</span>
            <span style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.2)", fontWeight:600 }}>{live.length} shows</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {live.map(show => (
              <div key={show.id} onClick={() => router.push(`/shows/${show.id}`)} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:18, overflow:"hidden", cursor:"pointer", boxShadow:"0 4px 24px rgba(0,0,0,0.3)" }}>
                <div style={{ position:"relative", paddingBottom:"70%", background:"linear-gradient(135deg,#0d0d20,#12122a)", overflow:"hidden" }}>
                  {show.coverImageURL ? <img src={show.coverImageURL} alt={show.title} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}/> : <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ width:36, height:36, background:"rgba(168,85,247,0.12)", border:"1px solid rgba(168,85,247,0.2)", borderRadius:10 }}/></div>}
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"60%", background:"linear-gradient(transparent,rgba(8,8,24,0.95))" }}/>
                  <div style={{ position:"absolute", top:10, left:10, background:"rgba(229,62,62,0.92)", borderRadius:8, padding:"3px 8px", display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:4, height:4, background:"#fff", borderRadius:"50%" }}/>
                    <span style={{ fontSize:"0.6rem", fontWeight:800, color:"#fff" }}>LIVE {show.viewerCount>0&&`• ${show.viewerCount>=1000?`${(show.viewerCount/1000).toFixed(1)}K`:show.viewerCount}`}</span>
                  </div>
                </div>
                <div style={{ padding:"10px 12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                    <div style={{ width:18, height:18, background:"linear-gradient(135deg,#00c8ff,#a855f7)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:"0.48rem", fontWeight:900, color:"#fff" }}>{show.sellerName[0]}</span>
                    </div>
                    <span style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.5)", fontWeight:600, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{show.sellerName}</span>
                  </div>
                  <div style={{ fontSize:"0.8rem", fontWeight:800, color:"#fff", lineHeight:1.3, marginBottom:5, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{show.title}</div>
                  <div style={{ fontSize:"0.63rem", color:"rgba(255,255,255,0.25)" }}>{show.totalProducts} productos</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auctions */}
      {auctions.length > 0 && (
        <div style={{ padding:"28px 20px 0", position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#a855f7", boxShadow:"0 0 10px #a855f7" }}/>
              <span style={{ fontSize:"0.7rem", fontWeight:800, color:"rgba(255,255,255,0.5)", letterSpacing:"0.12em", textTransform:"uppercase" }}>Subastas activas</span>
              <span style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.2)", fontWeight:600 }}>{auctions.length}</span>
            </div>
            <button onClick={() => router.push("/auctions")} style={{ background:"none", border:"none", color:"rgba(168,85,247,0.6)", fontSize:"0.72rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Ver todas →
            </button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {auctions.slice(0,6).map(auction => (
              <AuctionCard key={auction.id} auction={auction} onClick={() => router.push(`/auctions/${auction.id}`)}/>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Shows */}
      {soon.length > 0 && (
        <div style={{ padding:"28px 20px 0", position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#F5C518", boxShadow:"0 0 8px rgba(245,197,24,0.5)" }}/>
            <span style={{ fontSize:"0.7rem", fontWeight:800, color:"rgba(255,255,255,0.5)", letterSpacing:"0.12em", textTransform:"uppercase" }}>Próximos shows</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {soon.map(show => (
              <div key={show.id} onClick={() => router.push(`/shows/${show.id}`)} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.08)", borderRadius:16, overflow:"hidden", display:"flex", alignItems:"center", cursor:"pointer" }}>
                <div style={{ width:70, height:70, flexShrink:0, overflow:"hidden" }}>
                  {show.coverImageURL ? <img src={show.coverImageURL} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <div style={{ width:"100%", height:"100%", background:"rgba(168,85,247,0.08)" }}/>}
                </div>
                <div style={{ flex:1, padding:"12px 14px", minWidth:0 }}>
                  <div style={{ fontSize:"0.85rem", fontWeight:700, color:"#fff", marginBottom:3, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{show.title}</div>
                  <div style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.35)" }}>{show.sellerName} · {show.totalProducts} productos</div>
                </div>
                <div style={{ padding:"0 14px", flexShrink:0 }}>
                  <div style={{ background:"rgba(245,197,24,0.08)", border:"1px solid rgba(245,197,24,0.15)", borderRadius:20, padding:"5px 12px" }}>
                    <span style={{ fontSize:"0.63rem", fontWeight:700, color:"#F5C518" }}>Pronto</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {shows.length===0 && auctions.length===0 && (
        <div style={{ padding:"80px 20px", textAlign:"center", position:"relative", zIndex:1 }}>
          <div style={{ width:64, height:64, background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:20, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.4)" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </div>
          <div style={{ fontSize:"0.92rem", fontWeight:700, color:"rgba(255,255,255,0.3)", marginBottom:6 }}>No hay actividad ahora</div>
        </div>
      )}
    </div>
  );
}
