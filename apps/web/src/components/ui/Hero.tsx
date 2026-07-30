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
 * La pantalla de entrada, siguiendo assets/hero-app.png: fondo naranja
 * completo, la etiqueta gigante de marca de agua, titular apilado en
 * display y una tarjeta con una subasta.
 *
 * La tarjeta muestra una subasta ACTIVA DE VERDAD, no un ejemplo
 * inventado: si no hay ninguna, no se muestra. Poner un producto y un
 * precio falsos en la primera pantalla es la clase de cosa que fuimos
 * quitando de esta app.
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
  const [destacada, setDestacada] = useState<Destacada | null>(null);

  useEffect(() => {
    const q = query(collection(db, "auctions"), where("status", "==", "active"), limit(6));
    return onSnapshot(q, s => {
      if (s.empty) { setDestacada(null); return; }
      // La que cierra primero: es la que más urgencia transmite
      const ms = (v: any) => v?.toMillis?.() ?? Infinity;
      const orden = s.docs
        .map(d => ({ id: d.id, ...d.data() } as Destacada))
        .sort((a, b) => ms(a.endsAt) - ms(b.endsAt));
      setDestacada(orden[0]);
    }, () => setDestacada(null));
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      maxWidth: "var(--app-max)",
      margin: "0 auto",
      background: "var(--accent)",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      padding: "40px 20px calc(28px + env(safe-area-inset-bottom))",
    }}>

      {/* Etiqueta gigante de fondo, como la marca de agua del asset */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{
          position: "absolute", right: "-22%", top: "16%",
          width: "108%", height: "auto",
          fill: "var(--accent-light)", opacity: 0.55, pointerEvents: "none",
        }}
      >
        <path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/>
      </svg>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>

        <Logo tamano={34} color="#fff"/>

        {/* Titular apilado, con interlínea cerrada como en el asset */}
        <h1 className="lv-display" style={{
          color: "#fff",
          fontSize: "clamp(3rem, 17vw, 4.2rem)",
          lineHeight: 0.86,
          marginTop: 26,
          textWrap: "balance",
        }}>
          Subastas<br/>en vivo<br/>desde $1
        </h1>

        <p style={{
          color: "rgba(255,255,255,0.92)",
          fontSize: "1.05rem",
          fontWeight: 600,
          lineHeight: 1.45,
          marginTop: 20,
          maxWidth: 320,
        }}>
          {BRAND.description}
        </p>

        <div style={{ flex: 1, minHeight: 24 }}/>

        {destacada && <TarjetaDestacada subasta={destacada}/>}

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <button
            onClick={onEntrarSinCuenta}
            className="lv-btn lv-btn--block lv-btn--lg"
            style={{ background: "#fff", color: "var(--accent)" }}
          >
            Entrar sin cuenta
          </button>
          <button
            onClick={onCrearCuenta}
            className="lv-btn lv-btn--accent-deep lv-btn--block lv-btn--lg"
          >
            Crear cuenta
          </button>
          <button
            onClick={onIniciarSesion}
            style={{
              color: "rgba(255,255,255,0.92)", fontSize: "0.85rem",
              fontWeight: 700, padding: "8px 0", marginTop: 2,
            }}
          >
            Ya tengo cuenta · Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

function TarjetaDestacada({ subasta }: { subasta: Destacada }) {
  const { texto, vencida } = useCountdown(subasta.endsAt);
  const foto = subasta.imageURL ?? subasta.imageURLs?.[0];

  return (
    <div style={{
      background: "#fff",
      borderRadius: 24,
      padding: 14,
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <div style={{
        width: 78, height: 78, borderRadius: 16, flexShrink: 0,
        background: "var(--accent-tint)", overflow: "hidden", position: "relative",
      }}>
        {foto && <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
        {subasta.mode === "live" && (
          <span className="lv-badge lv-badge--live" style={{
            position: "absolute", top: 5, left: 5, fontSize: "0.5rem", padding: "3px 6px",
          }}>
            <i className="lv-dot"/> VIVO
          </span>
        )}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="lv-display" style={{ fontSize: "1.05rem", lineHeight: 1.05 }}>
          {subasta.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
          <span className="lv-price" style={{ fontSize: "1.5rem" }}>
            ${(subasta.currentBidUsd ?? 0).toFixed(0)}
          </span>
          {!vencida && <span className="lv-badge lv-badge--data">{texto}</span>}
        </div>
        {subasta.sellerName && (
          <div className="lv-mono" style={{ fontSize: "0.7rem", color: "var(--accent-muted)", marginTop: 4 }}>
            {subasta.sellerName}
          </div>
        )}
      </div>
    </div>
  );
}
