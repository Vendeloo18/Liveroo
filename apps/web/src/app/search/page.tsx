"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { AuctionCard, AuctionCardData } from "../../components/auction/AuctionCard";

type Tab = "subastas" | "shows" | "vendedores";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="lv-app"><div className="lv-empty"><div className="lv-empty__text">Cargando…</div></div></div>}>
      <Buscador/>
    </Suspense>
  );
}

function Buscador() {
  const router = useRouter();
  const params = useSearchParams();

  const [termino, setTermino] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>("subastas");
  const [subastas, setSubastas] = useState<AuctionCardData[]>([]);
  const [shows, setShows] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [buscado, setBuscado] = useState(false);

  // Firestore no hace búsqueda de texto: se traen candidatos y se filtra
  // en el cliente. Sirve a esta escala; con miles de docs habría que
  // meter un buscador aparte (Algolia, Typesense o similar).
  const buscar = useCallback(async (t: string) => {
    const q = t.trim().toLowerCase();
    if (!q) return;
    setCargando(true);
    setBuscado(true);
    try {
      const [snapSub, snapShows, snapVend] = await Promise.all([
        getDocs(query(collection(db, "auctions"), where("status", "==", "active"), limit(100))),
        getDocs(query(collection(db, "shows"), where("status", "in", ["live", "scheduled", "ended"]), orderBy("viewerCount", "desc"), limit(40))),
        getDocs(query(collection(db, "publicProfiles"), where("role", "==", "seller"), limit(60))),
      ]);

      setSubastas(snapSub.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCardData))
        .filter(a => a.title?.toLowerCase().includes(q) || a.sellerName?.toLowerCase().includes(q)));

      setShows(snapShows.docs.map(d => ({ id: d.id, ...d.data() }) as any)
        .filter(s => s.title?.toLowerCase().includes(q) || s.sellerName?.toLowerCase().includes(q)));

      setVendedores(snapVend.docs.map(d => ({ id: d.id, ...d.data() }) as any)
        .filter(v => v.displayName?.toLowerCase().includes(q) || v.shopName?.toLowerCase().includes(q) || v.username?.toLowerCase().includes(q)));
    } catch (e) {
      console.error("búsqueda:", e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const q = params.get("q");
    if (q) { setTermino(q); buscar(q); }
  }, [params, buscar]);

  // Busca sola mientras escribes (con debounce). El Enter y el botón
  // quedan como refuerzo — nadie se queda mirando una pantalla muda.
  useEffect(() => {
    const t = termino.trim();
    if (t.length < 2) return;
    const id = setTimeout(() => buscar(t), 350);
    return () => clearTimeout(id);
  }, [termino, buscar]);

  const total = subastas.length + shows.length + vendedores.length;

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.back()} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="lv-topbar__title">Buscar</h1>
      </header>

      <div className="lv-pad" style={{ paddingTop: 14 }}>
        <form onSubmit={e => { e.preventDefault(); buscar(termino); }} style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round"
                 style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              className="lv-input"
              style={{ paddingLeft: 38 }}
              type="search"
              enterKeyHint="search"
              value={termino}
              onChange={e => setTermino(e.target.value)}
              placeholder="Producto, show o vendedor"
              autoFocus
              aria-label="Buscar"
            />
          </div>
          <button type="submit" className="lv-btn lv-btn--accent" style={{ flexShrink: 0 }}>Buscar</button>
        </form>
      </div>

      {buscado && (
        <div className="lv-chips">
          {([["subastas", `Subastas (${subastas.length})`],
             ["shows", `Shows (${shows.length})`],
             ["vendedores", `Vendedores (${vendedores.length})`]] as [Tab, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setTab(v)} className={`lv-chip${tab === v ? " lv-chip--active" : ""}`}>{label}</button>
          ))}
        </div>
      )}

      <div className="lv-pad" style={{ paddingTop: 8 }}>
        {!buscado ? (
          <div className="lv-empty">
            <div className="lv-empty__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </div>
            <div className="lv-empty__title">¿Qué estás buscando?</div>
            <div className="lv-empty__text">Escribe un producto, un show o el nombre de un vendedor.</div>
          </div>
        ) : cargando ? (
          <div className="lv-grid">
            {[0,1,2,3].map(i => <div key={i} className="lv-skel" style={{ aspectRatio: "1 / 1.42" }}/>)}
          </div>
        ) : total === 0 ? (
          <div className="lv-empty">
            <div className="lv-empty__title">Nada para «{termino}»</div>
            <div className="lv-empty__text">Prueba con otra palabra.</div>
          </div>
        ) : (
          <>
            {tab === "subastas" && (
              subastas.length === 0
                ? <div className="lv-empty"><div className="lv-empty__title">Sin subastas con ese nombre</div></div>
                : <div className="lv-grid">{subastas.map(a => <AuctionCard key={a.id} auction={a}/>)}</div>
            )}

            {tab === "shows" && (
              shows.length === 0
                ? <div className="lv-empty"><div className="lv-empty__title">Sin shows con ese nombre</div></div>
                : <section className="lv-panel" style={{ padding: "2px 16px" }}>
                    {shows.map(s => (
                      <button key={s.id} className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push(`/shows/${s.id}`)}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.86rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                          <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 2 }}>{s.sellerName} · {s.viewerCount ?? 0} viendo</div>
                          {s.status === "live" && <span className="lv-badge lv-badge--live" style={{ marginTop: 5 }}><i className="lv-dot"/> EN VIVO</span>}
                        </div>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    ))}
                  </section>
            )}

            {tab === "vendedores" && (
              vendedores.length === 0
                ? <div className="lv-empty"><div className="lv-empty__title">Sin vendedores con ese nombre</div></div>
                : <section className="lv-panel" style={{ padding: "2px 16px" }}>
                    {vendedores.map(v => (
                      <button key={v.id} className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push(`/seller/${v.id}`)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                          {v.avatar
                            ? <img className="lv-avatar" src={v.avatar} alt=""/>
                            : <span className="lv-avatar">{(v.displayName ?? "?")[0].toUpperCase()}</span>}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "0.86rem", fontWeight: 700 }}>{v.shopName || v.displayName}</div>
                            <div className="lv-dim" style={{ fontSize: "0.73rem" }}>
                              {v.ratingAvg ? `${v.ratingAvg.toFixed(1)}★ · ` : ""}{v.totalSales ?? 0} ventas
                            </div>
                          </div>
                        </div>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    ))}
                  </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
