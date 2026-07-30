"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuthStore } from "../../../store/authStore";
import { BRAND, formatUsd, formatBs, buildWhatsappMessage, buildWhatsappLink } from "@subastas-ve/shared";

const PASOS = [
  { clave: "pending_payment", corto: "Pago" },
  { clave: "payment_confirmed", corto: "Confirmado" },
  { clave: "shipped", corto: "Enviado" },
  { clave: "delivered", corto: "Entregado" },
];

const ESTADO: Record<string, { texto: string; detalle: string; clase: string }> = {
  pending_payment: {
    texto: "Pago pendiente", clase: "lv-badge--soft",
    detalle: "Coordina el pago con el vendedor por WhatsApp. Él lo confirma aquí al recibirlo.",
  },
  payment_confirmed: {
    texto: "Pago confirmado", clase: "lv-badge--accent",
    detalle: "El vendedor confirmó tu pago. Espera el envío.",
  },
  shipped: {
    texto: "Enviado", clase: "lv-badge--accent",
    detalle: "Tu producto va en camino. Confirma cuando lo recibas.",
  },
  delivered: {
    texto: "Entregado", clase: "lv-badge--accent",
    detalle: "Transacción completada.",
  },
  cancelled: {
    texto: "Cancelada", clase: "lv-badge--live",
    detalle: "Esta orden fue cancelada.",
  },
  disputed: {
    texto: "En disputa", clase: "lv-badge--live",
    detalle: "Estamos revisando este caso.",
  },
};

