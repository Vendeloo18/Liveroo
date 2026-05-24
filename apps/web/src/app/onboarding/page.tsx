"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/authStore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

const SLIDES = [
  {
    title: "Compra lo que amas,\nen vivo",
    desc: "Subastas en vivo con vendedores venezolanos verificados. Precios en USD y Bs.",
    btnLabel: "Comenzar",
    accent: "linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)",
    glow: "rgba(168,85,247,0.18)",
    photos: [
      { src:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80", price:"$85", live:true, s:{ w:105, h:105, top:8, left:8, r:-9 } },
      { src:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80", price:"$210", live:false, s:{ w:88, h:88, top:0, right:4, r:7 } },
      { src:"https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=300&q=80", price:"$620", live:true, s:{ w:80, h:80, top:60, right:50, r:-3 } },
      { src:"https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300&q=80", price:"$95", live:false, s:{ w:90, h:90, top:55, left:55, r:6 } },
      { src:"https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=300&q=80", price:"$45", live:true, s:{ w:75, h:75, bottom:8, left:12, r:5 } },
      { src:"https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=300&q=80", price:"$130", live:false, s:{ w:82, h:82, bottom:4, right:8, r:-6 } },
    ],
  },
  {
    title: "Puja en segundos,\ngana en vivo",
    desc: "Temporizador por producto. Sé el mayor postor cuando cierre y es tuyo.",
    btnLabel: "Siguiente",
    accent: "linear-gradient(135deg,#a855f7,#e040fb)",
    glow: "rgba(0,200,255,0.12)",
    timer: "0:28",
    photos: [
      { src:"https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=300&q=80", price:"$340", live:true, s:{ w:110, h:110, top:5, left:6, r:-7 } },
      { src:"https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&q=80", price:"$180", live:false, s:{ w:90, h:90, top:2, right:6, r:8 } },
      { src:"https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=300&q=80", price:"$120", live:true, s:{ w:85, h:85, top:58, left:52, r:-4 } },
      { src:"https://images.unsplash.com/photo-1611078489935-0cb964de46d6?w=300&q=80", price:"$890", live:false, s:{ w:92, h:92, top:50, left:8, r:5 } },
      { src:"https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=300&q=80", price:"$68", live:true, s:{ w:72, h:72, bottom:6, right:10, r:-5 } },
      { src:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80", price:"$210", live:false, s:{ w:76, h:76, bottom:4, left:48, r:7 } },
    ],
  },
  {
    title: "Pagos seguros,\nsiempre protegidos",
    desc: "Liveroo retiene tus fondos hasta confirmar la entrega. Tu dinero 100% seguro.",
    btnLabel: "Empezar ahora",
    accent: "linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)",
    glow: "rgba(74,222,128,0.08)",
    showWallet: true,
    photos: [
      { src:"https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&q=80", price:"$180", won:true, s:{ w:108, h:108, top:6, left:8, r:-6 } },
      { src:"https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=300&q=80", price:"$120", live:false, s:{ w:88, h:88, top:2, right:8, r:7 } },
      { src:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80", price:"$210", live:false, s:{ w:82, h:82, top:60, right:52, r:-4 } },
      { src:"https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=300&q=80", price:"$340", live:false, s:{ w:86, h:86, top:55, left:50, r:5 } },
      { src:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80", price:"$85", live:false, s:{ w:74, h:74, bottom:6, left:12, r:4 } },
      { src:"https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300&q=80", price:"$95", live:false, s:{ w:78, h:78, bottom:4, right:6, r:-7 } },
    ],
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const { profile } = useAuthStore();
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const finish = async () => {
    if (profile) { try { await updateDoc(doc(db,"users",profile.uid), { onboardingDone:true }); } catch {} }
    localStorage.setItem("liveroo_onboarding_done","true");
    router.push("/");
  };

  return (
    <div style={{ minHeight:"100vh", background:"#07070f", display:"flex", flexDirection:"column", fontFamily:"'Inter',-apple-system,sans-serif", maxWidth:480, margin:"0 auto", position:"relative", overflow:"hidden" }}>

      {/* Glow */}
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 100% 55% at 50% 25%, ${slide.glow} 0%, transparent 65%)`, transition:"background 0.5s", pointerEvents:"none" }}/>

      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", position:"relative", zIndex:3, flexShrink:0 }}>
        <div style={{ display:"flex", gap:6 }}>
          {SLIDES.map((_,i) => (
            <div key={i} style={{ height:3, borderRadius:2, transition:"all 0.35s", width:i===step?28:7, background:i===step?slide.accent:"rgba(255,255,255,0.1)" }}/>
          ))}
        </div>
        <button onClick={finish} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.25)", fontSize:"0.82rem", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Saltar</button>
      </div>

      {/* Photos — full bleed dispersed */}
      <div style={{ height:270, position:"relative", flexShrink:0, overflow:"hidden" }}>
        {/* Dark vignette bottom */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"50%", background:"linear-gradient(transparent,#07070f)", zIndex:2, pointerEvents:"none" }}/>
        {/* Dark vignette top */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"30%", background:"linear-gradient(#07070f,transparent)", zIndex:2, pointerEvents:"none" }}/>

        {slide.photos.map((p:any, i:number) => (
          <div key={i} style={{ position:"absolute", width:p.s.w, height:p.s.h, top:p.s.top, bottom:p.s.bottom, left:p.s.left, right:p.s.right, transform:`rotate(${p.s.r}deg)`, borderRadius:14, overflow:"hidden", boxShadow:"0 8px 32px rgba(0,0,0,0.6)", zIndex:1 }}>
            <img src={p.src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
            {/* Overlay gradient */}
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(transparent 50%,rgba(0,0,0,0.5))" }}/>
            {/* Price */}
            <div style={{ position:"absolute", bottom:6, left:6, background:"rgba(7,7,15,0.88)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, padding:"2px 8px", fontSize:"0.58rem", fontWeight:800, color:"#fff" }}>
              {p.price}
            </div>
            {/* Live */}
            {p.live && <div style={{ position:"absolute", top:7, right:7, width:7, height:7, borderRadius:"50%", background:"#ff2d2d", boxShadow:"0 0 8px #ff2d2d" }}/>}
            {/* Won */}
            {p.won && <div style={{ position:"absolute", top:7, left:7, background:"rgba(74,222,128,0.9)", borderRadius:6, padding:"2px 7px", fontSize:"0.52rem", fontWeight:800, color:"#fff" }}>GANADO</div>}
          </div>
        ))}

        {/* Timer */}
        {slide.timer && (
          <div style={{ position:"absolute", bottom:18, left:20, background:"rgba(255,45,45,0.92)", borderRadius:10, padding:"6px 14px", zIndex:3, backdropFilter:"blur(4px)" }}>
            <span style={{ fontSize:"1rem", fontWeight:900, color:"#fff", fontVariantNumeric:"tabular-nums" }}>{slide.timer}</span>
          </div>
        )}

        {/* Wallet confirmed */}
        {slide.showWallet && (
          <div style={{ position:"absolute", bottom:18, left:"50%", transform:"translateX(-50%)", background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.25)", borderRadius:20, padding:"5px 16px", display:"flex", alignItems:"center", gap:6, zIndex:3, whiteSpace:"nowrap" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            <span style={{ fontSize:"0.62rem", fontWeight:700, color:"#4ade80" }}>Fondos liberados al vendedor</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:"4px 24px 0", position:"relative", zIndex:2 }}>
        {/* Wallet card */}
        {slide.showWallet && (
          <div style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
            <div style={{ fontSize:"0.58rem", color:"rgba(255,255,255,0.3)", fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>Billetera Liveroo</div>
            <div style={{ fontSize:"1.4rem", fontWeight:900, color:"#fff", letterSpacing:"-0.04em", marginBottom:8 }}>$150.00 <span style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.3)" }}>USD</span></div>
            <div style={{ display:"flex", gap:6 }}>
              {["Zelle","Pago Móvil","USDT"].map(m => (
                <div key={m} style={{ background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:7, padding:"3px 10px", fontSize:"0.58rem", fontWeight:700, color:"rgba(168,85,247,0.8)" }}>{m}</div>
              ))}
            </div>
          </div>
        )}

        <h1 style={{ fontSize:"1.8rem", fontWeight:900, color:"#fff", lineHeight:1.1, letterSpacing:"-0.04em", marginBottom:12, whiteSpace:"pre-line" }}>{slide.title}</h1>
        <p style={{ fontSize:"0.85rem", color:"rgba(255,255,255,0.38)", lineHeight:1.7 }}>{slide.desc}</p>
      </div>

      {/* Footer */}
      <div style={{ padding:"20px 24px 44px", position:"relative", zIndex:2, flexShrink:0 }}>
        <button onClick={() => isLast ? finish() : setStep(step+1)} style={{ width:"100%", background:slide.accent, border:"none", borderRadius:16, padding:"15px", fontSize:"0.95rem", fontWeight:900, color:"#fff", cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.02em", boxShadow:"0 0 30px rgba(168,85,247,0.25)", marginBottom:12 }}>
          {slide.btnLabel}
        </button>
        {step > 0 && (
          <button onClick={() => setStep(step-1)} style={{ width:"100%", background:"none", border:"none", color:"rgba(255,255,255,0.2)", fontSize:"0.82rem", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            Atrás
          </button>
        )}
        {step === 0 && (
          <button onClick={finish} style={{ width:"100%", background:"none", border:"none", color:"rgba(255,255,255,0.2)", fontSize:"0.78rem", fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
            Ya tengo cuenta · Iniciar sesión
          </button>
        )}
      </div>
    </div>
  );
}
