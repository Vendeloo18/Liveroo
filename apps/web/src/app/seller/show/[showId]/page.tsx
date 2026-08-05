"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, collection, onSnapshot, query, where, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../../lib/firebase";
import { useAuthStore } from "../../../../store/authStore";
import { useAgora } from "../../../../hooks/useAgora";
import { useCountdown } from "../../../../hooks/useCountdown";
import { ImageUploader } from "../../../../components/ui/ImageUploader";
import { BRAND, formatUsd } from "@subastas-ve/shared";

// Cada cuánto le avisa al servidor que sigue transmitiendo. El barrido da
// el vivo por abandonado a los 90s sin latido, así que 25s deja margen
// para dos latidos perdidos por mala señal.
const LATIDO_MS = 25_000;
// Una presencia cuenta si se refrescó hace menos de esto. El espectador
// la refresca cada 25s: 60s tolera un salto sin descontar a nadie.
const PRESENCIA_FRESCA_MS = 60_000;

const ESTADO: Record<string, { texto: string; clase: string }> = {
  waiting: { texto: "En cola", clase: "lv-badge--soft" },
  active: { texto: "En venta", clase: "lv-badge--accent" },
  sold: { texto: "Vendida", clase: "lv-badge--accent" },
  unsold: { texto: "Sin ganador", clase: "lv-badge--soft" },
  skipped: { texto: "Saltada", clase: "lv-badge--soft" },
  cancelled: { texto: "Cancelada", clase: "lv-badge--soft" },
};

// --------------------------------------------------
// Lo que se está subastando AHORA
// --------------------------------------------------
// Es la única cosa que el vendedor mira mientras habla a la cámara, así
// que ocupa el ancho completo y el precio se lee de lejos: es el número
// que va cantando.

function EnVentaAhora({ p, onSaltar, saltando }: { p: any; onSaltar: () => void; saltando: boolean }) {
  const { texto, urgente, vencida } = useCountdown(p.endsAt);
  const ofertas = p.bidsCount ?? 0;
  const cerrando = vencida || p.status !== "active";

  return (
    <section
      className="lv-panel"
      style={{ padding: 0, overflow: "hidden", boxShadow: `inset 0 0 0 2px ${urgente ? "var(--urgent)" : "var(--accent)"}` }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 14px", background: urgente ? "var(--urgent)" : "var(--accent)", color: "#fff",
      }}>
        <span className="lv-eyebrow" style={{ color: "#fff" }}>En venta ahora</span>
        <span className="lv-mono" style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.01em" }}>
          {cerrando ? "Cerrando…" : texto}
        </span>
      </div>

      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: "0.95rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {p.title}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
          <span className="lv-price lv-price--xl">{formatUsd(p.currentBidUsd ?? 0)}</span>
          <span className="lv-dim" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
            {ofertas} {ofertas === 1 ? "oferta" : "ofertas"}
          </span>
        </div>

        {p.currentBidderId ? (
          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ok)", marginTop: 4 }}>
            Va ganando {p.currentBidderName ?? "un comprador"}
          </div>
        ) : (
          <div className="lv-dim" style={{ fontSize: "0.82rem", marginTop: 4 }}>
            Nadie ha ofertado — insiste, que el reloj corre
          </div>
        )}

        {/* Saltar solo si nadie puso plata: el motor lo rechaza igual */}
        {!cerrando && !p.currentBidderId && (
          <button className="lv-btn lv-btn--outline lv-btn--block lv-btn--sm" style={{ marginTop: 12 }} disabled={saltando} onClick={onSaltar}>
            {saltando ? "…" : "Saltar este producto"}
          </button>
        )}
      </div>
    </section>
  );
}

