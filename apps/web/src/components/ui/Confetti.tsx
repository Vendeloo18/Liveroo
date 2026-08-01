"use client";
import { useMemo } from "react";

// Confetti autocontenido (sin librerías): un puñado de papelitos que caen y
// giran, y se van solos. Se monta cuando alguien gana una subasta.
const COLORES = ["#ff6a00", "#ffd166", "#06d6a0", "#4cc9f0", "#ef476f", "#ffffff"];

export function Confetti({ count = 70 }: { count?: number }) {
  const piezas = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.9 + Math.random() * 1.6,
        color: COLORES[Math.floor(Math.random() * COLORES.length)],
        w: 6 + Math.random() * 7,
        drift: (Math.random() - 0.5) * 160,
      })),
    [count],
  );

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 22 }}>
      <style>{`@keyframes cffall{0%{transform:translate(0,-10vh) rotate(0);opacity:1}100%{transform:translate(var(--dx),110vh) rotate(900deg);opacity:.85}}`}</style>
      {piezas.map(p => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 0.45,
            background: p.color,
            borderRadius: 1,
            ["--dx" as any]: `${p.drift}px`,
            animation: `cffall ${p.dur}s cubic-bezier(.2,.55,.4,1) ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
