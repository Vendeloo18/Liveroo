"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/authStore";
import { BRAND, SIMBOLO_PATH } from "@subastas-ve/shared";
import { Hero } from "../../components/ui/Hero";
import { Logo } from "../../components/ui/Logo";

type Modo = "entrar" | "crear";
type Vista = "hero" | "formulario";

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle, error, clearError, profile } = useAuthStore();

  // Primero el hero de marca; el formulario aparece cuando el usuario
  // elige crear cuenta o iniciar sesión.
  const [vista, setVista] = useState<Vista>("hero");
  const [modo, setModo] = useState<Modo>("crear");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // Si ya hay sesión, no tiene sentido quedarse aquí
  useEffect(() => { if (profile) router.replace("/"); }, [profile, router]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setOcupado(true);
    try {
      if (modo === "crear") {
        await signUp({ email, password: clave, displayName: nombre.trim() });
        router.push("/onboarding");
      } else {
        await signIn(email, clave);
        router.push("/");
      }
    } catch { /* el store ya expone el error */ }
    finally { setOcupado(false); }
  };

  const conGoogle = async () => {
    clearError();
    setOcupado(true);
    try { await signInWithGoogle(); router.push("/"); }
    catch { /* idem */ }
    finally { setOcupado(false); }
  };

  const puedeEnviar = !!email.trim() && clave.length >= 6 && (modo === "entrar" || !!nombre.trim());

  if (vista === "hero") {
    return (
      <Hero
        onCrearCuenta={() => { setModo("crear"); clearError(); setVista("formulario"); }}
        onIniciarSesion={() => { setModo("entrar"); clearError(); setVista("formulario"); }}
        onEntrarSinCuenta={() => router.push("/")}
      />
    );
  }

  // Formulario en el MISMO lenguaje del onboarding: naranja pleno, la
  // etiqueta de marca de agua, titular apilado en Anton y una tarjeta
  // blanca con el contenido. Una sola voz desde el hero hasta adentro.
  return (
    <div style={{
      minHeight: "100dvh", maxWidth: "var(--app-max)", margin: "0 auto",
      background: "var(--accent)", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
      padding: "calc(22px + env(safe-area-inset-top)) 20px calc(18px + env(safe-area-inset-bottom))",
    }}>
      <svg viewBox="0 0 24 24" aria-hidden style={{ position: "absolute", right: "-24%", top: "12%", width: "105%", fill: "var(--accent-light)", opacity: 0.5, pointerEvents: "none" }}>
        <path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/>
      </svg>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo tamano={26} color="#fff"/>
          <button onClick={() => router.push("/")} style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 700, padding: "6px 2px" }}>
            Ver sin cuenta
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 12 }}/>

        <div className="lv-eyebrow" style={{ color: "rgba(255,255,255,0.85)", letterSpacing: "0.16em" }}>
          {modo === "crear" ? "Únete a Vendeloo" : "Qué bueno verte"}
        </div>
        <h1 className="lv-display" style={{ color: "#fff", fontSize: "clamp(2.1rem, 11vw, 3rem)", lineHeight: 0.92, marginTop: 10, whiteSpace: "pre-line" }}>
          {modo === "crear" ? "Crea tu\ncuenta." : "Entra a\ntu cuenta."}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.92)", fontSize: "0.98rem", fontWeight: 600, lineHeight: 1.45, marginTop: 14, maxWidth: 340 }}>
          {modo === "crear" ? `${BRAND.tagline}. Puja, gana y coordina con el vendedor.` : "Tus pujas, tu saldo y tus órdenes te esperan."}
        </p>

        <div style={{ background: "var(--bg)", borderRadius: "var(--r-card)", padding: 18, marginTop: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.22)" }}>

        {/* Google primero: es como entra casi todo el mundo */}
        <button
          onClick={conGoogle}
          disabled={ocupado}
          className="lv-btn lv-btn--outline lv-btn--block lv-btn--lg"
          style={{ marginBottom: 16 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z"/>
          </svg>
          Continuar con Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }}/>
          <span className="lv-dim" style={{ fontSize: "0.72rem", fontWeight: 600 }}>o con tu correo</span>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }}/>
        </div>

        <form onSubmit={enviar}>
          {modo === "crear" && (
            <div className="lv-field">
              <label className="lv-field__label" htmlFor="nombre">Tu nombre</label>
              <input
                id="nombre" className="lv-input" value={nombre} autoComplete="name"
                onChange={e => setNombre(e.target.value)} placeholder="Como quieres que te vean"
              />
            </div>
          )}

          <div className="lv-field">
            <label className="lv-field__label" htmlFor="email">Correo</label>
            <input
              id="email" className="lv-input" type="email" inputMode="email" autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com"
            />
          </div>

          <div className="lv-field">
            <label className="lv-field__label" htmlFor="clave">Contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                id="clave" className="lv-input" type={verClave ? "text" : "password"}
                autoComplete={modo === "crear" ? "new-password" : "current-password"}
                value={clave} onChange={e => setClave(e.target.value)}
                placeholder="Mínimo 6 caracteres" style={{ paddingRight: 62 }}
              />
              <button
                type="button"
                onClick={() => setVerClave(v => !v)}
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", fontSize: "0.74rem", fontWeight: 700 }}
              >
                {verClave ? "Ocultar" : "Ver"}
              </button>
            </div>
            {modo === "crear" && clave.length > 0 && clave.length < 6 && (
              <div className="lv-field__hint">Te faltan {6 - clave.length} caracteres</div>
            )}
          </div>

          {error && <div className="lv-note lv-note--bad" style={{ marginBottom: 14 }}>{error}</div>}

          <button type="submit" className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={ocupado || !puedeEnviar}>
            {ocupado ? "Un momento…" : modo === "crear" ? "Crear mi cuenta" : "Entrar"}
          </button>

          {modo === "crear" && (
            <p className="lv-dim" style={{ fontSize: "0.72rem", lineHeight: 1.55, textAlign: "center", marginTop: 12 }}>
              Al crear tu cuenta aceptas los{" "}
              <a href="/terminos" style={{ color: "var(--accent-strong)", fontWeight: 700 }}>Términos</a> y la{" "}
              <a href="/privacidad" style={{ color: "var(--accent-strong)", fontWeight: 700 }}>Privacidad</a>.
            </p>
          )}
        </form>
        </div>

        <p style={{ fontSize: "0.72rem", lineHeight: 1.55, textAlign: "center", marginTop: 14, color: "rgba(255,255,255,0.85)" }}>
          Tu correo y tu teléfono no son públicos: solo los ve el vendedor con quien cierres una compra.
        </p>

        <div style={{ flex: 1, minHeight: 16 }}/>

        {/* Pie idéntico al del onboarding: Atrás en píldora + acción clara */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setVista("hero")} className="lv-btn lv-btn--lg" style={{ background: "transparent", color: "#fff", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.7)", flexShrink: 0, padding: "0 22px" }}>
            Atrás
          </button>
          <button
            onClick={() => { setModo(m => m === "crear" ? "entrar" : "crear"); clearError(); }}
            className="lv-btn lv-btn--lg"
            style={{ flex: 1, background: "#fff", color: "var(--accent)" }}
          >
            {modo === "crear" ? "Ya tengo cuenta" : "Quiero crear una cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}
