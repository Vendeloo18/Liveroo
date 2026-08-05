"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { BRAND, formatUsd } from "@subastas-ve/shared";
import { ImageUploader } from "../../components/ui/ImageUploader";
import { Logo } from "../../components/ui/Logo";
import { useCountdown } from "../../hooks/useCountdown";
import {
  CATEGORIAS,
  CIUDADES_VENEZUELA,
  cedulaVenezolanaValida,
  formatearCedulaVenezolana,
  formatearTelefonoVenezolano,
  telefonoVenezolanoValido,
} from "../../lib/marketplace";

type Pantalla = "hub" | "subasta";

const DURACIONES: [string, string][] = [
  ["6", "6 horas"], ["24", "1 día"], ["72", "3 días"], ["168", "7 días"],
];

const ESTADO: Record<string, { texto: string; clase: string }> = {
  waiting: { texto: "En cola", clase: "lv-badge--soft" },
  active: { texto: "Activa", clase: "lv-badge--accent" },
  sold: { texto: "Vendida", clase: "lv-badge--accent" },
  unsold: { texto: "Sin ganador", clase: "lv-badge--soft" },
  skipped: { texto: "Saltada", clase: "lv-badge--soft" },
  cancelled: { texto: "Cancelada", clase: "lv-badge--soft" },
  draft: { texto: "Borrador", clase: "lv-badge--soft" },
  scheduled: { texto: "Programado", clase: "lv-badge--soft" },
  live: { texto: "EN VIVO", clase: "lv-badge--live" },
  ended: { texto: "Terminado", clase: "lv-badge--soft" },
};

// Qué le toca al VENDEDOR en cada estado de la orden. No es el estado
// crudo: es la frase que le dice qué tiene que hacer ahora.
const ORDEN: Record<string, { texto: string; tuTurno?: boolean }> = {
  pending_payment: { texto: "Confirma que te pagaron", tuTurno: true },
  payment_confirmed: { texto: "Despacha el producto", tuTurno: true },
  shipped: { texto: "Enviado — esperando al comprador" },
  delivered: { texto: "Entregado" },
  cancelled: { texto: "Cancelada" },
  disputed: { texto: "En disputa" },
};

