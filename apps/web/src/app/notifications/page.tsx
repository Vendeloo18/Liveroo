"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection, collectionGroup, query, where, orderBy, limit, onSnapshot, documentId, getDocs,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";

// Esta pantalla NO tiene colección propia: arma los avisos a partir de
// datos reales (tus órdenes y las subastas donde pujaste). Antes mostraba
// una lista de notificaciones inventadas en el código, con nombres de
// productos y montos que nunca existieron.

interface Aviso {
  id: string;
  tipo: "ganaste" | "superado" | "ganando" | "orden" | "cerrada";
  titulo: string;
  detalle: string;
  cuando: number;
  ir: string;
}

const svgIco = (p: React.ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
);
const ICONO: Record<Aviso["tipo"], { emoji: React.ReactNode; clase: string }> = {
  ganaste: { emoji: svgIco(<path d="M20 6L9 17l-5-5"/>), clase: "lv-badge--accent" },
  superado: { emoji: svgIco(<path d="M12 19V5M5 12l7-7 7 7"/>), clase: "lv-badge--live" },
  ganando: { emoji: svgIco(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>), clase: "lv-badge--accent" },
  orden: { emoji: svgIco(<g><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5"/></g>), clase: "lv-badge--soft" },
  cerrada: { emoji: svgIco(<g><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>), clase: "lv-badge--soft" },
};

const ESTADO_ORDEN: Record<string, string> = {
  pending_payment: "Coordina el pago con el vendedor",
  payment_confirmed: "El vendedor confirmó tu pago",
  shipped: "Tu producto va en camino",
  delivered: "Entregado. Puedes calificar al vendedor",
  cancelled: "La orden fue cancelada",
};

export default function NotificationsPage() {
  const router = useRouter();
  const { profile } = useAuthStore();

  const [subastas, setSubastas] = useState<any[]>([]);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!profile) { setCargando(false); return; }
    const q = query(collection(db, "orders"), where("buyerId", "==", profile.uid), orderBy("createdAt", "desc"), limit(30));
    return onSnapshot(q, s => setOrdenes(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => undefined);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collectionGroup(db, "bids"), where("bidderId", "==", profile.uid), orderBy("placedAt", "desc"), limit(40));
    return onSnapshot(q, async s => {
      const ids = Array.from(new Set(s.docs.map(d => d.data().auctionId).filter(Boolean))) as string[];
      const encontradas: any[] = [];
      for (let i = 0; i < ids.length; i += 10) {
        const lote = ids.slice(i, i + 10);
        const snap = await getDocs(query(collection(db, "auctions"), where(documentId(), "in", lote)));
        snap.docs.forEach(d => encontradas.push({ id: d.id, ...d.data() }));
      }
      setSubastas(encontradas);
      setCargando(false);
    }, () => setCargando(false));
  }, [profile]);

  const avisos = useMemo<Aviso[]>(() => {
    if (!profile) return [];
    const ms = (v: any) => v?.toMillis?.() ?? 0;
    const salida: Aviso[] = [];

    for (const a of subastas) {
      const cuando = ms(a.endedAt) || ms(a.updatedAt) || ms(a.endsAt);
      if (a.status === "sold" && a.winnerId === profile.uid) {
        salida.push({
          id: `g_${a.id}`, tipo: "ganaste",
          titulo: `Ganaste "${a.title}"`,
          detalle: `Por $${(a.finalPriceUsd ?? a.currentBidUsd ?? 0).toFixed(2)}`,
          cuando, ir: a.orderId ? `/orders/${a.orderId}` : `/auctions/${a.id}`,
        });
      } else if (a.status === "active") {
        const ganando = a.currentBidderId === profile.uid;
        salida.push({
          id: `${ganando ? "w" : "o"}_${a.id}`,
          tipo: ganando ? "ganando" : "superado",
          titulo: ganando ? `Vas ganando "${a.title}"` : `Te superaron en "${a.title}"`,
          detalle: ganando
            ? `Tu oferta de $${(a.currentBidUsd ?? 0).toFixed(2)} va de primera`
            : `Ahora va en $${(a.currentBidUsd ?? 0).toFixed(2)}`,
          cuando: ms(a.updatedAt), ir: `/auctions/${a.id}`,
        });
      } else if (a.status === "sold") {
        salida.push({
          id: `p_${a.id}`, tipo: "cerrada",
          titulo: `No ganaste "${a.title}"`,
          detalle: `Cerró en $${(a.finalPriceUsd ?? 0).toFixed(2)}`,
          cuando, ir: `/auctions/${a.id}`,
        });
      } else if (["unsold", "cancelled", "skipped"].includes(a.status)) {
        salida.push({
          id: `c_${a.id}`, tipo: "cerrada",
          titulo: `"${a.title}" cerró sin venta`,
          detalle: "Nadie alcanzó el precio",
          cuando, ir: `/auctions/${a.id}`,
        });
      }
    }

    for (const o of ordenes) {
      const texto = ESTADO_ORDEN[o.status];
      if (!texto) continue;
      salida.push({
        id: `ord_${o.id}_${o.status}`, tipo: "orden",
        titulo: o.productTitle ?? "Tu orden",
        detalle: texto,
        cuando: ms(o.updatedAt) || ms(o.createdAt),
        ir: `/orders/${o.id}`,
      });
    }

    return salida.sort((a, b) => b.cuando - a.cuando);
  }, [subastas, ordenes, profile]);

  const Cabecera = () => (
    <header className="lv-topbar">
      <button className="lv-icon-btn" onClick={() => router.back()} aria-label="Atrás">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <h1 className="lv-topbar__title">Avisos</h1>
    </header>
  );

  if (!profile) {
    return (
      <div className="lv-app lv-app--aurora">
        <Cabecera/>
        <div className="lv-empty">
          <div className="lv-empty__title">Entra para ver tus avisos</div>
          <button className="lv-btn lv-btn--primary" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-app lv-app--aurora">
      <Cabecera/>

      <div className="lv-pad" style={{ paddingTop: 16 }}>
        {cargando ? (
          <div style={{ display: "grid", gap: 10 }}>
            {[0,1,2].map(i => <div key={i} className="lv-skel" style={{ height: 66 }}/>)}
          </div>
        ) : avisos.length === 0 ? (
          <div className="lv-empty">
            <div className="lv-empty__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div className="lv-empty__title">Nada por ahora</div>
            <div className="lv-empty__text">Cuando pujes o ganes algo, te avisamos aquí.</div>
          </div>
        ) : (
          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            {avisos.map(a => {
              const ic = ICONO[a.tipo];
              return (
                <button key={a.id} className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push(a.ir)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span className={`lv-badge ${ic.clase}`} style={{ width: 36, height: 36, borderRadius: 11, justifyContent: "center", fontSize: "1rem" }} aria-hidden="true">
                      {ic.emoji}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.titulo}
                      </div>
                      <div className="lv-dim" style={{ fontSize: "0.74rem", marginTop: 1 }}>{a.detalle}</div>
                    </div>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
