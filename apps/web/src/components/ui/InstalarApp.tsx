"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// =============================================================
// InstalarApp — la franja que consigue que te lleguen los avisos
// =============================================================
// Las dos plataformas se comportan distinto y por eso el mensaje cambia:
//
//   iPhone  — los avisos NO existen si la app no está en la pantalla de
//             inicio. Es un límite de Apple, no hay forma de evitarlo por
//             código. Solo se puede explicar cómo instalarla.
//   Android — los avisos funcionan igual en el navegador, así que aquí
//             instalar es comodidad, no requisito. Y Chrome sí permite
//             un botón de instalar de verdad.
//
// Vivía escondido en Ajustes, donde casi nadie entra. Aquí lo ve quien
// llegó por un enlace de WhatsApp, que es exactamente quien lo necesita.
//
// No aparece en el show en vivo: ahí la pantalla es del video.
// =============================================================

const OCULTO = "vlo_instalar_no";

export function InstalarApp() {
  const pathname = usePathname();
  const [modo, setModo] = useState<"no" | "ios" | "android">("no");
  const [pasos, setPasos] = useState(false);
  const [prompt, setPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { if (localStorage.getItem(OCULTO) === "1") return; } catch { /* modo privado */ }

    const instalada = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (instalada) return;

    const ua = navigator.userAgent;
    const esIphone = /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && "ontouchend" in document);

    if (esIphone) {
      // Dentro del navegador de WhatsApp o Instagram no se puede instalar:
      // hay que abrirlo en Safari primero, y eso lo dicen los pasos.
      setModo("ios");
      return;
    }

    // Android: Chrome avisa cuando la app se puede instalar de verdad.
    const alPoderInstalar = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setModo("android");
    };
    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    return () => window.removeEventListener("beforeinstallprompt", alPoderInstalar);
  }, []);

  const cerrar = () => {
    try { localStorage.setItem(OCULTO, "1"); } catch { /* modo privado */ }
    setModo("no");
  };

  const instalar = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") cerrar();
  };

  // El vivo manda: ahí la pantalla es del video y de la puja.
  if (modo === "no" || /^\/(shows|seller\/show)\//.test(pathname ?? "")) return null;

  return (
    <div style={{
      position: "fixed", left: 12, right: 12, zIndex: 40,
      bottom: "calc(var(--nav-h, 64px) + 12px + env(safe-area-inset-bottom))",
      maxWidth: "calc(var(--app-max, 520px) - 24px)", margin: "0 auto",
      background: "var(--ink)", color: "#fff", borderRadius: 18,
      padding: "13px 14px", boxShadow: "0 14px 40px rgba(0,0,0,0.3)",
      animation: "instalarSube 0.3s cubic-bezier(.22,1,.36,1)",
    }}>
      <style>{`@keyframes instalarSube{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10, background: "var(--accent)", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.86rem", fontWeight: 800, lineHeight: 1.25 }}>
            {modo === "ios" ? "Que te avisemos cuando te superen" : "Ten Vendeloo a mano"}
          </div>
          <div style={{ fontSize: "0.75rem", opacity: 0.75, marginTop: 2, lineHeight: 1.35 }}>
            {modo === "ios"
              ? "En iPhone hace falta agregarla a tu inicio."
              : "Se instala en un toque, sin ocupar casi nada."}
          </div>
        </div>
        {modo === "android" ? (
          <button onClick={instalar} className="lv-btn lv-btn--accent lv-btn--sm" style={{ flexShrink: 0 }}>
            Instalar
          </button>
        ) : (
          <button
            onClick={() => setPasos(p => !p)}
            className="lv-btn lv-btn--sm"
            style={{ flexShrink: 0, background: "#fff", color: "var(--ink)" }}
          >
            {pasos ? "Listo" : "Cómo"}
          </button>
        )}
        <button onClick={cerrar} aria-label="No mostrar más" style={{ color: "rgba(255,255,255,0.5)", padding: 4, flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {pasos && modo === "ios" && (
        <ol style={{ margin: "12px 0 2px", paddingLeft: 20, fontSize: "0.78rem", lineHeight: 1.75, opacity: 0.92 }}>
          <li>Abre esta página en <b>Safari</b>, no dentro de WhatsApp.</li>
          <li>Toca <b>Compartir</b>, el cuadrito con la flecha hacia arriba.</li>
          <li>Baja y elige <b>Agregar a inicio</b>.</li>
          <li>Entra desde el ícono nuevo y listo.</li>
        </ol>
      )}
    </div>
  );
}
