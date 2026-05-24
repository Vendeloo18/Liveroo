"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";

type Tab = "compras" | "pujas" | "guardados";

export default function ActivityPage() {
  const { profile } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pujas");
  const [bids, setBids] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    const u1 = onSnapshot(
      query(collection(db,"pendingBids"), where("bidderId","==",profile.uid), orderBy("submittedAt","desc")),
      s => setBids(s.docs.map(d => ({id:d.id,...d.data()})))
    );
    const u2 = onSnapshot(
      query(collection(db,"orders"), where("buyerId","==",profile.uid), orderBy("createdAt","desc")),
      s => setOrders(s.docs.map(d => ({id:d.id,...d.data()})))
    );
    return () => { u1(); u2(); };
  }, [profile]);

  const statusColor = (s:string) => ({
    pending:"#F5C518", active:"#F5C518", won:"#4ade80", lost:"rgba(255,255,255,0.3)",
    paid:"#4ade80", delivered:"#4ade80", cancelled:"#ff6b6b"
  }[s] ?? "#888");

  const statusLabel = (s:string) => ({
    pending:"Pendiente", active:"Activa", won:"Ganada", lost:"Superada",
    paid:"Pagado", delivered:"Entregado", cancelled:"Cancelado"
  }[s] ?? s);

  const handleBidClick = async (bid: any) => {
    if (bid.auctionId) {
      // Verificar si la subasta sigue activa
      const aDoc = await getDoc(doc(db,"auctions",bid.auctionId));
      if (aDoc.exists()) {
        router.push(`/auctions/${bid.auctionId}`);
        return;
      }
      // Si es de un show en vivo
      if (bid.showId) {
        router.push(`/shows/${bid.showId}`);
        return;
      }
    }
    if (bid.showId) {
      router.push(`/shows/${bid.showId}`);
    }
  };

  return (
    <div style={{minHeight:"100vh",background:"#080818",backgroundImage:"radial-gradient(ellipse 60% 30% at 50% 0%, rgba(168,85,247,0.05) 0%, transparent 60%)",fontFamily:"'Inter',-apple-system,sans-serif",maxWidth:480,margin:"0 auto",paddingBottom:90}}>

      <div style={{padding:"20px 20px 0"}}>
        <h1 style={{fontSize:"1.6rem",fontWeight:900,color:"#fff",letterSpacing:"-0.04em",marginBottom:4}}>Actividad</h1>
        <p style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.35)",marginBottom:20}}>Compras, pujas y guardados</p>

        {/* Tabs */}
        <div style={{display:"flex",gap:8,marginBottom:24}}>
          {([
            {id:"compras",label:"Compras",count:orders.length},
            {id:"pujas",label:"Pujas",count:bids.length},
            {id:"guardados",label:"Guardados",count:0},
          ] as {id:Tab,label:string,count:number}[]).map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?"linear-gradient(135deg,rgba(0,200,255,0.15),rgba(168,85,247,0.2))":"rgba(13,13,32,0.9)",border:`1px solid ${tab===t.id?"rgba(168,85,247,0.35)":"rgba(168,85,247,0.08)"}`,borderRadius:20,padding:"8px 16px",fontSize:"0.78rem",fontWeight:700,color:tab===t.id?"#fff":"rgba(255,255,255,0.4)",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
              {t.label}
              {t.count>0 && <span style={{background:tab===t.id?"rgba(168,85,247,0.3)":"rgba(255,255,255,0.1)",borderRadius:20,padding:"1px 7px",fontSize:"0.68rem",fontWeight:800}}>{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"0 20px"}}>

        {/* PUJAS */}
        {tab==="pujas" && (
          <div>
            {bids.length===0 ? (
              <div style={{textAlign:"center",padding:"60px 0"}}>
                <div style={{width:56,height:56,background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.12)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.4)" strokeWidth="1.5" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </div>
                <div style={{fontSize:"0.88rem",fontWeight:700,color:"rgba(255,255,255,0.25)",marginBottom:6}}>Sin pujas aún</div>
                <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.15)",marginBottom:20}}>Explora subastas activas</div>
                <button onClick={()=>router.push("/")} style={{background:"linear-gradient(135deg,rgba(0,200,255,0.15),rgba(168,85,247,0.2))",border:"1px solid rgba(168,85,247,0.25)",borderRadius:20,padding:"10px 24px",fontSize:"0.82rem",fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                  Ver subastas
                </button>
              </div>
            ) : bids.map((bid, i) => (
              <div
                key={bid.id}
                onClick={() => handleBidClick(bid)}
                style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.1)",borderRadius:16,padding:"16px",marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:14,transition:"border-color 0.15s"}}
              >
                {/* Icon */}
                <div style={{width:44,height:44,background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={statusColor(bid.status)} strokeWidth="2" strokeLinecap="round">
                    {bid.status==="won" ? <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/> : <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>}
                  </svg>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.92rem",fontWeight:800,color:"#fff",marginBottom:3}}>
                    ${bid.amountUsd?.toFixed(2)} USD
                  </div>
                  <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)"}}>
                    {bid.submittedAt?.toDate?.()?.toLocaleString("es-VE") ?? ""}
                  </div>
                  {bid.auctionId && (
                    <div style={{fontSize:"0.65rem",color:"rgba(168,85,247,0.5)",marginTop:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                      ID: {bid.auctionId}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                  <div style={{fontSize:"0.65rem",fontWeight:800,color:statusColor(bid.status),textTransform:"uppercase",letterSpacing:"0.06em",background:`rgba(${bid.status==="won"?"74,222,128":bid.status==="lost"?"255,255,255":"245,197,24"},0.06)`,padding:"4px 10px",borderRadius:20,border:`1px solid rgba(${bid.status==="won"?"74,222,128":bid.status==="lost"?"255,255,255":"245,197,24"},0.15)`}}>
                    {statusLabel(bid.status)}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* COMPRAS */}
        {tab==="compras" && (
          <div>
            {orders.length===0 ? (
              <div style={{textAlign:"center",padding:"60px 0"}}>
                <div style={{width:56,height:56,background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.12)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.4)" strokeWidth="1.5" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                </div>
                <div style={{fontSize:"0.88rem",fontWeight:700,color:"rgba(255,255,255,0.25)",marginBottom:6}}>Sin compras aún</div>
                <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.15)"}}>Gana una subasta para ver tus órdenes aquí</div>
              </div>
            ) : orders.map(order => (
              <div key={order.id} onClick={()=>router.push(`/orders/${order.id}`)} style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.1)",borderRadius:16,padding:"16px",marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:44,height:44,background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.92rem",fontWeight:800,color:"#fff",marginBottom:3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{order.productTitle ?? "Orden"}</div>
                  <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)"}}>${order.amountUsd?.toFixed(2)} · {order.createdAt?.toDate?.()?.toLocaleDateString("es-VE")??""}</div>
                </div>
                <div style={{fontSize:"0.65rem",fontWeight:800,color:statusColor(order.status),textTransform:"uppercase",letterSpacing:"0.06em",background:"rgba(168,85,247,0.06)",padding:"4px 10px",borderRadius:20}}>
                  {statusLabel(order.status)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GUARDADOS */}
        {tab==="guardados" && (
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <div style={{width:56,height:56,background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.12)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.4)" strokeWidth="1.5" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div style={{fontSize:"0.88rem",fontWeight:700,color:"rgba(255,255,255,0.25)",marginBottom:6}}>Sin guardados aún</div>
            <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.15)"}}>Guarda subastas y shows para seguirlos</div>
          </div>
        )}
      </div>
    </div>
  );
}
