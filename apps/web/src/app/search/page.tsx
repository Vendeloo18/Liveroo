"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Tab = "shows" | "sellers";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [tab, setTab] = useState<Tab>("shows");
  const [shows, setShows] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) { setSearch(q); doSearch(q); }
  }, []);

  const doSearch = async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const showsSnap = await getDocs(query(collection(db,"shows"), where("status","in",["live","scheduled","ended"]), orderBy("viewerCount","desc"), limit(20)));
      const allShows = showsSnap.docs.map(d => ({id:d.id,...d.data()})) as any[];
      setShows(allShows.filter((s:any) => s.title?.toLowerCase().includes(term.toLowerCase()) || s.sellerName?.toLowerCase().includes(term.toLowerCase())));

      const sellersSnap = await getDocs(query(collection(db,"users"), where("role","==","seller"), limit(50)));
      const allSellers = sellersSnap.docs.map(d => ({id:d.id,...d.data()})) as any[];
      setSellers(allSellers.filter((s:any) => s.displayName?.toLowerCase().includes(term.toLowerCase())));
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSearch = () => doSearch(search);

  const statusColor = (s:string) => ({ live:"#ff2d2d", scheduled:"#F5C518", ended:"rgba(255,255,255,0.2)" }[s] ?? "#888");
  const statusLabel = (s:string) => ({ live:"En vivo", scheduled:"Programado", ended:"Finalizado" }[s] ?? s);

  return (
    <div style={{ minHeight:"100vh", background:"#080818", backgroundImage:"radial-gradient(ellipse 60% 30% at 50% 0%, rgba(168,85,247,0.05) 0%, transparent 60%)", fontFamily:"'Inter',-apple-system,sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:90 }}>

      <div style={{ padding:"20px 20px 0", marginBottom:20 }}>
        <h1 style={{ fontSize:"1.4rem", fontWeight:900, color:"#fff", letterSpacing:"-0.03em", marginBottom:16 }}>Buscar</h1>
        <div style={{ display:"flex", gap:10 }}>
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:10, background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:14, padding:"12px 16px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSearch()} placeholder="Shows, vendedores..." style={{ flex:1, background:"none", border:"none", outline:"none", color:"#fff", fontSize:"0.9rem", fontFamily:"inherit" }}/>
            {search && <button onClick={() => { setSearch(""); setSearched(false); setShows([]); setSellers([]); }} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.3)", fontSize:"1.2rem", lineHeight:1, padding:0 }}>×</button>}
          </div>
          <button onClick={handleSearch} disabled={!search.trim()||loading} style={{ background:!search.trim()?"rgba(168,85,247,0.2)":"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)", border:"none", borderRadius:14, padding:"0 18px", fontSize:"0.82rem", fontWeight:800, color:"#fff", cursor:!search.trim()?"not-allowed":"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
            {loading?"...":"Buscar"}
          </button>
        </div>
      </div>

      {searched && (
        <div style={{ display:"flex", gap:8, padding:"0 20px", marginBottom:20 }}>
          {([{id:"shows",label:`Shows (${shows.length})`},{id:"sellers",label:`Vendedores (${sellers.length})`}] as {id:Tab,label:string}[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background:tab===t.id?"linear-gradient(135deg,rgba(0,200,255,0.15),rgba(168,85,247,0.2))":"rgba(13,13,32,0.9)", border:`1px solid ${tab===t.id?"rgba(168,85,247,0.35)":"rgba(168,85,247,0.08)"}`, borderRadius:20, padding:"8px 18px", fontSize:"0.78rem", fontWeight:700, color:tab===t.id?"#fff":"rgba(255,255,255,0.4)", cursor:"pointer", fontFamily:"inherit" }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding:"0 20px" }}>
        {!searched && (
          <div>
            <div style={{ fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14 }}>Búsquedas populares</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:28 }}>
              {["Nike","iPhone","Oro 18k","PlayStation","Adidas","Samsung","Joyas","Ropa"].map(tag => (
                <button key={tag} onClick={() => { setSearch(tag); doSearch(tag); }} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:20, padding:"8px 16px", fontSize:"0.8rem", fontWeight:600, color:"rgba(255,255,255,0.6)", cursor:"pointer", fontFamily:"inherit" }}>{tag}</button>
              ))}
            </div>
            <div style={{ fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14 }}>Categorías populares</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[{name:"Moda y Ropa",viewers:2610},{name:"Electronica",viewers:1840},{name:"Calzado",viewers:1520},{name:"Joyas y Relojes",viewers:980}].map(cat => (
                <div key={cat.name} onClick={() => router.push("/categories")} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:14, padding:"14px 16px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:"0.82rem", fontWeight:700, color:"#fff" }}>{cat.name}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:5, height:5, borderRadius:"50%", background:"#ff2d2d" }}/>
                    <span style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.4)" }}>{(cat.viewers/1000).toFixed(1)}K</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {searched && !loading && tab==="shows" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {shows.length===0 ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <div style={{ fontSize:"0.88rem", color:"rgba(255,255,255,0.2)", marginBottom:8 }}>Sin resultados para "{search}"</div>
              </div>
            ) : shows.map(show => (
              <div key={show.id} onClick={() => router.push(`/shows/${show.id}`)} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:16, overflow:"hidden", display:"flex", alignItems:"center", cursor:"pointer" }}>
                <div style={{ width:70, height:70, flexShrink:0, overflow:"hidden" }}>
                  {show.coverImageURL ? <img src={show.coverImageURL} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <div style={{ width:"100%", height:"100%", background:"rgba(168,85,247,0.08)" }}/>}
                </div>
                <div style={{ flex:1, padding:"12px 14px", minWidth:0 }}>
                  <div style={{ fontSize:"0.88rem", fontWeight:800, color:"#fff", marginBottom:4, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{show.title}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.4)" }}>{show.sellerName}</span>
                    <span style={{ fontSize:"0.68rem", fontWeight:700, color:statusColor(show.status) }}>{statusLabel(show.status)}</span>
                  </div>
                </div>
                {show.status==="live" && (
                  <div style={{ padding:"0 14px", flexShrink:0 }}>
                    <div style={{ background:"rgba(255,45,45,0.15)", border:"1px solid rgba(255,45,45,0.25)", borderRadius:20, padding:"4px 10px" }}>
                      <span style={{ fontSize:"0.62rem", fontWeight:700, color:"#ff2d2d" }}>{show.viewerCount} viendo</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {searched && !loading && tab==="sellers" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {sellers.length===0 ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <div style={{ fontSize:"0.88rem", color:"rgba(255,255,255,0.2)" }}>Sin vendedores para "{search}"</div>
              </div>
            ) : sellers.map(seller => (
              <div key={seller.id} onClick={() => router.push(`/seller/${seller.id}`)} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:16, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}>
                <div style={{ width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg,#00c8ff,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"1.1rem", fontWeight:900, color:"#fff" }}>
                  {seller.displayName?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"0.92rem", fontWeight:800, color:"#fff", marginBottom:2 }}>{seller.displayName}</div>
                  <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.4)" }}>{seller.totalSales??0} ventas · {seller.ratingAvg?.toFixed(1)??"0.0"}★</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            ))}
          </div>
        )}

        {loading && <div style={{ textAlign:"center", padding:"40px 0", fontSize:"0.88rem", color:"rgba(255,255,255,0.2)" }}>Buscando...</div>}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent/>
    </Suspense>
  );
}
