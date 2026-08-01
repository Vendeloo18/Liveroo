"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { doc, collection, onSnapshot, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../../lib/firebase";
import { useAuthStore } from "../../../../store/authStore";
import { useAgora } from "../../../../hooks/useAgora";
import { useCountdown } from "../../../../hooks/useCountdown";
import { ImageUploader } from "../../../../components/ui/ImageUploader";
import { BRAND } from "@subastas-ve/shared";

const ESTADO: Record<string, { texto: string; clase: string }> = {
  waiting: { texto: "En cola", clase: "lv-badge--soft" },
  active: { texto: "Subastando", clase: "lv-badge--accent" },
  sold: { texto: "Vendida", clase: "lv-badge--accent" },
  unsold: { texto: "Sin ganador", clase: "lv-badge--soft" },
  skipped: { texto: "Saltada", clase: "lv-badge--soft" },
  cancelled: { texto: "Cancelada", clase: "lv-badge--soft" },
};

function FilaProducto({ p, onSaltar, saltando, onPresentar, presentando }: { p: any; onSaltar?: () => void; saltando?: boolean; onPresentar?: () => void; presentando?: boolean }) {
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

      {/* En cola: subastarla ahora. Activa sin pujas: saltarla. */}
      {p.status === "waiting" && onPresentar && (
        <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={presentando} onClick={onPresentar}>
          {presentando ? "…" : "Subastar"}
        </button>
      )}
      {p.status === "active" && !p.currentBidderId && onSaltar && (
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

  const [titulo, setTitulo] = useState("");
  const [precio, setPrecio] = useState("");
  const [incremento, setIncremento] = useState("1");
  const [timer, setTimer] = useState("1"); // minutos
  const [fotos, setFotos] = useState<string[]>([]);

  const videoRef = useRef<HTMLDivElement>(null);
  // Se le pasa el showId, no el canal: el canal y el rol los resuelve
  // generateAgoraToken en el servidor.
  const agora = useAgora(showId, "host");

  useEffect(() => {
    const u1 = onSnapshot(doc(db, "shows", showId), s => { if (s.exists()) setShow({ id: s.id, ...s.data() }); });
    // Las subastas del show viven en /auctions con mode:"live". Filtramos
    // solo por showId (índice de un campo, que Firestore crea solo) y
    // ordenamos por sortOrder en el cliente: la cola es pequeña y así no
    // dependemos de un índice compuesto que tarda en construirse.
    const u2 = onSnapshot(
      query(collection(db, "auctions"), where("showId", "==", showId)),
      s => setProductos(
        s.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      ),
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
      const ref = await addDoc(collection(db, "auctions"), {
        mode: "live", showId,
        sellerId: profile.uid, sellerName: profile.displayName ?? "Vendedor",
        title: titulo.trim(), description: "",
        startingPriceUsd: p, currentBidUsd: p, minIncrementUsd: parseFloat(incremento),
        timerSeconds: Math.max(1, parseInt(timer) || 1) * 60,
        status: "waiting", sortOrder: productos.length,
        bidsCount: 0, currentBidderId: null, winnerId: null, orderId: null,
        imageURL: fotos[0] ?? null, imageURLs: fotos,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setTitulo(""); setPrecio(""); setFotos([]);
      // En vivo y sin nada subastándose → arranca este al instante.
      if (show?.status === "live" && !productos.some(p => p.status === "active")) {
        await httpsCallable(functions, "presentAuction")({ showId, auctionId: ref.id });
        avisar("ok", "¡Subastando!");
      } else {
        avisar("ok", "Agregado a la cola");
      }
    } catch (e: any) {
      avisar("bad", e?.message ?? "No se pudo agregar");
    } finally { setOcupado(null); }
  };

  // Poner en vivo un artículo que estaba en cola (cuando el anterior cerró).
  const presentar = async (auctionId: string) => {
    setOcupado(`present_${auctionId}`);
    try {
      await httpsCallable(functions, "presentAuction")({ showId, auctionId });
    } catch (e: any) {
      avisar("bad", e?.message ?? "No se pudo subastar");
    } finally { setOcupado(null); }
  };

  // Invitar gente: comparte el link del show (WhatsApp/redes) o lo copia.
  const compartir = async () => {
    const url = `${window.location.origin}/shows/${showId}`;
    const texto = `🔴 Estoy EN VIVO rematando en ${BRAND.name}. ¡Entra a pujar! ${url}`;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: `${BRAND.name} — En vivo`, text: texto, url });
      } else {
        await navigator.clipboard.writeText(url);
        avisar("ok", "Link copiado — mándaselo a tu gente");
      }
    } catch { /* el usuario canceló el compartir */ }
  };

  if (!show) {
    return <div className="lv-app"><div className="lv-empty"><div className="lv-empty__text">Cargando…</div></div></div>;
  }

  const enVivo = show.status === "live";
  const waiting = productos.filter(p => p.status === "waiting");
  const activa = productos.find(p => p.status === "active");
  const vendidas = productos.filter(p => p.status === "sold").length;
  // Ya no exige cola: se sale en vivo y se agrega en el momento.
  const puedeIniciar = ["scheduled", "draft"].includes(show.status);

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
        <button className="lv-icon-btn" onClick={compartir} aria-label="Invitar gente">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
        </button>
        {enVivo && <span className="lv-badge lv-badge--live"><i className="lv-dot"/> EN VIVO</span>}
      </header>

      <div className="lv-pad" style={{ paddingTop: 16, display: "grid", gap: 14 }}>
        {aviso && <div className={`lv-note lv-note--${aviso.tipo}`}>{aviso.texto}</div>}

        {/* Cámara */}
        {enVivo && (
          <div style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: 14, overflow: "hidden", background: "#000" }}>
            <div ref={videoRef} style={{ position: "absolute", inset: 0 }}/>
            {agora.joined && (
              <span className="lv-badge lv-badge--live" style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.55)", color: "#fff", backdropFilter: "blur(6px)" }}>
                <i className="lv-dot"/> Transmitiendo · te ven
              </span>
            )}
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

        {enVivo && agora.joined && (
          <div className="lv-dim" style={{ fontSize: "0.72rem", textAlign: "center", lineHeight: 1.45, marginTop: -6 }}>
            ¿Se ve negro aquí? Es normal en el teléfono — <strong style={{ color: "var(--ink-2)" }}>tu público sí te está viendo</strong>.
          </div>
        )}

        {show.status === "ended" ? (
          <div className="lv-note">Este show ya terminó.</div>
        ) : !enVivo ? (
          /* ── Antes de salir en vivo ── */
          <section className="lv-panel" style={{ textAlign: "center", padding: "24px 18px" }}>
            <div style={{ fontFamily: "var(--f-display)", fontSize: "1.4rem", textTransform: "uppercase", lineHeight: 1.05 }}>Todo listo</div>
            <p className="lv-dim" style={{ fontSize: "0.86rem", lineHeight: 1.5, margin: "9px 0 18px" }}>
              Sal en vivo y ve agregando lo que vendes, uno por uno.{waiting.length > 0 ? ` Tienes ${waiting.length} en cola.` : ""}
            </p>
            <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={!puedeIniciar || ocupado === "start"} onClick={iniciar}>
              {ocupado === "start" ? "Saliendo…" : "Salir en vivo"}
            </button>
          </section>
        ) : (
          /* ── En vivo: agrega y vende uno por uno ── */
          <>
            {activa ? (
              <section className="lv-panel" style={{ padding: "2px 16px", boxShadow: "inset 0 0 0 2px var(--accent)" }}>
                <div className="lv-eyebrow" style={{ padding: "12px 0 2px", color: "var(--accent-strong)" }}>Subastando ahora</div>
                <FilaProducto p={activa} saltando={ocupado === `skip_${activa.id}`} onSaltar={() => saltar(activa.id)}/>
              </section>
            ) : (
              <div className="lv-note lv-note--warn">Nada en subasta. Agrega un artículo abajo y sale al instante.</div>
            )}

            {/* Agregar lo que vendes — rápido: nombre, precio y minutos */}
            <section className="lv-panel">
              <div className="lv-eyebrow" style={{ marginBottom: 10 }}>{activa ? "Preparar el siguiente" : "¿Qué vas a vender?"}</div>

              <div className="lv-field">
                <input id="t" className="lv-input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="¿Qué vendes? Ej: Proyector portátil" style={{ fontSize: "1rem", fontWeight: 600 }}/>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div className="lv-field" style={{ marginBottom: 0 }}>
                  <label className="lv-field__label" htmlFor="p">Precio inicial</label>
                  <input id="p" className="lv-input" type="number" inputMode="decimal" min="0.5" step="0.5" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="$10"/>
                </div>
                <div className="lv-field" style={{ marginBottom: 0 }}>
                  <label className="lv-field__label" htmlFor="i">Sube de</label>
                  <input id="i" className="lv-input" type="number" inputMode="decimal" min="0.5" step="0.5" value={incremento} onChange={e => setIncremento(e.target.value)} placeholder="$1"/>
                </div>
              </div>

              {/* Duración en minutos con selector rápido */}
              <div className="lv-field">
                <span className="lv-field__label">¿Cuánto dura?</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button type="button" aria-label="menos" onClick={() => setTimer(t => String(Math.max(1, (parseInt(t) || 1) - 1)))} className="lv-btn lv-btn--outline" style={{ width: 48, height: 48, padding: 0, fontSize: "1.5rem", borderRadius: 12 }}>−</button>
                  <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: "1.1rem" }}>{parseInt(timer) || 1} min</div>
                  <button type="button" aria-label="más" onClick={() => setTimer(t => String(Math.min(30, (parseInt(t) || 1) + 1)))} className="lv-btn lv-btn--outline" style={{ width: 48, height: 48, padding: 0, fontSize: "1.5rem", borderRadius: 12 }}>+</button>
                </div>
              </div>

              <div className="lv-field">
                <span className="lv-field__label">Foto <span className="lv-dim" style={{ fontWeight: 400 }}>· opcional, hace que se vea brutal en el feed</span></span>
                <ImageUploader images={fotos} onChange={setFotos} path={`products/${profile?.uid ?? "anon"}`} max={3}/>
              </div>

              <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={ocupado === "add" || !titulo.trim() || !precio} onClick={agregar}>
                {ocupado === "add" ? "Un momento…" : activa ? "Agregar a la cola" : "Subastar ahora"}
              </button>
            </section>

            {/* En cola */}
            {waiting.length > 0 && (
              <section className="lv-panel" style={{ padding: "2px 16px" }}>
                <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>En cola · {waiting.length}</div>
                {waiting.map(p => (
                  <FilaProducto
                    key={p.id}
                    p={p}
                    onPresentar={!activa ? () => presentar(p.id) : undefined}
                    presentando={ocupado === `present_${p.id}`}
                  />
                ))}
              </section>
            )}

            <button className="lv-btn lv-btn--block" onClick={compartir} style={{ background: "var(--accent-tint)", color: "var(--accent-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
              Invitar gente al vivo
            </button>
            <button className="lv-btn lv-btn--soft lv-btn--block" onClick={() => router.push(`/shows/${showId}`)}>
              Ver como lo ve la gente{vendidas > 0 ? ` · ${vendidas} vendidas` : ""}
            </button>
            {activa?.currentBidderId && (
              <div className="lv-note lv-note--warn" style={{ fontSize: "0.8rem" }}>
                No puedes terminar mientras “{activa.title}” tiene pujas. Espera a que cierre — son segundos.
              </div>
            )}
            <button className="lv-btn lv-btn--danger lv-btn--block" disabled={ocupado === "end" || !!activa?.currentBidderId} onClick={terminar}>
              {ocupado === "end" ? "Terminando…" : "Terminar show"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
