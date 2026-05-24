"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, limit, updateDoc, increment } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuthStore } from "../../../store/authStore";

interface Auction { id:string; title:string; description?:string; imageURL:string; currentBidUsd:number; startingPriceUsd:number; minIncrementUsd:number; sellerName:string; sellerId:string; endsAt:any; bidsCount:number; status:string; currentBidderId?:string; currentBidderName?:string; category?:string; }
interface Bid { id:string; bidderName:string; amountUsd:number; createdAt:any; }

function useCountdown(endsAt: any) {
  const [text, setText] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const tick = () => {
      if (!endsAt) return;
      const diff = (endsAt.toMillis?.() ?? new Date(endsAt).getTime()) - Date.now();
      setMs(Math.max(0, diff));
      if (diff <= 0) { setText("Finalizada"); return; }
      const h = Math.floor(diff/3600000);
      const m = Math.floor((diff%3600000)/60000);
      const s = Math.floor((diff%60000)/1000);
      setUrgent(h===0 && m<10);
      if (h>0) setText(`${h}h ${m}m ${s}s`);
      else setText(`${m}m ${s}s`);
    };
    tick();
    const t = setInterval(tick,1000);
    return () => clearInterval(t);
  }, [endsAt]);
  return { text, urgent, ms };
}

export default function AuctionPage() {
  const { auctionId } = useParams() as { auctionId:string };
  const router = useRouter();
  const { profile } = useAuthStore();
  const [auction, setAuction] = useState<Auction|null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidInput, setBidInput] = useState("");
  const [bidStatus, setBidStatus] = useState<"idle"|"pending"|"ok"|"err"|"no_funds">("idle");
  const [wallet, setWallet] = useState({ balanceUsd:0 });
  const [showBids, setShowBids] = useState(false);
  const { text:countdown, urgent, ms } = useCountdown(auction?.endsAt);

  useEffect(() => {
    return onSnapshot(doc(db,"auctions",auctionId), s => {
      if(s.exists()) {
        const a = {id:s.id,...s.data()} as Auction;
        setAuction(a);
        const min = a.currentBidUsd + a.minIncrementUsd;
        setBidInput(min.toFixed(2));
      }
    });
  }, [auctionId]);

  useEffect(() => {
    const q = query(collection(db,"auctions",auctionId,"bids"), orderBy("createdAt","desc"), limit(20));
    return onSnapshot(q, s => {
      const bidList = s.docs.map(d => ({id:d.id,...d.data()} as Bid));
      setBids(bidList);
    });
  }, [auctionId]);

  useEffect(() => {
    if(!profile) return;
    return onSnapshot(doc(db,"wallets",profile.uid), s => { if(s.exists()) setWallet(s.data() as any); });
  }, [profile]);

  const handleBid = async () => {
    if(!profile || !auction) return;
    const amt = parseFloat(bidInput);
    const minBid = auction.currentBidUsd + auction.minIncrementUsd;
    if(isNaN(amt) || amt < minBid) { setBidStatus("err"); setTimeout(()=>setBidStatus("idle"),3000); return; }
    if(wallet.balanceUsd < amt) { setBidStatus("no_funds"); setTimeout(()=>setBidStatus("idle"),4000); return; }
    setBidStatus("pending");
    try {
      // Agregar puja a subcolección
      await addDoc(collection(db,"auctions",auctionId,"bids"), {
        auctionId,
        bidderId: profile.uid,
        bidderName: profile.displayName,
        amountUsd: amt,
        createdAt: serverTimestamp(),
      });
      // Actualizar auction: currentBid, bidsCount, líder
      await updateDoc(doc(db,"auctions",auctionId), {
        currentBidUsd: amt,
        currentBidderId: profile.uid,
        currentBidderName: profile.displayName,
        bidsCount: increment(1),
      });
      // También guardar en pendingBids para el sistema de escrow
      await addDoc(collection(db,"pendingBids"), {
        auctionId, bidderId:profile.uid, bidderName:profile.displayName,
        amountUsd:amt, submittedAt:serverTimestamp(), status:"pending", type:"auction"
      });
      setBidStatus("ok");
      setTimeout(()=>setBidStatus("idle"),3000);
    } catch(e:any) {
      console.error(e);
      setBidStatus("err");
      setTimeout(()=>setBidStatus("idle"),3000);
    }
  };

  if(!auction) return (
    <div style={{minHeight:"100vh",background:"#080818",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"rgba(255,255,255,0.2)",fontSize:"0.88rem"}}>Cargando...</div>
    </div>
  );

  const isMyBid = auction.currentBidderId===profile?.uid;
  const minBid = auction.currentBidUsd + auction.minIncrementUsd;
  const hasEnoughFunds = wallet.balanceUsd >= minBid;
  const isActive = auction.status==="active";
  const pctTime = auction.endsAt ? Math.min(100, Math.max(0, (ms / (24*3600000)) * 100)) : 0;

  return (
    <div style={{minHeight:"100vh",background:"#080818",fontFamily:"'Inter',-apple-system,sans-serif",maxWidth:480,margin:"0 auto",paddingBottom:100}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",position:"sticky",top:0,background:"rgba(8,8,24,0.95)",backdropFilter:"blur(10px)",zIndex:10,borderBottom:"1px solid rgba(168,85,247,0.08)"}}>
        <button onClick={()=>router.back()} style={{width:38,height:38,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(168,85,247,0.12)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {auction.category && (
            <div style={{background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:20,padding:"4px 12px"}}>
              <span style={{fontSize:"0.68rem",fontWeight:700,color:"#a855f7"}}>{auction.category}</span>
            </div>
          )}
          <div onClick={()=>router.push("/wallet")} style={{background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:20,padding:"4px 12px",cursor:"pointer"}}>
            <span style={{fontSize:"0.68rem",fontWeight:700,color:"#a855f7"}}>${wallet.balanceUsd.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Image */}
      <div style={{position:"relative",height:300,overflow:"hidden",background:"#0d0d1e"}}>
        <img src={auction.imageURL} alt={auction.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 40%, #080818 100%)"}}/>
        <div style={{position:"absolute",bottom:16,left:20,background:urgent?"rgba(255,45,45,0.95)":"rgba(8,8,24,0.9)",border:`1px solid ${urgent?"rgba(255,45,45,0.4)":"rgba(168,85,247,0.3)"}`,borderRadius:14,padding:"10px 16px",backdropFilter:"blur(8px)"}}>
          <div style={{fontSize:"0.58rem",color:urgent?"rgba(255,200,200,0.8)":"rgba(255,255,255,0.4)",fontWeight:600,letterSpacing:"0.08em",marginBottom:3}}>TERMINA EN</div>
          <div style={{fontSize:"1.2rem",fontWeight:900,color:"#fff",fontVariantNumeric:"tabular-nums"}}>{countdown}</div>
          <div style={{width:"100%",height:2,background:"rgba(255,255,255,0.1)",borderRadius:1,marginTop:6}}>
            <div style={{width:`${pctTime}%`,height:"100%",background:urgent?"#ff2d2d":"#a855f7",borderRadius:1}}/>
          </div>
        </div>
        <div onClick={()=>setShowBids(!showBids)} style={{position:"absolute",bottom:16,right:20,background:"rgba(8,8,24,0.9)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"10px 16px",backdropFilter:"blur(8px)",cursor:"pointer",textAlign:"center"}}>
          <div style={{fontSize:"0.58rem",color:"rgba(255,255,255,0.4)",fontWeight:600,letterSpacing:"0.08em",marginBottom:3}}>PUJAS</div>
          <div style={{fontSize:"1.2rem",fontWeight:900,color:"#fff"}}>{auction.bidsCount}</div>
        </div>
      </div>

      <div style={{padding:"0 20px"}}>
        <div style={{marginTop:20,marginBottom:20}}>
          <h1 style={{fontSize:"1.4rem",fontWeight:900,color:"#fff",letterSpacing:"-0.03em",marginBottom:8,lineHeight:1.2}}>{auction.title}</h1>
          {auction.description && <p style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.45)",lineHeight:1.7,marginBottom:12}}>{auction.description}</p>}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,background:"linear-gradient(135deg,#00c8ff,#a855f7)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.68rem",fontWeight:900,color:"#fff"}}>
              {auction.sellerName[0]}
            </div>
            <div>
              <div style={{fontSize:"0.82rem",fontWeight:700,color:"#fff"}}>{auction.sellerName}</div>
              <div style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.35)"}}>Vendedor verificado</div>
            </div>
          </div>
        </div>

        {/* Bid card */}
        <div style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:20,padding:"20px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div>
              <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.35)",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Puja actual</div>
              <div style={{fontSize:"2.4rem",fontWeight:900,color:"#fff",letterSpacing:"-0.04em",lineHeight:1}}>${auction.currentBidUsd.toFixed(2)}</div>
              <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.3)",marginTop:4}}>
                Inicio: ${auction.startingPriceUsd.toFixed(2)} · Mínimo +${auction.minIncrementUsd.toFixed(2)}
              </div>
            </div>
            {auction.currentBidderName && (
              <div style={{background:isMyBid?"rgba(0,200,255,0.1)":"rgba(168,85,247,0.08)",border:`1px solid ${isMyBid?"rgba(0,200,255,0.25)":"rgba(168,85,247,0.15)"}`,borderRadius:12,padding:"8px 14px",textAlign:"center"}}>
                <div style={{fontSize:"0.58rem",color:isMyBid?"rgba(0,200,255,0.6)":"rgba(255,255,255,0.3)",fontWeight:600,letterSpacing:"0.08em",marginBottom:4}}>LÍDER</div>
                <div style={{fontSize:"0.82rem",fontWeight:800,color:isMyBid?"#00c8ff":"#fff"}}>{isMyBid?"Tú":auction.currentBidderName}</div>
              </div>
            )}
          </div>

          {/* Recent bids preview */}
          {bids.length > 0 && (
            <div style={{borderTop:"1px solid rgba(168,85,247,0.08)",paddingTop:14,marginBottom:16}}>
              {bids.slice(0,3).map((bid,i) => (
                <div key={bid.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:i<2?8:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:i===0?"#a855f7":"rgba(255,255,255,0.15)",flexShrink:0}}/>
                    <span style={{fontSize:"0.75rem",color:i===0?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.35)",fontWeight:i===0?600:400}}>{bid.bidderName}</span>
                  </div>
                  <span style={{fontSize:"0.78rem",fontWeight:i===0?800:500,color:i===0?"#fff":"rgba(255,255,255,0.35)"}}>${bid.amountUsd.toFixed(2)}</span>
                </div>
              ))}
              {bids.length > 3 && (
                <button onClick={()=>setShowBids(!showBids)} style={{background:"none",border:"none",color:"rgba(168,85,247,0.6)",fontSize:"0.72rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginTop:10,padding:0}}>
                  {showBids?"Ocultar":"Ver todas"} ({bids.length} pujas)
                </button>
              )}
            </div>
          )}

          {/* Insufficient funds warning */}
          {!hasEnoughFunds && isActive && !isMyBid && (
            <div onClick={()=>router.push("/wallet")} style={{background:"rgba(245,197,24,0.06)",border:"1px solid rgba(245,197,24,0.15)",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:14}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
              <div style={{flex:1}}>
                <div style={{fontSize:"0.78rem",fontWeight:700,color:"#F5C518"}}>Saldo insuficiente</div>
                <div style={{fontSize:"0.68rem",color:"rgba(245,197,24,0.5)"}}>Tienes ${wallet.balanceUsd.toFixed(2)} · Toca para depositar</div>
              </div>
            </div>
          )}

          {/* Bid input */}
          {isActive && !isMyBid && (
            <div>
              <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.35)",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>
                Mínimo ${minBid.toFixed(2)} · Tu saldo ${wallet.balanceUsd.toFixed(2)}
              </div>
              <div style={{display:"flex",gap:10,marginBottom:10}}>
                <div style={{flex:1,position:"relative"}}>
                  <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.4)",fontSize:"1.1rem",fontWeight:700}}>$</span>
                  <input type="number" value={bidInput} onChange={e=>setBidInput(e.target.value)} min={minBid} step={auction.minIncrementUsd} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${hasEnoughFunds?"rgba(168,85,247,0.25)":"rgba(245,197,24,0.25)"}`,borderRadius:14,padding:"14px 14px 14px 32px",color:"#fff",fontSize:"1.2rem",fontWeight:800,fontFamily:"inherit",outline:"none"}}/>
                </div>
                <button onClick={handleBid} disabled={bidStatus==="pending"||!hasEnoughFunds} style={{background:!hasEnoughFunds?"rgba(245,197,24,0.1)":bidStatus==="pending"?"rgba(168,85,247,0.3)":"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)",border:`1px solid ${!hasEnoughFunds?"rgba(245,197,24,0.2)":"transparent"}`,borderRadius:14,padding:"0 24px",fontSize:"0.88rem",fontWeight:800,color:"#fff",cursor:(!hasEnoughFunds||bidStatus==="pending")?"not-allowed":"pointer",fontFamily:"inherit",whiteSpace:"nowrap",boxShadow:(!hasEnoughFunds||bidStatus==="pending")?"none":"0 0 24px rgba(168,85,247,0.3)"}}>
                  {bidStatus==="pending"?"...":!hasEnoughFunds?"Sin saldo":"Pujar"}
                </button>
              </div>
              <div style={{display:"flex",gap:8}}>
                {[1,5,10,25].map(inc => (
                  <button key={inc} onClick={()=>setBidInput((parseFloat(bidInput||"0")+inc).toFixed(2))} style={{flex:1,background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.1)",borderRadius:10,padding:"9px 0",fontSize:"0.75rem",fontWeight:700,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"inherit"}}>+${inc}</button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          {bidStatus==="ok" && (
            <div style={{marginTop:12,background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:12,padding:"12px 16px",fontSize:"0.85rem",color:"#4ade80",fontWeight:700,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              Puja registrada
            </div>
          )}
          {bidStatus==="no_funds" && (
            <div onClick={()=>router.push("/wallet")} style={{marginTop:12,background:"rgba(255,68,68,0.06)",border:"1px solid rgba(255,68,68,0.15)",borderRadius:12,padding:"12px 16px",fontSize:"0.82rem",color:"#ff8080",fontWeight:600,textAlign:"center",cursor:"pointer"}}>
              Saldo insuficiente → Depositar
            </div>
          )}
          {bidStatus==="err" && (
            <div style={{marginTop:12,background:"rgba(255,68,68,0.06)",border:"1px solid rgba(255,68,68,0.15)",borderRadius:12,padding:"12px 16px",fontSize:"0.82rem",color:"#ff8080",fontWeight:600,textAlign:"center"}}>
              Mínimo ${minBid.toFixed(2)}
            </div>
          )}
          {isMyBid && isActive && (
            <div style={{marginTop:12,background:"rgba(0,200,255,0.06)",border:"1px solid rgba(0,200,255,0.15)",borderRadius:12,padding:"12px 16px",fontSize:"0.85rem",color:"#00c8ff",fontWeight:700,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Eres el mayor postor
            </div>
          )}
          {!isActive && (
            <div style={{marginTop:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 16px",fontSize:"0.85rem",color:"rgba(255,255,255,0.4)",fontWeight:600,textAlign:"center"}}>
              Esta subasta ha finalizado
            </div>
          )}
        </div>

        {/* Escrow info */}
        <div style={{background:"rgba(0,200,255,0.04)",border:"1px solid rgba(0,200,255,0.1)",borderRadius:16,padding:"16px",marginBottom:16,display:"flex",alignItems:"flex-start",gap:12}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="1.5" strokeLinecap="round" style={{flexShrink:0,marginTop:2}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <div>
            <div style={{fontSize:"0.82rem",fontWeight:700,color:"#00c8ff",marginBottom:4}}>Pago protegido por Liveroo</div>
            <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.45)",lineHeight:1.6}}>Si ganas, tus fondos quedan en custodia. Liveroo los libera al vendedor solo cuando confirmes la entrega.</div>
          </div>
        </div>

        {/* Full bid history */}
        {showBids && bids.length > 0 && (
          <div style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.1)",borderRadius:16,padding:"16px",marginBottom:16}}>
            <div style={{fontSize:"0.72rem",fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>Historial de pujas</div>
            {bids.map((bid,i) => (
              <div key={bid.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<bids.length-1?"1px solid rgba(168,85,247,0.06)":"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:28,height:28,background:i===0?"rgba(168,85,247,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${i===0?"rgba(168,85,247,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:"0.65rem",fontWeight:800,color:i===0?"#a855f7":"rgba(255,255,255,0.3)"}}>{i+1}</span>
                  </div>
                  <div>
                    <div style={{fontSize:"0.82rem",fontWeight:i===0?700:500,color:i===0?"#fff":"rgba(255,255,255,0.5)"}}>{bid.bidderName}</div>
                    <div style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.25)"}}>{bid.createdAt?.toDate?.()?.toLocaleString("es-VE")??""}</div>
                  </div>
                </div>
                <div style={{fontSize:"0.95rem",fontWeight:i===0?900:600,color:i===0?"#fff":"rgba(255,255,255,0.4)"}}>${bid.amountUsd.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}

        <button onClick={()=>router.push("/wallet")} style={{width:"100%",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:14,padding:"14px",fontSize:"0.88rem",fontWeight:700,color:"#a855f7",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/></svg>
          Depositar fondos para pujar
        </button>
      </div>
    </div>
  );
}
