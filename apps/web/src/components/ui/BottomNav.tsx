"use client";
import { useRouter, usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label:"Inicio", href:"/", path:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { label:"Categorias", href:"/categories", path:"M4 6h16M4 12h16M4 18h7" },
  { label:"Vender", href:"/seller", path:"M12 5v14M5 12h14" },
  { label:"Actividad", href:"/activity", path:"M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" },
  { label:"Cuenta", href:"/account", path:"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"rgba(7,7,15,0.97)", borderTop:"1px solid rgba(168,85,247,0.08)", padding:"12px 0 22px", display:"flex", justifyContent:"space-around", backdropFilter:"blur(20px)", zIndex:100 }}>
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer", padding:"8px 10px", minWidth:44, background:"none", border:"none", WebkitTapHighlightColor:"transparent", outline:"none" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#a855f7" : "rgba(255,255,255,0.28)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.path}/>
            </svg>
            <span style={{ fontSize:"0.58rem", fontWeight:600, color:active ? "#a855f7" : "rgba(255,255,255,0.28)", fontFamily:"Inter,sans-serif" }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