function FilaOrden({ o, onClick }: { o: any; onClick: () => void }) {
  const e: { texto: string; tuTurno?: boolean } = ORDEN[o.status] ?? { texto: o.status };
  return (
    <button className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <div style={{ width: 46, height: 46, borderRadius: 11, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
          {o.productImageURL && <img src={o.productImageURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.86rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {o.productTitle ?? "Producto"}
          </div>
          <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 1 }}>
            {formatUsd(o.bidAmountUsd ?? 0)} · {o.buyerName ?? "Comprador"}
          </div>
          <span className={`lv-badge ${e.tuTurno ? "lv-badge--accent" : "lv-badge--soft"}`} style={{ marginTop: 4 }}>
            {e.texto}
          </span>
        </div>
      </div>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );
}

function FilaSubasta({ a, onClick }: { a: any; onClick: () => void }) {
  const { texto, vencida } = useCountdown(a.endsAt);
  const e = ESTADO[a.status] ?? { texto: a.status, clase: "lv-badge--soft" };
  const foto = a.imageURL ?? a.imageURLs?.[0];

  const activa = a.status === "active" && !vencida;
  const pujas = a.bidsCount ?? 0;

  return (
    <button className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 54, height: 54, borderRadius: 13, overflow: "hidden", flexShrink: 0, background: foto ? "var(--surface-2)" : "var(--accent-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {foto
            ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.title}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
            <span className="lv-price" style={{ fontSize: "1.1rem" }}>{formatUsd(a.currentBidUsd ?? 0)}</span>
            <span className="lv-dim" style={{ fontSize: "0.72rem" }}>{pujas} {pujas === 1 ? "oferta" : "ofertas"}</span>
          </div>
          {activa
            ? <span className="lv-badge lv-badge--data" style={{ marginTop: 5, fontSize: "0.62rem" }}>{texto}</span>
            : <span className={`lv-badge ${e.clase}`} style={{ marginTop: 5 }}>{e.texto}</span>}
        </div>
      </div>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  );
}

export default function SellerPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [pantalla, setPantalla] = useState<Pantalla>("hub");
  const [shows, setShows] = useState<any[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [ventas, setVentas] = useState<any[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  // Formulario de subasta suelta
  const [tSub, setTSub] = useState("");
  const [dSub, setDSub] = useState("");
  const [precio, setPrecio] = useState("");
  const [incremento, setIncremento] = useState("1");
  const [duracion, setDuracion] = useState("24");
  const [catSub, setCatSub] = useState("Moda y Ropa");
  const [fotosSub, setFotosSub] = useState<string[]>([]);

  // Solicitud de vendedor (estado no-aprobado)
  const [solTienda, setSolTienda] = useState("");
  const [solCat, setSolCat] = useState("Moda y Ropa");
  const [solCedula, setSolCedula] = useState(formatearCedulaVenezolana((profile as any)?.cedula ?? ""));
  const [solWhatsapp, setSolWhatsapp] = useState(formatearTelefonoVenezolano((profile as any)?.whatsapp ?? (profile as any)?.phone ?? ""));
  const [solCiudad, setSolCiudad] = useState((profile as any)?.city ?? "");
  const [solOcupado, setSolOcupado] = useState(false);
  const [avisoSolicitud, setAvisoSolicitud] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    setSolCedula(actual => actual !== "V-" ? actual : formatearCedulaVenezolana(p.cedula || ""));
    setSolWhatsapp(actual => actual !== "+58" ? actual : formatearTelefonoVenezolano(p.whatsapp || p.phone || ""));
    setSolCiudad(actual => actual || p.city || "");
    setSolTienda(actual => actual || p.shopName || "");
    setSolCat(actual => p.sellerCat || actual);
  }, [profile]);

  useEffect(() => {
    if (profile?.sellerStatus === "pending") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [profile?.sellerStatus]);

  const mensajeSolicitud = (error: any) => {
    const code = String(error?.code ?? "");
    if (code.includes("permission-denied")) {
      return "No pudimos guardar tu solicitud. Actualiza la app e inténtalo nuevamente.";
    }
    if (code.includes("unavailable") || code.includes("network")) {
      return "Parece que estás sin conexión. Revisa tu internet y vuelve a intentar.";
    }
    return "No pudimos enviar la solicitud. Tus datos siguen aquí para que lo intentes otra vez.";
  };

  const enviarSolicitudVendedor = async () => {
    if (!profile) return;
    if (solTienda.trim().length < 3) { setAvisoSolicitud({ tipo: "bad", texto: "El nombre de la tienda necesita al menos 3 caracteres" }); return; }
    if (!cedulaVenezolanaValida(solCedula)) { setAvisoSolicitud({ tipo: "bad", texto: "Escribe una cédula válida, por ejemplo V-12345678" }); return; }
    if (!telefonoVenezolanoValido(solWhatsapp)) { setAvisoSolicitud({ tipo: "bad", texto: "Escribe los 10 dígitos de tu WhatsApp después de +58" }); return; }
    if (!CIUDADES_VENEZUELA.includes(solCiudad as any)) { setAvisoSolicitud({ tipo: "bad", texto: "Selecciona tu ciudad" }); return; }
    setSolOcupado(true);
    setAvisoSolicitud(null);
    try {
      // Las reglas solo permiten este movimiento: none → pending, con los
      // datos de la tienda en la misma escritura. Aprobar es del admin.
      await updateDoc(doc(db, "users", profile.uid), {
        sellerStatus: "pending",
        shopName: solTienda.trim(),
        sellerCat: solCat,
        cedula: solCedula,
        whatsapp: `+${solWhatsapp.replace(/\D/g, "")}`,
        city: solCiudad,
        updatedAt: serverTimestamp(),
      });
      setAvisoSolicitud({ tipo: "ok", texto: "¡Solicitud enviada! Te avisamos cuando esté aprobada." });
    } catch (e: any) {
      setAvisoSolicitud({ tipo: "bad", texto: mensajeSolicitud(e) });
    } finally {
      setSolOcupado(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    const u1 = onSnapshot(
      query(collection(db, "shows"), where("sellerId", "==", profile.uid), orderBy("createdAt", "desc")),
      s => setShows(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("shows:", e.code));
    const u2 = onSnapshot(
      query(collection(db, "auctions"), where("sellerId", "==", profile.uid), orderBy("createdAt", "desc")),
      s => setAuctions(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("auctions:", e.code));
    // Las órdenes son la mitad del trabajo del vendedor —confirmar el pago,
    // despachar— y no se veían en ninguna pantalla: solo se llegaba a ellas
    // por el link del aviso. Por eso el panel "no decía nada".
    const u3 = onSnapshot(
      query(collection(db, "orders"), where("sellerId", "==", profile.uid), orderBy("createdAt", "desc")),
      s => setVentas(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("orders:", e.code));
    return () => { u1(); u2(); u3(); };
  }, [profile]);

  const avisar = (tipo: "ok" | "bad", texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 5000);
  };

  // El motor copia sellerWhatsapp a cada orden. Sin número, el ganador
  // se queda sin forma de coordinar y la venta muere ahí. El aviso solo
  // no bastaba: había que impedir publicar.
  const faltaWhatsapp = () => {
    if ((profile as any)?.whatsapp) return false;
    avisar("bad", "Agrega tu WhatsApp antes de publicar: por ahí te escribe quien gane.");
    setTimeout(() => router.push("/account/edit"), 1200);
    return true;
  };

  const crearSubasta = async () => {
    if (!tSub.trim() || !precio || !profile) return;
    if (faltaWhatsapp()) return;
    setOcupado(true);
    try {
      const p = parseFloat(precio);
      const ref = await addDoc(collection(db, "auctions"), {
        mode: "standalone", showId: null,
        sellerId: profile.uid, sellerName: profile.displayName ?? "Vendedor",
        title: tSub.trim(), description: dSub.trim(), category: catSub,
        startingPriceUsd: p, currentBidUsd: p, minIncrementUsd: parseFloat(incremento),
        status: "active",
        endsAt: new Date(Date.now() + parseInt(duracion) * 3600_000),
        bidsCount: 0, currentBidderId: null, winnerId: null, orderId: null, sortOrder: null,
        imageURL: fotosSub[0] ?? null, imageURLs: fotosSub,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setTSub(""); setDSub(""); setPrecio(""); setFotosSub([]);
      setPantalla("hub");
      router.push(`/auctions/${ref.id}`);
    } catch (e: any) {
      avisar("bad", e.message ?? "No se pudo publicar");
    } finally { setOcupado(false); }
  };

  // Salir en vivo es UN toque. Antes eran tres pantallas —el hub, una
  // ficha con título y categoría, y un "todo listo" — para decidir
  // exactamente nada: los dos campos venían pre-llenados del perfil. El
  // título se puede cambiar después, desde el propio panel del vivo.
  const salirEnVivo = async () => {
    if (!profile || ocupado) return;
    if (faltaWhatsapp()) return;

    // Si ya tiene uno abierto, volver a ese en vez de acumular shows
    // fantasma que después salen en su tienda sin haber transmitido nunca.
    const abierto = shows.find(s => s.status === "live")
      ?? shows.find(s => ["scheduled", "draft"].includes(s.status));
    if (abierto) {
      router.push(`/seller/show/${abierto.id}${abierto.status === "live" ? "" : "?vivo=1"}`);
      return;
    }

    setOcupado(true);
    try {
      const p = profile as any;
      const tienda = p.shopName || profile.displayName || "Vendedor";
      const ref = await addDoc(collection(db, "shows"), {
        sellerId: profile.uid, sellerName: profile.displayName ?? "Vendedor",
        title: `${tienda} en vivo`.slice(0, 120), description: "",
        category: p.sellerCat || "Moda y Ropa",
        // Sin agoraChannelName a propósito: el canal de video es el id del
        // show, que lo pone el servidor. Cuando lo escribía el cliente se
        // podía copiar el canal de otro vendedor y entrar con cámara a su
        // transmisión, así que las reglas ya no aceptan ese campo.
        status: "scheduled",
        viewerCount: 0, totalProducts: 0,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      // ?vivo=1: el panel llama a startShow y prende la cámara solo. El
      // ocupado NO se limpia a propósito — estamos navegando, y así el
      // botón no acepta un segundo toque que crearía un show de más.
      router.push(`/seller/show/${ref.id}?vivo=1`);
    } catch (e: any) {
      avisar("bad", e.message ?? "No se pudo salir en vivo");
      setOcupado(false);
    }
  };

  // ── Puertas ──
  if (!profile) {
    return (
      <div className="lv-app lv-app--aurora">
        <header className="lv-topbar"><h1 className="lv-topbar__title">Vender</h1></header>
        <div className="lv-empty">
          <div className="lv-empty__title">Entra para vender</div>
          <button className="lv-btn lv-btn--primary" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>Entrar</button>
        </div>
      </div>
    );
  }

  if (profile.sellerStatus !== "approved") {
    const enRevision = profile.sellerStatus === "pending";
    const suspendido = profile.sellerStatus === "suspended";
    const solicitudLista = solTienda.trim().length >= 3
      && cedulaVenezolanaValida(solCedula)
      && telefonoVenezolanoValido(solWhatsapp)
      && CIUDADES_VENEZUELA.includes(solCiudad as any);
    return (
      <div className="lv-app seller-apply">
        <header className="seller-apply__hero">
          <Logo tamano={29} color="#fff" />
          <Logo variante="simbolo" tamano={250} color="var(--accent-light)" className="seller-apply__watermark" />
          <div className="seller-apply__hero-copy">
            <div className="lv-eyebrow">Tu próxima venta empieza aquí</div>
            <h1 className="lv-display">Vende lo tuyo.<br/>Llega a todo el país.</h1>
            <p>Crea ventas en vivo, publica productos y construye una tienda que la gente quiera seguir.</p>
          </div>
        </header>

        <main className="seller-apply__sheet">
          {avisoSolicitud && !enRevision && (
            <div role="alert" className={`lv-note lv-note--${avisoSolicitud.tipo} seller-apply__notice`}>
              {avisoSolicitud.texto}
            </div>
          )}

          {suspendido ? (
            <section className="seller-apply__status-card">
              <span className="seller-apply__status-kicker">Cuenta en pausa</span>
              <h2>Vamos a revisar tu caso.</h2>
              <p>Tu tienda no puede publicar por el momento. El equipo de Vendeloo puede ayudarte a entender qué pasó y recuperarla.</p>
              <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" onClick={() => router.push("/support")}>
                Hablar con soporte
              </button>
            </section>
          ) : enRevision ? (
            <section className="seller-apply__status-card">
              <span className="seller-apply__status-kicker seller-apply__status-kicker--ok">Solicitud recibida</span>
              <h2>Tu tienda está en revisión.</h2>
              <p>Estamos verificando la información de <strong>{(profile as any).shopName || "tu tienda"}</strong>. Cuando la aprobemos, aparecerán aquí las opciones para publicar y vender en vivo.</p>
              <div className="seller-apply__timeline" aria-label="Estado de la solicitud">
                <div className="is-done"><span>1</span><div><b>Solicitud enviada</b><small>Información recibida</small></div></div>
                <div className="is-current"><span>2</span><div><b>Revisión de Vendeloo</b><small>Estamos validando tu tienda</small></div></div>
                <div><span>3</span><div><b>Lista para vender</b><small>Publica tu primera venta</small></div></div>
              </div>
              <button className="lv-btn lv-btn--soft lv-btn--block" onClick={() => router.push("/account")}>
                Volver a mi cuenta
              </button>
            </section>
          ) : (
            <>
              <section className="seller-apply__benefits" aria-label="Cómo funciona">
                <div><span>01</span><p><b>Cuéntanos qué vendes</b><small>Solo toma un minuto</small></p></div>
                <div><span>02</span><p><b>Revisamos tu tienda</b><small>Protegemos a la comunidad</small></p></div>
                <div><span>03</span><p><b>Empieza a vender</b><small>Ventas en vivo y por tiempo</small></p></div>
              </section>

              <form className="seller-apply__form" onSubmit={e => { e.preventDefault(); enviarSolicitudVendedor(); }}>
                <div className="seller-apply__form-head">
                  <div>
                    <span className="lv-eyebrow">Solicitud de vendedor</span>
                    <h2>Hablemos de tu tienda</h2>
                  </div>
                  <span>1 min</span>
                </div>

                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="sol-tienda">Nombre de tu tienda</label>
                  <input id="sol-tienda" className="lv-input" value={solTienda} onChange={e => setSolTienda(e.target.value)}
                    placeholder="Ej: Tecno Caracas" maxLength={40} autoComplete="organization"/>
                </div>

                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="sol-cat">Categoría principal</label>
                  <select id="sol-cat" className="lv-input seller-apply__select" value={solCat} onChange={e => setSolCat(e.target.value)}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="sol-cedula">Cédula de identidad</label>
                  <input id="sol-cedula" className="lv-input" type="text" inputMode="numeric" value={solCedula}
                    onChange={e => setSolCedula(formatearCedulaVenezolana(e.target.value))}
                    placeholder="V-12345678" maxLength={11} autoComplete="off"/>
                  <div className="lv-field__hint">La usamos únicamente para verificar tu identidad como vendedor.</div>
                </div>

                <div className="seller-apply__form-grid">
                  <div className="lv-field">
                    <label className="lv-field__label" htmlFor="sol-wa">WhatsApp</label>
                    <input id="sol-wa" className="lv-input" type="tel" inputMode="tel" value={solWhatsapp}
                      onChange={e => setSolWhatsapp(formatearTelefonoVenezolano(e.target.value))}
                      placeholder="+58 4141234567" maxLength={14} autoComplete="tel"/>
                  </div>
                  <div className="lv-field">
                    <label className="lv-field__label" htmlFor="sol-ciudad">Ciudad</label>
                    <select id="sol-ciudad" className="lv-input seller-apply__select" value={solCiudad}
                      onChange={e => setSolCiudad(e.target.value)} autoComplete="address-level2">
                      <option value="" disabled>Selecciona tu ciudad</option>
                      {CIUDADES_VENEZUELA.map(ciudad => <option key={ciudad} value={ciudad}>{ciudad}</option>)}
                    </select>
                  </div>
                </div>

                <p className="seller-apply__privacy">Revisamos cada solicitud para mantener compras y ventas más seguras. Tu cédula y WhatsApp son privados y no aparecen en tu perfil.</p>

                <button type="submit" className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={solOcupado || !solicitudLista}>
                  {solOcupado ? "Enviando…" : `Quiero vender en ${BRAND.name}`}
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    );
  }

  // Solo lo que está vivo: subastas sueltas activas y shows sin terminar.
  const activas = auctions.filter(a => a.mode !== "live" && a.status === "active");
  const showsActivos = shows.filter(s => !["ended", "cancelled"].includes(s.status));
  const enVivoAhora = shows.find(s => s.status === "live");

  // Lo que el vendedor tiene que MOVER hoy: confirmar un pago o despachar.
  // Va primero porque es lo único de esta pantalla con una fecha encima.
  const teToca = ventas.filter(o => ["pending_payment", "payment_confirmed"].includes(o.status));
  // Su parte de todo lo vendido (ya descontada la comisión), sin contar
  // lo cancelado. Es la cifra que de verdad le interesa ver al entrar.
  const ganado = ventas
    .filter(o => o.status !== "cancelled")
    .reduce((s, o) => s + (o.payoutUsd ?? o.sellerReceivesUsd ?? o.bidAmountUsd ?? 0), 0);

  const shopName = (profile as any).shopName || profile.displayName || "Mi tienda";
  const avatar = (profile as any).avatar as string | undefined;

  const Encabezado = ({ titulo }: { titulo: string }) => (
    <header className="lv-topbar">
      {pantalla !== "hub" && (
        <button className="lv-icon-btn" onClick={() => setPantalla("hub")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
      )}
      <h1 className="lv-topbar__title">{titulo}</h1>
    </header>
  );

  // ══ Publicar subasta suelta ══
  if (pantalla === "subasta") {
    return (
      <div className="lv-app lv-app--aurora">
        <Encabezado titulo="Publicar una venta"/>
        <div className="lv-pad" style={{ paddingTop: 18 }}>
          {aviso && <div className={`lv-note lv-note--${aviso.tipo}`} style={{ marginBottom: 14 }}>{aviso.texto}</div>}

          <div className="lv-field">
            <span className="lv-field__label">Fotos</span>
            <ImageUploader images={fotosSub} onChange={setFotosSub} path={`auctions/${profile.uid}`} max={5}/>
          </div>

          <div className="lv-field">
            <label className="lv-field__label" htmlFor="t">¿Qué vendes?</label>
            <input id="t" className="lv-input" value={tSub} onChange={e => setTSub(e.target.value)} placeholder="Tenis Nike Air Max 270 talla 42"/>
          </div>

          <div className="lv-field">
            <label className="lv-field__label" htmlFor="d">Descripción</label>
            <textarea id="d" className="lv-input" rows={3} value={dSub} onChange={e => setDSub(e.target.value)} placeholder="Estado, talla, detalles…"/>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="lv-field">
              <label className="lv-field__label" htmlFor="p">Precio inicial (USD)</label>
              <input id="p" className="lv-input" type="number" inputMode="decimal" min="0.5" step="0.5" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="20"/>
            </div>
            <div className="lv-field">
              <label className="lv-field__label" htmlFor="i">Incremento mínimo</label>
              <input id="i" className="lv-input" type="number" inputMode="decimal" min="0.5" step="0.5" value={incremento} onChange={e => setIncremento(e.target.value)}/>
            </div>
          </div>

          <div className="lv-field">
            <span className="lv-field__label">Duración</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DURACIONES.map(([v, label]) => (
                <button key={v} onClick={() => setDuracion(v)} className={`lv-chip${duracion === v ? " lv-chip--active" : ""}`}>{label}</button>
              ))}
            </div>
          </div>

          <div className="lv-field">
            <span className="lv-field__label">Categoría</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CATEGORIAS.map(c => (
                <button key={c} onClick={() => setCatSub(c)} className={`lv-chip${catSub === c ? " lv-chip--active" : ""}`}>{c}</button>
              ))}
            </div>
          </div>

          <div className="lv-note" style={{ marginBottom: 14 }}>
            Una vez publicada y con ofertas, ya no podrás cambiarle el precio ni borrarla.
          </div>

          <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={ocupado || !tSub.trim() || !precio} onClick={crearSubasta}>
            {ocupado ? "Publicando…" : "Publicar venta"}
          </button>
        </div>
      </div>
    );
  }

  // ══ Hub ══
  return (
    <div className="lv-app lv-app--aurora">
      <header className="lv-topbar">
        <h1 className="lv-topbar__title">Vender</h1>
        <button className="lv-icon-btn lv-icon-btn--bare" style={{ marginLeft: "auto" }} onClick={() => router.push(`/seller/${profile.uid}`)} aria-label="Ver mi tienda">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14L21 3"/></svg>
        </button>
      </header>

      <div className="lv-pad" style={{ paddingTop: 16, display: "grid", gap: 14 }}>
        {aviso && <div className={`lv-note lv-note--${aviso.tipo}`}>{aviso.texto}</div>}

        {/* Identidad de la tienda */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width: 46, height: 46, borderRadius: 14, objectFit: "cover", flexShrink: 0 }}/>
            : <span style={{ width: 46, height: 46, borderRadius: 14, background: "var(--accent-tint)", color: "var(--accent-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.15rem", flexShrink: 0 }}>{shopName[0].toUpperCase()}</span>}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--f-display)", fontSize: "1.15rem", fontWeight: 800, textTransform: "uppercase", lineHeight: 1.05, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shopName}</div>
            <div className="lv-eyebrow" style={{ marginTop: 3 }}>Panel de vendedor</div>
          </div>
          <span className="lv-badge lv-badge--soft" style={{ flexShrink: 0, color: "var(--ok)", background: "color-mix(in srgb, var(--ok) 12%, transparent)" }}>
            <i style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }}/>Aprobado
          </span>
        </div>

        {/* El motor copia sellerWhatsapp a cada orden. Sin número, el
            ganador se queda sin forma de contactar al vendedor. */}
        {!(profile as any).whatsapp && (
          <button className="lv-note lv-note--warn" style={{ width: "100%", textAlign: "left", display: "flex", gap: 10, alignItems: "flex-start" }} onClick={() => router.push("/account/edit")}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <strong>Agrega tu WhatsApp antes de publicar.</strong> Es por donde te
              escribe quien gane. Toca aquí.
            </div>
          </button>
        )}

        {/* Dejaste un vivo encendido. Va arriba de todo: mientras siga
            abierto aparece en el inicio y la gente entra a una cámara que
            quizá ya no está. */}
        {enVivoAhora && (
          <button
            onClick={() => router.push(`/seller/show/${enVivoAhora.id}`)}
            style={{
              width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderRadius: "var(--r-card)", background: "var(--live)", color: "#fff",
            }}
          >
            <span style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: "0.92rem", fontWeight: 800 }}>Sigues en vivo</span>
              <span style={{ display: "block", fontSize: "0.76rem", opacity: 0.92, marginTop: 1 }}>
                {enVivoAhora.viewerCount ?? 0} viendo · toca para volver
              </span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}

        {/* Los tres números que importan al entrar. Antes esta pantalla no
            mostraba un solo bolívar: no había forma de saber si el negocio
            iba bien sin abrir orden por orden. */}
        <div className="lv-grid" style={{ gridTemplateColumns: "1.3fr 1fr 1fr", gap: 10 }}>
          <div className="lv-panel" style={{ padding: "13px 12px", textAlign: "center" }}>
            <div className="lv-price" style={{ fontSize: "1.25rem" }}>{formatUsd(ganado)}</div>
            <div className="lv-eyebrow" style={{ marginTop: 2 }}>Tu parte</div>
          </div>
          <div className="lv-panel" style={{ padding: "13px 12px", textAlign: "center", boxShadow: teToca.length > 0 ? "inset 0 0 0 2px var(--accent)" : undefined }}>
            <div className="lv-price" style={{ fontSize: "1.25rem", color: teToca.length > 0 ? "var(--accent-strong)" : undefined }}>{teToca.length}</div>
            <div className="lv-eyebrow" style={{ marginTop: 2 }}>Te toca</div>
          </div>
          <div className="lv-panel" style={{ padding: "13px 12px", textAlign: "center" }}>
            <div className="lv-price" style={{ fontSize: "1.25rem" }}>{activas.length}</div>
            <div className="lv-eyebrow" style={{ marginTop: 2 }}>Activas</div>
          </div>
        </div>

        {/* Acciones — Vender en vivo arriba y prominente; artículo, secundario */}
        <button
          className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg"
          onClick={salirEnVivo}
          disabled={ocupado}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          {ocupado ? "Saliendo…" : enVivoAhora ? "Volver a tu vivo" : "Vender en vivo"}
        </button>
        <button className="lv-btn lv-btn--outline lv-btn--block" onClick={() => setPantalla("subasta")} style={{ marginTop: -4 }}>
          Vender un artículo
        </button>

        {/* Te toca — lo primero después de las acciones porque es lo único
            con un comprador esperando del otro lado. */}
        {teToca.length > 0 && (
          <section className="lv-panel" style={{ padding: "2px 16px", boxShadow: "inset 0 0 0 2px var(--accent)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 4px" }}>
              <span className="lv-eyebrow" style={{ color: "var(--accent-strong)" }}>Te toca</span>
              <span className="lv-badge lv-badge--accent" style={{ fontSize: "0.62rem" }}>{teToca.length}</span>
            </div>
            {teToca.map(o => (
              <FilaOrden key={o.id} o={o} onClick={() => router.push(`/orders/${o.id}`)}/>
            ))}
          </section>
        )}

        {/* Ventas activas (subastas sueltas) */}
        {activas.length > 0 && (
          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 4px" }}>
              <span className="lv-eyebrow">Ventas activas</span>
              <span className="lv-badge lv-badge--accent" style={{ fontSize: "0.62rem" }}>{activas.length}</span>
            </div>
            {activas.map(a => (
              <FilaSubasta key={a.id} a={a} onClick={() => router.push(`/auctions/${a.id}`)}/>
            ))}
          </section>
        )}

        {/* Vivos preparados pero sin transmitir (el que está al aire ya
            tiene su franja arriba, no hace falta repetirlo aquí). */}
        {showsActivos.filter(s => s.status !== "live").length > 0 && (
          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>Listos para salir</div>
            {showsActivos.filter(s => s.status !== "live").map(s => {
              const cola = auctions.filter(a => a.showId === s.id && a.status === "waiting").length;
              return (
                <button key={s.id} className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push(`/seller/show/${s.id}?vivo=1`)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                    <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 2 }}>
                      {cola > 0 ? `${cola} en cola · toca para salir al aire` : "Toca para salir al aire"}
                    </div>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              );
            })}
          </section>
        )}

        {/* El historial completo vive en /ventas, que ya existía pero solo
            se alcanzaba desde Mi cuenta — nadie la encontraba desde aquí,
            que es donde un vendedor la busca. Se enlaza en vez de repetir
            la lista: una sola pantalla manda sobre las órdenes. */}
        {ventas.length > 0 && (
          <button className="lv-panel" onClick={() => router.push("/ventas")} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%" }}>
            <span className="lv-avatar" style={{ background: "var(--accent-tint)", color: "var(--accent-strong)", borderRadius: 11 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2l1.5 3h9L18 2M3 6h18l-1.5 13a2 2 0 0 1-2 1.8H6.5a2 2 0 0 1-2-1.8z"/></svg>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>Todas mis ventas</div>
              <div className="lv-dim" style={{ fontSize: "0.74rem" }}>
                {ventas.length} {ventas.length === 1 ? "orden" : "órdenes"} · pagos y envíos
              </div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}

        {/* Nada todavía */}
        {showsActivos.length === 0 && activas.length === 0 && ventas.length === 0 && (
          <div className="lv-dim" style={{ fontSize: "0.84rem", textAlign: "center", lineHeight: 1.6, padding: "18px 12px" }}>
            Todavía no has vendido nada.<br/>Toca <strong style={{ color: "var(--ink-2)" }}>Vender en vivo</strong> y sales al aire de una.
          </div>
        )}
      </div>
    </div>
  );
}
