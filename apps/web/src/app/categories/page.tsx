"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

// El nombre tiene que ser idéntico al que guarda /auctions.category,
// porque es el que viaja como filtro a /auctions?cat=
const CATEGORIAS = [
  { nombre: "Moda y Ropa", icono: "👗" },
  { nombre: "Electronica", icono: "💻" },
  { nombre: "Calzado", icono: "👟" },
  { nombre: "Joyas y Relojes", icono: "💍" },
  { nombre: "Hogar", icono: "🏠" },
  { nombre: "Colecciones", icono: "🏆" },
  { nombre: "Autos y Motos", icono: "🚗" },
  { nombre: "Deportes", icono: "⚽" },
  { nombre: "Arte", icono: "🎨" },
  { nombre: "Juguetes", icono: "🎮" },
  { nombre: "Comida", icono: "🍕" },
  { nombre: "Mascotas", icono: "🐾" },
];

export default function CategoriesPage() {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);

  // Los conteos salen de las subastas activas de verdad. Antes esta
  // pantalla mostraba audiencias inventadas ("2.6K viendo").
  useEffect(() => {
    const q = query(collection(db, "auctions"), where("status", "==", "active"));
    return onSnapshot(q, s => {
      const c: Record<string, number> = {};
      s.docs.forEach(d => {
        const cat = d.data().category;
        if (cat) c[cat] = (c[cat] ?? 0) + 1;
      });
      setConteo(c);
      setCargando(false);
    }, () => setCargando(false));
  }, []);

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    const lista = t ? CATEGORIAS.filter(c => c.nombre.toLowerCase().includes(t)) : CATEGORIAS;
    // Las que tienen algo primero
    return [...lista].sort((a, b) => (conteo[b.nombre] ?? 0) - (conteo[a.nombre] ?? 0));
  }, [busqueda, conteo]);

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.push("/")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="lv-topbar__title">Categorías</h1>
      </header>

      <div className="lv-pad" style={{ paddingTop: 14 }}>
        <input
          className="lv-input"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar categoría"
          aria-label="Buscar categoría"
        />
      </div>

      <div className="lv-pad" style={{ paddingTop: 16 }}>
        <div className="lv-grid">
          {visibles.map(c => {
            const n = conteo[c.nombre] ?? 0;
            return (
              <button
                key={c.nombre}
                onClick={() => router.push(`/auctions?cat=${encodeURIComponent(c.nombre)}`)}
                className="lv-panel"
                style={{ textAlign: "left", padding: "16px 14px" }}
              >
                <div style={{ fontSize: "1.7rem", lineHeight: 1, marginBottom: 10 }} aria-hidden="true">{c.icono}</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 750, letterSpacing: "-0.015em", marginBottom: 3 }}>
                  {c.nombre}
                </div>
                <div className="lv-dim" style={{ fontSize: "0.73rem" }}>
                  {cargando ? "…" : n === 0 ? "Sin subastas" : `${n} ${n === 1 ? "subasta" : "subastas"}`}
                </div>
              </button>
            );
          })}
        </div>

        {visibles.length === 0 && (
          <div className="lv-empty">
            <div className="lv-empty__title">Ninguna categoría con ese nombre</div>
          </div>
        )}
      </div>
    </div>
  );
}