function FilaCola({ p, onPresentar, presentando }: { p: any; onPresentar?: () => void; presentando?: boolean }) {
  const e = ESTADO[p.status] ?? { texto: p.status, clase: "lv-badge--soft" };
  const foto = p.imageURL ?? p.imageURLs?.[0];

  return (
    <div className="lv-row">
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 9, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
          {foto && <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.title}
          </div>
          <div className="lv-dim" style={{ fontSize: "0.72rem", marginTop: 1 }}>
            Empieza en {formatUsd(p.startingPriceUsd ?? p.currentBidUsd ?? 0)}
          </div>
          {p.status !== "waiting" && <span className={`lv-badge ${e.clase}`} style={{ marginTop: 4 }}>{e.texto}</span>}
        </div>
      </div>

      {p.status === "waiting" && onPresentar && (
        <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={presentando} onClick={onPresentar}>
          {presentando ? "…" : "Vender ahora"}
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
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  // Salir en vivo es de un toque, así que el título nace del nombre de la
  // tienda. Ponerle uno propio se hace acá, sin frenar el arranque.
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [tituloNuevo, setTituloNuevo] = useState("");

  const [titulo, setTitulo] = useState("");
  const [precio, setPrecio] = useState("");
  // El incremento se calcula del precio y la duración se hereda del
  // artículo anterior: entre productos del mismo vivo casi nunca cambian,
  // y pedirlos cada vez obliga a escribir con una mano sosteniendo el
  // producto frente a la cámara. Ambos siguen siendo editables.
  const [timer, setTimer] = useState("1"); // minutos, se recuerda
  const [ajustes, setAjustes] = useState(false);
  const [incrementoManual, setIncrementoManual] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);

  // Menos de $20 sube de $1; hasta $100, de $2; más caro, de $5.
  const incrementoSugerido = (p: number) => (!isFinite(p) || p < 20 ? 1 : p <= 100 ? 2 : 5);
  const incremento = incrementoManual || String(incrementoSugerido(parseFloat(precio)));

  const videoRef = useRef<HTMLDivElement>(null);
  // Se le pasa el showId, no el canal: el canal y el rol los resuelve
  // generateAgoraToken en el servidor.
  const agora = useAgora(showId, "host");

  const enVivo = show?.status === "live";
  const esDueño = !!show && !!profile && show.sellerId === profile.uid;

  useEffect(() => {
    const u1 = onSnapshot(doc(db, "shows", showId), s => { if (s.exists()) setShow({ id: s.id, ...s.data() }); });
    // Las subastas del vivo viven en /auctions con mode:"live". Filtramos
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

  // ── Latido ──────────────────────────────────────────────
  // Mientras este panel esté abierto y al aire, el servidor sabe que el
  // vendedor sigue ahí. Si deja de llegar, el barrido termina el vivo. Es
  // lo que evita que un show quede EN VIVO en el home con la cámara ya
  // muerta porque alguien cerró la app sin darle a Terminar.
  useEffect(() => {
    if (!enVivo || !esDueño) return;
    const ref = doc(db, "shows", showId);
    const latir = () => { updateDoc(ref, { hostSeenAt: serverTimestamp() }).catch(() => undefined); };
    latir();
    const t = setInterval(latir, LATIDO_MS);
    // Latir en los DOS sentidos del cambio de pestaña, no solo al volver.
    // El navegador congela los timers en cuanto te cambias de app, así que
    // el latido de salida es el que hace que la cuenta atrás del servidor
    // empiece cuando te fuiste y no en el último tic del intervalo —que
    // pudo haber sido 24 segundos antes. Importa porque el botón
    // "Invitar" abre el compartir nativo y manda la app al fondo.
    const alCambiar = () => latir();
    document.addEventListener("visibilitychange", alCambiar);
    window.addEventListener("pagehide", alCambiar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alCambiar);
      window.removeEventListener("pagehide", alCambiar);
    };
  }, [enVivo, esDueño, showId]);

  // ── Espectadores de verdad ──────────────────────────────
  // Cada quien refresca su propio doc en /viewers mientras mira. Aquí se
  // cuentan los frescos. El vendedor es el único garantizado presente
  // durante todo el vivo, así que es quien publica el total en el show
  // para que el home y el buscador lo vean.
  const [presencias, setPresencias] = useState<{ id: string; ms: number }[]>([]);
  const [tic, setTic] = useState(0);

  useEffect(() => {
    if (!enVivo || !esDueño) return;
    const u = onSnapshot(
      collection(db, "shows", showId, "viewers"),
      s => setPresencias(s.docs.map(d => ({ id: d.id, ms: d.data().seenAt?.toMillis?.() ?? 0 }))),
      () => undefined);
    // Nadie escribe cuando alguien SE VA: su doc simplemente deja de
    // refrescarse. Sin este tic, el conteo se quedaría congelado en el
    // último que entró.
    const t = setInterval(() => setTic(x => x + 1), 15_000);
    return () => { u(); clearInterval(t); };
  }, [enVivo, esDueño, showId]);

  const viendo = useMemo(() => {
    const corte = Date.now() - PRESENCIA_FRESCA_MS;
    return presencias.filter(p => p.id !== profile?.uid && p.ms > corte).length;
    // tic entra a propósito: obliga a recontar aunque nadie escriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presencias, tic, profile?.uid]);

  useEffect(() => {
    if (!enVivo || !esDueño) return;
    if ((show?.viewerCount ?? 0) === viendo) return;
    updateDoc(doc(db, "shows", showId), { viewerCount: viendo }).catch(() => undefined);
  }, [viendo, enVivo, esDueño, showId, show?.viewerCount]);

  const avisar = (tipo: "ok" | "bad", texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 6000);
  };

  // El estado del vivo lo mueve el motor, no el navegador: startShow
  // valida que seas el dueño y activa la primera subasta de la cola.
  const iniciar = async () => {
    setOcupado("start");
    try {
      await httpsCallable(functions, "startShow")({ showId });
      await agora.join(videoRef.current);
    } catch (e: any) {
      avisar("bad", e?.message ?? "No se pudo salir en vivo");
    } finally { setOcupado(null); }
  };

  // Salir en vivo de un toque: /seller crea el show y manda para acá con
  // ?vivo=1. Antes eran tres pantallas —crear, "todo listo", salir— para
  // decidir exactamente nada.
  const arranqueAuto = useRef(false);
  useEffect(() => {
    if (arranqueAuto.current || !show || !profile) return;
    if (show.sellerId !== profile.uid) return;
    if (new URLSearchParams(window.location.search).get("vivo") !== "1") return;
    if (!["scheduled", "draft"].includes(show.status)) return;
    arranqueAuto.current = true;
    // Limpia el parámetro: recargar la página no debe reintentar el
    // arranque de un show que ya está al aire.
    window.history.replaceState({}, "", `/seller/show/${showId}`);
    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, profile]);

  const terminar = async () => {
    setConfirmarSalida(false);
    setOcupado("end");
    try {
      await agora.leave();
      await httpsCallable(functions, "endShow")({ showId });
      router.push("/seller");
    } catch (e: any) {
      avisar("bad", e?.message ?? "No se pudo terminar la venta en vivo");
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
      // La duración SÍ se hereda (es la misma todo el vivo). El incremento
      // vuelve a automático: si pusiste $5 a mano para algo caro, el
      // siguiente artículo barato no debe heredarlo.
      setTitulo(""); setPrecio(""); setFotos([]); setIncrementoManual(""); setAjustes(false);
      // Al aire y sin nada subastándose → arranca este al instante.
      if (show?.status === "live" && !productos.some(x => x.status === "active")) {
        await httpsCallable(functions, "presentAuction")({ showId, auctionId: ref.id });
      } else {
        avisar("ok", "Listo, queda de siguiente en la cola");
      }
    } catch (e: any) {
      avisar("bad", e?.message ?? "No se pudo sacar a la venta");
    } finally { setOcupado(null); }
  };

  // Poner en vivo un artículo que estaba en cola (cuando el anterior cerró).
  const presentar = async (auctionId: string) => {
    setOcupado(`present_${auctionId}`);
    try {
      await httpsCallable(functions, "presentAuction")({ showId, auctionId });
    } catch (e: any) {
      avisar("bad", e?.message ?? "No se pudo poner a la venta");
    } finally { setOcupado(null); }
  };

  // Invitar gente: comparte el link del vivo (WhatsApp/redes) o lo copia.
  const compartir = async () => {
    const url = `${window.location.origin}/shows/${showId}`;
    const texto = `🔴 Estoy vendiendo EN VIVO en ${BRAND.name}. ¡Entra a mirar y usa PUJALOO! ${url}`;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: `${BRAND.name} — En vivo`, text: texto, url });
      } else {
        await navigator.clipboard.writeText(url);
        avisar("ok", "Link copiado — mándaselo a tu gente");
      }
    } catch { /* el usuario canceló el compartir */ }
  };

  const guardarTitulo = async () => {
    const t = tituloNuevo.trim();
    if (!t || t === show?.title) { setEditandoTitulo(false); return; }
    setEditandoTitulo(false);
    try {
      await updateDoc(doc(db, "shows", showId), { title: t.slice(0, 120), updatedAt: serverTimestamp() });
    } catch { avisar("bad", "No se pudo cambiar el nombre"); }
  };

  // Salir del panel con el vivo encendido: el latido lo mantiene abierto
  // un par de minutos, así que hay que preguntar en vez de dejarlo al azar.
  const atras = () => {
    if (enVivo) { setConfirmarSalida(true); return; }
    router.push("/seller");
  };

  if (!show) {
    return <div className="lv-app"><div className="lv-empty"><div className="lv-empty__text">Cargando…</div></div></div>;
  }

  const waiting = productos.filter(p => p.status === "waiting");
  const activa = productos.find(p => p.status === "active");
  const vendidas = productos.filter(p => p.status === "sold");
  const recaudado = vendidas.reduce((s, p) => s + (p.currentBidUsd ?? 0), 0);
  const puedeIniciar = ["scheduled", "draft"].includes(show.status);
  const listoParaSacar = !!titulo.trim() && !!precio;

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={atras} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            onClick={() => { setTituloNuevo(show.title ?? ""); setEditandoTitulo(true); }}
            disabled={show.status === "ended"}
            style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: "100%" }}
            aria-label="Cambiar el nombre del vivo"
          >
            <h1 className="lv-topbar__title" style={{ fontSize: "1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{show.title}</h1>
            {show.status !== "ended" && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
              </svg>
            )}
          </button>
          <div className="lv-dim" style={{ fontSize: "0.7rem" }}>
            {enVivo
              ? `${vendidas.length} ${vendidas.length === 1 ? "vendida" : "vendidas"}${recaudado > 0 ? ` · ${formatUsd(recaudado)}` : ""}`
              : show.status === "ended" ? "Terminada" : "Aún no has salido"}
          </div>
        </div>
        {enVivo && <span className="lv-badge lv-badge--live"><i className="lv-dot"/> EN VIVO</span>}
      </header>

      <div className="lv-pad" style={{ paddingTop: 14, display: "grid", gap: 13 }}>
        {aviso && <div className={`lv-note lv-note--${aviso.tipo}`}>{aviso.texto}</div>}

        {/* ── Cámara ─────────────────────────────────────────────
            Se monta ANTES de salir al aire, a propósito. Estaba dentro de
            un {enVivo && …}, así que cuando iniciar() llamaba a
            agora.join(videoRef.current) ese div todavía no existía y le
            llegaba null: el público sí recibía el video, pero el vendedor
            se quedaba mirando un recuadro negro para siempre. */}
        {show.status !== "ended" && (
          <div>
            <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 16, overflow: "hidden", background: "#000" }}>
              <div ref={videoRef} style={{ position: "absolute", inset: 0 }}/>

              {agora.joined && (
                <>
                  {/* Cuánta gente te está viendo, AHORA. Era el dato que
                      el vendedor no tenía: transmitía a ciegas. */}
                  <div style={{
                    position: "absolute", top: 10, left: 10, display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "7px 12px", borderRadius: "var(--r-pill)",
                    background: viendo > 0 ? "var(--live)" : "rgba(0,0,0,0.58)",
                    color: "#fff", backdropFilter: "blur(8px)",
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span style={{ fontSize: "0.92rem", fontWeight: 800, lineHeight: 1 }}>{viendo}</span>
                    <span style={{ fontSize: "0.74rem", fontWeight: 600, opacity: 0.9, lineHeight: 1 }}>
                      {viendo === 1 ? "viendo" : "viendo"}
                    </span>
                  </div>

                  <div style={{ position: "absolute", bottom: 10, left: 10, display: "flex", gap: 8 }}>
                    {([["mic", micOn, setMicOn, agora.toggleMic], ["cam", camOn, setCamOn, agora.toggleCamera]] as const).map(([k, on, set, fn]) => (
                      <button
                        key={k}
                        onClick={async () => { await fn(); set(v => !v); }}
                        aria-label={k === "mic" ? (on ? "Silenciar" : "Activar micrófono") : (on ? "Apagar cámara" : "Encender cámara")}
                        style={{ width: 40, height: 40, borderRadius: "50%", background: on ? "rgba(255,255,255,0.22)" : "var(--live)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                          {k === "mic"
                            ? (on ? <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></>
                                  : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></>)
                            : <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>}
                        </svg>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={compartir}
                    style={{
                      position: "absolute", bottom: 10, right: 10, display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "10px 14px", borderRadius: "var(--r-pill)", background: "rgba(255,255,255,0.22)",
                      backdropFilter: "blur(8px)", color: "#fff", fontSize: "0.8rem", fontWeight: 700,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
                    Invitar
                  </button>
                </>
              )}

              {!agora.joined && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", textAlign: "center", padding: "0 24px" }}>
                  {ocupado === "start" || agora.loading
                    ? "Prendiendo la cámara…"
                    : !enVivo ? "Tu cámara se prende al salir en vivo"
                    : agora.error ? agora.error
                    : "Cámara desconectada"}
                  {enVivo && !agora.loading && ocupado !== "start" && (
                    <button className="lv-btn lv-btn--sm" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }} onClick={() => agora.join(videoRef.current)}>
                      Reconectar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sin público, la acción (invitar) en vez de la queja. Con
                público, confirmarle que lo que ve es lo que sale al aire —
                antes decía "es normal que se vea negro", que era tapar el
                bug del ref nulo con una explicación falsa. */}
            {agora.joined && (
              viendo === 0 ? (
                <button
                  onClick={compartir}
                  className="lv-note"
                  style={{ width: "100%", textAlign: "left", marginTop: 9, display: "flex", gap: 9, alignItems: "center" }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
                  <span>
                    <strong>Todavía no hay nadie mirando.</strong> Manda el link por WhatsApp
                    y empieza a vender apenas entren.
                  </span>
                </button>
              ) : (
                <div className="lv-dim" style={{ fontSize: "0.72rem", textAlign: "center", lineHeight: 1.45, marginTop: 8 }}>
                  Estás al aire — <strong style={{ color: "var(--ink-2)" }}>lo que ves aquí es lo que ve tu público</strong>.
                </div>
              )
            )}
          </div>
        )}

        {show.status === "ended" ? (
          <>
            <div className="lv-note">Esta venta en vivo ya terminó.</div>
            {vendidas.length > 0 && (
              <section className="lv-panel" style={{ textAlign: "center", padding: "20px 16px" }}>
                <div className="lv-eyebrow">Lo que vendiste</div>
                <div className="lv-price lv-price--xl" style={{ marginTop: 6 }}>{formatUsd(recaudado)}</div>
                <div className="lv-dim" style={{ fontSize: "0.82rem", marginTop: 2 }}>
                  en {vendidas.length} {vendidas.length === 1 ? "producto" : "productos"}
                </div>
              </section>
            )}
            <button className="lv-btn lv-btn--soft lv-btn--block" onClick={() => router.push("/seller")}>
              Volver a Vender
            </button>
          </>
        ) : !enVivo ? (
          /* ── Aún no salió al aire ──
             Solo se llega acá si el arranque automático falló o si es un
             show viejo: normalmente /seller entra ya transmitiendo. */
          <section className="lv-panel" style={{ textAlign: "center", padding: "26px 18px" }}>
            <div style={{ fontFamily: "var(--f-campaign)", fontSize: "1.5rem", textTransform: "uppercase", lineHeight: 1.05 }}>
              Todo listo
            </div>
            <p className="lv-dim" style={{ fontSize: "0.86rem", lineHeight: 1.5, margin: "9px 0 18px" }}>
              Prende la cámara y ve sacando lo que vendes, uno por uno.
              {waiting.length > 0 ? ` Tienes ${waiting.length} en cola.` : ""}
            </p>
            <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={!puedeIniciar || ocupado === "start"} onClick={iniciar}>
              {ocupado === "start" ? "Saliendo…" : "Salir en vivo"}
            </button>
          </section>
        ) : (
          /* ── Al aire: sacar productos uno por uno ── */
          <>
            {activa && (
              <EnVentaAhora p={activa} saltando={ocupado === `skip_${activa.id}`} onSaltar={() => saltar(activa.id)}/>
            )}

            {/* Sacar un producto. Sin nada en venta esta tarjeta ES la
                pantalla: nombre, precio y un botón. Todo lo demás vive
                detrás de "Ajustes" porque entre productos del mismo vivo
                casi nunca cambia. */}
            <section className="lv-panel">
              <div className="lv-eyebrow" style={{ marginBottom: 10 }}>
                {activa ? "Preparar el siguiente" : waiting.length > 0 ? "Sacar otro producto" : "¿Qué vas a vender?"}
              </div>

              <div className="lv-field">
                <input
                  id="t" className="lv-input" value={titulo} onChange={e => setTitulo(e.target.value)}
                  placeholder="Ej: Proyector portátil" autoComplete="off"
                  style={{ fontSize: "1rem", fontWeight: 600 }}
                />
              </div>

              <div className="lv-field">
                <label className="lv-field__label" htmlFor="p">Precio de arranque</label>
                <input
                  id="p" className="lv-input" type="number" inputMode="decimal" min="0.5" step="0.5"
                  value={precio} onChange={e => setPrecio(e.target.value)} placeholder="10"
                  style={{ fontSize: "1.05rem", fontWeight: 700 }}
                />
                <div className="lv-field__hint">
                  {parseFloat(precio) > 0
                    ? `Dura ${parseInt(timer) || 1} min · sube de ${formatUsd(parseFloat(incremento))} por oferta`
                    : "Arranca bajo: la gente puja más cuando ve que puede ganar"}
                </div>
              </div>

              <button
                className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg"
                disabled={ocupado === "add" || !listoParaSacar}
                onClick={agregar}
              >
                {ocupado === "add" ? "Un momento…" : activa ? "Dejar listo el siguiente" : "Sacar a la venta"}
              </button>

              <button
                type="button"
                onClick={() => setAjustes(a => !a)}
                style={{ display: "block", margin: "12px auto 0", fontSize: "0.8rem", fontWeight: 700, color: "var(--ink-3)" }}
              >
                {ajustes ? "Listo" : "Duración, incremento y foto"}
              </button>

              {ajustes && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                  <div className="lv-field">
                    <span className="lv-field__label">¿Cuánto dura? <span className="lv-dim" style={{ fontWeight: 400 }}>· se queda así para los siguientes</span></span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button type="button" aria-label="menos" onClick={() => setTimer(t => String(Math.max(1, (parseInt(t) || 1) - 1)))} className="lv-btn lv-btn--outline" style={{ width: 48, height: 48, padding: 0, fontSize: "1.5rem", borderRadius: 12 }}>−</button>
                      <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: "1.1rem" }}>{parseInt(timer) || 1} min</div>
                      <button type="button" aria-label="más" onClick={() => setTimer(t => String(Math.min(30, (parseInt(t) || 1) + 1)))} className="lv-btn lv-btn--outline" style={{ width: 48, height: 48, padding: 0, fontSize: "1.5rem", borderRadius: 12 }}>+</button>
                    </div>
                  </div>

                  <div className="lv-field">
                    <label className="lv-field__label" htmlFor="i">Sube de <span className="lv-dim" style={{ fontWeight: 400 }}>· automático según el precio</span></label>
                    <input id="i" className="lv-input" type="number" inputMode="decimal" min="0.5" step="0.5" value={incremento} onChange={e => setIncrementoManual(e.target.value)}/>
                  </div>

                  <div className="lv-field" style={{ marginBottom: 0 }}>
                    <span className="lv-field__label">Foto <span className="lv-dim" style={{ fontWeight: 400 }}>· solo para el feed, en el vivo se ve por cámara</span></span>
                    <ImageUploader images={fotos} onChange={setFotos} path={`products/${profile?.uid ?? "anon"}`} max={3}/>
                  </div>
                </div>
              )}
            </section>

            {/* En cola */}
            {waiting.length > 0 && (
              <section className="lv-panel" style={{ padding: "2px 16px" }}>
                <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>En cola · {waiting.length}</div>
                {waiting.map(p => (
                  <FilaCola
                    key={p.id}
                    p={p}
                    onPresentar={!activa ? () => presentar(p.id) : undefined}
                    presentando={ocupado === `present_${p.id}`}
                  />
                ))}
              </section>
            )}

            <button className="lv-btn lv-btn--soft lv-btn--block" onClick={() => router.push(`/shows/${showId}`)}>
              Ver como lo ve la gente
            </button>

            <button
              type="button"
              onClick={() => setConfirmarSalida(true)}
              style={{ display: "block", margin: "2px auto 8px", fontSize: "0.82rem", fontWeight: 700, color: "var(--live)" }}
            >
              Terminar la venta en vivo
            </button>
          </>
        )}
      </div>

      {editandoTitulo && (
        <div
          onClick={() => setEditandoTitulo(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="lv-panel"
            style={{ width: "min(100%, var(--app-max))", margin: 12, padding: "20px 18px", borderRadius: 20 }}
          >
            <div className="lv-field">
              <label className="lv-field__label" htmlFor="titulo-vivo">¿Cómo se llama tu vivo?</label>
              <input
                id="titulo-vivo" className="lv-input" value={tituloNuevo} maxLength={120} autoFocus
                onChange={e => setTituloNuevo(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") guardarTitulo(); }}
                placeholder="Ej: Sneakers importados"
              />
              <div className="lv-field__hint">Es lo que ve la gente en el inicio. Un buen nombre trae más gente.</div>
            </div>
            <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" onClick={guardarTitulo}>Guardar</button>
            <button className="lv-btn lv-btn--soft lv-btn--block" style={{ marginTop: 9 }} onClick={() => setEditandoTitulo(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Terminar o dejarlo corriendo. Antes esto era un confirm() del
          navegador dentro del botón rojo; ahora también atrapa el botón
          de atrás, que era por donde el vivo se quedaba encendido. */}
      {confirmarSalida && (
        <div
          onClick={() => setConfirmarSalida(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="lv-panel"
            style={{ width: "min(100%, var(--app-max))", margin: 12, padding: "20px 18px", borderRadius: 20 }}
          >
            <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>¿Terminas la venta en vivo?</div>
            <p className="lv-dim" style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "7px 0 16px" }}>
              {activa?.currentBidderId
                ? `“${activa.title}” tiene ofertas encima. Espera a que cierre — son segundos — y ahí sí puedes terminar.`
                : waiting.length > 0
                  ? `Se cancelan ${waiting.length} ${waiting.length === 1 ? "producto que queda" : "productos que quedan"} en cola.`
                  : "Se apaga la cámara y tu vivo deja de aparecer en el inicio."}
            </p>
            <button
              className="lv-btn lv-btn--danger lv-btn--block lv-btn--lg"
              disabled={ocupado === "end" || !!activa?.currentBidderId}
              onClick={terminar}
            >
              {ocupado === "end" ? "Terminando…" : "Sí, terminar"}
            </button>
            <button className="lv-btn lv-btn--soft lv-btn--block" style={{ marginTop: 9 }} onClick={() => setConfirmarSalida(false)}>
              Seguir en vivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
