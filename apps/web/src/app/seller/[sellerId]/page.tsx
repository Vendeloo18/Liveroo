"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, collection, query, where, orderBy, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function SellerProfilePage() {
  const { sellerId } = useParams() as { sellerId: string };
  const router = useRouter();
  const [seller, setSeller] = useState<any>(null);
  const [shows, setShows] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "users", sellerId)).then(s => {
      if (s.exists()) setSeller({ id: s.id, ...s.data() });
    });
    const u1 = onSnapshot(
      query(collection(db,"shows"), where("sellerId","==",sellerId), orderBy("createdAt","desc")),
      s => setShows(s.docs.map(d => ({ id:d.id, ...d.data() })))
    );
    const u2 = onSnapshot(
      query(collection(db,"ratings"), where("toUid","==",sellerId), orderBy("createdAt","desc")),
      s => setRatings(s.docs.map(d => ({ id:d.id, ...d.data() })))
    );
    return () => { u1(); u2(); };
  }, [sellerId]);

  const statusColor = (s: string) => ({ live:"#ff2d2d", scheduled:"#F5C518", ended:"#4ade80" }[s] ?? "#555");
  const statusLabel = (s: string) => ({ live:"En vivo", scheduled:"Programado", ended:"Finalizado" }[s] ?? s);

  const renderStars = (score: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < score ? "#F5C518" : "rgba(255,255,255,0.1)", fontSize:"0.9rem" }}>★</span>
    ));
  };

  if (!seller) return (
    <div style={{ minHeight:"100vh", background:"#080818", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontSize:"0.88rem", color:"rgba(255,255,255,0.2)" }}>Cargando...</div>
    </div>
  );

  const liveShows = shows.filter(s => s.status === "live");
  const upcomingShows = shows.filter(s => s.status === "scheduled");
  const pastShows = shows.filter(s => s.status === "ended");

  return (
    <div style={{ minHeight:"100vh", background:"#080818", backgroundImage:"radial-gradient(ellipse 80% 40% at 50% 0%, rgba(168,85,247,0.07) 0%, transparent 60%)", fontFamily:"'Inter',-apple-system,sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:40 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 20px 0", marginBottom:24 }}>
        <button onClick={() => router.back()} style={{ width:38, height:38, background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ fontSize:"1.1rem", fontWeight:900, color:"#fff", letterSpacing:"-0.02em" }}>Perfil del Vendedor</h1>
      </div>

      <div style={{ padding:"0 20px" }}>

        {/* Profile card */}
        <div style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:24, padding:"24px", marginBottom:16, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", width:200, height:200, borderRadius:"50%", background:"rgba(168,85,247,0.05)", top:-60, right:-40, filter:"blur(40px)" }}/>
          <div style={{ display:"flex", alignItems:"flex-start", gap:16, marginBottom:20 }}>
            {/* Avatar */}
            <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 0 24px rgba(168,85,247,0.4)", fontSize:"1.8rem", fontWeight:900, color:"#fff" }}>
              {seller.displayName?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <div style={{ fontSize:"1.2rem", fontWeight:900, color:"#fff", letterSpacing:"-0.02em" }}>{seller.displayName}</div>
                {seller.sellerStatus === "approved" && (
                  <div style={{ width:18, height:18, background:"linear-gradient(135deg,#00c8ff,#a855f7)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                )}
              </div>
              {/* Stars */}
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                <div style={{ display:"flex" }}>{renderStars(Math.round(seller.ratingAvg ?? 0))}</div>
                <span style={{ fontSize:"0.75rem", color:"rgba(255,255,255,0.5)", fontWeight:600 }}>
                  {seller.ratingAvg?.toFixed(1) ?? "0.0"} ({seller.ratingCount ?? 0})
                </span>
              </div>
              <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.35)" }}>
                {seller.totalSales ?? 0} ventas realizadas
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
            {[
              { label:"Shows", val: shows.length },
              { label:"Ventas", val: seller.totalSales ?? 0 },
              { label:"Rating", val: `${seller.ratingAvg?.toFixed(1) ?? "—"}★` },
            ].map(s => (
              <div key={s.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(168,85,247,0.08)", borderRadius:12, padding:"12px", textAlign:"center" }}>
                <div style={{ fontSize:"1.1rem", fontWeight:900, color:"#fff", marginBottom:2 }}>{s.val}</div>
                <div style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.3)", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Follow button */}
          <button
            onClick={() => setFollowing(!following)}
            style={{ width:"100%", background: following ? "rgba(168,85,247,0.15)" : "linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)", border: following ? "1px solid rgba(168,85,247,0.3)" : "none", borderRadius:14, padding:"13px", fontSize:"0.88rem", fontWeight:800, color:"#fff", cursor:"pointer", fontFamily:"inherit", boxShadow: following ? "none" : "0 0 20px rgba(168,85,247,0.3)" }}
          >
            {following ? "Siguiendo" : "Seguir"}
          </button>
        </div>

        {/* Live shows */}
        {liveShows.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#ff2d2d", boxShadow:"0 0 8px #ff2d2d" }}/>
              <span style={{ fontSize:"0.72rem", fontWeight:700, color:"#fff", letterSpacing:"0.08em", textTransform:"uppercase", opacity:0.6 }}>En vivo ahora</span>
            </div>
            {liveShows.map(show => (
              <div key={show.id} onClick={() => router.push(`/shows/${show.id}`)} style={{ background:"rgba(255,45,45,0.08)", border:"1px solid rgba(255,45,45,0.2)", borderRadius:16, padding:"16px", cursor:"pointer", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontSize:"0.92rem", fontWeight:800, color:"#fff" }}>{show.title}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(255,45,45,0.2)", borderRadius:20, padding:"3px 10px" }}>
                    <div style={{ width:5, height:5, borderRadius:"50%", background:"#ff2d2d" }}/>
                    <span style={{ fontSize:"0.62rem", fontWeight:700, color:"#ff2d2d" }}>LIVE</span>
                  </div>
                </div>
                <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.4)" }}>{show.viewerCount ?? 0} viendo · {show.totalProducts ?? 0} productos</div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming */}
        {upcomingShows.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>Próximos shows</div>
            {upcomingShows.map(show => (
              <div key={show.id} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:14, padding:"14px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:42, height:42, background:"rgba(245,197,24,0.08)", border:"1px solid rgba(245,197,24,0.15)", borderRadius:12, flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"0.85rem", fontWeight:700, color:"#fff", marginBottom:2 }}>{show.title}</div>
                  <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.35)" }}>{show.totalProducts ?? 0} productos</div>
                </div>
                <div style={{ background:"rgba(245,197,24,0.1)", border:"1px solid rgba(245,197,24,0.2)", borderRadius:8, padding:"4px 10px" }}>
                  <span style={{ fontSize:"0.62rem", fontWeight:700, color:"#F5C518" }}>Pronto</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past shows */}
        {pastShows.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>Shows anteriores</div>
            {pastShows.slice(0,5).map(show => (
              <div key={show.id} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.08)", borderRadius:14, padding:"14px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:12, opacity:0.7 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"0.85rem", fontWeight:700, color:"#fff", marginBottom:2 }}>{show.title}</div>
                  <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.3)" }}>{show.peakViewerCount ?? 0} viewers máx</div>
                </div>
                <span style={{ fontSize:"0.62rem", fontWeight:700, color:"#4ade80", textTransform:"uppercase", letterSpacing:"0.05em" }}>Finalizado</span>
              </div>
            ))}
          </div>
        )}

        {/* Ratings */}
        {ratings.length > 0 && (
          <div>
            <div style={{ fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>Calificaciones</div>
            {ratings.slice(0,5).map(r => (
              <div key={r.id} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.08)", borderRadius:14, padding:"14px 16px", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ display:"flex" }}>{renderStars(r.score)}</div>
                  <span style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.3)" }}>
                    {r.createdAt?.toDate?.()?.toLocaleDateString("es-VE") ?? ""}
                  </span>
                </div>
                {r.comment && <div style={{ fontSize:"0.78rem", color:"rgba(255,255,255,0.6)", lineHeight:1.6 }}>{r.comment}</div>}
              </div>
            ))}
          </div>
        )}

        {ratings.length === 0 && pastShows.length === 0 && liveShows.length === 0 && upcomingShows.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <div style={{ fontSize:"0.82rem", color:"rgba(255,255,255,0.2)" }}>Este vendedor aún no tiene actividad</div>
          </div>
        )}
      </div>
    </div>
  );
}
