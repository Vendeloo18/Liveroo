"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { doc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../../../../lib/firebase";
import { useAuthStore } from "../../../../store/authStore";
import { useAgora } from "../../../../hooks/useAgora";

export default function SellerShowPage() {
  const { showId } = useParams() as { showId: string };
  const router = useRouter();
  const { profile } = useAuthStore();
  const [show, setShow] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<string|null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [addingProduct, setAddingProduct] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newIncrement, setNewIncrement] = useState("1");
  const [newTimer, setNewTimer] = useState("30");
  const [addLoading, setAddLoading] = useState(false);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const fnc = getFunctions(undefined, "us-central1");
  const agora = useAgora(showId, "host");

  useEffect(() => {
    const u1 = onSnapshot(doc(db,"shows",showId), s => { if(s.exists()) setShow({id:s.id,...s.data()}); });
    const u2 = onSnapshot(query(collection(db,"shows",showId,"products"), orderBy("sortOrder","asc")), s => setProducts(s.docs.map(d => ({id:d.id,...d.data()}))));
    return () => { u1(); u2(); };
  }, [showId]);

  const handleStart = async () => {
    setLoading("start");
    try {
      await httpsCallable(fnc,"startShow")({ showId });
      await agora.join(localVideoRef.current);
    } catch(e:any) { alert(e.message); }
    finally { setLoading(null); }
  };

  const handleEnd = async () => {
    if(!confirm("¿Terminar el show?")) return;
    setLoading("end");
    try { await agora.leave(); await httpsCallable(fnc,"endShow")({ showId }); router.push("/seller"); }
    catch(e:any) { alert(e.message); }
    finally { setLoading(null); }
  };

  const handleSkip = async (productId: string) => {
    setLoading("skip_"+productId);
    try { await httpsCallable(fnc,"skipProduct")({ showId, productId }); }
    catch(e:any) { alert(e.message); }
    finally { setLoading(null); }
  };

  const handleAddProduct = async () => {
    if (!newTitle.trim() || !newPrice) return;
    setAddLoading(true);
    try {
      await addDoc(collection(db,"shows",showId,"products"), {
        showId, sellerId:profile?.uid ?? "EGCLeYcNURagvfm8oRfV7R3xib0K",
        title:newTitle.trim(),
        startingPriceUsd:parseFloat(newPrice),
        currentBidUsd:parseFloat(newPrice),
        minIncrementUsd:parseFloat(newIncrement),
        timerSeconds:parseInt(newTimer),
        auctionStatus:"waiting",
        sortOrder:products.length,
        imageURLs:[],
        createdAt:serverTimestamp(), updatedAt:serverTimestamp(),
      });
      setNewTitle(""); setNewPrice(""); setNewIncrement("1");
      setAddingProduct(false);
    } catch(e:any) { alert(e.message); }
    finally { setAddLoading(false); }
  };

  const statusColor = (s:string) => ({ waiting:"rgba(255,255,255,0.3)", active:"#F5C518", sold:"#4ade80", unsold:"#ff4444", skipped:"#555" }[s] ?? "#888");
  const statusLabel = (s:string) => ({ waiting:"Esperando", active:"En subasta", sold:"Vendido", unsold:"Sin ganador", skipped:"Saltado" }[s] ?? s);

  if(!show) return <div style={{minHeight:"100vh",background:"#080818",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"rgba(255,255,255,0.2)"}}>Cargando...</div></div>;

  const isLive = show.status === "live";
  const currentProduct = products.find(p => p.id === show.currentAuctionId);

  const inp: React.CSSProperties = { width:"100%", background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:12, padding:"12px 14px", color:"#fff", fontSize:"0.88rem", fontFamily:"inherit", outline:"none" };

  return (
    <div style={{minHeight:"100vh",background:"#080818",fontFamily:"Inter,sans-serif",maxWidth:480,margin:"0 auto",paddingBottom:40}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"20px 20px 0",marginBottom:16}}>
        <button onClick={() => router.push("/seller")} style={{width:38,height:38,background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.12)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{flex:1}}>
          <h1 style={{fontSize:"1rem",fontWeight:900,color:"#fff",letterSpacing:"-0.02em",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{show.title}</h1>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2}}>
            {isLive && <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,45,45,0.15)",border:"1px solid rgba(255,45,45,0.3)",borderRadius:20,padding:"3px 10px"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#ff2d2d",boxShadow:"0 0 6px #ff2d2d"}}/>
              <span style={{fontSize:"0.62rem",fontWeight:700,color:"#ff2d2d"}}>EN VIVO</span>
            </div>}
            <span style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.3)"}}>{show.viewerCount??0} viendo</span>
          </div>
        </div>
        {isLive && (
          <button onClick={()=>router.push(`/shows/${showId}`)} style={{background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:20,padding:"6px 14px",fontSize:"0.72rem",fontWeight:700,color:"#a855f7",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            Ver show
          </button>
        )}
      </div>

      <div style={{padding:"0 20px"}}>

        {/* Video preview */}
        {isLive && (
          <div style={{position:"relative",height:180,background:"#000",borderRadius:16,overflow:"hidden",marginBottom:16}}>
            <div ref={localVideoRef} style={{position:"absolute",inset:0}}/>
            {!agora.joined && (
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(13,13,32,0.95)"}}>
                <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.3)",marginBottom:12}}>
                  {agora.loading?"Conectando cámara...":agora.error?"Error de cámara":"Cámara desconectada"}
                </div>
                {!agora.loading && (
                  <button onClick={()=>agora.join(localVideoRef.current)} style={{background:"rgba(168,85,247,0.2)",border:"1px solid rgba(168,85,247,0.3)",borderRadius:10,padding:"8px 16px",fontSize:"0.78rem",fontWeight:700,color:"#a855f7",cursor:"pointer",fontFamily:"inherit"}}>
                    Reconectar cámara
                  </button>
                )}
              </div>
            )}
            {agora.joined && (
              <div style={{position:"absolute",bottom:10,left:10,display:"flex",gap:8}}>
                <button onClick={async()=>{await agora.toggleMic();setMicOn(!micOn);}} style={{width:32,height:32,background:micOn?"rgba(168,85,247,0.3)":"rgba(255,45,45,0.5)",border:"none",borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">{micOn?<><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></>:<><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></>}</svg>
                </button>
                <button onClick={async()=>{await agora.toggleCamera();setCamOn(!camOn);}} style={{width:32,height:32,background:camOn?"rgba(168,85,247,0.3)":"rgba(255,45,45,0.5)",border:"none",borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">{camOn?<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>:<><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34"/></>}</svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Start show */}
        {!isLive && (
          <div style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:20,padding:"24px",marginBottom:16,textAlign:"center"}}>
            <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.4)",marginBottom:6}}>{products.length===0?"Agrega productos antes de iniciar":`${products.length} productos listos`}</div>
            <div style={{fontSize:"1.1rem",fontWeight:800,color:"#fff",marginBottom:20}}>{products.length===0?"Sin productos aún":"Listo para iniciar"}</div>
            <button onClick={handleStart} disabled={loading==="start"} style={{width:"100%",background:"linear-gradient(135deg,#ff2d2d,#ff6b2b)",border:"none",borderRadius:14,padding:"16px",fontSize:"1rem",fontWeight:900,color:"#fff",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 0 30px rgba(255,45,45,0.3)",marginBottom:12}}>
              {loading==="start"?"Iniciando...":"Iniciar Show en Vivo"}
            </button>
          </div>
        )}

        {/* Current auction */}
        {isLive && currentProduct && (
          <div style={{background:"linear-gradient(135deg,rgba(255,45,45,0.08),rgba(255,107,43,0.08))",border:"1px solid rgba(255,45,45,0.2)",borderRadius:16,padding:"16px",marginBottom:12}}>
            <div style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.4)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Subastando ahora</div>
            <div style={{fontSize:"1rem",fontWeight:800,color:"#fff",marginBottom:8}}>{currentProduct.title}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:"1.6rem",fontWeight:900,color:"#fff",letterSpacing:"-0.03em"}}>${currentProduct.currentBidUsd?.toFixed(2)}</div>
                {currentProduct.currentBidderName && <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.4)"}}>Líder: {currentProduct.currentBidderName}</div>}
              </div>
              <button onClick={()=>handleSkip(currentProduct.id)} disabled={!!loading} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",fontSize:"0.75rem",fontWeight:700,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"inherit"}}>
                {loading?.startsWith("skip")?"...":"Saltar"}
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
          {[{label:"Total",val:products.length},{label:"Vendidos",val:products.filter(p=>p.auctionStatus==="sold").length},{label:"Viewers",val:show.viewerCount??0}].map(s => (
            <div key={s.label} style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.1)",borderRadius:14,padding:"12px",textAlign:"center"}}>
              <div style={{fontSize:"1.4rem",fontWeight:900,color:"#fff",marginBottom:2}}>{s.val}</div>
              <div style={{fontSize:"0.6rem",color:"rgba(255,255,255,0.35)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Products list + add button */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:"0.72rem",fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Cola de productos</div>
          <button onClick={()=>setAddingProduct(!addingProduct)} style={{background:addingProduct?"rgba(255,45,45,0.1)":"rgba(0,200,255,0.1)",border:`1px solid ${addingProduct?"rgba(255,45,45,0.2)":"rgba(0,200,255,0.2)"}`,borderRadius:20,padding:"5px 14px",fontSize:"0.72rem",fontWeight:700,color:addingProduct?"#ff6b6b":"#00c8ff",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
            {addingProduct ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>Cancelar</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Agregar producto</>
            )}
          </button>
        </div>

        {/* Add product form inline */}
        {addingProduct && (
          <div style={{background:"rgba(13,13,32,0.95)",border:"1px solid rgba(0,200,255,0.2)",borderRadius:16,padding:"16px",marginBottom:12}}>
            <div style={{fontSize:"0.72rem",fontWeight:700,color:"#00c8ff",marginBottom:12,letterSpacing:"0.06em"}}>NUEVO PRODUCTO</div>
            <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Nombre del producto" style={{...inp,marginBottom:10,width:"100%",boxSizing:"border-box"}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.4)",fontWeight:700,fontSize:"0.9rem"}}>$</span>
                <input type="number" value={newPrice} onChange={e=>setNewPrice(e.target.value)} placeholder="Precio" style={{...inp,paddingLeft:26,boxSizing:"border-box"}}/>
              </div>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.4)",fontWeight:700,fontSize:"0.9rem"}}>$</span>
                <input type="number" value={newIncrement} onChange={e=>setNewIncrement(e.target.value)} placeholder="Incremento" style={{...inp,paddingLeft:26,boxSizing:"border-box"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12}}>
              {[{v:"30",l:"30s"},{v:"60",l:"1m"},{v:"90",l:"90s"},{v:"120",l:"2m"}].map(t => (
                <button key={t.v} onClick={()=>setNewTimer(t.v)} style={{flex:1,background:newTimer===t.v?"rgba(0,200,255,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${newTimer===t.v?"rgba(0,200,255,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:8,padding:"8px 0",fontSize:"0.72rem",fontWeight:700,color:newTimer===t.v?"#00c8ff":"rgba(255,255,255,0.4)",cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>
              ))}
            </div>
            <button onClick={handleAddProduct} disabled={addLoading||!newTitle.trim()||!newPrice} style={{width:"100%",background:(!newTitle.trim()||!newPrice)?"rgba(0,200,255,0.1)":"linear-gradient(135deg,#00c8ff,#a855f7)",border:"none",borderRadius:12,padding:"12px",fontSize:"0.85rem",fontWeight:800,color:"#fff",cursor:(!newTitle.trim()||!newPrice)?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {addLoading?"Agregando...":"Agregar a la cola"}
            </button>
          </div>
        )}

        {/* Products list */}
        {products.length===0 ? (
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.2)"}}>Sin productos — agrega el primero</div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {products.map((p,i) => (
              <div key={p.id} style={{background:p.id===show.currentAuctionId?"rgba(245,197,24,0.06)":"rgba(13,13,32,0.9)",border:`1px solid ${p.id===show.currentAuctionId?"rgba(245,197,24,0.2)":"rgba(168,85,247,0.08)"}`,borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:26,height:26,background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.12)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:"0.7rem",fontWeight:800,color:"rgba(255,255,255,0.4)"}}>{i+1}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.85rem",fontWeight:700,color:"#fff",marginBottom:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.title}</div>
                  <div style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.35)"}}>
                    ${p.startingPriceUsd?.toFixed(2)} · {p.timerSeconds}s
                    {p.auctionStatus==="active"&&p.currentBidUsd>p.startingPriceUsd&&` · Puja actual: $${p.currentBidUsd?.toFixed(2)}`}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {p.auctionStatus==="active"&&<div style={{width:6,height:6,borderRadius:"50%",background:"#F5C518",boxShadow:"0 0 6px #F5C518"}}/>}
                  <span style={{fontSize:"0.62rem",fontWeight:700,color:statusColor(p.auctionStatus),textTransform:"uppercase",letterSpacing:"0.05em"}}>{statusLabel(p.auctionStatus)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* End show */}
        {isLive && (
          <button onClick={handleEnd} disabled={!!loading} style={{width:"100%",background:"rgba(255,45,45,0.08)",border:"1px solid rgba(255,45,45,0.2)",borderRadius:14,padding:"14px",fontSize:"0.88rem",fontWeight:700,color:"#ff6b6b",cursor:"pointer",fontFamily:"inherit",marginTop:16}}>
            {loading==="end"?"Terminando...":"Terminar Show"}
          </button>
        )}
      </div>
    </div>
  );
}
