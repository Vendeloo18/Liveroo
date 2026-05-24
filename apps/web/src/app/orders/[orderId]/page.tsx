"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { formatUsd, formatBs, buildWhatsappMessage, buildWhatsappLink } from "@subastas-ve/shared";

export default function OrderPage() {
  const { orderId } = useParams() as { orderId: string };
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    return onSnapshot(doc(db, "orders", orderId), s => {
      if (s.exists()) setOrder({ id: s.id, ...s.data() });
    });
  }, [orderId]);

  if (!order) return (
    <div style={{ minHeight:"100vh", background:"#080818", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontSize:"0.88rem", color:"rgba(255,255,255,0.2)" }}>Cargando orden...</div>
    </div>
  );

  const statusConfig: Record<string, { label:string; color:string; bg:string }> = {
    pending_payment: { label:"Pago pendiente", color:"#F5C518", bg:"rgba(245,197,24,0.08)" },
    payment_confirmed: { label:"Pago confirmado", color:"#00c8ff", bg:"rgba(0,200,255,0.08)" },
    shipped: { label:"Enviado", color:"#a855f7", bg:"rgba(168,85,247,0.08)" },
    delivered: { label:"Entregado", color:"#4ade80", bg:"rgba(74,222,128,0.08)" },
    cancelled: { label:"Cancelado", color:"#ff4444", bg:"rgba(255,68,68,0.08)" },
  };

  const sc = statusConfig[order.status] ?? { label:order.status, color:"#888", bg:"rgba(255,255,255,0.04)" };

  const whatsappMsg = buildWhatsappMessage({
    buyerName: order.buyerName,
    productTitle: `Orden #${order.id.slice(-6).toUpperCase()}`,
    bidAmountUsd: order.bidAmountUsd,
    bidAmountBs: order.bidAmountBs,
    frozenRate: order.frozenExchangeRate,
    orderId: order.id,
    showTitle: "Liveroo",
  });

  const whatsappLink = order.sellerWhatsapp
    ? buildWhatsappLink(order.sellerWhatsapp, whatsappMsg)
    : `https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`;

  const STEPS = ["pending_payment","payment_confirmed","shipped","delivered"];
  const currentStep = STEPS.indexOf(order.status);

  return (
    <div style={{ minHeight:"100vh", background:"#080818", backgroundImage:"radial-gradient(ellipse 60% 30% at 50% 0%, rgba(168,85,247,0.05) 0%, transparent 60%)", fontFamily:"'Inter',-apple-system,sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:40 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 20px 0", marginBottom:24 }}>
        <button onClick={() => router.push("/activity")} style={{ width:38, height:38, background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 style={{ fontSize:"1.1rem", fontWeight:900, color:"#fff", letterSpacing:"-0.02em", lineHeight:1 }}>Orden #{order.id.slice(-6).toUpperCase()}</h1>
          <div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.3)", marginTop:2 }}>
            {order.createdAt?.toDate?.()?.toLocaleDateString("es-VE") ?? ""}
          </div>
        </div>
      </div>

      <div style={{ padding:"0 20px" }}>

        {/* Status */}
        <div style={{ background:sc.bg, border:`1px solid ${sc.color}30`, borderRadius:20, padding:"20px 24px", marginBottom:16, display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:`${sc.color}20`, border:`1px solid ${sc.color}40`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            {order.status === "delivered" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            ) : order.status === "cancelled" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            )}
          </div>
          <div>
            <div style={{ fontSize:"1rem", fontWeight:800, color:"#fff", marginBottom:4 }}>{sc.label}</div>
            <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.4)", lineHeight:1.5 }}>
              {order.status === "pending_payment" && "Coordina el pago con el vendedor por WhatsApp"}
              {order.status === "payment_confirmed" && "Pago recibido · Esperando envío del producto"}
              {order.status === "shipped" && "Producto en camino · Confirma al recibir"}
              {order.status === "delivered" && "Transacción completada · Fondos liberados al vendedor"}
              {order.status === "cancelled" && "Esta orden fue cancelada"}
            </div>
          </div>
        </div>

        {/* Progress steps */}
        {order.status !== "cancelled" && (
          <div style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:16, padding:"20px", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative" }}>
              {/* Line */}
              <div style={{ position:"absolute", top:14, left:"10%", right:"10%", height:2, background:"rgba(168,85,247,0.1)", zIndex:0 }}/>
              <div style={{ position:"absolute", top:14, left:"10%", height:2, background:"linear-gradient(90deg,#00c8ff,#a855f7)", zIndex:1, width:`${Math.max(0, currentStep) / (STEPS.length-1) * 80}%`, transition:"width 0.3s" }}/>
              {[
                { label:"Pago", icon:"M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z" },
                { label:"Confirmado", icon:"M20 6L9 17l-5-5" },
                { label:"Enviado", icon:"M5 12h14M12 5l7 7-7 7" },
                { label:"Entregado", icon:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
              ].map((step, i) => (
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, zIndex:2, flex:1 }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background: i <= currentStep ? "linear-gradient(135deg,#00c8ff,#a855f7)" : "rgba(255,255,255,0.05)", border:`1px solid ${i <= currentStep ? "transparent" : "rgba(168,85,247,0.15)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={i <= currentStep ? "#fff" : "rgba(255,255,255,0.2)"} strokeWidth="2.5" strokeLinecap="round">
                      <path d={step.icon}/>
                    </svg>
                  </div>
                  <div style={{ fontSize:"0.55rem", fontWeight:600, color: i <= currentStep ? "#fff" : "rgba(255,255,255,0.25)", textAlign:"center", letterSpacing:"0.04em" }}>{step.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order details */}
        <div style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:16, padding:"20px", marginBottom:16 }}>
          <div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.4)", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16 }}>Detalle de la orden</div>
          {[
            { label:"Vendedor", val: order.sellerName },
            { label:"Monto USD", val: formatUsd(order.bidAmountUsd) },
            { label:"Monto Bs", val: formatBs(order.bidAmountBs) },
            { label:"Tasa congelada", val: `${order.frozenExchangeRate} Bs/USD` },
            { label:"Comisión Liveroo", val: formatUsd(order.commissionAmountUsd ?? order.bidAmountUsd * 0.1) },
          ].map(row => (
            <div key={row.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:12, marginBottom:12, borderBottom:"1px solid rgba(168,85,247,0.06)" }}>
              <span style={{ fontSize:"0.78rem", color:"rgba(255,255,255,0.4)" }}>{row.label}</span>
              <span style={{ fontSize:"0.88rem", fontWeight:700, color:"#fff" }}>{row.val}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:"0.82rem", fontWeight:700, color:"rgba(255,255,255,0.6)" }}>Total pagado</span>
            <span style={{ fontSize:"1.1rem", fontWeight:900, color:"#fff" }}>{formatUsd(order.bidAmountUsd)}</span>
          </div>
        </div>

        {/* Escrow info */}
        <div style={{ background: order.escrowReleasedAt ? "rgba(74,222,128,0.06)" : "rgba(168,85,247,0.06)", border:`1px solid ${order.escrowReleasedAt ? "rgba(74,222,128,0.15)" : "rgba(168,85,247,0.12)"}`, borderRadius:14, padding:"14px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={order.escrowReleasedAt ? "#4ade80" : "#a855f7"} strokeWidth="2" strokeLinecap="round">
            {order.escrowReleasedAt
              ? <path d="M20 6L9 17l-5-5"/>
              : <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
            }
          </svg>
          <div>
            <div style={{ fontSize:"0.78rem", fontWeight:700, color: order.escrowReleasedAt ? "#4ade80" : "#a855f7", marginBottom:2 }}>
              {order.escrowReleasedAt ? "Fondos liberados" : "Fondos en custodia"}
            </div>
            <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.4)", lineHeight:1.5 }}>
              {order.escrowReleasedAt
                ? `Vendedor recibió ${formatUsd(order.sellerPaidAmountUsd)}`
                : "Liveroo libera los fondos cuando confirmes la entrega"
              }
            </div>
          </div>
        </div>

        {/* WhatsApp button */}
        {order.status === "pending_payment" && (
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, width:"100%", background:"#25D366", border:"none", borderRadius:14, padding:"15px", fontSize:"0.92rem", fontWeight:800, color:"#fff", textDecoration:"none", marginBottom:12, boxShadow:"0 0 20px rgba(37,211,102,0.3)" }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
            </svg>
            Coordinar pago con vendedor
          </a>
        )}

        <button onClick={() => router.push("/activity")} style={{ width:"100%", background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:14, padding:"13px", fontSize:"0.88rem", fontWeight:700, color:"#a855f7", cursor:"pointer", fontFamily:"inherit" }}>
          Ver todas mis órdenes
        </button>
      </div>
    </div>
  );
}
