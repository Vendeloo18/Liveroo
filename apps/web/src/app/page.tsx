"use client";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "../lib/firebase";
import { AuctionCard, AuctionCardData } from "../components/auction/AuctionCard";
import { Logo } from "../components/ui/Logo";

interface Show {
  id: string; sellerName?: string; title?: string; status?: string;
  viewerCount?: number; totalProducts?: number; coverImageURL?: string;
}

const CATEGORIAS = ["Para Ti", "Moda y Ropa", "Electronica", "Calzado", "Joyas y Relojes", "Hogar", "Deportes"];

export default function Home() {
  const router = useRouter();
  const [shows, setShows] = useState<Show[]>([]);
  const [auctions, setAuctions] = useState<AuctionCardData[]>([]);
  const [cat, setCat] = useState("Para Ti");
  const [cargando, setCargando] = useState(true);

  // Los onSnapshot llevan callback de error a propósito: sin él, una
  // regla que deniegue o un índice que falte fallan en silencio y la
  // pantalla se queda cargando para siempre sin decir por qué.
  useEffect(() => {
    const q = query(collection(db, "shows"), where("status", "==", "live"), orderBy("viewerCount", "desc"), limit(6));
    return onSnapshot(q,
      s => setShows(s.docs.map(d => ({ id: d.id, ...d.data() } as Show))),
      e => console.error("No se pudieron cargar los shows:", e.code, e.message));
  }, []);

  useEffect(() => {
    const q = query(collection(db, "auctions"), where("status", "==", "active"));
    return onSnapshot(q,
      s => {
        setAuctions(s.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCardData)));
        setCargando(false);
      },
      e => { console.error("No se pudieron cargar las subastas:", e.code, e.message); setCargando(false); });
  }, []);

  const visibles = auctions
    .filter(a => cat === "Para Ti" || (a as any).category === cat)
    .sort((a, b) => {
      const ms = (v: any) => v?.toMillis?.() ?? new Date(v ?? 0).getTime();
      return ms(a.endsAt) - ms(b.endsAt);
    });

  return (
    <div className="lv-app">

      {/* Barra superior */}
      <header className="lv-topbar">
        <Logo tamano={26}/>
        <div style={{ flex: 1 }}/>
        <button className="lv-icon-btn" onClick={() => router.push("/auctions")} aria-label="Buscar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </button>
        <button className="lv-icon-btn" onClick={() => router.push("/notifications")} aria-label="Notificaciones">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
      </header>

      {/* Categorías */}
      <div className="lv-chips">
        {CATEGORIAS.map(c => (
          <button key={c} onClick={() => setCat(c)} className={`lv-chip${cat === c ? " lv-chip--active" : ""}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Shows en vivo */}
      {shows.length > 0 && (
        <>
          <div className="lv-section">
            <h2 className="lv-section__title">
              <span className="lv-badge lv-badge--live"><i className="lv-dot"/> EN VIVO</span>
              {shows.length} {shows.length === 1 ? "show" : "shows"}
            </h2>
          </div>
          <div className="lv-pad" style={{ display:"flex", gap:12, overflowX:"auto", scrollbarWidth:"none", paddingBottom:4 }}>
            {shows.map(show => (
              <article
                key={show.id}
                onClick={() => router.push(`/shows/${show.id}`)}
                className="lv-card"
                style={{ minWidth: 176, flexShrink: 0 }}
              >
                <div className="lv-card__media" style={{ aspectRatio: "3 / 4" }}>
                  {show.coverImageURL
                    ? <img src={show.coverImageURL} alt={show.title ?? ""}/>
                    : <div style={{ width:"100%", height:"100%", background:"var(--surface-3)" }}/>}
                  <span className="lv-badge lv-badge--live lv-badge--float" style={{ top:8, left:8 }}>
                    <i className="lv-dot"/> LIVE
                  </span>
                  {(show.viewerCount ?? 0) > 0 && (
                    <span className="lv-badge lv-badge--float" style={{ top:8, right:8 }}>
                      {show.viewerCount} viendo
                    </span>
                  )}
                </div>
                <div className="lv-card__body">
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                    <span className="lv-avatar" style={{ width:20, height:20, fontSize:"0.6rem" }}>
                      {(show.sellerName ?? "?")[0]}
                    </span>
                    <span className="lv-dim" style={{ fontSize:"0.72rem", fontWeight:600, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                      {show.sellerName}
                    </span>
                  </div>
                  <h3 className="lv-card__title" style={{ minHeight:0, marginBottom:0 }}>{show.title}</h3>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* Subastas */}
      <div className="lv-section">
        <h2 className="lv-section__title">Subastas activas</h2>
        <button className="lv-section__link" onClick={() => router.push("/auctions")}>Ver todas →</button>
      </div>

      <div className="lv-pad">
        {cargando ? (
          <div className="lv-grid">
            {[0,1,2,3].map(i => <div key={i} className="lv-skel" style={{ aspectRatio:"1 / 1.42" }}/>)}
          </div>
        ) : visibles.length === 0 ? (
          <div className="lv-empty">
            <div className="lv-empty__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M14 11l-8 8M9 6l9 9M3 21h6M12.5 3.5l8 8"/>
              </svg>
            </div>
            <div className="lv-empty__title">
              {cat === "Para Ti" ? "Todavía no hay subastas activas" : `Nada en ${cat}`}
            </div>
            <div className="lv-empty__text">Vuelve pronto o publica la tuya.</div>
          </div>
        ) : (
          <div className="lv-grid">
            {visibles.slice(0, 8).map(a => <AuctionCard key={a.id} auction={a}/>)}
          </div>
        )}
      </div>
    </div>
  );
}
