"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { SIMBOLO_PATH } from "@subastas-ve/shared";
import { Logo } from "../../components/ui/Logo";
import { SlideToBid } from "../../components/ui/SlideToBid";

// =============================================================
// Onboarding — 3 pasos sobre el naranja de marca
// =============================================================
// 1 Qué es esto · 2 Dos formas de comprar · 3 Puja de práctica con el
// MISMO slide de la app: deslizarlo es lo que te hace entrar (se clava
// en verde y pasa solo). Iconos SVG de línea — nada de emojis.
// Se muestra UNA vez: localStorage por dispositivo y, con cuenta,
// onboardingDone en el perfil.
// =============================================================

const TOTAL = 3;

const ic = (p: React.ReactNode) => (
  <span style={{ width: 38, height: 38, borderRadius: 12, background: "var(--accent-tint)", color: "var(--accent-strong)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
  </span>
);

export default function OnboardingPage() {
  const router = useRouter();
  const { profile } = useAuthStore();

  const [paso, setPaso] = useState(0);
  const [modo, setModo] = useState<"vivo" | "dias">("vivo");
  const [pujaDemo, setPujaDemo] = useState(4);
  const [inc, setInc] = useState(1);
  const [pujado, setPujado] = useState(false);
  const swipeX = useRef<number | null>(null);

  const terminar = (ruta: string) => {
    try { localStorage.setItem("vlo_onb", "1"); } catch { /* modo privado */ }
    if (profile) updateDoc(doc(db, "users", profile.uid), { onboardingDone: true }).catch(() => undefined);
    router.push(ruta);
  };
  const siguiente = () => { if (paso < TOTAL - 1) setPaso(p => p + 1); };
  const atras = () => setPaso(p => Math.max(0, p - 1));

  // Flechas del teclado
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") siguiente();
      if (e.key === "ArrowLeft") atras();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  const titulos: [string, string][] = [
    ["Subastas\nen vivo.\nPrecios de\nverdad.", "Vendedores de todo el país rematan en vivo. Tú pujas, ganas y coordinas la entrega."],
    ["Dos formas\nde encontrar\ntu próxima\ncompra.", "Toca cada opción para ver cómo funciona."],
    ["Haz una puja\nde práctica.", "Es una simulación: no usa tu saldo. Deslizar la puja te lleva adentro."],
  ];

  return (
    <div
      onPointerDown={e => { swipeX.current = e.clientX; }}
      onPointerUp={e => {
        if (swipeX.current === null) return;
        const dx = e.clientX - swipeX.current;
        swipeX.current = null;
        if (Math.abs(dx) > 70) (dx < 0 ? siguiente() : atras());
      }}
      style={{
        minHeight: "100dvh", maxWidth: "var(--app-max)", margin: "0 auto",
        background: "var(--accent)", position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column",
        padding: "calc(22px + env(safe-area-inset-top)) 20px calc(18px + env(safe-area-inset-bottom))",
        touchAction: "pan-y", userSelect: "none",
      }}
    >
      {/* Etiqueta gigante de fondo */}
      <svg viewBox="0 0 24 24" aria-hidden style={{ position: "absolute", right: "-24%", top: "12%", width: "105%", fill: "var(--accent-light)", opacity: 0.5, pointerEvents: "none" }}>
        <path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/>
      </svg>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Barra superior */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo tamano={26} color="#fff"/>
          <button onClick={() => terminar("/")} style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 700, padding: "6px 2px" }}>
            Saltar
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 14 }}/>

        {/* Título del paso */}
        <div className="lv-eyebrow" style={{ color: "rgba(255,255,255,0.85)", letterSpacing: "0.16em" }}>
          Paso {paso + 1} de {TOTAL}
        </div>
        <h1 className="lv-display" style={{ color: "#fff", fontSize: "clamp(2.1rem, 11vw, 3rem)", lineHeight: 0.92, marginTop: 10, whiteSpace: "pre-line" }}>
          {titulos[paso][0]}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.92)", fontSize: "0.98rem", fontWeight: 600, lineHeight: 1.45, marginTop: 14, maxWidth: 340 }}>
          {titulos[paso][1]}
        </p>

        {/* Tarjeta del paso */}
        <div style={{ background: "var(--bg)", borderRadius: "var(--r-card)", padding: 18, marginTop: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.22)" }}>

          {/* ── Paso 1: qué es ── */}
          {paso === 0 && (
            <div style={{ display: "grid", gap: 4 }}>
              {([
                [ic(<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>),
                  "Shows en vivo", "El vendedor presenta cada artículo por video y tú pujas al momento."],
                [ic(<><path d="M12 2v3M12 19v3M5 12H2M22 12h-3M4.9 4.9l2.1 2.1M16.9 16.9l2.2 2.2M19.1 4.9L17 7M7 17l-2.1 2.1"/></>),
                  "Subastas de verdad", "El precio lo decide la gente pujando, no una etiqueta."],
                [ic(<><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></>),
                  "Pagas en bolívares", "Precios en dólares, pago local. Todo en Venezuela."],
              ] as [React.ReactNode, string, string][]).map(([icono, t, s]) => (
                <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 2px" }}>
                  {icono}
                  <div>
                    <div style={{ fontSize: "0.92rem", fontWeight: 800 }}>{t}</div>
                    <div className="lv-dim" style={{ fontSize: "0.78rem", lineHeight: 1.45, marginTop: 2 }}>{s}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Paso 2: dos formas ── */}
          {paso === 1 && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {([["vivo", "En vivo"], ["dias", "Por días"]] as ["vivo" | "dias", string][]).map(([v, t]) => (
                  <button
                    key={v}
                    onClick={() => setModo(v)}
                    className="lv-btn"
                    style={{
                      flex: 1, height: 44,
                      background: modo === v ? "var(--accent)" : "var(--surface-2)",
                      color: modo === v ? "var(--accent-ink)" : "var(--ink-2)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="lv-eyebrow" style={{ color: "var(--accent-strong)" }}>
                {modo === "vivo" ? "Rápido y en directo" : "Con calma"}
              </div>
              <div className="lv-display" style={{ fontSize: "1.35rem", marginTop: 6, lineHeight: 1.05 }}>
                {modo === "vivo" ? "Mira al vendedor y puja en segundos." : "Subastas que duran horas o días."}
              </div>
              <p className="lv-dim" style={{ fontSize: "0.84rem", lineHeight: 1.55, marginTop: 8 }}>
                {modo === "vivo"
                  ? "Ves cada lote mientras el vendedor lo presenta y reaccionas al momento, como en primera fila de un remate."
                  : "Encuentras el artículo, dejas tu puja y te avisamos si alguien te supera. Vuelves cuando quieras."}
              </p>
            </div>
          )}

          {/* ── Paso 3: puja de práctica — deslizar ES continuar ── */}
          {paso === 2 && (
            <div onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="lv-badge lv-badge--accent">Demo</span>
                <span className="lv-eyebrow">Puja actual</span>
              </div>
              <div className="lv-price" style={{ fontSize: "2.6rem", lineHeight: 1 }}>${pujaDemo}</div>

              <div style={{ display: "flex", gap: 8, margin: "14px 0 12px" }}>
                {[1, 5, 10].map(v => (
                  <button
                    key={v}
                    onClick={() => !pujado && setInc(v)}
                    className="lv-btn lv-btn--sm"
                    style={{
                      flex: 1,
                      background: inc === v ? "var(--accent)" : "var(--surface-2)",
                      color: inc === v ? "var(--accent-ink)" : "var(--ink-2)",
                      opacity: pujado && inc !== v ? 0.5 : 1,
                    }}
                  >
                    +${v}
                  </button>
                ))}
              </div>

              <SlideToBid
                label={`Puja $${pujaDemo + inc}`}
                successLabel="¡Vas ganando!"
                holdSuccess
                onConfirm={() => {
                  setPujado(true);
                  setPujaDemo(p => p + inc);
                  setTimeout(() => terminar("/"), 1200);
                }}
              />

              <div style={{ textAlign: "center", fontSize: "0.8rem", fontWeight: 700, color: pujado ? "var(--ok)" : "var(--ink-3)", marginTop: 12, minHeight: 18, transition: "color 0.3s" }}>
                {pujado ? "Puja registrada. Entrando a Vendeloo…" : "Desliza la flecha hacia la derecha para pujar y entrar."}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 16 }}/>

        {/* Progreso */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} style={{ flex: 1, height: 3.5, borderRadius: 999, background: i <= paso ? "#fff" : "rgba(255,255,255,0.35)", transition: "background 0.25s" }}/>
          ))}
        </div>

        {/* Controles: en el paso 3 el que continúa es el slide de arriba */}
        <div style={{ display: "flex", gap: 10, minHeight: 54 }}>
          {paso > 0 && (
            <button onClick={atras} className="lv-btn lv-btn--lg" style={{ background: "transparent", color: "#fff", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.7)", flexShrink: 0, padding: "0 22px" }}>
              Atrás
            </button>
          )}
          {paso < TOTAL - 1 ? (
            <button onClick={siguiente} className="lv-btn lv-btn--lg" style={{ flex: 1, background: "#fff", color: "var(--accent)" }}>
              Continuar
            </button>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.9)", fontSize: "0.85rem", fontWeight: 700 }}>
              Desliza la puja para entrar
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", fontSize: "0.66rem", color: "rgba(255,255,255,0.75)", marginTop: 9 }}>
          También puedes deslizar o usar las flechas del teclado.
        </div>
      </div>
    </div>
  );
}
