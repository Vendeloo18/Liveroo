"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuthStore } from "../../../store/authStore";

const CATEGORIAS = [
  "Moda y Ropa", "Electronica", "Calzado", "Joyas y Relojes", "Hogar",
  "Colecciones", "Autos y Motos", "Deportes", "Arte", "Juguetes", "Comida", "Mascotas",
];

// buildWhatsappLink hace phone.replace(/\D/g,"") y arma wa.me/<digitos>,
// así que el número tiene que llevar código de país o el enlace no abre
// el chat correcto. Venezuela es 58 y se le quita el 0 inicial:
// 0414-1234567 → 584141234567
function normalizarWhatsapp(entrada: string): string | null {
  let d = entrada.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "58" + d.slice(1);       // 0414… → 58414…
  else if (d.length === 10) d = "58" + d;             // 414… → 58414…
  if (d.length < 11 || d.length > 15) return null;
  return d;
}

const mostrarWhatsapp = (d?: string) => {
  if (!d) return "";
  if (d.startsWith("58") && d.length === 12) return `+58 ${d.slice(2, 5)}-${d.slice(5)}`;
  return `+${d}`;
};

export default function EditProfilePage() {
  const router = useRouter();
  const { profile } = useAuthStore();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [shopName, setShopName] = useState("");
  const [sellerCat, setSellerCat] = useState("");

  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    setDisplayName(p.displayName ?? "");
    setUsername(p.username ?? "");
    setWhatsapp(mostrarWhatsapp(p.whatsapp));
    setCity(p.city ?? "");
    setShopName(p.shopName ?? "");
    setSellerCat(p.sellerCat ?? "");
  }, [profile]);

  const esVendedor = profile?.sellerStatus === "approved";

  const guardar = async () => {
    if (!profile) return;
    if (!displayName.trim()) {
      setAviso({ tipo: "bad", texto: "El nombre no puede quedar vacío" });
      return;
    }

    let numero: string | null = null;
    if (whatsapp.trim()) {
      numero = normalizarWhatsapp(whatsapp);
      if (!numero) {
        setAviso({ tipo: "bad", texto: "Ese número de WhatsApp no parece válido" });
        return;
      }
    } else if (esVendedor) {
      setAviso({ tipo: "bad", texto: "Como vendedor necesitas WhatsApp: es por donde te contactan los compradores" });
      return;
    }

    setOcupado(true);
    setAviso(null);
    try {
      await updateDoc(doc(db, "users", profile.uid), {
        displayName: displayName.trim(),
        username: username.trim().replace(/^@/, ""),
        whatsapp: numero,
        city: city.trim(),
        shopName: shopName.trim(),
        sellerCat: sellerCat || null,
        updatedAt: serverTimestamp(),
      });
      setAviso({ tipo: "ok", texto: "Perfil guardado" });
      setTimeout(() => router.push("/account"), 900);
    } catch (e: any) {
      setAviso({ tipo: "bad", texto: e?.message ?? "No se pudo guardar" });
    } finally {
      setOcupado(false);
    }
  };

  if (!profile) {
    return (
      <div className="lv-app">
        <div className="lv-empty">
          <div className="lv-empty__title">Entra para editar tu perfil</div>
          <button className="lv-btn lv-btn--primary" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>Entrar</button>
        </div>
      </div>
    );
  }

  const faltaWhatsapp = esVendedor && !(profile as any).whatsapp;

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.push("/account")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="lv-topbar__title">Editar perfil</h1>
      </header>

      <div className="lv-pad" style={{ paddingTop: 18 }}>
        {aviso && <div className={`lv-note lv-note--${aviso.tipo}`} style={{ marginBottom: 14 }}>{aviso.texto}</div>}

        {faltaWhatsapp && !aviso && (
          <div className="lv-note lv-note--warn" style={{ marginBottom: 14 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <strong>Te falta el WhatsApp.</strong> Sin él, quien gane tus subastas
              no tiene cómo escribirte para pagar.
            </div>
          </div>
        )}

        <div className="lv-field">
          <label className="lv-field__label" htmlFor="nombre">Nombre</label>
          <input id="nombre" className="lv-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Como quieres que te vean"/>
          <div className="lv-field__hint">Es público.</div>
        </div>

        <div className="lv-field">
          <label className="lv-field__label" htmlFor="usuario">Usuario</label>
          <input id="usuario" className="lv-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="tunombre"/>
        </div>

        <div className="lv-field">
          <label className="lv-field__label" htmlFor="wa">
            WhatsApp {esVendedor && <span style={{ color: "var(--live)" }}>· obligatorio para vender</span>}
          </label>
          <input
            id="wa" className="lv-input" type="tel" inputMode="tel"
            value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
            placeholder="0414-1234567"
          />
          <div className="lv-field__hint">
            Solo lo ve quien cierre una compra contigo, en su orden. No aparece en tu perfil público.
            {whatsapp.trim() && normalizarWhatsapp(whatsapp) && (
              <> · Se guardará como <strong>{mostrarWhatsapp(normalizarWhatsapp(whatsapp)!)}</strong></>
            )}
          </div>
        </div>

        <div className="lv-field">
          <label className="lv-field__label" htmlFor="ciudad">Ciudad</label>
          <input id="ciudad" className="lv-input" value={city} onChange={e => setCity(e.target.value)} placeholder="Caracas"/>
        </div>

        {esVendedor && (
          <>
            <div className="lv-field">
              <label className="lv-field__label" htmlFor="tienda">Nombre de tu tienda</label>
              <input id="tienda" className="lv-input" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="Opcional"/>
              <div className="lv-field__hint">Si lo pones, es lo que se muestra en tu perfil en vez de tu nombre.</div>
            </div>

            <div className="lv-field">
              <span className="lv-field__label">Qué vendes</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CATEGORIAS.map(c => (
                  <button key={c} onClick={() => setSellerCat(c === sellerCat ? "" : c)} className={`lv-chip${sellerCat === c ? " lv-chip--active" : ""}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <section className="lv-panel lv-panel--flat" style={{ marginBottom: 14 }}>
          <div className="lv-eyebrow" style={{ marginBottom: 6 }}>Privado</div>
          <div className="lv-row" style={{ borderBottom: "none", padding: "4px 0" }}>
            <span className="lv-muted" style={{ fontSize: "0.83rem" }}>Correo</span>
            <strong style={{ fontSize: "0.82rem" }}>{profile.email}</strong>
          </div>
          <p className="lv-dim" style={{ fontSize: "0.74rem", lineHeight: 1.5, marginTop: 6 }}>
            Tu correo no es público y no se puede cambiar desde aquí.
          </p>
        </section>

        <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={ocupado} onClick={guardar}>
          {ocupado ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
