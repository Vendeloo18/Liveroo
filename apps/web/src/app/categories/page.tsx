"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { name:"Moda y Ropa", viewers:2610, icon:"👗", color:"rgba(236,72,153,0.15)", border:"rgba(236,72,153,0.25)", filter:"moda" },
  { name:"Electronica", viewers:1840, icon:"💻", color:"rgba(0,200,255,0.1)", border:"rgba(0,200,255,0.2)", filter:"electronica" },
  { name:"Calzado", viewers:1520, icon:"👟", color:"rgba(168,85,247,0.1)", border:"rgba(168,85,247,0.2)", filter:"calzado" },
  { name:"Joyas y Relojes", viewers:980, icon:"💍", color:"rgba(234,179,8,0.1)", border:"rgba(234,179,8,0.2)", filter:"joyas" },
  { name:"Hogar", viewers:925, icon:"🏠", color:"rgba(34,197,94,0.1)", border:"rgba(34,197,94,0.2)", filter:"hogar" },
  { name:"Colecciones", viewers:812, icon:"🏆", color:"rgba(249,115,22,0.1)", border:"rgba(249,115,22,0.2)", filter:"colecciones" },
  { name:"Autos y Motos", viewers:741, icon:"🚗", color:"rgba(239,68,68,0.1)", border:"rgba(239,68,68,0.2)", filter:"autos" },
  { name:"Deportes", viewers:665, icon:"⚽", color:"rgba(14,165,233,0.1)", border:"rgba(14,165,233,0.2)", filter:"deportes" },
  { name:"Arte", viewers:590, icon:"🎨", color:"rgba(168,85,247,0.1)", border:"rgba(168,85,247,0.2)", filter:"arte" },
  { name:"Juguetes", viewers:467, icon:"🎮", color:"rgba(236,72,153,0.1)", border:"rgba(236,72,153,0.2)", filter:"juguetes" },
  { name:"Comida", viewers:390, icon:"🍕", color:"rgba(249,115,22,0.1)", border:"rgba(249,115,22,0.2)", filter:"comida" },
  { name:"Mascotas", viewers:210, icon:"🐾", color:"rgba(34,197,94,0.1)", border:"rgba(34,197,94,0.2)", filter:"mascotas" },
];

function formatViewers(n: number) {
  return n >= 1000 ? `${(n/1000).toFixed(1)}K` : `${n}`;
}

export default function CategoriesPage() {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const filtered = CATEGORIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ minHeight:"100vh", background:"#080818", backgroundImage:"radial-gradient(ellipse 80% 40% at 50% 0%, rgba(168,85,247,0.05) 0%, transparent 60%)", fontFamily:"'Inter',-apple-system,sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:90 }}>

      <div style={{ padding:"20px 16px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <button onClick={() => router.push("/")} style={{ width:38, height:38, background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <h1 style={{ fontSize:"1.4rem", fontWeight:900, color:"#fff", letterSpacing:"-0.03em" }}>Categorías</h1>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:14, padding:"12px 16px", marginBottom:24 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar categoría..." style={{ flex:1, background:"none", border:"none", outline:"none", color:"#fff", fontSize:"0.88rem", fontFamily:"inherit" }}/>
        </div>
      </div>

      <div style={{ padding:"0 16px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {filtered.map((cat) => (
          <div
            key={cat.name}
            onClick={() => router.push(`/search?q=${cat.filter}`)}
            style={{ background:cat.color, border:`1px solid ${cat.border}`, borderRadius:16, padding:"16px 12px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"space-between", minHeight:110, gap:8 }}
          >
            <div style={{ fontSize:"2rem", lineHeight:1, filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}>
              {cat.icon}
            </div>
            <div style={{ fontSize:"0.72rem", fontWeight:800, color:"#fff", lineHeight:1.3, textAlign:"center" }}>
              {cat.name}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"#ff2d2d", boxShadow:"0 0 6px #ff2d2d" }}/>
              <span style={{ fontSize:"0.6rem", fontWeight:600, color:"rgba(255,255,255,0.5)" }}>{formatViewers(cat.viewers)}</span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <p style={{ color:"rgba(255,255,255,0.2)", fontSize:"0.88rem" }}>No se encontraron categorías</p>
        </div>
      )}
    </div>
  );
}
