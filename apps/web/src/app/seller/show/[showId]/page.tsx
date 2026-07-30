"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { doc, collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../../lib/firebase";
import { useAuthStore } from "../../../../store/authStore";
import { useAgora } from "../../../../hooks/useAgora";
import { useCountdown } from "../../../../hooks/useCountdown";
import { ImageUploader } from "../../../../components/ui/ImageUploader";

const ESTADO: Record<string, { texto: string; clase: string }> = {
  waiting: { texto: "En cola", clase: "lv-badge--soft" },
  active: { texto: "Subastando", clase: "lv-badge--accent" },
  sold: { texto: "Vendida", clase: "lv-badge--accent" },
  unsold: { texto: "Sin ganador", clase: "lv-badge--soft" },
  skipped: { texto: "Saltada", clase: "lv-badge--soft" },
  cancelled: { texto: "Cancelada", clase: "lv-badge--soft" },
};

function FilaProducto({ p, onSaltar, saltando }: { p: any; onSaltar: () => void; saltando: boolean }) {
  const { texto, vencida } = useCountdown(p.endsAt);
  const e = ESTADO[p.status] ?? { texto: p.status, clase: "lv-badge--soft" };
  const activa = p.status === "active" && !vencida;

  return (
    <div className="lv-row">
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 9, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
          {(p.imageURL ?? p.imageURLs?.[0]) && (
            <img src={p.imageURL ?? p.imageURLs[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.title}
          </div>
          <div className="lv-dim" style={{ fontSize: "0.72rem", marginTop: 1 }}>
            ${(p.currentBidUsd ?? 0).toFixed(2)} · {p.bidsCount ?? 0} pujas
            {activa ? ` · ${texto}` : ""}
          </div>
          <span className={`lv-badge ${e.clase}`} style={{ marginTop: 4 }}>{e.texto}</span>
        </div>
      </div>

      {/* Solo se puede saltar lo que nadie ha pujado: el motor lo rechaza igual */}
      {p.status === "active" && !p.currentBidderId && (
        <button className="lv-btn lv-btn--outline lv-btn--sm" disabled={saltando} onClick={onSaltar}>
          {saltando ? "…" : "Saltar"}
        </button>
      )}
    </div>
  );
}

export default function SellerShowPage() {
  const { showId } = useParams() as { showId: string };
  const router = useRouter();
  const { profile } = useAuthStore();

  const [show, setShow] = useState<any>(null);
  const [productos, setProductos] = useState<any[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const [agregando, setAgregando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [precio, setPrecio] = useState("");
  const [incremento, setIncremento] = useState("1");
  const [timer, setTimer] = useState("30");
  const [fotos, setFotos] = useState<string[]>([]);

  const videoRef = useRef<HTMLDivElement>(null);
  // Se le pasa el showId, no el canal: el canal y el rol los resuelve
  // generateAgoraToken en el servidor.
  const agora = useAgora(showId, "host");

  useEffect(() => {
    const u1 = onSnapshot(doc(db, "shows", showId), s => { if (s.exists()) setShow({ id: s.id, ...s.data() }); });
    // Las subastas del show viven en /auctions con mode:"live"
    const u2 = onSnapshot(
      query(collection(db, "auctions"), where("showId", "==", showId), orderBy("sortOrder", "asc")),
      s => setProductos(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => setAviso({ tipo: "bad", texto: `No se pudo cargar la cola (${e.code})` }));
    return () => { u1(); u2(); };
  }, [showId]);

  const avisar = (tipo: "ok" | "bad", texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 6000);
  };

  // El estado del show lo mueve el motor, no el navegador: startShow
  // valida que seas el dueño y activa la primera subasta de la cola.
  const iniciar = async () => {
    setOcupado("start");
    try {
      await httpsCallable(functions, "startShow")({ showId });
      await agora.join(videoRef.current);
      avisar("ok", "¡Estás en vivo!");
    } catch (e: any) {
      avisar("bad", e?.message ?? "No se pudo iniciar el show");
    } finally { setOcupado(null); }
  };

  const terminar = async () => {
    if (!confirm("¿Terminar el show? Se cancelan las subastas que queden en cola.")) return;
    setOcupado("end");
    try {
      await agora.leave();
      await httpsCallable(functions, "endShow")({ showId });
      router.push("/seller");
    } catch (e: any) {
      avisar("bad", e?.message ?? "No se pudo terminar el show");
    } finally { setOcupado(null); }
  };

  const saltar = async (auctionId: string) => {
    setOcupado(`skip_${auctionId}`);
    try { await httpsCallable(functions, "skipAuction")({ showId, auctionId }); }
    catch (e: any) { avisar("bad", e?.message ?? "No se pudo saltar"); }
    finally { setOcupado(null); }
  };

  const agregar = async () => {
    if (!titulo.trim() || !precio || !profile) return;
    setOcupado("add");
    try {
      const p = parseFloat(precio);
      await addDoc(collection(db, "auctions"), {
        mode: "live", showId,
        sellerId: profile.uid, sellerName: profile.displayName ?? "Vendedor",
        title: titulo.trim(), description: "",
        startingPriceUsd: p, currentBidUsd: p, minIncrementUsd: parseFloat(incremento),
        timerSeconds: parseInt(timer),
        status: "waiting", sortOrder: productos.length,
        bidsCount: 0, currentBidderId: null, winnerId: null, orderId: null,
        imageURL: fotos[0] ?? null, imageURLs: fotos,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setTitulo(""); setPrecio(""); setFotos([]); setAgregando(false);
      avisar("ok", "Agregada a la cola");
    } catch (e: any) {
      avisar("bad", e?.message ?? "No se pudo agregar");
    } finally { setOcupado(null); }
  };

  if (!show) {
    return <div className="lv-app"><div className="lv-empty"><div className="lv-empty__text">Cargando…</div></div></div>;
  }

  const enVivo = show.status === "live";
  const enCola = productos.filter(p => p.status === "waiting").length;
  const vendidas = productos.filter(p => p.status === "sold").length;
  const puedeIniciar = ["scheduled", "draft"].includes(show.status) && enCola > 0;

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.push("/seller")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="lv-topbar__title" style={{ fontSize: "1rem" }}>{show.title}</h1>
          <div className="lv-dim" style={{ fontSize: "0.7rem" }}>{show.viewerCount ?? 0} viendo</div>
        </div>
        {enVivo && <span className="lv-badge lv-badge--live"><i className="lv-dot"/> EN VIVO</span>}
      </header>

      <div className="lv-pad" style={{ paddingTop: 16, display: "grid", gap: 14 }}>
        {aviso && <div className={`lv-note lv-note--${aviso.tipo}`}>{aviso.texto}</div>}

        {/* Cámara */}
        {enVivo && (
          <div style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: 14, overflow: "hidden", background: "#000" }}>
            <div ref={videoRef} style={{ position: "absolute", inset: 0 }}/>
            {!agora.joined && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", textAlign: "center", padding: "0 24px" }}>
                {agora.loading ? "Conectando cámara…" : agora.error ? agora.error : "Cámara desconectada"}
                {!agora.loading && (
                  <button className="lv-btn lv-btn--sm" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }} onClick={() => agora.join(videoRef.current)}>
                    Reconectar
                  </button>
                )}
              </div>
            )}
            {agora.joined && (
              <div style={{ position: "absolute", bottom: 10, left: 10, display: "flex", gap: 8 }}>
                {([["mic", micOn, setMicOn, agora.toggleMic], ["cam", camOn, setCamOn, agora.toggleCamera]] as const).map(([k, on, set, fn]) => (
                  <button
                    key={k}
                    onClick={async () => { await fn(); set(v => !v); }}
                    aria-label={k === "mic" ? (on ? "Silenciar" : "Activar micrófono") : (on ? "Apagar cámara" : "Encender cámara")}
                    style={{ width: 36, height: 36, borderRadius: "50%", background: on ? "rgba(255,255,255,0.2)" : "var(--live)", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                      {k === "mic"
                        ? (on ? <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></>
                              : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></>)
                        : <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>}
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Métricas */}
        <div className="lv-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[["En cola", enCola], ["Vendidas", vendidas], ["Viendo", show.viewerCount ?? 0]].map(([l, v]) => (
            <div key={String(l)} className="lv-panel" style={{ padding: "13px 12px", textAlign: "center" }}>
              <div className="lv-price" style={{ fontSize: "1.25rem" }}>{v}</div>
              <div className="lv-eyebrow" style={{ marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Control */}
        {enVivo ? (
          <div style={{ display: "grid", gap: 10 }}>
            <button className="lv-btn lv-btn--soft lv-btn--block" onClick={() => router.push(`/shows/${showId}`)}>
              Ver el show como lo ve la gente
            </button>
            <button className="lv-btn lv-btn--danger lv-btn--block lv-btn--lg" disabled={ocupado === "end"} onClick={terminar}>
              {ocupado === "end" ? "Terminando…" : "Terminar show"}
            </button>
          </div>
        ) : show.status === "ended" ? (
          <div className="lv-note">Este show ya terminó.</div>
        ) : (
          <>
            {enCola === 0 && (
              <div className="lv-note lv-note--warn">
                Agrega al menos una subasta a la cola antes de salir en vivo.
              </div>
            )}
            <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={!puedeIniciar || ocupado === "start"} onClick={iniciar}>
              {ocupado === "start" ? "Iniciando…" : "Salir en vivo"}
            </button>
          </>
        )}

        {/* Cola */}
        <section className="lv-panel" style={{ padding: "2px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 4px" }}>
            <span className="lv-eyebrow">Cola de subastas</span>
            {show.status !== "ended" && (
              <button className="lv-btn lv-btn--soft lv-btn--sm" onClick={() => setAgregando(a => !a)}>
                {agregando ? "Cerrar" : "Agregar"}
              </button>
            )}
          </div>

          {productos.length === 0 && !agregando && (
            <p className="lv-dim" style={{ fontSize: "0.82rem", padding: "6px 0 16px" }}>
              Todavía no hay nada en la cola.
            </p>
          )}

          {productos.map(p => (
            <FilaProducto
              key={p.id}
              p={p}
              saltando={ocupado === `skip_${p.id}`}
              onSaltar={() => saltar(p.id)}
            />
          ))}
        </section>

        {/* Alta rápida */}
        {agregando && (
          <section className="lv-panel">
            <div className="lv-eyebrow" style={{ marginBottom: 10 }}>Nueva subasta</div>

            <div className="lv-field">
              <span className="lv-field__label">Fotos</span>
              <ImageUploader images={fotos} onChange={setFotos} path={`products/${profile?.uid ?? "anon"}`} max={5}/>
            </div>

            <div className="lv-field">
              <label className="lv-field__label" htmlFor="t">Producto</label>
              <input id="t" className="lv-input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Nombre del producto"/>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div className="lv-field">
                <label className="lv-field__label" htmlFor="p">Precio</label>
                <input id="p" className="lv-input" type="number" inputMode="decimal" min="0.5" step="0.5" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="10"/>
              </div>
              <div className="lv-field">
                <label className="lv-field__label" htmlFor="i">Incremento</label>
                <input id="i" className="lv-input" type="number" inputMode="decimal" min="0.5" step="0.5" value={incremento} onChange={e => setIncremento(e.target.value)}/>
              </div>
              <div className="lv-field">
                <label className="lv-field__label" htmlFor="s">Timer (s)</label>
                <input id="s" className="lv-input" type="number" inputMode="numeric" min="10" step="5" value={timer} onChange={e => setTimer(e.target.value)}/>
              </div>
            </div>

            <button className="lv-btn lv-btn--accent lv-btn--block" disabled={ocupado === "add" || !titulo.trim() || !precio} onClick={agregar}>
              {ocupado === "add" ? "Agregando…" : "Agregar a la cola"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
