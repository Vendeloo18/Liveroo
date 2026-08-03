"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection, collectionGroup, query, where, orderBy, limit, onSnapshot, documentId, getDocs,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { useCountdown } from "../../hooks/useCountdown";

type Tab = "pujas" | "compras";

interface MiPuja {
  auctionId: string;
  ultimoMonto: number;
  cuando: any;
}

interface Subasta {
  id: string; title?: string; imageURL?: string; imageURLs?: string[];
  currentBidUsd?: number; currentBidderId?: string; status?: string;
  endsAt?: any; winnerId?: string; finalPriceUsd?: number; orderId?: string;
}

interface Orden {
  id: string; productTitle?: string; productImageURL?: string;
  bidAmountUsd?: number; bidAmountBs?: number; status?: string;
  sellerName?: string; createdAt?: any;
}

const ESTADO_ORDEN: Record<string, { texto: string; clase: string }> = {
  pending_payment: { texto: "Pago pendiente", clase: "lv-badge--soft" },
  payment_confirmed: { texto: "Pago confirmado", clase: "lv-badge--accent" },
  shipped: { texto: "Enviado", clase: "lv-badge--accent" },
  delivered: { texto: "Entregado", clase: "lv-badge--accent" },
  cancelled: { texto: "Cancelada", clase: "lv-badge--live" },
  disputed: { texto: "En disputa", clase: "lv-badge--live" },
};

function FilaPuja({ subasta, monto, uid, onClick }: { subasta: Subasta; monto: number; uid: string; onClick: () => void }) {
  const { texto, vencida } = useCountdown(subasta.endsAt);
  const activa = subasta.status === "active" && !vencida;
  const voyGanando = subasta.currentBidderId === uid;
  const gane = subasta.status === "sold" && subasta.winnerId === uid;

  const estado = activa
    ? (voyGanando ? { t: "Vas ganando", c: "lv-badge--accent" } : { t: "Te superaron", c: "lv-badge--live" })
    : gane
      ? { t: "Ganaste", c: "lv-badge--accent" }
      : subasta.status === "sold" ? { t: "No ganaste", c: "lv-badge--soft" }
      : { t: "Cerrada sin venta", c: "lv-badge--soft" };

  const foto = subasta.imageURL ?? subasta.imageURLs?.[0];

  return (
    <button className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
          {foto && <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subasta.title ?? "Venta"}
          </div>
          <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 2 }}>
            Ofertaste ${monto.toFixed(2)} · ahora ${(subasta.currentBidUsd ?? 0).toFixed(2)}
          </div>
          <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
            <span className={`lv-badge ${estado.c}`}>{estado.t}</span>
            {activa && <span className="lv-dim" style={{ fontSize: "0.68rem" }}>{texto}</span>}
          </div>
        </div>
      </div>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  );
}

