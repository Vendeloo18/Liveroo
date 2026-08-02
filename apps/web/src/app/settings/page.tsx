"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { estadoPush, activarPush, desactivarPush, type EstadoPush } from "../../lib/push";
import { BRAND } from "@subastas-ve/shared";

// "shows" sigue en el tipo y en los valores por defecto porque
// notifyShowStartingSoon ya existe y publica al topic seller_{id}. Lo que
// falta es que alguien se suscriba: no hay función de seguir vendedores,
// así que hoy ese aviso no le llega a nadie. El interruptor vuelve a la
// lista el día que existan los seguidores; mientras tanto ofrecerlo sería
// prometer algo que la app no puede cumplir.
interface Prefs { shows: boolean; pujas: boolean; ordenes: boolean; promo: boolean }

const POR_DEFECTO: Prefs = { shows: true, pujas: true, ordenes: true, promo: false };

const AVISOS: [keyof Prefs, string, string][] = [
  ["pujas", "Superaron tu oferta", "Para que puedas usar SUBELOO a tiempo"],
  ["ordenes", "Cambios en tus órdenes", "Pago confirmado, envío y entrega"],
  ["promo", "Novedades y promociones", `Ofertas y anuncios de ${BRAND.name}`],
];

function Interruptor({ activo, onChange, label }: { activo: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      aria-label={label}
      onClick={onChange}
      style={{
        width: 46, height: 27, borderRadius: 999, flexShrink: 0, position: "relative",
        background: activo ? "var(--accent)" : "var(--surface-3)", transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: activo ? 22 : 3, width: 21, height: 21,
        borderRadius: "50%", background: "var(--bg)", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }}/>
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();

  const [prefs, setPrefs] = useState<Prefs>(POR_DEFECTO);
  const [moneda, setMoneda] = useState<"usd" | "bs">("usd");
  const [ocupado, setOcupado] = useState(false);
  const [push, setPush] = useState<EstadoPush | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  // Se hidrata con lo que el usuario ya tenía guardado
  useEffect(() => {
    if (!profile) return;
    const p = (profile as any).notifPrefs as Partial<Prefs> | undefined;
    if (p) setPrefs({ ...POR_DEFECTO, ...p });
    const m = (profile as any).currencyPref;
    if (m === "usd" || m === "bs") setMoneda(m);
  }, [profile]);

  // El permiso del navegador es aparte de las preferencias: se puede
  // haber dado permiso y tener todo apagado, o al revés. Si hay permiso
  // pero el perfil no tiene token (otro navegador, o token borrado),
  // esto cuenta como apagado, porque no hay a dónde mandar.
  useEffect(() => {
    let vivo = true;
    estadoPush().then(e => {
      if (!vivo) return;
      setPush(e === "activo" && !(profile as any)?.fcmToken ? "pendiente" : e);
    });
    return () => { vivo = false; };
  }, [profile]);

  const alternarPush = async () => {
    if (!profile || pidiendo) return;
    setPidiendo(true);
    setAviso(null);
    try {
      if (push === "activo") {
        await desactivarPush(profile.uid);
        setPush("pendiente");
        setAviso({ tipo: "ok", texto: "Ya no recibirás avisos en este dispositivo" });
      } else {
        const nuevo = await activarPush(profile.uid);
        setPush(nuevo);
        if (nuevo === "activo") setAviso({ tipo: "ok", texto: "Avisos activados en este dispositivo" });
        else if (nuevo === "denegado") setAviso({ tipo: "bad", texto: "El navegador tiene los avisos bloqueados para este sitio" });
      }
    } finally {
      setPidiendo(false);
      setTimeout(() => setAviso(null), 5000);
    }
  };

  // Antes este botón solo mostraba "Guardado" sin escribir nada.
  const guardar = async () => {
    if (!profile) return;
    setOcupado(true);
    setAviso(null);
    try {
      await updateDoc(doc(db, "users", profile.uid), {
        notifPrefs: prefs,
        currencyPref: moneda,
        updatedAt: serverTimestamp(),
      });
      setAviso({ tipo: "ok", texto: "Preferencias guardadas" });
    } catch (e: any) {
      setAviso({ tipo: "bad", texto: e?.message ?? "No se pudieron guardar" });
    } finally {
      setOcupado(false);
      setTimeout(() => setAviso(null), 4000);
    }
  };

  if (!profile) {
    return (
      <div className="lv-app">
        <header className="lv-topbar">
          <button className="lv-icon-btn" onClick={() => router.push("/account")} aria-label="Atrás">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <h1 className="lv-topbar__title">Ajustes</h1>
        </header>
        <div className="lv-empty">
          <div className="lv-empty__title">Entra para cambiar tus ajustes</div>
          <button className="lv-btn lv-btn--primary" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.push("/account")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="lv-topbar__title">Ajustes</h1>
      </header>

      <div className="lv-pad" style={{ paddingTop: 18, display: "grid", gap: 14 }}>
        {aviso && <div className={`lv-note lv-note--${aviso.tipo}`}>{aviso.texto}</div>}

        {push && push !== "sin-configurar" && (
          <section className="lv-panel">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>Avisos en este dispositivo</div>
                <div className="lv-dim" style={{ fontSize: "0.74rem", marginTop: 3, lineHeight: 1.45 }}>
                  {push === "activo"
                    ? "Te llegan aunque tengas la app cerrada."
                    : push === "denegado"
                    ? "Están bloqueados en la configuración del navegador para este sitio. Hay que reactivarlos ahí."
                    : push === "no-soportado"
                    ? "Este navegador no los soporta. En iPhone hay que agregar la app a la pantalla de inicio primero."
                    : "Sin esto, los avisos solo se ven al abrir la app."}
                </div>
              </div>
              {push === "denegado" || push === "no-soportado" ? (
                <span className="lv-chip" style={{ flexShrink: 0, opacity: 0.6 }}>No disponible</span>
              ) : (
                <Interruptor
                  activo={push === "activo"}
                  label="Avisos en este dispositivo"
                  onChange={alternarPush}
                />
              )}
            </div>
            {pidiendo && <div className="lv-dim" style={{ fontSize: "0.74rem", marginTop: 8 }}>Un momento…</div>}
          </section>
        )}

        <section className="lv-panel" style={{ padding: "2px 16px" }}>
          <div className="lv-eyebrow" style={{ padding: "14px 0 2px" }}>Avisarme cuando…</div>
          {AVISOS.map(([clave, titulo, detalle]) => (
            <div key={clave} className="lv-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.86rem", fontWeight: 650 }}>{titulo}</div>
                <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 1 }}>{detalle}</div>
              </div>
              <Interruptor
                activo={prefs[clave]}
                label={titulo}
                onChange={() => setPrefs(p => ({ ...p, [clave]: !p[clave] }))}
              />
            </div>
          ))}
        </section>

        <section className="lv-panel">
          <div className="lv-eyebrow" style={{ marginBottom: 10 }}>Mostrar precios en</div>
          <div style={{ display: "flex", gap: 8 }}>
            {([["usd", "Dólares"], ["bs", "Bolívares"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setMoneda(v)} className={`lv-chip${moneda === v ? " lv-chip--active" : ""}`} style={{ flex: 1 }}>
                {label}
              </button>
            ))}
          </div>
          <p className="lv-dim" style={{ fontSize: "0.74rem", lineHeight: 1.5, marginTop: 10 }}>
            Las ofertas siempre se hacen en dólares. Los bolívares se calculan con la tasa
            del momento y se congelan al cerrar la venta.
          </p>
        </section>

        <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={ocupado} onClick={guardar}>
          {ocupado ? "Guardando…" : "Guardar preferencias"}
        </button>

        <section className="lv-panel" style={{ padding: "2px 16px" }}>
          <div className="lv-row">
            <span className="lv-muted" style={{ fontSize: "0.84rem" }}>Correo</span>
            <strong style={{ fontSize: "0.82rem" }}>{profile.email}</strong>
          </div>
          <div className="lv-row">
            <span className="lv-muted" style={{ fontSize: "0.84rem" }}>Cuenta</span>
            <strong style={{ fontSize: "0.82rem" }}>
              {profile.role === "admin" ? "Administrador" : profile.sellerStatus === "approved" ? "Vendedor" : "Comprador"}
            </strong>
          </div>
        </section>

        <section className="lv-panel" style={{ padding: "2px 16px" }}>
          {([["Términos y condiciones", "/terminos"], ["Privacidad", "/privacidad"], ["Soporte", "/support"]] as [string, string][]).map(([t, href]) => (
            <a key={href} href={href} className="lv-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", color: "inherit" }}>
              <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>{t}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </a>
          ))}
        </section>

        <button
          className="lv-btn lv-btn--soft lv-btn--block"
          style={{ color: "var(--live)" }}
          onClick={async () => { if (confirm("¿Cerrar sesión?")) { await signOut(); router.push("/login"); } }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
