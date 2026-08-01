"use client";
import { useEffect, useState } from "react";
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { BRAND, SIMBOLO_PATH } from "@subastas-ve/shared";
import { db } from "../../lib/firebase";
import { useCountdown } from "../../hooks/useCountdown";
import { Logo } from "./Logo";

interface Destacada {
  id: string; title?: string; imageURL?: string; imageURLs?: string[];
  currentBidUsd?: number; sellerName?: string; endsAt?: any; mode?: string;
}

/**
 * Pantalla de entrada, siguiendo assets/hero-app.png: fondo naranja, la
 * etiqueta gigante de marca de agua, titular en display, y —para que no se
 * sienta vacía— una fila de subastas ACTIVAS DE VERDAD que la gente puede
 * ganar. Si no hay ninguna, la fila no se muestra (nada de precios falsos).
 */
export function Hero({
  onCrearCuenta,
  onIniciarSesion,
  onEntrarSinCuenta,
}: {
  onCrearCuenta: () => void;
  onIniciarSesion: () => void;
  onEntrarSinCuenta: () => void;
}) {
  const [destacadas, setDestacadas] = useState<Destacada[]>([]);

  useEffect(() => {
    const q = query(collection(db, "auctions"), where("status", "==", "active"), limit(12));
    return onSnapshot(q, s => {
      const ms = (v: any) => v?.toMillis?.() ?? Infinity;
      const orden = s.docs
        .map(d => ({ id: d.id, ...d.data() } as Destacada))
        .filter(a => a.imageURL || a.imageURLs?.[0]) // solo las que tienen foto lucen bien
        .sort((a, b) => ms(a.endsAt) - ms(b.endsAt));
      setDestacadas(orden.slice(0, 8));
    }, () => setDestacadas([]));
  }, []);

  return (
    <div style={{
      minHeight: "100dvh", maxWidth: "var(--app-max)", margin: "0 auto",
      background: "var(--accent)", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
      padding: "calc(34px + env(safe-area-inset-top)) 20px calc(26px + env(safe-area-inset-bottom))",
    }}>
      {/* Etiqueta gigante de fondo */}
      <svg viewBox="0 0 24 24" aria-hidden="true" style={{
        position: "absolute", right: "-22%", top: "14%", width: "108%", height: "auto",
        fill: "var(--accent-light)", opacity: 0.5, pointerEvents: "none",
      }}>
        <path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/>
      </svg>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
        <Logo tamano={32} color="#fff"/>

        <h1 className="lv-display" style={{
          color: "#fff", fontSize: "clamp(2.7rem, 15vw, 3.9rem)", lineHeight: 0.88,
          marginTop: 22, textWrap: "balance",
        }}>
          Subastas<br/>en vivo<br/>desde $1
        </h1>

        <p style={{ color: "rgba(255,255,255,0.92)", fontSize: "1.02rem", fontWeight: 600, lineHeight: 1.45, marginTop: 18, maxWidth: 330 }}>
          {BRAND.description}
        </p>

        {/* Beneficios: llenan el centro y refuerzan por qué entrar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
          {([
            [<path key="a" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>, "Puja desde $1"],
            [<g key="b"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></g>, "Pago en bolívares"],
            [<g key="c"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></g>, "Vendedores en vivo"],
          ] as [React.ReactNode, string][]).map(([icono, t]) => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.16)", color: "#fff", borderRadius: 999, padding: "9px 14px", fontSize: "0.84rem", fontWeight: 700, backdropFilter: "blur(4px)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icono}</svg>{t}
            </span>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 18 }}/>

        {/* Fila de subastas reales: llena el centro y muestra qué se puede ganar */}
        {destacadas.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div className="lv-eyebrow" style={{ color: "#fff", opacity: 0.85, marginBottom: 10, letterSpacing: "0.14em" }}>
              Ahora mismo · gánatelas
            </div>
            <div style={{ display: "flex", gap: 11, overflowX: "auto", scrollbarWidth: "none", margin: "0 -20px", padding: "0 20px 2px" }}>
              {destacadas.map(a => <MiniSubasta key={a.id} a={a}/>)}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          <button onClick={onIniciarSesion} className="lv-btn lv-btn--block lv-btn--lg" style={{ background: "#fff", color: "var(--accent)" }}>
            Iniciar sesión
          </button>
          <button onClick={onCrearCuenta} className="lv-btn lv-btn--accent-deep lv-btn--block lv-btn--lg">
            Crear cuenta
          </button>
          <button onClick={onEntrarSinCuenta} style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, padding: "8px 0", marginTop: 2 }}>
            ¿Solo mirando?{" "}
            <span style={{ textDecoration: "underline", textUnderlineOffset: 3, textDecorationThickness: 2 }}>Entrar sin cuenta</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniSubasta({ a }: { a: Destacada }) {
  const { texto, vencida } = useCountdown(a.endsAt);
  const foto = a.imageURL ?? a.imageURLs?.[0];

  return (
    <div style={{
      position: "relative", width: 128, minWidth: 128, flexShrink: 0, aspectRatio: "3 / 4",
      borderRadius: 16, overflow: "hidden", background: "rgba(0,0,0,0.15)",
      boxShadow: "0 8px 22px rgba(0,0,0,0.2)",
    }}>
      {foto && <img src={foto} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}/>}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 34%, transparent 46%, rgba(0,0,0,0.82) 100%)" }}/>

      {a.mode === "live" && (
        <span className="lv-badge lv-badge--live" style={{ position: "absolute", top: 7, left: 7, fontSize: "0.5rem", padding: "3px 6px" }}>
          <i className="lv-dot"/> VIVO
        </span>
      )}
      {!vencida && (
        <span className="lv-badge lv-badge--data" style={{ position: "absolute", top: 7, right: 7, fontSize: "0.5rem", padding: "3px 6px", background: "rgba(0,0,0,0.55)" }}>
          {texto}
        </span>
      )}

      <div style={{ position: "absolute", left: 9, right: 9, bottom: 8, color: "#fff" }}>
        <div style={{ fontSize: "0.66rem", fontWeight: 700, opacity: 0.92, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", lineHeight: 1.2 }}>
          {a.title}
        </div>
        <div style={{ fontSize: "1.3rem", fontWeight: 900, letterSpacing: "-0.02em", marginTop: 1 }}>
          ${(() => { const n = a.currentBidUsd ?? 0; return n % 1 === 0 ? n : n.toFixed(2); })()}
        </div>
      </div>
    </div>
  );
}
