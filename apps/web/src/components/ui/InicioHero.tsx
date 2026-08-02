"use client";
import { useEffect, useState } from "react";
import { SIMBOLO_PATH } from "@subastas-ve/shared";

// =============================================================
// InicioHero — el cuadro COMPLETO es el anuncio
// =============================================================
// Todo el bloque es el espacio patrocinado: la foto del producto de
// la tienda a sangre, su marca encima y la llamada a entrar. Rota
// solo entre 4-5 tiendas con sus puntitos. Esto es lo que se vende
// como destacado; sin patrocinadores cae al bloque naranja de marca.
// =============================================================

export interface TiendaDestacada {
  id: string;
  nombre: string;
  avatar?: string;
  activas: number;
  foto?: string;
  producto?: string;
}

export function InicioHero({
  tiendas,
  onExplorar,
  onTienda,
}: {
  tiendas: TiendaDestacada[];
  onExplorar: () => void;
  onTienda: (id: string) => void;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => { setIdx(0); }, [tiendas.length]);
  useEffect(() => {
    if (tiendas.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % tiendas.length), 4500);
    return () => clearInterval(t);
  }, [tiendas.length]);

  const tienda = tiendas[idx] ?? null;

  // Sin patrocinadores: el bloque de marca de siempre
  if (!tienda) {
    return (
      <div style={{ padding: "10px 16px 4px" }}>
        <div style={{
          position: "relative", overflow: "hidden", borderRadius: "var(--r-card, 22px)",
          background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong, #dc5a00) 100%)",
          padding: "22px 18px", color: "#fff",
        }}>
          <svg viewBox="0 0 24 24" aria-hidden style={{ position: "absolute", right: "-14%", top: "-30%", width: "72%", fill: "var(--accent-light, #ff7d21)", opacity: 0.5 }}>
            <path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/>
          </svg>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="lv-eyebrow" style={{ color: "#fff", opacity: 0.9 }}>Ventas en vivo · Venezuela</div>
            <h1 className="lv-display" style={{ color: "#fff", fontSize: "clamp(1.9rem, 9vw, 2.5rem)", lineHeight: 0.94, marginTop: 8 }}>
              Entra al vivo.<br/>SUBELOO. Llévatelo.
            </h1>
            <button onClick={onExplorar} className="lv-btn lv-btn--lg" style={{ marginTop: 16, background: "#fff", color: "var(--accent-strong, #dc5a00)" }}>
              Explorar ventas →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 16px 4px" }}>
      <style>{`@keyframes adIn{0%{opacity:0}100%{opacity:1}}`}</style>

      <button
        onClick={() => onTienda(tienda.id)}
        style={{
          position: "relative", display: "block", width: "100%", textAlign: "left",
          aspectRatio: "1 / 1", maxHeight: 400,
          borderRadius: "var(--r-card, 22px)", overflow: "hidden",
          // Fondo neutro oscuro: si la foto tarda o no carga, el cuadro se
          // ve sobrio — con el naranja detrás, la imagen salía teñida.
          background: tienda.foto ? "#16161a" : "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong, #dc5a00) 100%)",
          boxShadow: "0 12px 34px rgba(11,11,13,0.14)",
        }}
      >
        {/* La foto del producto ocupa TODO el cuadro */}
        {tienda.foto && (
          <img
            key={tienda.id}
            src={tienda.foto}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "adIn 0.5s ease" }}
          />
        )}

        {/* Marca de agua cuando no hay foto */}
        {!tienda.foto && (
          <svg viewBox="0 0 24 24" aria-hidden style={{ position: "absolute", right: "-20%", top: "8%", width: "90%", fill: "var(--accent-light, #ff7d21)", opacity: 0.5 }}>
            <path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/>
          </svg>
        )}

        {/* Degradados: arriba para el rótulo, abajo para la marca */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,11,13,0.5) 0%, rgba(11,11,13,0) 26%, rgba(11,11,13,0) 46%, rgba(11,11,13,0.9) 100%)" }}/>

        {/* Rótulo del anuncio */}
        <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
            Tienda destacada
          </span>
          <span style={{ fontSize: "0.56rem", fontWeight: 800, letterSpacing: "0.08em", padding: "3px 7px", borderRadius: 999, background: "rgba(255,255,255,0.22)", color: "#fff", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.28)" }}>
            AD
          </span>
        </div>

        {/* Marca de la tienda, abajo */}
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 16, color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            {tienda.avatar
              ? <img src={tienda.avatar} alt="" style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2.5px solid rgba(255,255,255,0.85)" }}/>
              : <span style={{ width: 50, height: 50, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.15rem", flexShrink: 0, border: "2.5px solid rgba(255,255,255,0.85)" }}>{tienda.nombre[0]}</span>}
            <div style={{ minWidth: 0, flex: 1 }}>
              {/* El nombre cabe entero: baja de tamaño si es largo en vez de cortarse */}
              <div className="lv-display" style={{ color: "#fff", fontSize: tienda.nombre.length > 14 ? "1.2rem" : "clamp(1.4rem, 6.5vw, 1.75rem)", lineHeight: 1.02, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
                {tienda.nombre}
              </div>
              <div style={{ fontSize: "0.76rem", fontWeight: 600, opacity: 0.9, marginTop: 3, textShadow: "0 1px 4px rgba(0,0,0,0.55)" }}>
                {tienda.activas} {tienda.activas === 1 ? "venta activa" : "ventas activas"}
              </div>
            </div>
            <span className="lv-btn lv-btn--sm" style={{ background: "#fff", color: "var(--accent-strong, #dc5a00)", flexShrink: 0, fontWeight: 800, alignSelf: "center" }}>
              Ver tienda
            </span>
          </div>
        </div>

        {/* Puntitos */}
        {tiendas.length > 1 && (
          <div style={{ position: "absolute", top: 16, right: 14, display: "flex", gap: 4 }}>
            {tiendas.map((t, i) => (
              <span key={t.id} style={{ width: i === idx ? 16 : 5, height: 5, borderRadius: 999, background: i === idx ? "#fff" : "rgba(255,255,255,0.5)", transition: "width 0.25s" }}/>
            ))}
          </div>
        )}
      </button>

      <button
        onClick={onExplorar}
        className="lv-btn lv-btn--soft lv-btn--block"
        style={{ marginTop: 10 }}
      >
        Explorar todas las ventas →
      </button>
    </div>
  );
}
