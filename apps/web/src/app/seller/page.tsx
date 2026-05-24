"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { ImageUploader } from "../../components/ui/ImageUploader";

type Screen = "hub" | "create-show" | "create-auction" | "add-product" | "my-shows" | "my-auctions";

export default function SellerPage() {
  const { profile } = useAuthStore();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("hub");
  const [shows, setShows] = useState<any[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdId, setCreatedId] = useState("");

  const [showTitle, setShowTitle] = useState("");
  const [showDesc, setShowDesc] = useState("");
  const [showCategory, setShowCategory] = useState("Moda y Ropa");

  const [auctionTitle, setAuctionTitle] = useState("");
  const [auctionDesc, setAuctionDesc] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [minIncrement, setMinIncrement] = useState("1");
  const [duration, setDuration] = useState("24");
  const [auctionCategory, setAuctionCategory] = useState("Moda y Ropa");
  const [auctionImages, setAuctionImages] = useState<string[]>([]);
  const [productImages, setProductImages] = useState<string[]>([]);

  const [selectedShowId, setSelectedShowId] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productIncrement, setProductIncrement] = useState("1");
  const [timerSeconds, setTimerSeconds] = useState("30");

  const CATEGORIES = ["Moda y Ropa","Electronica","Calzado","Joyas y Relojes","Hogar","Colecciones","Autos y Motos","Deportes","Arte","Juguetes","Comida","Mascotas"];

  useEffect(() => {
    if (!profile) return;
    const u1 = onSnapshot(query(collection(db,"shows"), where("sellerId","==",profile.uid), orderBy("createdAt","desc")), s => setShows(s.docs.map(d => ({id:d.id,...d.data()}))));
    const u2 = onSnapshot(query(collection(db,"auctions"), where("sellerId","==",profile.uid), orderBy("createdAt","desc")), s => setAuctions(s.docs.map(d => ({id:d.id,...d.data()}))));
    return () => { u1(); u2(); };
  }, [profile]);

  const handleCreateShow = async () => {
    if (!showTitle.trim()) return;
    setLoading(true);
    try {
      const ref = await addDoc(collection(db,"shows"), {
        sellerId: profile?.uid ?? "unknown",
        sellerName: profile?.displayName ?? "Vendedor",
        title: showTitle.trim(),
        description: showDesc.trim(),
        category: showCategory,
        status: "scheduled",
        agoraChannelName: `show_${Date.now()}`,
        viewerCount: 0, totalProducts: 0,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setCreatedId(ref.id);
      setSuccess(true);
      setShowTitle(""); setShowDesc("");
    } catch(e: any) { alert("Error: " + e.message); }
    finally { setLoading(false); }
  };

  const handleCreateAuction = async () => {
    if (!auctionTitle.trim() || !startPrice) return;
    setLoading(true);
    try {
      const endsAt = new Date(Date.now() + parseInt(duration) * 3600000);
      const ref = await addDoc(collection(db,"auctions"), {
        sellerId: profile?.uid ?? "unknown",
        sellerName: profile?.displayName ?? "Vendedor",
        title: auctionTitle.trim(),
        description: auctionDesc.trim(),
        category: auctionCategory,
        startingPriceUsd: parseFloat(startPrice),
        currentBidUsd: parseFloat(startPrice),
        minIncrementUsd: parseFloat(minIncrement),
        status: "active", endsAt, bidsCount: 0, isLive: false,
        imageURL: auctionImages[0] ?? "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setCreatedId(ref.id);
      setSuccess(true);
      setAuctionTitle(""); setAuctionDesc(""); setStartPrice("");
    } catch(e: any) { alert("Error: " + e.message); }
    finally { setLoading(false); }
  };

  const handleAddProduct = async () => {
    if (!selectedShowId || !productTitle.trim() || !productPrice) return;
    setLoading(true);
    try {
      await addDoc(collection(db,"shows",selectedShowId,"products"), {
        showId: selectedShowId, sellerId: profile?.uid ?? "unknown",
        title: productTitle.trim(), description: productDesc.trim(),
        startingPriceUsd: parseFloat(productPrice),
        currentBidUsd: parseFloat(productPrice),
        minIncrementUsd: parseFloat(productIncrement),
        timerSeconds: parseInt(timerSeconds),
        auctionStatus: "waiting", sortOrder: 0, imageURLs: productImages,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setSuccess(true);
      setProductTitle(""); setProductDesc(""); setProductPrice("");
      setTimeout(() => setSuccess(false), 2000);
    } catch(e: any) { alert("Error: " + e.message); }
    finally { setLoading(false); }
  };

  const inp: React.CSSProperties = { width:"100%", background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:14, padding:"14px 16px", color:"#fff", fontSize:"0.9rem", fontFamily:"inherit", outline:"none", marginBottom:16 };
  const lbl: React.CSSProperties = { fontSize:"0.62rem", fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:8, display:"block" };
  const statusColor = (s:string) => ({ scheduled:"#F5C518", live:"#ff2d2d", ended:"#4ade80", active:"#4ade80" }[s] ?? "#888");
  const statusLabel = (s:string) => ({ scheduled:"Programado", live:"En vivo", ended:"Finalizado", active:"Activa" }[s] ?? s);

  const CategoryPicker = ({ value, onChange }: { value:string; onChange:(c:string)=>void }) => (
    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
      {CATEGORIES.map(c => (
        <button key={c} onClick={()=>onChange(c)} style={{background:value===c?"rgba(168,85,247,0.2)":"rgba(13,13,32,0.9)",border:`1px solid ${value===c?"rgba(168,85,247,0.4)":"rgba(168,85,247,0.1)"}`,borderRadius:20,padding:"7px 14px",fontSize:"0.75rem",fontWeight:value===c?700:500,color:value===c?"#a855f7":"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"inherit"}}>
          {c}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#080818",backgroundImage:"radial-gradient(ellipse 60% 30% at 50% 0%, rgba(168,85,247,0.06) 0%, transparent 60%)",fontFamily:"'Inter',-apple-system,sans-serif",maxWidth:480,margin:"0 auto",paddingBottom:90}}>

      <div style={{display:"flex",alignItems:"center",gap:12,padding:"20px 20px 0",marginBottom:24}}>
        <button onClick={() => { if(screen==="hub") router.push("/"); else { setScreen("hub"); setSuccess(false); setCreatedId(""); } }} style={{width:38,height:38,background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.12)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 style={{fontSize:"1.4rem",fontWeight:900,color:"#fff",letterSpacing:"-0.03em",lineHeight:1}}>
            {{hub:"Seller Hub","create-show":"Crear Show","create-auction":"Crear Subasta","add-product":"Agregar Producto","my-shows":"Mis Shows","my-auctions":"Mis Subastas"}[screen]}
          </h1>
          <div style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.3)",marginTop:2}}>{profile?.displayName}</div>
        </div>
      </div>

      {/* HUB */}
      {screen==="hub" && (
        <div style={{padding:"0 20px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
            {[{label:"Shows",val:shows.length},{label:"Subastas activas",val:auctions.filter(a=>a.status==="active").length}].map(s => (
              <div key={s.label} style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.1)",borderRadius:14,padding:"16px",textAlign:"center"}}>
                <div style={{fontSize:"1.8rem",fontWeight:900,color:"#fff",marginBottom:4}}>{s.val}</div>
                <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.35)",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {label:"Crear show en vivo",sub:"Transmite y subasta en tiempo real",sc:"create-show" as Screen,color:"#00c8ff"},
              {label:"Crear subasta sin live",sub:"Hasta 24h, sin necesidad de transmitir",sc:"create-auction" as Screen,color:"#a855f7"},
              {label:"Agregar producto a show",sub:"Agrega items a un show existente",sc:"add-product" as Screen,color:"#e040fb"},
              {label:"Mis shows",sub:"Ver y gestionar tus shows",sc:"my-shows" as Screen,color:"#F5C518"},
              {label:"Mis subastas",sub:"Ver tus subastas activas",sc:"my-auctions" as Screen,color:"#4ade80"},
            ].map(item => (
              <button key={item.label} onClick={()=>{setSuccess(false);setCreatedId("");setScreen(item.sc);}} style={{width:"100%",background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.1)",borderRadius:16,padding:"16px 20px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:item.color,boxShadow:`0 0 10px ${item.color}`,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:"0.92rem",fontWeight:700,color:"#fff",marginBottom:2}}>{item.label}</div>
                  <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)"}}>{item.sub}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CREATE SHOW */}
      {screen==="create-show" && (
        <div style={{padding:"0 20px"}}>
          {success ? (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{width:64,height:64,background:"rgba(0,200,100,0.1)",border:"1px solid rgba(0,200,100,0.2)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div style={{fontSize:"1.2rem",fontWeight:800,color:"#fff",marginBottom:6}}>Show creado</div>
              <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.4)",marginBottom:28}}>¿Qué quieres hacer ahora?</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <button onClick={()=>router.push(`/seller/show/${createdId}`)} style={{width:"100%",background:"linear-gradient(135deg,#ff2d2d,#ff6b2b)",border:"none",borderRadius:14,padding:"15px",fontSize:"0.92rem",fontWeight:800,color:"#fff",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 0 24px rgba(255,45,45,0.25)"}}>
                  Iniciar Show en Vivo ahora
                </button>
                <button onClick={()=>{setSelectedShowId(createdId);setSuccess(false);setScreen("add-product");}} style={{width:"100%",background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:14,padding:"14px",fontSize:"0.88rem",fontWeight:700,color:"#a855f7",cursor:"pointer",fontFamily:"inherit"}}>
                  Agregar productos primero
                </button>
                <button onClick={()=>{setSuccess(false);setScreen("my-shows");}} style={{width:"100%",background:"none",border:"none",color:"rgba(255,255,255,0.25)",fontSize:"0.82rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  Ver mis shows
                </button>
              </div>
            </div>
          ) : (
            <>
              <label style={lbl}>Título del show</label>
              <input style={inp} value={showTitle} onChange={e=>setShowTitle(e.target.value)} placeholder="Ej: Sneakers Nike y Adidas desde $1"/>
              <label style={lbl}>Descripción <span style={{opacity:0.4}}>(opcional)</span></label>
              <textarea style={{...inp,height:80,resize:"none"}} value={showDesc} onChange={e=>setShowDesc(e.target.value)} placeholder="Cuéntale a tus compradores qué van a encontrar..."/>
              <label style={lbl}>Categoría</label>
              <CategoryPicker value={showCategory} onChange={setShowCategory}/>
              <button onClick={handleCreateShow} disabled={loading||!showTitle.trim()} style={{width:"100%",background:!showTitle.trim()?"rgba(168,85,247,0.2)":"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)",border:"none",borderRadius:14,padding:"15px",fontSize:"0.92rem",fontWeight:800,color:"#fff",cursor:!showTitle.trim()?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:!showTitle.trim()?"none":"0 0 30px rgba(168,85,247,0.3)"}}>
                {loading?"Creando...":"Crear Show"}
              </button>
            </>
          )}
        </div>
      )}

      {/* CREATE AUCTION */}
      {screen==="create-auction" && (
        <div style={{padding:"0 20px"}}>
          {success ? (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{width:64,height:64,background:"rgba(0,200,100,0.1)",border:"1px solid rgba(0,200,100,0.2)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div style={{fontSize:"1.2rem",fontWeight:800,color:"#fff",marginBottom:6}}>Subasta publicada</div>
              <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.4)",marginBottom:28}}>Ya está activa y visible en el home</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <button onClick={()=>router.push(`/auctions/${createdId}`)} style={{width:"100%",background:"linear-gradient(135deg,#a855f7,#e040fb)",border:"none",borderRadius:14,padding:"15px",fontSize:"0.92rem",fontWeight:800,color:"#fff",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 0 24px rgba(168,85,247,0.3)"}}>
                  Ver mi subasta
                </button>
                <button onClick={()=>{setSuccess(false);setScreen("create-auction");}} style={{width:"100%",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:14,padding:"14px",fontSize:"0.88rem",fontWeight:700,color:"#a855f7",cursor:"pointer",fontFamily:"inherit"}}>
                  Crear otra subasta
                </button>
                <button onClick={()=>{setSuccess(false);setScreen("hub");}} style={{width:"100%",background:"none",border:"none",color:"rgba(255,255,255,0.25)",fontSize:"0.82rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  Ir al hub
                </button>
              </div>
            </div>
          ) : (
            <>
              <label style={lbl}>Título del producto</label>
              <input style={inp} value={auctionTitle} onChange={e=>setAuctionTitle(e.target.value)} placeholder="Ej: Nike Air Jordan 1 Retro"/>
              <label style={lbl}>Descripción <span style={{opacity:0.4}}>(opcional)</span></label>
              <textarea style={{...inp,height:80,resize:"none"}} value={auctionDesc} onChange={e=>setAuctionDesc(e.target.value)} placeholder="Talla, condición, estado..."/>
              <label style={lbl}>Fotos del producto</label>
              <ImageUploader images={auctionImages} onChange={setAuctionImages} path={`auctions/${profile?.uid ?? "unknown"}`} max={5}/>
              <label style={lbl}>Categoría</label>
              <CategoryPicker value={auctionCategory} onChange={setAuctionCategory}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                <div>
                  <label style={lbl}>Precio inicial (USD)</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.4)",fontWeight:700}}>$</span>
                    <input style={{...inp,marginBottom:0,paddingLeft:26}} type="number" value={startPrice} onChange={e=>setStartPrice(e.target.value)} placeholder="0.00" min="0" step="0.01"/>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Incremento mínimo</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.4)",fontWeight:700}}>$</span>
                    <input style={{...inp,marginBottom:0,paddingLeft:26}} type="number" value={minIncrement} onChange={e=>setMinIncrement(e.target.value)} placeholder="1.00" min="0.01" step="0.01"/>
                  </div>
                </div>
              </div>
              <label style={lbl}>Duración</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:20}}>
                {[{val:"1",label:"1h"},{val:"6",label:"6h"},{val:"12",label:"12h"},{val:"24",label:"24h"}].map(d => (
                  <button key={d.val} onClick={()=>setDuration(d.val)} style={{background:duration===d.val?"rgba(168,85,247,0.2)":"rgba(13,13,32,0.9)",border:`1px solid ${duration===d.val?"rgba(168,85,247,0.4)":"rgba(168,85,247,0.1)"}`,borderRadius:12,padding:"12px 0",fontSize:"0.82rem",fontWeight:700,color:duration===d.val?"#a855f7":"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>{d.label}</button>
                ))}
              </div>
              <button onClick={handleCreateAuction} disabled={loading||!auctionTitle.trim()||!startPrice} style={{width:"100%",background:(!auctionTitle.trim()||!startPrice)?"rgba(168,85,247,0.2)":"linear-gradient(135deg,#a855f7,#e040fb)",border:"none",borderRadius:14,padding:"15px",fontSize:"0.92rem",fontWeight:800,color:"#fff",cursor:(!auctionTitle.trim()||!startPrice)?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:(!auctionTitle.trim()||!startPrice)?"none":"0 0 30px rgba(168,85,247,0.25)"}}>
                {loading?"Publicando...":"Publicar Subasta"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ADD PRODUCT */}
      {screen==="add-product" && (
        <div style={{padding:"0 20px"}}>
          {success ? (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{width:64,height:64,background:"rgba(0,200,100,0.1)",border:"1px solid rgba(0,200,100,0.2)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div style={{fontSize:"1.2rem",fontWeight:800,color:"#fff",marginBottom:8}}>Producto agregado</div>
              <button onClick={()=>setSuccess(false)} style={{background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:20,padding:"8px 20px",fontSize:"0.82rem",fontWeight:700,color:"#a855f7",cursor:"pointer",fontFamily:"inherit"}}>Agregar otro</button>
            </div>
          ) : (
            <>
              <label style={lbl}>Seleccionar show</label>
              <div style={{position:"relative",marginBottom:16}}>
                <select style={{...inp,marginBottom:0,appearance:"none" as const,paddingRight:40}} value={selectedShowId} onChange={e=>setSelectedShowId(e.target.value)}>
                  <option value="">Elige un show...</option>
                  {shows.filter(s=>s.status!=="ended").map(s => <option key={s.id} value={s.id}>{s.title} — {s.status}</option>)}
                </select>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.6)" strokeWidth="2" strokeLinecap="round" style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><path d="M6 9l6 6 6-6"/></svg>
              </div>
              <label style={lbl}>Fotos del producto</label>
              <ImageUploader images={productImages} onChange={setProductImages} path={`products/${profile?.uid ?? "unknown"}`} max={5}/>
              <label style={lbl}>Nombre del producto</label>
              <input style={inp} value={productTitle} onChange={e=>setProductTitle(e.target.value)} placeholder="Ej: Nike Air Jordan 1 Retro"/>
              <label style={lbl}>Descripción <span style={{opacity:0.4}}>(opcional)</span></label>
              <input style={inp} value={productDesc} onChange={e=>setProductDesc(e.target.value)} placeholder="Talla, condición, detalles..."/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                <div>
                  <label style={lbl}>Precio base (USD)</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.4)",fontWeight:700}}>$</span>
                    <input style={{...inp,marginBottom:0,paddingLeft:26}} type="number" value={productPrice} onChange={e=>setProductPrice(e.target.value)} placeholder="0.00" min="0" step="0.01"/>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Incremento mínimo</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.4)",fontWeight:700}}>$</span>
                    <input style={{...inp,marginBottom:0,paddingLeft:26}} type="number" value={productIncrement} onChange={e=>setProductIncrement(e.target.value)} placeholder="1.00" min="0.01" step="0.01"/>
                  </div>
                </div>
              </div>
              <label style={lbl}>Temporizador por producto</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:20}}>
                {[{val:"30",label:"30s"},{val:"60",label:"1m"},{val:"90",label:"90s"},{val:"120",label:"2m"}].map(v => (
                  <button key={v.val} onClick={()=>setTimerSeconds(v.val)} style={{background:timerSeconds===v.val?"rgba(168,85,247,0.2)":"rgba(13,13,32,0.9)",border:`1px solid ${timerSeconds===v.val?"rgba(168,85,247,0.4)":"rgba(168,85,247,0.1)"}`,borderRadius:12,padding:"12px 0",fontSize:"0.82rem",fontWeight:700,color:timerSeconds===v.val?"#a855f7":"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>{v.label}</button>
                ))}
              </div>
              <button onClick={handleAddProduct} disabled={loading||!selectedShowId||!productTitle.trim()||!productPrice} style={{width:"100%",background:(!selectedShowId||!productTitle.trim()||!productPrice)?"rgba(168,85,247,0.2)":"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)",border:"none",borderRadius:14,padding:"15px",fontSize:"0.92rem",fontWeight:800,color:"#fff",cursor:(!selectedShowId||!productTitle.trim()||!productPrice)?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:(!selectedShowId||!productTitle.trim()||!productPrice)?"none":"0 0 30px rgba(168,85,247,0.3)"}}>
                {loading?"Agregando...":"Agregar Producto"}
              </button>
            </>
          )}
        </div>
      )}

      {/* MY SHOWS */}
      {screen==="my-shows" && (
        <div style={{padding:"0 20px"}}>
          {shows.length===0 ? (
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{fontSize:"0.88rem",color:"rgba(255,255,255,0.2)",marginBottom:16}}>No tienes shows aún</div>
              <button onClick={()=>setScreen("create-show")} style={{background:"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)",border:"none",borderRadius:14,padding:"12px 24px",fontSize:"0.88rem",fontWeight:800,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>Crear primer show</button>
            </div>
          ) : shows.map(show => (
            <div key={show.id} style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.1)",borderRadius:16,padding:"16px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:"0.92rem",fontWeight:800,color:"#fff",marginBottom:4}}>{show.title}</div>
                  <div style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.35)"}}>{show.totalProducts??0} productos · {show.viewerCount??0} viewers</div>
                </div>
                <div style={{fontSize:"0.65rem",fontWeight:700,color:statusColor(show.status),textTransform:"uppercase",letterSpacing:"0.06em",background:"rgba(168,85,247,0.08)",padding:"4px 10px",borderRadius:20}}>{statusLabel(show.status)}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>router.push(`/seller/show/${show.id}`)} style={{flex:1,background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:10,padding:"9px",fontSize:"0.75rem",fontWeight:700,color:"#a855f7",cursor:"pointer",fontFamily:"inherit"}}>Panel control</button>
                <button onClick={()=>{setSelectedShowId(show.id);setScreen("add-product");}} style={{flex:1,background:"rgba(0,200,255,0.08)",border:"1px solid rgba(0,200,255,0.15)",borderRadius:10,padding:"9px",fontSize:"0.75rem",fontWeight:700,color:"#00c8ff",cursor:"pointer",fontFamily:"inherit"}}>+ Producto</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MY AUCTIONS */}
      {screen==="my-auctions" && (
        <div style={{padding:"0 20px"}}>
          {auctions.length===0 ? (
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{fontSize:"0.88rem",color:"rgba(255,255,255,0.2)",marginBottom:16}}>No tienes subastas aún</div>
              <button onClick={()=>setScreen("create-auction")} style={{background:"linear-gradient(135deg,#a855f7,#e040fb)",border:"none",borderRadius:14,padding:"12px 24px",fontSize:"0.88rem",fontWeight:800,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>Crear primera subasta</button>
            </div>
          ) : auctions.map(auction => (
            <div key={auction.id} onClick={()=>router.push(`/auctions/${auction.id}`)} style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.1)",borderRadius:16,padding:"16px",marginBottom:10,cursor:"pointer",display:"flex",gap:12,alignItems:"center"}}>
              <div style={{width:56,height:56,borderRadius:12,overflow:"hidden",flexShrink:0}}>
                {auction.imageURL?<img src={auction.imageURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",background:"rgba(168,85,247,0.1)"}}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.88rem",fontWeight:700,color:"#fff",marginBottom:3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{auction.title}</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:"0.78rem",color:"#fff",fontWeight:800}}>${auction.currentBidUsd?.toFixed(2)}</span>
                  <span style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.35)"}}>{auction.bidsCount??0} pujas</span>
                </div>
              </div>
              <div style={{fontSize:"0.65rem",fontWeight:700,color:statusColor(auction.status),textTransform:"uppercase",letterSpacing:"0.05em"}}>{statusLabel(auction.status)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
