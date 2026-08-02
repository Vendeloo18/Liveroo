"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { formatUsd } from "@subastas-ve/shared";

// Lista de ventas del vendedor: quién compró qué, con su número de pedido.
// Vive fuera de la página de Vender (que quedó solo para vender), y se llega
// desde Cuenta. Cada fila lleva al detalle de la orden, donde el vendedor
// confirma el pago / marca el envío y ve el WhatsApp del comprador.

const ESTADO: Record<string, { texto: string; clase: string }> = {
  pending_payment: { texto: "Esperando pago", clase: "lv-badge--soft" },
  payment_confirmed: { texto: "Por enviar", clase: "lv-badge--accent" },
  shipped: { texto: "Enviado", clase: "lv-badge--soft" },
  delivered: { texto: "Entregado", clase: "lv-badge--accent" },
  cancelled: { texto: "Cancelada", clase: "lv-badge--live" },
  disputed: { texto: "En disputa", clase: "lv-badge--live" },
};

const numero = (o: any) => o.orderNumber ?? (o.id ?? "").slice(-6).toUpperCase();

export default function VentasPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [ventas, setVentas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(
      query(collection(db, "orders"), where("sellerId", "==", profile.uid), orderBy("createdAt", "desc")),
      s => { setVentas(s.docs.map(d => ({ id: d.id, ...d.data() }))); setCargando(false); },
      e => { console.error("ventas:", e.code); setCargando(false); },
    );
  }, [profile]);

  if (!profile) {
    return (
      <div className="lv-app">
        <header className="lv-topbar"><h1 className="lv-topbar__title">Mis ventas</h1></header>
        <div className="lv-empty">
          <div className="lv-empty__title">Entra para ver tus ventas</div>
          <button className="lv-btn lv-btn--primary" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>Entrar</button>
        </div>
      </div>
    );
  }

  const porAtender = ventas.filter(o => ["pending_payment", "payment_confirmed"].includes(o.status)).length;

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.push("/account")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="lv-topbar__title" style={{ fontSize: "1.15rem", fontWeight: 850 }}>Mis ventas</h1>
        </div>
        {porAtender > 0 && <span className="lv-badge lv-badge--accent">{porAtender} por atender</span>}
      </header>

      <div className="lv-pad" style={{ paddingTop: 16 }}>
        {cargando ? (
          <p className="lv-dim" style={{ fontSize: "0.85rem", textAlign: "center", padding: "24px 0" }}>Cargando…</p>
        ) : ventas.length === 0 ? (
          <div className="lv-empty">
            <div className="lv-empty__title">Todavía no has vendido nada</div>
            <div className="lv-empty__text">Cuando alguien se lleve una de tus ventas por ofertas, aparecerá aquí con su número de pedido.</div>
          </div>
        ) : (
          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            {ventas.map(o => {
              const e = ESTADO[o.status] ?? { texto: o.status, clase: "lv-badge--soft" };
              const tuTurno = ["pending_payment", "payment_confirmed"].includes(o.status);
              return (
                <button key={o.id} className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push(`/orders/${o.id}`)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 10, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
                      {o.productImageURL && <img src={o.productImageURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="lv-mono" style={{ fontSize: "0.66rem", color: "var(--accent-strong)", fontWeight: 600, letterSpacing: "0.02em" }}>#{numero(o)}</div>
                      <div style={{ fontSize: "0.86rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                        {o.productTitle ?? "Producto"}
                      </div>
                      <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 1 }}>
                        {formatUsd(o.bidAmountUsd ?? 0)} · lo compró {o.buyerName ?? "un comprador"}
                      </div>
                      <span className={`lv-badge ${tuTurno ? "lv-badge--accent" : e.clase}`} style={{ marginTop: 5 }}>
                        {tuTurno ? "Te toca" : e.texto}
                      </span>
                      {o.paymentMethod === "wallet" && o.status !== "cancelled" && (
                        <span className="lv-badge lv-badge--soft" style={{ marginTop: 5, marginLeft: 6, color: o.payoutStatus === "paid" ? "var(--ok)" : undefined }}>
                          {o.payoutStatus === "paid" ? "Liquidada ✓" : "Cobras de Vendeloo"}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                </button>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
