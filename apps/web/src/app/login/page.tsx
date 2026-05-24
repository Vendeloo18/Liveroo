"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/authStore";

type Screen = "signup" | "login" | "email-signup";

export default function AuthPage() {
  const [screen, setScreen] = useState<Screen>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, signInWithGoogle, error, clearError } = useAuthStore();
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); clearError(); setLoading(true);
    try { await signUp({ email, password, displayName: name }); router.push("/onboarding"); }
    catch {} finally { setLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clearError(); setLoading(true);
    try { await signIn(email, password); router.push("/"); }
    catch {} finally { setLoading(false); }
  };


  const handleGoogle = async () => {
    clearError(); setLoading(true);
    try { await signInWithGoogle(); router.push("/"); }
    catch {} finally { setLoading(false); }
  };

  const inp: React.CSSProperties = {
    width:"100%", background:"rgba(255,255,255,0.04)",
    border:"1px solid rgba(168,85,247,0.15)",
    borderRadius:14, padding:"14px 16px",
    color:"#fff", fontSize:"0.92rem",
    fontFamily:"'Inter',-apple-system,sans-serif",
    outline:"none", transition:"border-color 0.2s",
  };

  const lbl: React.CSSProperties = {
    fontSize:"0.62rem", fontWeight:700,
    color:"rgba(255,255,255,0.4)",
    letterSpacing:"0.1em", textTransform:"uppercase",
    marginBottom:8, display:"block",
  };

  if (screen === "signup") return (
    <div style={{ minHeight:"100vh", background:"#080818", display:"flex", flexDirection:"column", fontFamily:"'Inter',-apple-system,sans-serif", position:"relative", overflow:"hidden" }}>

      {/* Background effects */}
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 100% 60% at 50% -10%, rgba(168,85,247,0.15) 0%, transparent 60%)", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"rgba(0,200,255,0.04)", top:-100, right:-100, filter:"blur(60px)", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"rgba(224,64,251,0.04)", bottom:-80, left:-80, filter:"blur(60px)", pointerEvents:"none" }}/>

      {/* Grid pattern */}
      <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(168,85,247,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.03) 1px, transparent 1px)", backgroundSize:"40px 40px", pointerEvents:"none" }}/>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 28px", position:"relative", zIndex:1 }}>

        {/* Logo */}
        <div style={{ marginBottom:12, textAlign:"center" }}>
          <div style={{ fontSize:"4rem", fontWeight:900, letterSpacing:"-0.05em", lineHeight:1, background:"linear-gradient(135deg, #00c8ff 0%, #a855f7 50%, #e040fb 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", filter:"drop-shadow(0 0 30px rgba(168,85,247,0.5))", marginBottom:6 }}>
            Liveroo
          </div>
          <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.25)", letterSpacing:"0.25em", textTransform:"uppercase" }}>
            Subastas en vivo · Venezuela
          </div>
        </div>

        {/* Live indicator */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:40, background:"rgba(255,45,45,0.08)", border:"1px solid rgba(255,45,45,0.15)", borderRadius:100, padding:"6px 16px" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#ff2d2d", boxShadow:"0 0 8px #ff2d2d" }}/>
          <span style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.5)", fontWeight:600, letterSpacing:"0.06em" }}>14 shows activos ahora mismo</span>
        </div>

        {/* Buttons */}
        <div style={{ width:"100%", maxWidth:380, display:"flex", flexDirection:"column", gap:12, marginBottom:24 }}>
          {[
            { label:"Continuar con Google", onClick: handleGoogle },
            { label:"Continuar con Apple", onClick: undefined },
            { label:"Continuar con Correo", onClick: () => setScreen("email-signup") },
          ].map((btn, i) => (
            <button key={i} onClick={btn.onClick} style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(168,85,247,0.15)", borderRadius:16, padding:"15px 20px", fontSize:"0.92rem", fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.01em", transition:"all 0.2s", backdropFilter:"blur(10px)" }}>
              {btn.label}
            </button>
          ))}
        </div>

        <p style={{ fontSize:"0.82rem", color:"rgba(255,255,255,0.25)", marginBottom:12 }}>¿Ya tienes cuenta?</p>

        <button onClick={() => setScreen("login")} style={{ width:"100%", maxWidth:380, background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.2)", borderRadius:16, padding:"15px", fontSize:"0.92rem", fontWeight:800, color:"#fff", cursor:"pointer", fontFamily:"inherit", marginBottom:32 }}>
          Iniciar Sesión
        </button>

        <p style={{ fontSize:"0.62rem", color:"rgba(255,255,255,0.15)", textAlign:"center", lineHeight:1.8, maxWidth:300 }}>
          Al continuar aceptas nuestros <u>Términos de Uso</u> y <u>Política de Privacidad</u>
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#080818", display:"flex", flexDirection:"column", fontFamily:"'Inter',-apple-system,sans-serif", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 80% 50% at 50% 0%, rgba(168,85,247,0.1) 0%, transparent 60%)", pointerEvents:"none" }}/>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 28px", position:"relative", zIndex:1 }}>

        {/* Logo small */}
        <div style={{ fontSize:"2rem", fontWeight:900, letterSpacing:"-0.04em", background:"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", filter:"drop-shadow(0 0 15px rgba(168,85,247,0.4))", marginBottom:32 }}>
          Liveroo
        </div>

        <div style={{ width:"100%", maxWidth:380, background:"rgba(13,13,32,0.8)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:24, padding:"32px 28px", backdropFilter:"blur(20px)" }}>

          {/* Back */}
          <button onClick={() => { setScreen("signup"); clearError(); }} style={{ width:38, height:38, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", marginBottom:24 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>

          <h1 style={{ fontSize:"1.7rem", fontWeight:900, color:"#fff", marginBottom:8, letterSpacing:"-0.03em" }}>
            {screen === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}
          </h1>
          <p style={{ fontSize:"0.8rem", color:"rgba(255,255,255,0.35)", marginBottom:28, lineHeight:1.6 }}>
            {screen === "login" ? "Ingresa para seguir pujando en vivo" : "Únete y empieza a pujar en vivo"}
          </p>

          <form onSubmit={screen === "login" ? handleLogin : handleSignup} style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {screen === "email-signup" && (
              <div style={{ marginBottom:16 }}>
                <label style={lbl}>Nombre completo</label>
                <input style={inp} type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" required/>
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Correo electrónico</label>
              <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" required/>
            </div>

            <div style={{ marginBottom: screen==="login" ? 8 : 28 }}>
              <label style={lbl}>Contraseña</label>
              <div style={{ position:"relative" }}>
                <input style={{ ...inp, paddingRight:50 }} type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={6}/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:"0.75rem", fontWeight:600, fontFamily:"inherit" }}>
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            {screen === "login" && (
              <button type="button" style={{ background:"none", border:"none", color:"#a855f7", fontSize:"0.78rem", fontWeight:600, textAlign:"right", marginBottom:24, cursor:"pointer", fontFamily:"inherit" }}>
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {error && (
              <div style={{ background:"rgba(255,45,45,0.08)", border:"1px solid rgba(255,45,45,0.2)", borderRadius:12, padding:"12px 16px", fontSize:"0.8rem", color:"#ff8080", marginBottom:16, lineHeight:1.5 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ width:"100%", background: loading ? "rgba(168,85,247,0.3)" : "linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)", border:"none", borderRadius:14, padding:"15px", fontSize:"0.92rem", fontWeight:900, color:"#fff", cursor: loading ? "not-allowed" : "pointer", fontFamily:"inherit", letterSpacing:"0.02em", boxShadow: loading ? "none" : "0 0 30px rgba(168,85,247,0.3)", transition:"all 0.2s" }}>
              {loading ? "Cargando..." : screen === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
            </button>
          </form>

          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
            <div style={{ flex:1, height:1, background:"rgba(168,85,247,0.1)" }}/>
            <span style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.2)", letterSpacing:"0.08em" }}>O CONTINÚA CON</span>
            <div style={{ flex:1, height:1, background:"rgba(168,85,247,0.1)" }}/>
          </div>

          <div style={{ display:"flex", gap:10, marginBottom:20 }}>
            {["Google","Apple"].map(s => (
              <button key={s} onClick={s==="Google" ? handleGoogle : undefined} style={{ flex:1, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:12, padding:"12px", fontSize:"0.82rem", fontWeight:600, color:"rgba(255,255,255,0.6)", cursor:"pointer", fontFamily:"inherit" }}>{s}</button>
            ))}
          </div>

          <p style={{ textAlign:"center", fontSize:"0.8rem", color:"rgba(255,255,255,0.3)" }}>
            {screen === "login" ? "¿Sin cuenta? " : "¿Ya tienes cuenta? "}
            <button onClick={() => { setScreen(screen==="login"?"email-signup":"login"); clearError(); }} style={{ background:"none", border:"none", color:"#a855f7", fontWeight:700, cursor:"pointer", fontSize:"inherit", fontFamily:"inherit" }}>
              {screen === "login" ? "Regístrate gratis" : "Iniciar Sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
