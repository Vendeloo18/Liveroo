"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { CaretLeft, GoogleLogo, PlayCircle } from "@phosphor-icons/react";
import { useAuthStore } from "../../store/authStore";
import { BrandFlowHero } from "../../components/ui/BrandFlowHero";
import { functions } from "../../lib/firebase";

type Modo = "entrar" | "crear";
// La pantalla ahora tiene dos momentos, como un paso de onboarding:
// primero se elige puerta, después se pide la credencial. Antes las tres
// cosas —pestañas, Google y tres campos— llegaban de una.
type Vista = "elegir" | "formulario";

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle, resetPassword, error, clearError, profile } = useAuthStore();
  const [modo, setModo] = useState<Modo>("crear");
  const [vista, setVista] = useState<Vista>("elegir");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [recuperando, setRecuperando] = useState(false);
  const [avisoReset, setAvisoReset] = useState<string | null>(null);
  const [verClave, setVerClave] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // Los tres campos de una hacían que la pantalla se leyera como un
  // trámite. Google queda como camino a la vista y el correo a un toque
  // —a un toque, no enterrado: si Google falla, la gente tiene que poder
  // encontrar la otra puerta sin pensar.
  const [verCorreo, setVerCorreo] = useState(false);
  const [salidaControlada, setSalidaControlada] = useState(false);
  const esCorreoAdmin = modo === "entrar" && email.trim().toLowerCase() === "info@vendeloo.io";

  const bonoPendiente = () => {
    if (typeof window === "undefined") return false;
    const query = new URLSearchParams(window.location.search);
    try {
      return query.get("bonus") === "1" || localStorage.getItem("vlo_welcome_bonus_pending") === "1";
    } catch {
      return query.get("bonus") === "1";
    }
  };

  const activarBono = async () => {
    await httpsCallable(functions, "claimWelcomeBonus")({});
    try {
      localStorage.removeItem("vlo_welcome_bonus_pending");
      localStorage.setItem("vlo_onb", "1");
    } catch { /* modo privado */ }
  };

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const entrar = query.get("entrar") === "1";
    const crear = query.get("crear") === "1";
    setModo(entrar ? "entrar" : "crear");
    // Quien llega con la puerta ya elegida —el onboarding manda
    // ?crear=1 con el bono pendiente— no debe volver a elegirla.
    if (entrar || crear) setVista("formulario");
  }, []);

  useEffect(() => {
    if (profile && !bonoPendiente() && !salidaControlada) router.replace("/");
  }, [profile, router, salidaControlada]);

  const completarBonoSiAplica = async () => {
    if (!bonoPendiente()) return false;
    try {
      await activarBono();
      router.push("/wallet");
    } catch {
      router.push("/onboarding?bonus_retry=1");
    }
    return true;
  };

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    setOcupado(true);
    setSalidaControlada(true);
    try {
      if (esCorreoAdmin) {
        await signInWithGoogle();
        router.push("/admin");
      } else if (modo === "crear") {
        await signUp({ email, password: clave, displayName: nombre.trim() });
        if (!(await completarBonoSiAplica())) router.push("/onboarding");
      } else {
        await signIn(email, clave);
        if (!(await completarBonoSiAplica())) router.push("/");
      }
    } catch {
      setSalidaControlada(false);
      /* el store ya expone el error */
    }
    finally { setOcupado(false); }
  };

  const conGoogle = async () => {
    clearError();
    setOcupado(true);
    setSalidaControlada(true);
    try {
      await signInWithGoogle();
      if (!(await completarBonoSiAplica())) router.push("/");
    } catch {
      setSalidaControlada(false);
      /* el store ya expone el error */
    }
    finally { setOcupado(false); }
  };

  const abrirFormulario = (nuevoModo: Modo) => {
    setModo(nuevoModo);
    setVista("formulario");
    clearError();
  };

  const volverAElegir = () => {
    setVista("elegir");
    setVerCorreo(false);
    setAvisoReset(null);
    clearError();
  };

  const puedeEnviar = !!email.trim() && clave.length >= 6 && (modo === "entrar" || !!nombre.trim());

  return (
    <main className={`vlo-flow-shell vlo-auth vlo-auth--${vista}`}>
      <BrandFlowHero
        imageSrc="/brand/venta-en-vivo-headphones.png"
        imageAlt="Audífonos presentados en una venta en vivo de Vendeloo"
        eyebrow="Vendeloo · Ventas en vivo"
        title={<>COMPRAR<br/>EN VIVO ES<br/>ASÍ DE FÁCIL.</>}
        description="MÍRALO EN VIVO · PUJALOO · GANALOO."
        actionLabel="Explorar"
        onAction={() => router.push("/")}
        variant="entry"
      />

      <section className="vlo-flow-sheet vlo-auth__sheet">
        {vista === "elegir" ? (
          // Misma geometría que un paso del onboarding: la hoja mide lo
          // mismo y el naranja cae donde cae CONTINUAR. Solo dos puertas;
          // pedir credenciales es asunto de la pantalla siguiente.
          <div className="vlo-auth__puertas">
            <button
              type="button"
              className="vlo-auth__puerta vlo-auth__puerta--principal"
              onClick={() => abrirFormulario("crear")}
            >
              CREAR CUENTA
            </button>
            <button
              type="button"
              className="vlo-auth__puerta vlo-auth__puerta--secundaria"
              onClick={() => abrirFormulario("entrar")}
            >
              INICIAR SESIÓN
            </button>

            <p className="vlo-auth__terms">
              Al crear tu cuenta aceptas los <a href="/terminos">Términos</a> y la{" "}
              <a href="/privacidad">Privacidad</a>. Tus datos no son públicos.
            </p>
          </div>
        ) : (
        <>
        <div className="vlo-auth__encabezado">
          <button type="button" className="vlo-auth__volver" onClick={volverAElegir}>
            <CaretLeft size={16} weight="bold" aria-hidden="true"/> Atrás
          </button>
          <span>{modo === "crear" ? "Crear cuenta" : "Iniciar sesión"}</span>
        </div>

        <p className="vlo-auth__lead">
          {modo === "crear"
            ? "Empieza a comprar en vivo desde cualquier lugar de Venezuela."
            : "Tus ventas en vivo te están esperando."}
        </p>

        <button
          type="button"
          onClick={conGoogle}
          disabled={ocupado}
          className="lv-btn lv-btn--outline lv-btn--block lv-btn--lg vlo-auth__google"
        >
          <GoogleLogo size={20} weight="bold" aria-hidden="true"/>
          Continuar con Google
        </button>

        {/* El error va fuera del formulario: si Google falla y los campos
            están plegados, el aviso tiene que verse igual. */}
        {error && <div className="lv-note lv-note--bad vlo-auth__error">{error}</div>}

        {!verCorreo && (
          <button
            type="button"
            className="vlo-auth__separator vlo-auth__correo"
            onClick={() => setVerCorreo(true)}
            aria-expanded={false}
          >
            <i aria-hidden="true"/>
            <span>{modo === "crear" ? "o crea tu cuenta con correo" : "o entra con tu correo"}</span>
            <i aria-hidden="true"/>
          </button>
        )}

        {verCorreo && (
          <div className="vlo-auth__separator" aria-hidden="true">
            <i/>
            <span>o con tu correo</span>
            <i/>
          </div>
        )}

        {verCorreo && <form onSubmit={enviar} className="vlo-auth__form">
          {modo === "crear" && (
            <div className="lv-field">
              <label className="lv-field__label" htmlFor="nombre">Tu nombre</label>
              <input
                id="nombre"
                className="lv-input"
                value={nombre}
                autoComplete="name"
                onChange={event => setNombre(event.target.value)}
                placeholder="Cómo quieres que te vean"
              />
            </div>
          )}

          <div className="lv-field">
            <label className="lv-field__label" htmlFor="email">Correo</label>
            <input
              id="email"
              className="lv-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="tucorreo@ejemplo.com"
            />
          </div>

          {!esCorreoAdmin && <div className="lv-field">
            <label className="lv-field__label" htmlFor="clave">Contraseña</label>
            <div className="vlo-auth__password">
              <input
                id="clave"
                className="lv-input"
                type={verClave ? "text" : "password"}
                autoComplete={modo === "crear" ? "new-password" : "current-password"}
                value={clave}
                onChange={event => setClave(event.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setVerClave(valor => !valor)}
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {verClave ? "Ocultar" : "Ver"}
              </button>
            </div>
            {modo === "crear" && clave.length > 0 && clave.length < 6 && (
              <div className="lv-field__hint">Te faltan {6 - clave.length} caracteres</div>
            )}
            {modo === "entrar" && (
              <button
                type="button"
                onClick={async () => {
                  clearError();
                  setAvisoReset(null);
                  if (!email.trim()) { setAvisoReset("Escribe tu correo arriba y toca aquí de nuevo."); return; }
                  setRecuperando(true);
                  try {
                    await resetPassword(email);
                    setAvisoReset(`Te enviamos un enlace a ${email.trim()} para cambiar tu contraseña. Revisa también el correo no deseado.`);
                  } catch { /* el store ya expone el error */ }
                  finally { setRecuperando(false); }
                }}
                style={{ marginTop: 8, fontSize: "0.78rem", fontWeight: 700, color: "var(--accent-strong)", textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                {recuperando ? "Enviando…" : "Olvidé mi contraseña"}
              </button>
            )}
          </div>}

          {esCorreoAdmin && (
            <div className="lv-note lv-note--ok" style={{ marginBottom: 12 }}>
              Esta es la cuenta administradora. Entrarás de forma segura con Google; no necesitas contraseña.
            </div>
          )}

          {avisoReset && <div className="lv-note lv-note--ok" style={{ marginBottom: 12 }}>{avisoReset}</div>}

          <button
            type="submit"
            className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg"
            disabled={ocupado || (!esCorreoAdmin && !puedeEnviar)}
          >
            {ocupado ? "Abriendo Google…" : esCorreoAdmin ? "Entrar al panel de administración" : modo === "crear" ? "Crear mi cuenta" : "Entrar a Vendeloo"}
          </button>

        </form>}

        <button type="button" className="vlo-auth__how" onClick={() => router.push("/onboarding")}>
          <PlayCircle size={21} weight="regular" aria-hidden="true"/>
          Ver cómo funciona
        </button>

        {/* Términos y privacidad eran dos bloques de texto separados por un
            botón, tres cosas apiladas al final. Van en una sola línea. */}
        <p className="vlo-auth__terms">
          {modo === "crear" && (
            <>Al crear tu cuenta aceptas los <a href="/terminos">Términos</a> y la <a href="/privacidad">Privacidad</a>. </>
          )}
          Tus datos no son públicos.
        </p>
        </>
        )}
      </section>
    </main>
  );
}
