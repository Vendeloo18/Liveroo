"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";


interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
  showId?: string;
  orderId?: string;
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  show_starting_soon: { color:"#F5C518", bg:"rgba(245,197,24,0.08)", icon:"M23 7 16 12 23 17 23 7zM1 5h15v14H1z" },
  outbid: { color:"#ff6b6b", bg:"rgba(255,107,107,0.08)", icon:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
  auction_won: { color:"#00c8ff", bg:"rgba(0,200,255,0.08)", icon:"M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z" },
  order_confirmed: { color:"#4ade80", bg:"rgba(74,222,128,0.08)", icon:"M20 6L9 17l-5-5" },
  deposit_confirmed: { color:"#a855f7", bg:"rgba(168,85,247,0.08)", icon:"M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
};

// Demo notifications para mostrar cuando no hay reales
const DEMO_NOTIFICATIONS: Notification[] = [
  { id:"n1", type:"auction_won", title:"Ganaste la subasta", body:"Nike Air Jordan 1 Retro es tuyo por $85.00", read:false, createdAt:null, orderId:"order001" },
  { id:"n2", type:"outbid", title:"Te superaron", body:"Alguien pujó $92.00 en iPhone 15 Pro. ¡Vuelve a pujar!", read:false, createdAt:null, showId:"show001" },
  { id:"n3", type:"show_starting_soon", title:"Show en 5 minutos", body:"CarlosVE comienza su show de Sneakers ahora mismo", read:true, createdAt:null, showId:"show001" },
  { id:"n4", type:"deposit_confirmed", title:"Depósito confirmado", body:"Tu depósito de $50.00 fue acreditado a tu billetera", read:true, createdAt:null },
  { id:"n5", type:"order_confirmed", title:"Pago confirmado", body:"El vendedor confirmó tu pago. Producto en camino.", read:true, createdAt:null, orderId:"order001" },
];

export default function NotificationsPage() {
  const { profile } = useAuthStore();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(DEMO_NOTIFICATIONS);
  const [filter, setFilter] = useState<"all"|"unread">("all");

  useEffect(() => {
    if (!profile) return;
    // En producción escucha notificaciones reales de Firestore
    // Por ahora usamos las demo
  }, [profile]);

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleTap = (notif: Notification) => {
    markRead(notif.id);
    if (notif.orderId) router.push(`/orders/${notif.orderId}`);
    else if (notif.showId) router.push(`/shows/${notif.showId}`);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications;

  const timeAgo = (createdAt: any) => {
    if (!createdAt) return "Ahora";
    const diff = Date.now() - createdAt.toMillis();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080818", backgroundImage:"radial-gradient(ellipse 60% 30% at 50% 0%, rgba(168,85,247,0.05) 0%, transparent 60%)", fontFamily:"'Inter',-apple-system,sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:80 }}>

      {/* Header */}
      <div style={{ padding:"20px 20px 0", marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <h1 style={{ fontSize:"1.4rem", fontWeight:900, color:"#fff", letterSpacing:"-0.03em" }}>Notificaciones</h1>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ background:"none", border:"none", color:"#a855f7", fontSize:"0.78rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Marcar todas como leídas
            </button>
          )}
        </div>
        {unreadCount > 0 && (
          <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.35)" }}>{unreadCount} sin leer</div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:8, padding:"0 20px", marginBottom:20 }}>
        {([
          { id:"all", label:"Todas" },
          { id:"unread", label:`Sin leer ${unreadCount > 0 ? `(${unreadCount})` : ""}` },
        ] as {id:"all"|"unread", label:string}[]).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ background:filter===f.id?"linear-gradient(135deg,rgba(0,200,255,0.15),rgba(168,85,247,0.2))":"rgba(13,13,32,0.9)", border:`1px solid ${filter===f.id?"rgba(168,85,247,0.35)":"rgba(168,85,247,0.08)"}`, borderRadius:20, padding:"8px 18px", fontSize:"0.78rem", fontWeight:700, color:filter===f.id?"#fff":"rgba(255,255,255,0.4)", cursor:"pointer", fontFamily:"inherit" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div style={{ padding:"0 20px", display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ width:56, height:56, background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.5)" strokeWidth="1.5" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div style={{ fontSize:"0.88rem", color:"rgba(255,255,255,0.2)" }}>Sin notificaciones</div>
          </div>
        )}

        {filtered.map(notif => {
          const config = TYPE_CONFIG[notif.type] ?? { color:"#a855f7", bg:"rgba(168,85,247,0.08)", icon:"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" };
          return (
            <div
              key={notif.id}
              onClick={() => handleTap(notif)}
              style={{ background: notif.read ? "rgba(13,13,32,0.9)" : "rgba(13,13,32,0.95)", border:`1px solid ${notif.read ? "rgba(168,85,247,0.08)" : "rgba(168,85,247,0.2)"}`, borderRadius:16, padding:"16px", display:"flex", alignItems:"flex-start", gap:14, cursor:"pointer", position:"relative", transition:"border-color 0.2s" }}
            >
              {/* Unread dot */}
              {!notif.read && (
                <div style={{ position:"absolute", top:16, right:16, width:8, height:8, borderRadius:"50%", background:"#a855f7", boxShadow:"0 0 8px #a855f7" }}/>
              )}

              {/* Icon */}
              <div style={{ width:44, height:44, borderRadius:14, background:config.bg, border:`1px solid ${config.color}20`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={config.icon}/>
                </svg>
              </div>

              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:"0.88rem", fontWeight: notif.read ? 600 : 800, color:"#fff", marginBottom:4, paddingRight:16 }}>{notif.title}</div>
                <div style={{ fontSize:"0.75rem", color:"rgba(255,255,255,0.5)", lineHeight:1.5, marginBottom:6 }}>{notif.body}</div>
                <div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.25)", fontWeight:600 }}>{timeAgo(notif.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>

      
    </div>
  );
}
