"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { BRAND } from "@subastas-ve/shared";
import { ImageUploader } from "../../components/ui/ImageUploader";
import { useCountdown } from "../../hooks/useCountdown";

type Pantalla = "hub" | "subasta" | "show" | "producto";

const CATEGORIAS = [
  "Moda y Ropa", "Electronica", "Calzado", "Joyas y Relojes", "Hogar",
  "Colecciones", "Autos y Motos", "Deportes", "Arte", "Juguetes", "Comida", "Mascotas",
];

const DURACIONES: [string, string][] = [
  ["6", "6 horas"], ["24", "1 día"], ["72", "3 días"], ["168", "7 días"],
];

const ESTADO_ORDEN: Record<string, { texto: string; clase: string }> = {
  pending_payment: { texto: "Esperando pago", clase: "lv-badge--soft" },
  payment_confirmed: { texto: "Por enviar", clase: "lv-badge--soft" },
  shipped: { texto: "Enviado", clase: "lv-badge--soft" },
  delivered: { texto: "Entregado", clase: "lv-badge--accent" },
  cancelled: { texto: "Cancelada", clase: "lv-badge--live" },
  disputed: { texto: "En disputa", clase: "lv-badge--live" },
};

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

function FilaSubasta({ a, onClick }: { a: any; onClick: () => void }) {
  const { texto, vencida } = useCountdown(a.endsAt);
  const e = ESTADO[a.status] ?? { texto: a.status, clase: "lv-badge--soft" };
  const foto = a.imageURL ?? a.imageURLs?.[0];

  return (
    <button className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
          {foto && <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.title}
          </div>
          <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 2 }}>
            ${(a.currentBidUsd ?? 0).toFixed(2)} · {a.bidsCount ?? 0} {(a.bidsCount ?? 0) === 1 ? "puja" : "pujas"}
            {a.status === "active" && !vencida ? ` · ${texto}` : ""}
          </div>
          <span className={`lv-badge ${e.clase}`} style={{ marginTop: 5 }}>{e.texto}</span>
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

  // Formulario de show
  const [tShow, setTShow] = useState("");
  const [dShow, setDShow] = useState("");
  const [catShow, setCatShow] = useState("Moda y Ropa");

  // Solicitud de vendedor (estado no-aprobado)
  const [solTienda, setSolTienda] = useState("");
  const [solCat, setSolCat] = useState("Moda y Ropa");
  const [solWhatsapp, setSolWhatsapp] = useState((profile as any)?.whatsapp ?? "");
  const [solCiudad, setSolCiudad] = useState((profile as any)?.city ?? "");
  const [solOcupado, setSolOcupado] = useState(false);
  const [avisoSolicitud, setAvisoSolicitud] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  const enviarSolicitudVendedor = async () => {
    if (!profile) return;
    if (solTienda.trim().length < 3) { setAvisoSolicitud({ tipo: "bad", texto: "El nombre de la tienda necesita al menos 3 caracteres" }); return; }
    if (solWhatsapp.trim().length < 7) { setAvisoSolicitud({ tipo: "bad", texto: "Tu WhatsApp es obligatorio: por ahí vendes" }); return; }
    setSolOcupado(true);
    setAvisoSolicitud(null);
    try {
      // Las reglas solo permiten este movimiento: none → pending, con los
      // datos de la tienda en la misma escritura. Aprobar es del admin.
      await updateDoc(doc(db, "users", profile.uid), {
        sellerStatus: "pending",
        shopName: solTienda.trim(),
        sellerCat: solCat,
        whatsapp: solWhatsapp.trim(),
        city: solCiudad.trim(),
        updatedAt: serverTimestamp(),
      });
      setAvisoSolicitud({ tipo: "ok", texto: "¡Solicitud enviada! Te avisamos cuando esté aprobada." });
    } catch (e: any) {
      setAvisoSolicitud({ tipo: "bad", texto: e?.message ?? "No se pudo enviar la solicitud" });
    } finally {
      setSolOcupado(false);
    }
  };

  // Formulario de producto de show
  const [showElegido, setShowElegido] = useState("");
  const [tProd, setTProd] = useState("");
  const [precioProd, setPrecioProd] = useState("");
  const [incProd, setIncProd] = useState("1");
  const [timer, setTimer] = useState("30");
  const [fotosProd, setFotosProd] = useState<string[]>([]);

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
    const u3 = onSnapshot(
      query(collection(db, "orders"), where("sellerId", "==", profile.uid), orderBy("createdAt", "desc")),
      s => setVentas(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("ventas:", e.code));
    return () => { u1(); u2(); u3(); };
  }, [profile]);

  const avisar = (tipo: "ok" | "bad", texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 5000);
  };

  const crearSubasta = async () => {
    if (!tSub.trim() || !precio || !profile) return;
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

  const crearShow = async () => {
    if (!tShow.trim() || !profile) return;
    setOcupado(true);
    try {
      await addDoc(collection(db, "shows"), {
        sellerId: profile.uid, sellerName: profile.displayName ?? "Vendedor",
        title: tShow.trim(), description: dShow.trim(), category: catShow,
        status: "scheduled", agoraChannelName: `show_${Date.now()}`,
        viewerCount: 0, totalProducts: 0,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setTShow(""); setDShow("");
      setPantalla("hub");
      avisar("ok", "Show creado. Agrégale subastas antes de salir en vivo.");
    } catch (e: any) {
      avisar("bad", e.message ?? "No se pudo crear el show");
    } finally { setOcupado(false); }
  };

  const agregarProducto = async () => {
    if (!showElegido || !tProd.trim() || !precioProd || !profile) return;
    setOcupado(true);
    try {
      const p = parseFloat(precioProd);
      const enCola = auctions.filter(a => a.showId === showElegido).length;
      await addDoc(collection(db, "auctions"), {
        mode: "live", showId: showElegido,
        sellerId: profile.uid, sellerName: profile.displayName ?? "Vendedor",
        title: tProd.trim(), description: "",
        startingPriceUsd: p, currentBidUsd: p, minIncrementUsd: parseFloat(incProd),
        timerSeconds: parseInt(timer),
        status: "waiting", sortOrder: enCola,
        bidsCount: 0, currentBidderId: null, winnerId: null, orderId: null,
        imageURL: fotosProd[0] ?? null, imageURLs: fotosProd,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setTProd(""); setPrecioProd(""); setFotosProd([]);
      avisar("ok", "Subasta agregada a la cola del show");
    } catch (e: any) {
      avisar("bad", e.message ?? "No se pudo agregar");
    } finally { setOcupado(false); }
  };

  // ── Puertas ──
  if (!profile) {
    return (
      <div className="lv-app">
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
    return (
      <div className="lv-app">
        <header className="lv-topbar"><h1 className="lv-topbar__title">Vender</h1></header>
        <div className="lv-pad" style={{ paddingTop: 20, display: "grid", gap: 14 }}>
          {avisoSolicitud && <div className={`lv-note lv-note--${avisoSolicitud.tipo}`}>{avisoSolicitud.texto}</div>}

          {suspendido ? (
            <section className="lv-panel">
              <div style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 6 }}>Tu cuenta de vendedor está suspendida</div>
              <p className="lv-dim" style={{ fontSize: "0.84rem", lineHeight: 1.55 }}>
                Escríbenos por soporte para revisar tu caso.
              </p>
              <button className="lv-btn lv-btn--soft lv-btn--block" style={{ marginTop: 14 }} onClick={() => router.push("/support")}>
                Contactar soporte
              </button>
            </section>
          ) : enRevision ? (
            <section className="lv-panel">
              <div style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 6 }}>Tu solicitud está en revisión ⏳</div>
              <p className="lv-dim" style={{ fontSize: "0.84rem", lineHeight: 1.55 }}>
                Un administrador la revisa a mano. Te avisamos apenas quede aprobada
                y podrás publicar subastas y hacer shows en vivo.
              </p>
            </section>
          ) : (
            <>
              <section className="lv-panel">
                <div style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 6 }}>{`Vende en ${BRAND.name}`}</div>
                <p className="lv-dim" style={{ fontSize: "0.82rem", lineHeight: 1.55 }}>
                  Cuéntanos de tu tienda y un administrador revisa tu solicitud.
                  Es lo que evita que cualquiera publique a nombre de otro.
                </p>
              </section>

              <section className="lv-panel">
                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="sol-tienda">Nombre de tu tienda</label>
                  <input id="sol-tienda" className="lv-input" value={solTienda} onChange={e => setSolTienda(e.target.value)}
                    placeholder="Ej: Tecno Caracas" maxLength={40}/>
                </div>

                <div className="lv-field">
                  <span className="lv-field__label">Qué vendes</span>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {CATEGORIAS.map(c => (
                      <button key={c} onClick={() => setSolCat(c)}
                        className={`lv-chip${solCat === c ? " lv-chip--active" : ""}`}>{c}</button>
                    ))}
                  </div>
                </div>

                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="sol-wa">Tu WhatsApp</label>
                  <input id="sol-wa" className="lv-input" type="tel" value={solWhatsapp} onChange={e => setSolWhatsapp(e.target.value)}
                    placeholder="Ej: +58 414 1234567" maxLength={20}/>
                  <div className="lv-field__hint">Por ahí coordinas pagos y entregas con tus compradores.</div>
                </div>

                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="sol-ciudad">Ciudad</label>
                  <input id="sol-ciudad" className="lv-input" value={solCiudad} onChange={e => setSolCiudad(e.target.value)}
                    placeholder="Ej: Caracas" maxLength={40}/>
                </div>

                <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={solOcupado} onClick={enviarSolicitudVendedor}>
                  {solOcupado ? "Enviando…" : "Enviar solicitud"}
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    );
  }

  const misSubastas = auctions.filter(a => a.mode !== "live");
  const activas = misSubastas.filter(a => a.status === "active");
  const vendidas = auctions.filter(a => a.status === "sold");
  const enCola = auctions.filter(a => a.mode === "live" && a.status === "waiting");
  // Órdenes esperando algo de él: confirmar el pago o despachar
  const porAtender = ventas.filter(o => ["pending_payment", "payment_confirmed"].includes(o.status)).length;

  const Encabezado = ({ titulo }: { titulo: string }) => (
    <header className="lv-topbar">
      {pantalla !== "hub" && (
        <button className="lv-icon-btn" onClick={() => setPantalla("hub")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
      )}
      <h1 className="lv-topbar__title" style={{ fontSize: "1.15rem", fontWeight: 850 }}>{titulo}</h1>
    </header>
  );

  // ══ Publicar subasta suelta ══
  if (pantalla === "subasta") {
    return (
      <div className="lv-app">
        <Encabezado titulo="Publicar subasta"/>
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
            Una vez publicada y con pujas encima, ya no podrás cambiarle el precio ni borrarla.
          </div>

          <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={ocupado || !tSub.trim() || !precio} onClick={crearSubasta}>
            {ocupado ? "Publicando…" : "Publicar subasta"}
          </button>
        </div>
      </div>
    );
  }

  // ══ Crear show ══
  if (pantalla === "show") {
    return (
      <div className="lv-app">
        <Encabezado titulo="Nuevo show"/>
        <div className="lv-pad" style={{ paddingTop: 18 }}>
          {aviso && <div className={`lv-note lv-note--${aviso.tipo}`} style={{ marginBottom: 14 }}>{aviso.texto}</div>}

          <div className="lv-field">
            <label className="lv-field__label" htmlFor="ts">Título del show</label>
            <input id="ts" className="lv-input" value={tShow} onChange={e => setTShow(e.target.value)} placeholder="Sneakers exclusivos importados"/>
          </div>

          <div className="lv-field">
            <label className="lv-field__label" htmlFor="ds">Descripción</label>
            <textarea id="ds" className="lv-input" rows={3} value={dShow} onChange={e => setDShow(e.target.value)} placeholder="Qué vas a subastar en vivo"/>
          </div>

          <div className="lv-field">
            <span className="lv-field__label">Categoría</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CATEGORIAS.map(c => (
                <button key={c} onClick={() => setCatShow(c)} className={`lv-chip${catShow === c ? " lv-chip--active" : ""}`}>{c}</button>
              ))}
            </div>
          </div>

          <div className="lv-note" style={{ marginBottom: 14 }}>
            El show nace programado. Agrégale subastas y luego, desde su panel, sales en vivo.
          </div>

          <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={ocupado || !tShow.trim()} onClick={crearShow}>
            {ocupado ? "Creando…" : "Crear show"}
          </button>
        </div>
      </div>
    );
  }

  // ══ Agregar subasta a un show ══
  if (pantalla === "producto") {
    const programados = shows.filter(s => ["draft", "scheduled", "live"].includes(s.status));
    return (
      <div className="lv-app">
        <Encabezado titulo="Agregar a un show"/>
        <div className="lv-pad" style={{ paddingTop: 18 }}>
          {aviso && <div className={`lv-note lv-note--${aviso.tipo}`} style={{ marginBottom: 14 }}>{aviso.texto}</div>}

          {programados.length === 0 ? (
            <div className="lv-empty">
              <div className="lv-empty__title">No tienes shows abiertos</div>
              <button className="lv-btn lv-btn--accent" style={{ marginTop: 14 }} onClick={() => setPantalla("show")}>Crear un show</button>
            </div>
          ) : (
            <>
              <div className="lv-field">
                <span className="lv-field__label">¿A cuál show?</span>
                <div style={{ display: "grid", gap: 8 }}>
                  {programados.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setShowElegido(s.id)}
                      className="lv-panel lv-panel--flat"
                      style={{ textAlign: "left", padding: "12px 14px", boxShadow: showElegido === s.id ? "inset 0 0 0 2px var(--ink)" : "none" }}
                    >
                      <div style={{ fontSize: "0.86rem", fontWeight: 700 }}>{s.title}</div>
                      <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 2 }}>
                        {auctions.filter(a => a.showId === s.id).length} en cola
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lv-field">
                <span className="lv-field__label">Fotos</span>
                <ImageUploader images={fotosProd} onChange={setFotosProd} path={`products/${profile.uid}`} max={5}/>
              </div>

              <div className="lv-field">
                <label className="lv-field__label" htmlFor="tp">Producto</label>
                <input id="tp" className="lv-input" value={tProd} onChange={e => setTProd(e.target.value)} placeholder="Nombre del producto"/>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="pp">Precio</label>
                  <input id="pp" className="lv-input" type="number" inputMode="decimal" min="0.5" step="0.5" value={precioProd} onChange={e => setPrecioProd(e.target.value)} placeholder="10"/>
                </div>
                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="ip">Incremento</label>
                  <input id="ip" className="lv-input" type="number" inputMode="decimal" min="0.5" step="0.5" value={incProd} onChange={e => setIncProd(e.target.value)}/>
                </div>
                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="tm">Timer (s)</label>
                  <input id="tm" className="lv-input" type="number" inputMode="numeric" min="10" step="5" value={timer} onChange={e => setTimer(e.target.value)}/>
                </div>
              </div>

              <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={ocupado || !showElegido || !tProd.trim() || !precioProd} onClick={agregarProducto}>
                {ocupado ? "Agregando…" : "Agregar a la cola"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ══ Hub ══
  return (
    <div className="lv-app">
      <Encabezado titulo="Vender"/>

      <div className="lv-pad" style={{ paddingTop: 18, display: "grid", gap: 14 }}>
        {aviso && <div className={`lv-note lv-note--${aviso.tipo}`}>{aviso.texto}</div>}

        {/* El motor copia sellerWhatsapp a cada orden. Sin número, el
            ganador se queda sin forma de contactar al vendedor. */}
        {!(profile as any).whatsapp && (
          <button className="lv-note lv-note--warn" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push("/account/edit")}>
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

        {/* Métricas */}
        <div className="lv-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[["Activas", activas.length], ["Vendidas", vendidas.length], ["En cola", enCola.length]].map(([l, v]) => (
            <div key={String(l)} className="lv-panel" style={{ padding: "13px 12px", textAlign: "center" }}>
              <div className="lv-price" style={{ fontSize: "1.3rem" }}>{v}</div>
              <div className="lv-eyebrow" style={{ marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" onClick={() => setPantalla("subasta")}>
          Publicar una subasta
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="lv-btn lv-btn--outline" onClick={() => setPantalla("show")}>Nuevo show</button>
          <button className="lv-btn lv-btn--outline" onClick={() => setPantalla("producto")}>Agregar a show</button>
        </div>

        {/* Shows */}
        {shows.length > 0 && (
          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>Mis shows</div>
            {shows.map(s => {
              const e = ESTADO[s.status] ?? { texto: s.status, clase: "lv-badge--soft" };
              const cola = auctions.filter(a => a.showId === s.id).length;
              return (
                <button key={s.id} className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push(`/seller/show/${s.id}`)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                    <div className="lv-dim" style={{ fontSize: "0.73rem", marginTop: 2 }}>{cola} en cola · {s.viewerCount ?? 0} viendo</div>
                    <span className={`lv-badge ${e.clase}`} style={{ marginTop: 5 }}>
                      {s.status === "live" && <i className="lv-dot"/>}{e.texto}
                    </span>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              );
            })}
          </section>
        )}

        {/* Ventas — sin esta pantalla las órdenes se congelaban en
            pending_payment porque nadie podía avanzarlas */}
        {ventas.length > 0 && (
          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 4px" }}>
              <span className="lv-eyebrow">Mis ventas</span>
              {porAtender > 0 && (
                <span className="lv-badge lv-badge--accent">{porAtender} por atender</span>
              )}
            </div>
            {ventas.map(o => {
              const e = ESTADO_ORDEN[o.status] ?? { texto: o.status, clase: "lv-badge--soft" };
              const tuTurno = ["pending_payment", "payment_confirmed"].includes(o.status);
              return (
                <button key={o.id} className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={() => router.push(`/orders/${o.id}`)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 9, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
                      {o.productImageURL && <img src={o.productImageURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {o.productTitle ?? "Producto"}
                      </div>
                      <div className="lv-dim" style={{ fontSize: "0.72rem", marginTop: 1 }}>
                        ${o.bidAmountUsd?.toFixed(2)} · {o.buyerName ?? "Comprador"}
                      </div>
                      <span className={`lv-badge ${tuTurno ? "lv-badge--accent" : e.clase}`} style={{ marginTop: 4 }}>
                        {tuTurno ? "Te toca" : e.texto}
                      </span>
                    </div>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              );
            })}
          </section>
        )}

        {/* Subastas */}
        <section className="lv-panel" style={{ padding: "2px 16px" }}>
          <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>Mis subastas</div>
          {misSubastas.length === 0 ? (
            <p className="lv-dim" style={{ fontSize: "0.82rem", padding: "6px 0 16px" }}>
              Todavía no has publicado ninguna.
            </p>
          ) : (
            misSubastas.map(a => (
              <FilaSubasta key={a.id} a={a} onClick={() => router.push(`/auctions/${a.id}`)}/>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
