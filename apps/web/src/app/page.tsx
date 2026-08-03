"use client";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import { AuctionCard, AuctionCardData } from "../components/auction/AuctionCard";
import { Logo } from "../components/ui/Logo";
import { InicioHero } from "../components/ui/InicioHero";
import { LiveShowCard } from "../components/ui/LiveShowCard";
import { BRAND } from "@subastas-ve/shared";

interface Show {
  id: string; sellerName?: string; title?: string; status?: string;
  viewerCount?: number; totalProducts?: number; coverImageURL?: string;
}

// Las fichas salen de lo que HAY publicado, no de una lista fija. Con una
// lista fija de 7 de las 26 categorías, un producto en "Consolas y
// Videojuegos" no se encontraba navegando — y las fichas mostraban
// categorías vacías. Ordenadas por cantidad: primero donde hay más que ver.

export default function Home() {
  const router = useRouter();
  const [shows, setShows] = useState<Show[]>([]);
  const [auctions, setAuctions] = useState<AuctionCardData[]>([]);
  const [cat, setCat] = useState("Para Ti");
  const [cargando, setCargando] = useState(true);

  const { profile, loading: authLoading } = useAuthStore();

  // Onboarding al entrar: UNA vez de verdad, no una vez por sesión.
  // Anónimo: una vez por dispositivo (localStorage). Con cuenta: hasta
  // que el perfil diga onboardingDone (se guarda al terminarlo).
  useEffect(() => {
    try {
      const vistoAqui = localStorage.getItem("vlo_onb") === "1";
      if (profile) {
        if ((profile as any).onboardingDone !== true && !vistoAqui) router.replace("/onboarding");
      } else if (!authLoading && !vistoAqui) {
        router.replace("/onboarding");
      }
    } catch { /* modo privado del navegador: no bloquea la entrada */ }
  }, [profile, authLoading, router]);

  // Los onSnapshot llevan callback de error a propósito: sin él, una
  // regla que deniegue o un índice que falte fallan en silencio y la
  // pantalla se queda cargando para siempre sin decir por qué.
  useEffect(() => {
    const q = query(collection(db, "shows"), where("status", "==", "live"), orderBy("viewerCount", "desc"), limit(6));
    return onSnapshot(q,
      s => setShows(s.docs.map(d => ({ id: d.id, ...d.data() } as Show))),
      e => console.error("No se pudieron cargar los shows:", e.code, e.message));
  }, []);

  useEffect(() => {
    const q = query(collection(db, "auctions"), where("status", "==", "active"));
    return onSnapshot(q,
      s => {
        setAuctions(s.docs.map(d => ({ id: d.id, ...d.data() } as AuctionCardData)));
        setCargando(false);
      },
      e => { console.error("No se pudieron cargar las subastas:", e.code, e.message); setCargando(false); });
  }, []);

  // Avatares de los vendedores, para el slider de tiendas destacadas
  const [avatares, setAvatares] = useState<Record<string, string>>({});
  useEffect(() => {
    getDocs(query(collection(db, "publicProfiles"), where("role", "==", "seller"), limit(40)))
      .then(s => {
        const m: Record<string, string> = {};
        s.docs.forEach(d => { const a = (d.data() as any).avatar; if (a) m[d.id] = a; });
        setAvatares(m);
      })
      .catch(() => undefined);
  }, []);

  const ms = (v: any) => v?.toMillis?.() ?? new Date(v ?? 0).getTime();

  // Tiendas destacadas: las 5 con más subastas activas. Hoy es orgánico;
  // mañana este espacio se vende como destacado/publicidad.
  const porTienda: Record<string, { id: string; nombre: string; activas: number; foto?: string; producto?: string }> = {};
  for (const a of auctions as any[]) {
    if (!a.sellerId) continue;
    if (!porTienda[a.sellerId]) porTienda[a.sellerId] = { id: a.sellerId, nombre: a.sellerName ?? "Tienda", activas: 0 };
    porTienda[a.sellerId].activas += 1;
    // La foto del anuncio: el primer producto con imagen de esa tienda
    const f = a.imageURL ?? a.imageURLs?.[0];
    if (f && !porTienda[a.sellerId].foto) {
      porTienda[a.sellerId].foto = f;
      porTienda[a.sellerId].producto = a.title;
    }
  }
  const tiendas = Object.values(porTienda)
    .sort((a, b) => b.activas - a.activas)
    .slice(0, 5)
    .map(t => ({ ...t, avatar: avatares[t.id] }));

  const categorias = (() => {
    const cuenta = new Map<string, number>();
    for (const a of auctions) {
      const c = (a as any).category;
      if (c) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
    }
    return ["Para Ti", ...Array.from(cuenta.entries()).sort((x, y) => y[1] - x[1]).map(([c]) => c)];
  })();

  // Si la categoría elegida se queda sin nada (cerró la última venta), se
  // vuelve a "Para Ti" en vez de dejar la pantalla vacía sin explicación.
  const catActiva = categorias.includes(cat) ? cat : "Para Ti";

  const visibles = auctions
    .filter(a => catActiva === "Para Ti" || (a as any).category === catActiva)
    .sort((a, b) => ms((a as any).endsAt) - ms((b as any).endsAt));

  return (
    <div className="lv-app">

      {/* Barra superior */}
      <header className="lv-topbar">
        <div style={{ display: "grid", gap: 1 }}>
          <Logo tamano={29}/>
          <span style={{ color: "var(--accent-strong)", fontSize: "0.46rem", fontWeight: 900, letterSpacing: "0.075em" }}>
            {BRAND.mantra}
          </span>
        </div>
        <div style={{ flex: 1 }}/>
        <button className="lv-icon-btn" onClick={() => router.push("/auctions")} aria-label="Buscar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </button>
        <button className="lv-icon-btn" onClick={() => router.push("/notifications")} aria-label="Notificaciones">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
      </header>

      {/* Hero de portada: slider de tiendas destacadas (futuro espacio de ads) */}
      <InicioHero
        tiendas={tiendas}
        onExplorar={() => router.push("/auctions")}
        onTienda={(id) => router.push(`/seller/${id}`)}
      />

      {/* Categorías */}
      <div className="lv-chips">
        {categorias.map(c => (
          <button key={c} onClick={() => setCat(c)} className={`lv-chip${catActiva === c ? " lv-chip--active" : ""}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Shows en vivo */}
      {shows.length > 0 && (
        <>
          <div className="lv-section">
            <h2 className="lv-section__title">
              <span className="lv-badge lv-badge--live"><i className="lv-dot"/> EN VIVO</span>
              {shows.length} {shows.length === 1 ? "venta en vivo" : "ventas en vivo"}
            </h2>
          </div>
          <div className="lv-pad" style={{ display:"flex", gap:12, overflowX:"auto", scrollbarWidth:"none", paddingBottom:4 }}>
            {shows.map(show => (
              <LiveShowCard key={show.id} show={show} onClick={() => router.push(`/shows/${show.id}`)}/>
            ))}
          </div>
        </>
      )}

      {/* Ventas por ofertas */}
      <div className="lv-section">
        <h2 className="lv-section__title">Ventas activas</h2>
        <button className="lv-section__link" onClick={() => router.push("/auctions")}>Ver todas →</button>
      </div>

      <div className="lv-pad">
        {cargando ? (
          <div className="lv-grid">
            {[0,1,2,3].map(i => <div key={i} className="lv-skel" style={{ aspectRatio:"1 / 1.42" }}/>)}
          </div>
        ) : visibles.length === 0 ? (
          <div className="lv-empty">
            <div className="lv-empty__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M14 11l-8 8M9 6l9 9M3 21h6M12.5 3.5l8 8"/>
              </svg>
            </div>
            <div className="lv-empty__title">
              {cat === "Para Ti" ? "Todavía no hay ventas activas" : `Nada en ${cat}`}
            </div>
            <div className="lv-empty__text">Vuelve pronto o publica la tuya.</div>
          </div>
        ) : (
          <div className="lv-grid">
            {visibles.slice(0, 12).map(a => <AuctionCard key={a.id} auction={a}/>)}
          </div>
        )}
      </div>
    </div>
  );
}
