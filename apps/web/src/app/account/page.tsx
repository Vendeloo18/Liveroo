"use client";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/authStore";


const MENU_ITEMS = [
  { label:"Mis Órdenes", sub:"Historial de compras", href:"/activity", icon:"M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z" },
  { label:"Mis Pujas", sub:"Subastas activas e historial", href:"/activity", icon:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
  { label:"Mi Billetera", sub:"Saldo, depósitos y movimientos", href:"/wallet", icon:"M20 12V22H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" },
  { label:"Notificaciones", sub:"Shows, pujas y órdenes", href:"/notifications", icon:"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" },
  { label:"Buscar", sub:"Shows y vendedores", href:"/search", icon:"M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" },
  { label:"Soporte", sub:"Centro de ayuda y contacto", href:"/support", icon:"M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" },
  { label:"Configuración", sub:"Preferencias de la app", href:"/settings", icon:"M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" },
];

export default function AccountPage() {
  const { profile, signOut } = useAuthStore();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080818", backgroundImage:"radial-gradient(ellipse 60% 30% at 50% 0%, rgba(168,85,247,0.06) 0%, transparent 60%)", fontFamily:"'Inter',-apple-system,sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:90 }}>

      <div style={{ padding:"24px 20px 0" }}>
        <h1 style={{ fontSize:"1.4rem", fontWeight:900, color:"#fff", letterSpacing:"-0.03em", marginBottom:20 }}>Mi Cuenta</h1>

        {/* Profile card */}
        <div style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:20, padding:"20px", marginBottom:16, display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:60, height:60, borderRadius:"50%", background:"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 0 20px rgba(168,85,247,0.3)", fontSize:"1.4rem", fontWeight:900, color:"#fff" }}>
            {profile?.displayName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"1.1rem", fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 }}>
              {profile?.displayName ?? "Usuario"}
            </div>
            <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.4)", marginBottom:8 }}>{profile?.email}</div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:5, background: profile?.role==="admin" ? "rgba(0,200,255,0.1)" : profile?.role==="seller" ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.05)", border:`1px solid ${profile?.role==="admin" ? "rgba(0,200,255,0.2)" : profile?.role==="seller" ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.1)"}`, borderRadius:20, padding:"3px 10px" }}>
              <span style={{ fontSize:"0.62rem", fontWeight:700, color: profile?.role==="admin" ? "#00c8ff" : profile?.role==="seller" ? "#a855f7" : "rgba(255,255,255,0.4)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                {profile?.role==="admin" ? "Admin" : profile?.role==="seller" ? "Vendedor" : "Comprador"}
              </span>
            </div>
          </div>
          <button style={{ background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.2)", borderRadius:10, padding:"8px 14px", fontSize:"0.75rem", fontWeight:700, color:"#a855f7", cursor:"pointer", fontFamily:"inherit" }}>
            Editar
          </button>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
          {[
            { label:"Compras", value: profile?.totalPurchases ?? 0 },
            { label:"Ventas", value: profile?.totalSales ?? 0 },
            { label:"Rating", value: profile?.ratingAvg ? `${profile.ratingAvg.toFixed(1)}★` : "—" },
          ].map(s => (
            <div key={s.label} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:14, padding:"14px 12px", textAlign:"center" }}>
              <div style={{ fontSize:"1.3rem", fontWeight:900, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 }}>{s.value}</div>
              <div style={{ fontSize:"0.62rem", color:"rgba(255,255,255,0.35)", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Admin shortcut */}
        {profile?.role==="admin" && (
          <button onClick={() => router.push("/admin")} style={{ width:"100%", background:"linear-gradient(135deg,rgba(0,200,255,0.08),rgba(168,85,247,0.1))", border:"1px solid rgba(0,200,255,0.2)", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", marginBottom:12, fontFamily:"inherit", textAlign:"left" }}>
            <div style={{ width:36, height:36, background:"rgba(0,200,255,0.1)", border:"1px solid rgba(0,200,255,0.2)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:"0.88rem", fontWeight:700, color:"#fff" }}>Panel Admin</div>
              <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.4)" }}>Gestionar la plataforma</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}

        {/* Menu items */}
        <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:16 }}>
          {MENU_ITEMS.map((item, i) => (
            <button
              key={i}
              onClick={() => router.push(item.href)}
              style={{ width:"100%", background:"transparent", border:"none", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", fontFamily:"inherit", textAlign:"left", transition:"background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background="rgba(168,85,247,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background="transparent")}
            >
              <div style={{ width:38, height:38, background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.7)" strokeWidth="2" strokeLinecap="round">
                  <path d={item.icon}/>
                </svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"0.88rem", fontWeight:700, color:"#fff" }}>{item.label}</div>
                <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.35)" }}>{item.sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        {/* Sign out */}
        <button onClick={handleSignOut} style={{ width:"100%", background:"rgba(255,45,45,0.06)", border:"1px solid rgba(255,45,45,0.12)", borderRadius:14, padding:"14px 16px", fontSize:"0.88rem", fontWeight:700, color:"rgba(255,100,100,0.8)", cursor:"pointer", fontFamily:"inherit", marginBottom:8 }}>
          Cerrar Sesión
        </button>

        <p style={{ textAlign:"center", fontSize:"0.62rem", color:"rgba(255,255,255,0.1)", marginBottom:8 }}>
          Liveroo v1.0.0 · Venezuela
        </p>
      </div>

      
    </div>
  );
}
