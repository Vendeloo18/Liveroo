"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";


const FAQS = [
  { q:"¿Cómo deposito fondos?", a:"Ve a Mi Billetera → Depositar. Elige Zelle, Pago Móvil o USDT, envía el monto y sube la referencia. El admin confirma en menos de 24h." },
  { q:"¿Cómo funciona la subasta?", a:"Cada producto tiene un temporizador. Puja antes de que cierre. Si alguien puja después de ti el timer se extiende. Al cerrar el mayor postor gana." },
  { q:"¿Qué pasa con mis fondos al ganar?", a:"Se congelan automáticamente. Liveroo los retiene en custodia hasta que confirmes la entrega. Entonces los libera al vendedor." },
  { q:"¿Cómo me convierto en vendedor?", a:"Ve a Vender → Seller Hub y solicita tu cuenta. El admin la revisa y aprueba. Una vez aprobado puedes crear shows y agregar productos." },
  { q:"¿Qué métodos de pago aceptan?", a:"Zelle, Pago Móvil y USDT TRC-20. Próximamente más métodos." },
  { q:"¿Cómo contacto a un vendedor?", a:"Una vez que ganas una subasta se genera una orden con el botón de WhatsApp del vendedor para coordinar directamente." },
];

export default function SupportPage() {
  const router = useRouter();
  const [open, setOpen] = useState<number|null>(null);
  return (
    <div style={{ minHeight:"100vh", background:"#080818", fontFamily:"Inter,sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:90 }}>
      <div style={{ padding:"20px 20px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          <button onClick={() => router.push("/account")} style={{ width:38, height:38, background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <h1 style={{ fontSize:"1.4rem", fontWeight:900, color:"#fff" }}>Soporte</h1>
        </div>
        <div style={{ background:"rgba(0,200,255,0.08)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:20, padding:"20px", marginBottom:24 }}>
          <div style={{ fontSize:"0.88rem", fontWeight:800, color:"#fff", marginBottom:6 }}>¿Necesitas ayuda directa?</div>
          <div style={{ fontSize:"0.75rem", color:"rgba(255,255,255,0.45)", marginBottom:16, lineHeight:1.6 }}>Nuestro equipo responde en menos de 24 horas por WhatsApp.</div>
          <a href="https://wa.me/584140000000" target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:"#25D366", borderRadius:12, padding:"12px", fontSize:"0.85rem", fontWeight:800, color:"#fff", textDecoration:"none" }}>
            Contactar por WhatsApp
          </a>
        </div>
        <div style={{ fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14 }}>Preguntas frecuentes</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:14, overflow:"hidden" }}>
              <button onClick={() => setOpen(open===i ? null : i)} style={{ width:"100%", background:"none", border:"none", padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                <span style={{ fontSize:"0.85rem", fontWeight:700, color:"#fff", flex:1, paddingRight:12 }}>{faq.q}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.6)" strokeWidth="2.5" strokeLinecap="round" style={{ transform:open===i?"rotate(180deg)":"rotate(0)" }}><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {open===i && (
                <div style={{ padding:"12px 16px 14px", fontSize:"0.78rem", color:"rgba(255,255,255,0.5)", lineHeight:1.7, borderTop:"1px solid rgba(168,85,247,0.06)" }}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}
