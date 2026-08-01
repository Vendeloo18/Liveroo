"use client";
import { useRef, useState } from "react";

// =============================================================
// Deslizar para pujar — v3
// =============================================================
// Gradiente con profundidad, brillo que invita, relleno de progreso,
// "¡Suelta!" cerca del final y un cierre pulido: la pista se funde a
// VERDE de éxito, la perilla hace pop con su check y vibra (si el
// teléfono puede). Con `holdSuccess` se queda clavado en verde (el
// onboarding lo usa como "desliza para continuar"); sin él, vuelve
// suave al inicio listo para la próxima puja.
// =============================================================

export function SlideToBid({
  label,
  onConfirm,
  disabled,
  color = "var(--accent)",
  successLabel = "¡Listo!",
  holdSuccess = false,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  color?: string;
  successLabel?: string;
  holdSuccess?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const [hecho, setHecho] = useState(false);
  const inicio = useRef(0);
  const KNOB = 40;
  const PAD = 4;

  const maxX = () => Math.max(0, (trackRef.current?.offsetWidth ?? 300) - KNOB - PAD * 2);

  const onDown = (e: React.PointerEvent) => {
    if (disabled || hecho) return;
    setDrag(true);
    inicio.current = e.clientX - x;
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* puntero sintético */ }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setX(Math.max(0, Math.min(maxX(), e.clientX - inicio.current)));
  };
  const soltar = () => {
    if (!drag) return;
    setDrag(false);
    if (x >= maxX() * 0.7) {
      setX(maxX());
      setHecho(true);
      try { (navigator as any).vibrate?.(35); } catch { /* sin vibración */ }
      onConfirm();
      if (!holdSuccess) {
        setTimeout(() => { setHecho(false); setX(0); }, 950);
      }
    } else {
      setX(0);
    }
  };

  const progreso = maxX() > 0 ? x / maxX() : 0;
  const casi = progreso > 0.8 && !hecho;

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative", height: 48, borderRadius: 999, overflow: "hidden",
        background: `linear-gradient(180deg, color-mix(in srgb, ${color} 80%, #fff) 0%, ${color} 55%, color-mix(in srgb, ${color} 85%, #000) 100%)`,
        boxShadow: hecho
          ? "inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 22px rgba(16,154,69,0.45)"
          : `inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -3px 9px rgba(0,0,0,0.22), 0 8px 22px color-mix(in srgb, ${color} 45%, transparent)`,
        opacity: disabled ? 0.5 : 1, touchAction: "none", userSelect: "none",
        transition: "box-shadow 0.35s ease",
      }}
    >
      <style>{`
        @keyframes s2bShine{0%{transform:translateX(-140%)}55%,100%{transform:translateX(360%)}}
        @keyframes s2bText{0%{background-position:200% 0}100%{background-position:-100% 0}}
        @keyframes s2bPop{0%{transform:scale(0.55)}55%{transform:scale(1.18)}100%{transform:scale(1)}}
        @keyframes s2bIn{0%{opacity:0;transform:scale(0.94)}100%{opacity:1;transform:scale(1)}}
      `}</style>

      {/* Capa de éxito: la pista entera se funde a verde */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(180deg, #1ec763, #0f9a45)",
        opacity: hecho ? 1 : 0, transition: "opacity 0.35s ease",
      }}/>

      {/* Relleno de progreso detrás de la perilla */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: x + KNOB + PAD,
        background: "rgba(255,255,255,0.18)", pointerEvents: "none",
        opacity: hecho ? 0 : 1,
        transition: drag ? "opacity 0.3s" : "width 0.5s cubic-bezier(.2,1,.3,1), opacity 0.3s",
      }}/>

      {/* Brillo que barre, invitando a deslizar */}
      {!drag && !hecho && progreso < 0.05 && (
        <div style={{ position: "absolute", top: 0, bottom: 0, width: 70, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)", animation: "s2bShine 2.8s ease-in-out infinite", pointerEvents: "none" }}/>
      )}

      {/* Etiqueta con shimmer */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: KNOB, pointerEvents: "none", opacity: hecho ? 0 : Math.max(0, 1 - progreso * 1.6), transition: "opacity 0.2s" }}>
        <span style={{
          fontWeight: 800, fontSize: "0.92rem", letterSpacing: "-0.01em",
          background: "linear-gradient(90deg, rgba(255,255,255,0.6) 0%, #fff 50%, rgba(255,255,255,0.6) 100%)",
          backgroundSize: "220% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          animation: "s2bText 2.6s linear infinite",
        }}>
          {label}
        </span>
      </div>

      {/* Etiqueta de éxito */}
      {hecho && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingRight: KNOB - 6, gap: 7, pointerEvents: "none", color: "#fff", fontWeight: 800, fontSize: "0.92rem", animation: "s2bIn 0.3s ease 0.08s both" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          {successLabel}
        </div>
      )}

      {/* Cerca del final: suelta */}
      {casi && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 18, color: "#fff", fontWeight: 900, fontSize: "0.84rem", pointerEvents: "none", textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
          ¡Suelta!
        </div>
      )}

      {/* Perilla */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        style={{
          position: "absolute", top: PAD, left: PAD, width: KNOB, height: KNOB, borderRadius: "50%",
          background: "linear-gradient(180deg, #ffffff, #ededed)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: `translateX(${x}px) scale(${drag ? 1.07 : 1})`,
          transition: drag ? "transform 0.05s" : "transform 0.55s cubic-bezier(.22,1.2,.32,1)",
          boxShadow: "0 3px 11px rgba(0,0,0,0.32), inset 0 1px 0 #fff",
          cursor: disabled ? "default" : "grab", touchAction: "none",
          animation: hecho ? "s2bPop 0.45s cubic-bezier(.2,1.5,.4,1)" : undefined,
        }}
      >
        {hecho ? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#0f9a45" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}><path d="M5 6l6 6-6 6M12 6l6 6-6 6"/></svg>
        )}
      </div>
    </div>
  );
}
