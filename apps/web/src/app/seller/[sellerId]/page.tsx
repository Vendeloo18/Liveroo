"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, collection, query, where, orderBy, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { AuctionCard, AuctionCardData } from "../../../components/auction/AuctionCard";

interface Perfil {
  id: string; displayName?: string; username?: string; avatar?: string;
  shopName?: string; sellerCat?: string; city?: string; role?: string;
  sellerStatus?: string; ratingAvg?: number; ratingCount?: number; totalSales?: number;
}

interface Calificacion {
  id: string; fromName?: string; score?: number; comment?: string; createdAt?: any;
}

type Tab = "subastas" | "shows" | "opiniones";

const ESTADO_SHOW: Record<string, { texto: string; clase: string }> = {
  live: { texto: "EN VIVO", clase: "lv-badge--live" },
  scheduled: { texto: "Programado", clase: "lv-badge--soft" },
  ended: { texto: "Terminado", clase: "lv-badge--soft" },
  draft: { texto: "Borrador", clase: "lv-badge--soft" },
  cancelled: { texto: "Cancelado", clase: "lv-badge--soft" },
};

export default function SellerProfilePage() {
  const { sellerId } = useParams() as { sellerId: string };
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [shows, setShows] = useState<any[]>([]);
  const [subastas, setSubastas] = useState<AuctionCardData[]>([]);
  const [opiniones, setOpiniones] = useState<Calificacion[]>([]);
  const [tab, setTab] = useState<Tab>("subastas");

  useEffect(() => {
    // Perfil público: sin email, teléfono ni cédula
    getDoc(doc(db, "publicProfiles", sellerId))
      .then(s => s.exists() ? setPerfil({ id: s.id, ...s.data() } as Perfil) : setNoExiste(true))
      .catch(() => setNoExiste(true));

    const u1 = onSnapshot(
      query(collection(db, "shows"), where("sellerId", "==", sellerId), orderBy("createdAt", "desc")),
      s => setShows(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("shows del vendedor:", e.code));

    const u2 = onSnapshot(
      query(collection(db, "auctions"), where("sellerId", "==", sellerId), orderBy("createdAt", "desc")),
      s => setSubastas(s.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCardData))),
      e => console.error("subastas del vendedor:", e.code));

    const u3 = onSnapshot(
      query(collection(db, "ratings"), where("toUid", "==", sellerId), orderBy("createdAt", "desc")),
      s => setOpiniones(s.docs.map(d => ({ id: d.id, ...d.data() } as Calificacion))),
      e => console.error("calificaciones:", e.code));

    return () => { u1(); u2(); u3(); };
  }, [sellerId]);

  if (noExiste) {
    return (
      <div className="lv-app">
        <header className="lv-topbar">
          <button className="lv-icon-btn" onClick={() => router.back()} aria-label="Atrás">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <h1 className="lv-topbar__title">Vendedor</h1>
        </header>
        <div className="lv-empty">
          <div className="lv-empty__title">Este vendedor no existe</div>
          <div className="lv-empty__text">Puede que haya cerrado su cuenta.</div>
        </div>
      </div>
    );
  }

  if (!perfil) {
    return <div className="lv-app"><div className="lv-empty"><div className="lv-empty__text">Cargando…</div></div></div>;
  }

  const activas = subastas.filter(a => a.status === "active");
  const vendidas = subastas.filter(a => a.status === "sold");
  const enVivo = shows.filter(s => s.status === "live");

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.back()} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="lv-topbar__title">{perfil.displayName}</h1>
      </header>

      <div className="lv-pad" style={{ paddingTop: 18, display: "grid", gap: 14 }}>

        {/* Cabecera */}
        <section style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {perfil.avatar
            ? <img className="lv-avatar" style={{ width: 64, height: 64 }} src={perfil.avatar} alt=""/>
            : <span className="lv-avatar" style={{ width: 64, height: 64, fontSize: "1.5rem", background: "var(--accent)", color: "var(--accent-ink)" }}>
                {(perfil.displayName ?? "?")[0].toUpperCase()}
              </span>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
              {perfil.shopName || perfil.displayName}
            </div>
            {perfil.username && <div className="lv-dim" style={{ fontSize: "0.78rem" }}>@{perfil.username}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
              {perfil.sellerStatus === "approved" && (
                <span className="lv-badge lv-badge--accent">Vendedor verificado</span>
              )}
              {enVivo.length > 0 && (
                <span className="lv-badge lv-badge--live"><i className="lv-dot"/> EN VIVO</span>
              )}
              {perfil.sellerCat && <span className="lv-badge lv-badge--soft">{perfil.sellerCat}</span>}
            </div>
          </div>
        </section>

        {/* Reputación */}
        <div className="lv-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            ["Rating", perfil.ratingAvg ? `${perfil.ratingAvg.toFixed(1)}★` : "—"],
            ["Ventas", perfil.totalSales ?? vendidas.length],
            ["Activas", activas.length],
          ].map(([l, v]) => (
            <div key={String(l)} className="lv-panel" style={{ padding: "13px 12px", textAlign: "center" }}>
              <div className="lv-price" style={{ fontSize: "1.2rem" }}>{v}</div>
              <div className="lv-eyebrow" style={{ marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {enVivo.length > 0 && (
          <button className="lv-btn lv-btn--danger lv-btn--block lv-btn--lg" onClick={() => router.push(`/shows/${enVivo[0].id}`)}>
            <i className="lv-dot"/> Entrar a la venta en vivo
          </button>
        )}
      </div>

      <div className="lv-chips">
        {([["subastas", `Ventas (${activas.length})`],
           ["shows", `En vivo (${shows.length})`],
           ["opiniones", `Opiniones (${opiniones.length})`]] as [Tab, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className={`lv-chip${tab === v ? " lv-chip--active" : ""}`}>{label}</button>
        ))}
      </div>

      <div className="lv-pad">
        {tab === "subastas" && (
          activas.length === 0 ? (
            <div className="lv-empty">
              <div className="lv-empty__title">Sin ventas activas</div>
              <div className="lv-empty__text">Vuelve pronto.</div>
            </div>
          ) : (
            <div className="lv-grid">
              {activas.map(a => <AuctionCard key={a.id} auction={a}/>)}
            </div>
          )
        )}

        {tab === "shows" && (
          shows.length === 0 ? (
            <div className="lv-empty"><div className="lv-empty__title">Todavía no ha vendido en vivo</div></div>
          ) : (
            <section className="lv-panel" style={{ padding: "2px 16px" }}>
              {shows.map(s => {
                const e = ESTADO_SHOW[s.status] ?? { texto: s.status, clase: "lv-badge--soft" };
                return (
                  <button key={s.id} className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push(`/shows/${s.id}`)}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.86rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                      <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 2 }}>{s.viewerCount ?? 0} viendo</div>
                      <span className={`lv-badge ${e.clase}`} style={{ marginTop: 5 }}>
                        {s.status === "live" && <i className="lv-dot"/>}{e.texto}
                      </span>
                    </div>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                );
              })}
            </section>
          )
        )}

        {tab === "opiniones" && (
          opiniones.length === 0 ? (
            <div className="lv-empty">
              <div className="lv-empty__title">Sin opiniones todavía</div>
              <div className="lv-empty__text">Aparecen cuando un comprador califica una entrega.</div>
            </div>
          ) : (
            <section className="lv-panel" style={{ padding: "2px 16px" }}>
              {opiniones.map(o => (
                <div key={o.id} className="lv-row" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.84rem", fontWeight: 700 }}>{o.fromName ?? "Comprador"}</span>
                      <span style={{ fontSize: "0.78rem", color: "var(--accent-ink)", background: "var(--accent)", borderRadius: 6, padding: "1px 7px", fontWeight: 800 }}>
                        {o.score}★
                      </span>
                    </div>
                    {o.comment && (
                      <p className="lv-muted" style={{ fontSize: "0.8rem", lineHeight: 1.5, marginTop: 5 }}>{o.comment}</p>
                    )}
                    <div className="lv-dim" style={{ fontSize: "0.68rem", marginTop: 4 }}>
                      {o.createdAt?.toDate?.()?.toLocaleDateString("es-VE") ?? ""}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )
        )}
      </div>
    </div>
  );
}
