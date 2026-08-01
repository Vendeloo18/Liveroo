"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "../../lib/firebase";
import { CATEGORIAS as CATEGORIAS_MARKETPLACE } from "../../lib/marketplace";
import { AuctionCard, AuctionCardData } from "../../components/auction/AuctionCard";

const CATEGORIAS = ["Todas", ...CATEGORIAS_MARKETPLACE];

const ORDENES = [
  ["cierre", "Cierran pronto"],
  ["precio_asc", "Más baratas"],
  ["precio_desc", "Más caras"],
  ["pujas", "Más pujadas"],
] as const;

type Orden = typeof ORDENES[number][0];

// useSearchParams obliga a renderizado en cliente; sin este Suspense
// el build de Next falla al prerenderizar la ruta.
export default function AuctionsPage() {
  return (
    <Suspense fallback={<div className="lv-app"><div className="lv-empty lv-empty__text">Cargando…</div></div>}>
      <ListaDeSubastas/>
    </Suspense>
  );
}

function ListaDeSubastas() {
  const router = useRouter();
  const params = useSearchParams();
  const [auctions, setAuctions] = useState<AuctionCardData[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cat, setCat] = useState(params.get("cat") ?? "Todas");
  const [orden, setOrden] = useState<Orden>("cierre");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const q = query(collection(db, "auctions"), where("status", "==", "active"));
    return onSnapshot(q, s => {
      setAuctions(s.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCardData)));
      setCargando(false);
    });
  }, []);

  const visibles = useMemo(() => {
    const ms = (v: any) => v?.toMillis?.() ?? new Date(v ?? 0).getTime();
    return auctions
      .filter(a => cat === "Todas" || (a as any).category === cat)
      .filter(a => !busqueda.trim() || a.title?.toLowerCase().includes(busqueda.toLowerCase()))
      .sort((a, b) => {
        if (orden === "precio_asc") return (a.currentBidUsd ?? 0) - (b.currentBidUsd ?? 0);
        if (orden === "precio_desc") return (b.currentBidUsd ?? 0) - (a.currentBidUsd ?? 0);
        if (orden === "pujas") return (b.bidsCount ?? 0) - (a.bidsCount ?? 0);
        return ms(a.endsAt) - ms(b.endsAt);
      });
  }, [auctions, cat, orden, busqueda]);

  const filtrado = busqueda.trim() !== "" || cat !== "Todas";

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.back()} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <h1 className="lv-topbar__title">Explorar</h1>
        <span className="lv-dim" style={{ fontSize:"0.8rem", fontWeight:700 }}>{visibles.length}</span>
      </header>

      <div className="lv-pad" style={{ paddingTop: 14 }}>
        <div style={{ position: "relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round"
               style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)" }}>
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            className="lv-input"
            style={{ paddingLeft: 38 }}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar subastas"
            aria-label="Buscar subastas"
          />
        </div>
      </div>

      <div className="lv-chips">
        {CATEGORIAS.map(c => (
          <button key={c} onClick={() => setCat(c)} className={`lv-chip${cat === c ? " lv-chip--active" : ""}`}>{c}</button>
        ))}
      </div>

      <div className="lv-chips" style={{ paddingTop: 0 }}>
        {ORDENES.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setOrden(v)}
            className={`lv-chip${orden === v ? " lv-chip--active" : ""}`}
            style={{ fontSize: "0.74rem", padding: "7px 13px" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="lv-pad" style={{ paddingTop: 6 }}>
        {cargando ? (
          <div className="lv-grid">
            {[0,1,2,3,4,5].map(i => <div key={i} className="lv-skel" style={{ aspectRatio:"1 / 1.42" }}/>)}
          </div>
        ) : visibles.length === 0 ? (
          <div className="lv-empty">
            <div className="lv-empty__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M14 11l-8 8M9 6l9 9M3 21h6M12.5 3.5l8 8"/>
              </svg>
            </div>
            <div className="lv-empty__title">{filtrado ? "Nada con ese filtro" : "No hay subastas activas"}</div>
            {filtrado && (
              <button
                className="lv-btn lv-btn--soft lv-btn--sm"
                style={{ marginTop: 12 }}
                onClick={() => { setBusqueda(""); setCat("Todas"); }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="lv-grid">
            {visibles.map(a => <AuctionCard key={a.id} auction={a}/>)}
          </div>
        )}
      </div>
    </div>
  );
}
