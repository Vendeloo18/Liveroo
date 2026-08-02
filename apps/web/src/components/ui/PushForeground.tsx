"use client";
// =============================================================
// Avisos que llegan con la app abierta
// =============================================================
// El navegador no muestra una notificación push si la pestaña está en
// primer plano: asume que la app ya se lo puede decir por su cuenta. Si
// nadie escucha, "te superaron en la puja" se pierde justo cuando más
// importa, que es mientras estás mirando la subasta.
//
// Esto lo muestra como una tarjeta arriba, tocable. No guarda nada: la
// pantalla de Avisos ya se arma sola desde las órdenes y las pujas
// reales, así que este es solo el empujón del momento.
// =============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { escucharEnPrimerPlano } from "../../lib/push";
import { useAuthStore } from "../../store/authStore";

interface Toast { id: number; titulo: string; cuerpo: string }

export function PushForeground() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [cola, setCola] = useState<Toast[]>([]);

  useEffect(() => {
    if (!profile) return;
    let cancelar: (() => void) | undefined;
    let vivo = true;

    escucharEnPrimerPlano((titulo, cuerpo) => {
      if (!titulo && !cuerpo) return;
      const id = performance.now();
      setCola((c) => [...c.slice(-2), { id, titulo, cuerpo }]);
      // Se va solo; nadie quiere cerrar avisos a mano en medio de una puja
      setTimeout(() => setCola((c) => c.filter((t) => t.id !== id)), 6000);
    }).then((off) => {
      if (vivo) cancelar = off;
      else off();
    });

    return () => { vivo = false; cancelar?.(); };
  }, [profile]);

  if (!cola.length) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 10px)",
        left: 10, right: 10, zIndex: 900,
        display: "grid", gap: 8, pointerEvents: "none",
      }}
    >
      {cola.map((t) => (
        <button
          key={t.id}
          onClick={() => { setCola((c) => c.filter((x) => x.id !== t.id)); router.push("/notifications"); }}
          style={{
            pointerEvents: "auto",
            textAlign: "left",
            background: "var(--accent)",
            color: "var(--accent-ink)",
            borderRadius: "var(--r-card)",
            padding: "11px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            animation: "lvPushIn 0.22s ease-out",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 700, lineHeight: 1.3 }}>{t.titulo}</div>
          {t.cuerpo && (
            <div style={{ fontSize: "0.77rem", lineHeight: 1.4, marginTop: 2, opacity: 0.92 }}>{t.cuerpo}</div>
          )}
        </button>
      ))}
    </div>
  );
}