export default function ActivityPage() {
  const { profile } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pujas");

  const [misPujas, setMisPujas] = useState<MiPuja[]>([]);
  const [subastas, setSubastas] = useState<Record<string, Subasta>>({});
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Historial real de pujas: la subcolección /auctions/*/bids que solo
  // escribe el motor. /pendingBids son solicitudes efímeras, no historial.
  useEffect(() => {
    if (!profile) { setCargando(false); return; }
    const q = query(
      collectionGroup(db, "bids"),
      where("bidderId", "==", profile.uid),
      orderBy("placedAt", "desc"),
      limit(60)
    );
    return onSnapshot(q, s => {
      // Una subasta puede tener varias pujas mías: se muestra la última
      const porSubasta = new Map<string, MiPuja>();
      s.docs.forEach(d => {
        const b = d.data();
        if (!b.auctionId || porSubasta.has(b.auctionId)) return;
        porSubasta.set(b.auctionId, { auctionId: b.auctionId, ultimoMonto: b.amountUsd, cuando: b.placedAt });
      });
      setMisPujas(Array.from(porSubasta.values()));
      setCargando(false);
    }, e => {
      setError(e.code === "failed-precondition"
        ? "Falta desplegar el índice de ofertas. Corre: firebase deploy --only firestore:indexes"
        : `No se pudo cargar tu actividad (${e.code})`);
      setCargando(false);
    });
  }, [profile]);

  // Las subastas referidas por esas pujas, en lotes de 10 (límite de "in")
  useEffect(() => {
    const ids = misPujas.map(p => p.auctionId).filter(id => !subastas[id]);
    if (ids.length === 0) return;
    let cancelado = false;
    (async () => {
      const nuevas: Record<string, Subasta> = {};
      for (let i = 0; i < ids.length; i += 10) {
        const lote = ids.slice(i, i + 10);
        const snap = await getDocs(query(collection(db, "auctions"), where(documentId(), "in", lote)));
        snap.docs.forEach(d => { nuevas[d.id] = { id: d.id, ...d.data() } as Subasta; });
      }
      if (!cancelado) setSubastas(prev => ({ ...prev, ...nuevas }));
    })().catch(() => undefined);
    return () => { cancelado = true; };
  }, [misPujas, subastas]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, "orders"), where("buyerId", "==", profile.uid), orderBy("createdAt", "desc"));
    return onSnapshot(q,
      s => setOrdenes(s.docs.map(d => ({ id: d.id, ...d.data() } as Orden))),
      e => console.error("No se pudieron cargar tus órdenes:", e.code));
  }, [profile]);

  const pujasOrdenadas = useMemo(() => {
    const ms = (v: any) => v?.toMillis?.() ?? 0;
    return [...misPujas].sort((a, b) => ms(b.cuando) - ms(a.cuando));
  }, [misPujas]);

  if (!profile) {
    return (
      <div className="lv-app">
        <header className="lv-topbar"><h1 className="lv-topbar__title">Actividad</h1></header>
        <div className="lv-empty">
          <div className="lv-empty__title">Entra para ver tu actividad</div>
          <div className="lv-empty__text">Ahí quedan tus ofertas y tus compras.</div>
          <button className="lv-btn lv-btn--primary" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <h1 className="lv-topbar__title">Actividad</h1>
      </header>

      <div className="lv-chips">
        {([["pujas", `Mis ofertas${pujasOrdenadas.length ? ` (${pujasOrdenadas.length})` : ""}`],
           ["compras", `Mis compras${ordenes.length ? ` (${ordenes.length})` : ""}`]] as [Tab, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className={`lv-chip${tab === v ? " lv-chip--active" : ""}`}>{label}</button>
        ))}
      </div>

      {error && <div className="lv-pad"><div className="lv-note lv-note--bad">{error}</div></div>}

      <div className="lv-pad">
        {tab === "pujas" && (
          cargando ? (
            <div style={{ display: "grid", gap: 10 }}>
              {[0,1,2].map(i => <div key={i} className="lv-skel" style={{ height: 76 }}/>)}
            </div>
          ) : pujasOrdenadas.length === 0 ? (
            <div className="lv-empty">
              <div className="lv-empty__icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M14 11l-8 8M9 6l9 9M3 21h6M12.5 3.5l8 8"/>
                </svg>
              </div>
              <div className="lv-empty__title">Todavía no has usado SUBELOO</div>
              <div className="lv-empty__text">Cuando pujes, aquí ves si vas ganando.</div>
              <button className="lv-btn lv-btn--accent" style={{ marginTop: 16 }} onClick={() => router.push("/auctions")}>
                Ver ventas
              </button>
            </div>
          ) : (
            <section className="lv-panel" style={{ padding: "2px 16px" }}>
              {pujasOrdenadas.map(p => {
                const s = subastas[p.auctionId];
                if (!s) return <div key={p.auctionId} className="lv-skel" style={{ height: 68, margin: "10px 0" }}/>;
                return (
                  <FilaPuja
                    key={p.auctionId}
                    subasta={s}
                    monto={p.ultimoMonto}
                    uid={profile.uid}
                    onClick={() => router.push(s.orderId ? `/orders/${s.orderId}` : `/auctions/${p.auctionId}`)}
                  />
                );
              })}
            </section>
          )
        )}

        {tab === "compras" && (
          // Sin esta espera, el que ACABA de ganar veía "Aún no has ganado
          // nada" durante el primer instante — justo cuando entra ilusionado
          // a ver su orden.
          cargando ? (
            <div style={{ display: "grid", gap: 10 }}>
              {[0,1,2].map(i => <div key={i} className="lv-skel" style={{ height: 76 }}/>)}
            </div>
          ) : ordenes.length === 0 ? (
            <div className="lv-empty">
              <div className="lv-empty__icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M6 2l1.5 3h9L18 2M3 6h18l-1.5 13a2 2 0 0 1-2 1.8H6.5a2 2 0 0 1-2-1.8z"/>
                </svg>
              </div>
              <div className="lv-empty__title">Aún no has ganado nada</div>
              <div className="lv-empty__text">Cuando ganes una venta, tu orden aparece aquí.</div>
            </div>
          ) : (
            <section className="lv-panel" style={{ padding: "2px 16px" }}>
              {ordenes.map(o => {
                const e = ESTADO_ORDEN[o.status ?? ""] ?? { texto: o.status ?? "—", clase: "lv-badge--soft" };
                return (
                  <button key={o.id} className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push(`/orders/${o.id}`)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
                        {o.productImageURL && <img src={o.productImageURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {o.productTitle ?? "Producto"}
                        </div>
                        <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 2 }}>
                          ${o.bidAmountUsd?.toFixed(2)}
                          {o.bidAmountBs ? ` · Bs ${o.bidAmountBs.toFixed(2)}` : ""}
                          {o.sellerName ? ` · ${o.sellerName}` : ""}
                        </div>
                        <span className={`lv-badge ${e.clase}`} style={{ marginTop: 5 }}>{e.texto}</span>
                      </div>
                    </div>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                );
              })}
            </section>
          )
        )}
      </div>
    </div>
  );
}