export default function OrderPage() {
  const { orderId } = useParams() as { orderId: string };
  const router = useRouter();
  const { profile } = useAuthStore();
  const [order, setOrder] = useState<any>(null);

  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorRating, setErrorRating] = useState<string | null>(null);
  const [yaCalifique, setYaCalifique] = useState(false);
  const [avanzando, setAvanzando] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, "orders", orderId), s => {
      if (!s.exists()) return;
      const o = { id: s.id, ...s.data() } as any;
      setOrder(o);
      if (o.ratingGiven != null) setYaCalifique(true);
    });
  }, [orderId]);

  // El vendedor empuja hasta "enviado"; el último paso lo da el comprador,
  // porque es el único que sabe si le llegó. Las reglas lo hacen cumplir.
  const avanzar = async (nuevo: string, extra: Record<string, any> = {}) => {
    if (!order) return;
    setAvanzando(true);
    setErrorEstado(null);
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: nuevo,
        ...extra,
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      setErrorEstado(e?.message ?? "No se pudo actualizar la orden");
    } finally {
      setAvanzando(false);
    }
  };

  const calificar = async () => {
    if (!order || !profile || estrellas === 0) return;
    setEnviando(true);
    setErrorRating(null);
    try {
      // Nombres de campo según onRatingCreated: toUid + score
      await addDoc(collection(db, "ratings"), {
        fromUid: profile.uid,
        fromName: profile.displayName ?? "",
        toUid: order.sellerId,
        orderId: order.id,
        score: estrellas,
        comment: comentario.trim(),
        createdAt: serverTimestamp(),
      });
      setYaCalifique(true);
    } catch (e: any) {
      setErrorRating(e?.message ?? "No se pudo enviar la calificación");
    } finally {
      setEnviando(false);
    }
  };

  if (!order) {
    return <div className="lv-app"><div className="lv-empty"><div className="lv-empty__text">Cargando orden…</div></div></div>;
  }

  const e = ESTADO[order.status] ?? { texto: order.status, detalle: "", clase: "lv-badge--soft" };
  const paso = PASOS.findIndex(p => p.clave === order.status);
  const soyComprador = profile?.uid === order.buyerId;
  const soyVendedor = profile?.uid === order.sellerId;

  // Qué acción toca según quién mira y en qué estado va la orden
  const accion: { label: string; estado: string; extra?: Record<string, any>; nota: string } | null =
    soyVendedor && order.status === "pending_payment"
      ? { label: "Ya recibí el pago", estado: "payment_confirmed",
          extra: { paymentConfirmedAt: serverTimestamp(), paymentConfirmedBy: profile!.uid },
          nota: "Confírmalo solo cuando el dinero esté en tu cuenta." }
      : soyVendedor && order.status === "payment_confirmed"
      ? { label: "Marcar como enviado", estado: "shipped",
          extra: { shippedAt: serverTimestamp() },
          nota: "El comprador confirmará cuando lo reciba." }
      : soyComprador && order.status === "shipped"
      ? { label: "Ya lo recibí", estado: "delivered",
          extra: { deliveredAt: serverTimestamp() },
          nota: "Al confirmar podrás calificar al vendedor." }
      : null;

  const mensaje = buildWhatsappMessage({
    buyerName: order.buyerName,
    productTitle: order.productTitle ?? `Orden #${order.id.slice(-6).toUpperCase()}`,
    bidAmountUsd: order.bidAmountUsd,
    bidAmountBs: order.bidAmountBs,
    frozenRate: order.frozenExchangeRate,
    orderId: order.id,
    showTitle: BRAND.name,
  });
  const enlaceWhatsapp = order.sellerWhatsapp
    ? buildWhatsappLink(order.sellerWhatsapp, mensaje)
    : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.push("/activity")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="lv-topbar__title" style={{ fontSize: "1rem" }}>Orden #{order.id.slice(-6).toUpperCase()}</h1>
          <div className="lv-dim" style={{ fontSize: "0.7rem" }}>
            {order.createdAt?.toDate?.()?.toLocaleDateString("es-VE") ?? ""}
          </div>
        </div>
      </header>

      <div className="lv-pad" style={{ paddingTop: 18, display: "grid", gap: 14 }}>

        {/* Producto */}
        <section className="lv-panel" style={{ display: "flex", gap: 13, alignItems: "center" }}>
          <div style={{ width: 62, height: 62, borderRadius: 12, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
            {order.productImageURL && <img src={order.productImageURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.92rem", fontWeight: 750, lineHeight: 1.3 }}>{order.productTitle ?? "Producto"}</div>
            <div className="lv-dim" style={{ fontSize: "0.76rem", marginTop: 3 }}>Vendido por {order.sellerName}</div>
            <span className={`lv-badge ${e.clase}`} style={{ marginTop: 6 }}>{e.texto}</span>
          </div>
        </section>

        {e.detalle && <div className="lv-note">{e.detalle}</div>}

        {/* Acción del turno */}
        {accion && (
          <section className="lv-panel">
            <p className="lv-dim" style={{ fontSize: "0.79rem", lineHeight: 1.5, marginBottom: 12 }}>
              {accion.nota}
            </p>
            {errorEstado && <div className="lv-note lv-note--bad" style={{ marginBottom: 12 }}>{errorEstado}</div>}
            <button
              className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg"
              disabled={avanzando}
              onClick={() => avanzar(accion.estado, accion.extra)}
            >
              {avanzando ? "Guardando…" : accion.label}
            </button>
          </section>
        )}

        {soyVendedor && (
          <div className="lv-note">
            Estás viendo esta orden como <strong>vendedor</strong>.
            {order.buyerName ? ` Le vendiste a ${order.buyerName}.` : ""}
          </div>
        )}

        {/* Progreso */}
        {order.status !== "cancelled" && (
          <section className="lv-panel">
            <div style={{ display: "flex", position: "relative" }}>
              <div style={{ position: "absolute", top: 13, left: "12%", right: "12%", height: 2, background: "var(--surface-3)" }}/>
              <div style={{
                position: "absolute", top: 13, left: "12%", height: 2, background: "var(--accent)",
                width: `${Math.max(0, paso) / (PASOS.length - 1) * 76}%`, transition: "width 0.3s",
              }}/>
              {PASOS.map((p, i) => (
                <div key={p.clave} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative" }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: i <= paso ? "var(--accent)" : "var(--surface-2)",
                    color: i <= paso ? "var(--accent-ink)" : "var(--ink-4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <span style={{ fontSize: "0.58rem", fontWeight: 700, color: i <= paso ? "var(--accent)" : "var(--ink-3)", textAlign: "center" }}>
                    {p.corto}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Montos */}
        <section className="lv-panel">
          <div className="lv-eyebrow" style={{ marginBottom: 4 }}>Detalle</div>
          <div className="lv-row">
            <span className="lv-muted" style={{ fontSize: "0.83rem" }}>Monto en dólares</span>
            <strong>{formatUsd(order.bidAmountUsd)}</strong>
          </div>
          {order.bidAmountBs != null && (
            <div className="lv-row">
              <span className="lv-muted" style={{ fontSize: "0.83rem" }}>Monto en bolívares</span>
              <strong>{formatBs(order.bidAmountBs)}</strong>
            </div>
          )}
          {order.frozenExchangeRate != null && (
            <div className="lv-row">
              <span className="lv-muted" style={{ fontSize: "0.83rem" }}>Tasa congelada</span>
              <strong>{order.frozenExchangeRate} Bs/$</strong>
            </div>
          )}
          {order.commissionUsd != null && (
            <div className="lv-row">
              <span className="lv-muted" style={{ fontSize: "0.83rem" }}>Comisión de la plataforma</span>
              <strong>{formatUsd(order.commissionUsd)}</strong>
            </div>
          )}
        </section>

        {order.bidAmountBs == null && (
          <div className="lv-note lv-note--warn">
            Esta orden se cerró sin tasa de cambio configurada, por eso no tiene monto en bolívares.
          </div>
        )}

        {/* WhatsApp */}
        {["pending_payment", "payment_confirmed", "shipped"].includes(order.status) && (
          <a
            href={enlaceWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="lv-btn lv-btn--block lv-btn--lg"
            style={{ background: "#25D366", color: "#fff", textDecoration: "none" }}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
            </svg>
            Coordinar por WhatsApp
          </a>
        )}

        {/* Calificación: el último paso del ciclo. onRatingCreated
            recalcula el promedio del vendedor a partir de esto. */}
        {order.status === "delivered" && soyComprador && (
          <section className="lv-panel">
            {yaCalifique ? (
              <div className="lv-note lv-note--ok" style={{ justifyContent: "center" }}>
                Gracias por calificar a {order.sellerName}
              </div>
            ) : (
              <>
                <div style={{ fontSize: "0.94rem", fontWeight: 750, marginBottom: 3 }}>
                  ¿Cómo te fue con {order.sellerName}?
                </div>
                <p className="lv-dim" style={{ fontSize: "0.76rem", marginBottom: 14 }}>
                  Tu calificación es pública y afecta su reputación.
                </p>

                <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 14 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setEstrellas(n)}
                      aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                      aria-pressed={n <= estrellas}
                      style={{
                        width: 46, height: 46, borderRadius: 12,
                        background: n <= estrellas ? "var(--accent)" : "var(--surface-2)",
                        color: n <= estrellas ? "var(--accent-ink)" : "var(--ink-4)",
                        fontSize: "1.15rem", fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "background 0.15s ease",
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <textarea
                  className="lv-input"
                  rows={2}
                  maxLength={300}
                  value={comentario}
                  onChange={ev => setComentario(ev.target.value)}
                  placeholder="Un comentario (opcional)"
                  style={{ resize: "none", marginBottom: 12 }}
                  aria-label="Comentario"
                />

                {errorRating && <div className="lv-note lv-note--bad" style={{ marginBottom: 12 }}>{errorRating}</div>}

                <button
                  className="lv-btn lv-btn--accent lv-btn--block"
                  disabled={estrellas === 0 || enviando}
                  onClick={calificar}
                >
                  {enviando ? "Enviando…" : "Enviar calificación"}
                </button>
              </>
            )}
          </section>
        )}

        <button className="lv-btn lv-btn--soft lv-btn--block" onClick={() => router.push("/activity")}>
          Ver todas mis órdenes
        </button>
      </div>
    </div>
  );
}
