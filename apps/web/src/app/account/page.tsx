"use client";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/authStore";
import { BRAND } from "@subastas-ve/shared";

const MENU_ITEMS = [
  { label: "Mis órdenes", sub: "Compras y pujas", href: "/activity", icon: "M6 2l1.5 3h9L18 2M3 6h18l-1.5 13a2 2 0 0 1-2 1.8H6.5a2 2 0 0 1-2-1.8z" },
  { label: "Mi billetera", sub: "Saldo y movimientos", href: "/wallet", icon: "M20 12V22H4V12M22 7H2v5h20V7zM12 22V7" },
  { label: "Notificaciones", sub: "Shows, pujas y órdenes", href: "/notifications", icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" },
  { label: "Soporte", sub: "Centro de ayuda", href: "/support", icon: "M12 17h.01M12 14a2 2 0 0 1 .5-1.3l1.2-1.2A2.5 2.5 0 1 0 9.5 9.5M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z" },
  { label: "Configuración", sub: "Preferencias de la app", href: "/settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" },
];

const ETIQUETA_VENDEDOR: Record<string, { texto: string; clase: string }> = {
  approved: { texto: "Vendedor verificado", clase: "lv-badge--accent" },
  pending: { texto: "Solicitud en revisión", clase: "lv-badge--soft" },
  suspended: { texto: "Cuenta suspendida", clase: "lv-badge--live" },
};

export default function AccountPage() {
  const { profile, signOut } = useAuthStore();
  const router = useRouter();

  const salir = async () => {
    if (!confirm("¿Cerrar sesión?")) return;
    await signOut();
    router.push("/login");
  };

  if (!profile) {
    return (
      <div className="lv-app">
        <div className="lv-empty">
          <div className="lv-empty__title">No has iniciado sesión</div>
          <div className="lv-empty__text">Entra para ver tus pujas, órdenes y perfil.</div>
          <button className="lv-btn lv-btn--primary" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>
            Entrar
          </button>
        </div>
      </div>
    );
  }

  const etiqueta = profile.sellerStatus ? ETIQUETA_VENDEDOR[profile.sellerStatus] : undefined;
  const esAdmin = profile.role === "admin";

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <h1 className="lv-topbar__title" style={{ fontSize: "1.15rem", fontWeight: 850 }}>Mi cuenta</h1>
      </header>

      <div className="lv-pad" style={{ paddingTop: 18, display: "grid", gap: 14 }}>

        {/* Sin WhatsApp el comprador que gane no tiene cómo escribirle */}
        {profile.sellerStatus === "approved" && !(profile as any).whatsapp && (
          <button className="lv-note lv-note--warn" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push("/account/edit")}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <strong>Falta tu WhatsApp.</strong> Quien gane tus subastas no tiene cómo
              contactarte para pagar. Toca aquí para agregarlo.
            </div>
          </button>
        )}

        {/* Perfil */}
        <button className="lv-panel" style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left" }} onClick={() => router.push("/account/edit")}>
          {(profile as any).avatar
            ? <img className="lv-avatar" style={{ width: 56, height: 56 }} src={(profile as any).avatar} alt=""/>
            : <span className="lv-avatar" style={{ width: 56, height: 56, fontSize: "1.3rem", background: "var(--accent)", color: "var(--accent-ink)" }}>
                {profile.displayName?.[0]?.toUpperCase() ?? "?"}
              </span>}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {profile.displayName ?? "Usuario"}
            </div>
            <div className="lv-dim" style={{ fontSize: "0.76rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile.email}
            </div>
            {etiqueta && (
              <span className={`lv-badge ${etiqueta.clase}`} style={{ marginTop: 7 }}>{etiqueta.texto}</span>
            )}
          </div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>

        {/* Métricas */}
        <div className="lv-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            ["Compras", profile.totalPurchases ?? 0],
            ["Ventas", profile.totalSales ?? 0],
            ["Rating", profile.ratingAvg ? `${profile.ratingAvg.toFixed(1)}★` : "—"],
          ].map(([label, valor]) => (
            <div key={String(label)} className="lv-panel" style={{ padding: "13px 12px", textAlign: "center" }}>
              <div className="lv-price" style={{ fontSize: "1.15rem" }}>{valor}</div>
              <div className="lv-eyebrow" style={{ marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Vender */}
        {profile.sellerStatus === "approved" ? (
          <>
            <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" onClick={() => router.push("/seller")}>
              Panel de vendedor
            </button>
            <button className="lv-panel" onClick={() => router.push("/ventas")} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%" }}>
              <span className="lv-avatar" style={{ background: "var(--accent-tint)", color: "var(--accent-strong)", borderRadius: 11 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2l1.5 3h9L18 2M3 6h18l-1.5 13a2 2 0 0 1-2 1.8H6.5a2 2 0 0 1-2-1.8z"/></svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 750 }}>Mis ventas</div>
                <div className="lv-dim" style={{ fontSize: "0.74rem" }}>Quién compró qué · pagos y envíos</div>
              </div>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </>
        ) : (
          <section className="lv-panel">
            <div style={{ fontSize: "0.92rem", fontWeight: 750, marginBottom: 4 }}>{`¿Quieres vender en ${BRAND.name}?`}</div>
            <p className="lv-dim" style={{ fontSize: "0.79rem", lineHeight: 1.5, marginBottom: 12 }}>
              {profile.sellerStatus === "pending"
                ? "Tu solicitud está en revisión. Te avisamos cuando la aprueben."
                : "Un administrador revisa cada cuenta antes de habilitarla para publicar subastas."}
            </p>
            <button
              className="lv-btn lv-btn--outline lv-btn--block"
              disabled={profile.sellerStatus === "pending"}
              onClick={() => router.push("/seller")}
            >
              {profile.sellerStatus === "pending" ? "En revisión" : "Quiero vender"}
            </button>
          </section>
        )}

        {/* Admin */}
        {esAdmin && (
          <button className="lv-panel" onClick={() => router.push("/admin")} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%" }}>
            <span className="lv-avatar" style={{ background: "var(--accent)", color: "var(--accent-ink)", borderRadius: 11 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 750 }}>Administración</div>
              <div className="lv-dim" style={{ fontSize: "0.74rem" }}>Vendedores, tasa y comisión</div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}

        {/* Menú */}
        <section className="lv-panel" style={{ padding: "4px 16px" }}>
          {MENU_ITEMS.map(item => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="lv-row"
              style={{ width: "100%", textAlign: "left" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon}/>
                </svg>
                <span>
                  <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 650 }}>{item.label}</span>
                  <span className="lv-dim" style={{ display: "block", fontSize: "0.72rem" }}>{item.sub}</span>
                </span>
              </span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </section>

        <button className="lv-btn lv-btn--soft lv-btn--block" onClick={salir} style={{ color: "var(--live)" }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
