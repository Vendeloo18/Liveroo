"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/authStore";
import { BRAND } from "@subastas-ve/shared";

type Modo = "entrar" | "crear";

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle, error, clearError, profile } = useAuthStore();

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

  return (
    <div className="lv-app" style={{ paddingBottom: 32 }}>

      <div className="lv-pad" style={{ paddingTop: 40 }}>
        <div className="lv-wordmark" style={{ fontSize: "2rem" }}>{BRAND.name}</div>
        <p className="lv-muted" style={{ fontSize: "0.92rem", lineHeight: 1.5, marginTop: 8, maxWidth: 300 }}>
          {BRAND.tagline}. Puja, gana y coordina con el vendedor.
        </p>
      </div>

      <div className="lv-pad" style={{ paddingTop: 22 }}>

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

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {([["crear", "Crear cuenta"], ["entrar", "Ya tengo cuenta"]] as [Modo, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setModo(v); clearError(); }}
              className={`lv-chip${modo === v ? " lv-chip--active" : ""}`}
              style={{ flex: 1 }}
            >
              {label}
            </button>
          ))}
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
        </form>

        <p className="lv-dim" style={{ fontSize: "0.72rem", lineHeight: 1.55, textAlign: "center", marginTop: 18 }}>
          Tu correo y tu teléfono no son públicos: solo los ve el vendedor con quien cierres una compra.
        </p>

        <button className="lv-btn lv-btn--soft lv-btn--block" style={{ marginTop: 18 }} onClick={() => router.push("/")}>
          Ver subastas sin entrar
        </button>
      </div>
    </div>
  );
}
