"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  CaretLeft,
  Eye,
  Gavel,
  Trophy,
} from "@phosphor-icons/react";
import { BRAND } from "@subastas-ve/shared";
import { db, functions } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { BrandFlowHero } from "../../components/ui/BrandFlowHero";
import { SlideToBid } from "../../components/ui/SlideToBid";
import { celebrateFullScreen } from "../../components/ui/Confetti";

const TOTAL = 2;
const CELEBRATION_MS = 3200;

const escenas = [
  {
    eyebrow: "Paso 1 de 2 · Descubre",
    title: <>MIRALOO.<br/>DESCUBRE.</>,
    description: "Productos reales, vendedores en vivo y oportunidades en segundos.",
    imageSrc: "/brand/onboarding-productos-v2.png",
    imageAlt: "Control, teléfono y zapatos disponibles en Vendeloo",
    variant: "products" as const,
  },
  {
    eyebrow: "Paso 2 de 2 · Participa",
    title: <>SUBELOO.<br/>RECIBELOO.</>,
    description: "Haz el gesto una vez y recibe $1 para comenzar.",
    imageSrc: "/brand/onboarding-productos-live-v3.png",
    imageAlt: "Consola portátil, cámara instantánea y reloj inteligente disponibles en Vendeloo",
    variant: "showcase" as const,
  },
];

type BonusEstado = "listo" | "ganado" | "acreditado" | "cuenta" | "error";

export default function OnboardingPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [paso, setPaso] = useState(0);
  const [subido, setSubido] = useState(false);
  const [bonusEstado, setBonusEstado] = useState<BonusEstado>("listo");
  const [bonusIntento, setBonusIntento] = useState(0);

  const terminar = (ruta: string) => {
    try { localStorage.setItem("vlo_onb", "1"); } catch { /* modo privado */ }
    if (profile) {
      updateDoc(doc(db, "users", profile.uid), { onboardingDone: true }).catch(() => undefined);
    }
    router.push(ruta);
  };

  const siguiente = () => setPaso(actual => Math.min(TOTAL - 1, actual + 1));
  const atras = () => setPaso(actual => Math.max(0, actual - 1));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && paso < TOTAL - 1) siguiente();
      if (event.key === "ArrowLeft" && paso > 0) atras();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paso]);

  const escena = escenas[paso];

  const reclamarBono = async () => {
    setSubido(true);
    setBonusEstado(profile ? "ganado" : "cuenta");
    celebrateFullScreen();

    if (!profile) {
      try {
        localStorage.setItem("vlo_onb", "1");
        localStorage.setItem("vlo_welcome_bonus_pending", "1");
      } catch { /* modo privado */ }
      setTimeout(() => router.push("/login?crear=1&bonus=1"), CELEBRATION_MS);
      return;
    }

    try {
      const response = await httpsCallable(functions, "claimWelcomeBonus")({});
      const data = response.data as { status?: "awarded" | "already_claimed" };
      setBonusEstado(data.status === "already_claimed" ? "acreditado" : "ganado");
      try { localStorage.setItem("vlo_onb", "1"); } catch { /* modo privado */ }
      setTimeout(() => router.push("/wallet"), CELEBRATION_MS);
    } catch (error) {
      console.error("No se pudo acreditar el bono de bienvenida", error);
      setSubido(false);
      setBonusEstado("error");
      setBonusIntento(intentos => intentos + 1);
    }
  };

  const successLabel = bonusEstado === "ganado" || bonusEstado === "cuenta"
      ? "¡TE GANASTE $1!"
      : bonusEstado === "acreditado"
        ? "TU $1 YA ESTÁ ACREDITADO"
        : "SUBELOO";

  return (
    <main className={`vlo-flow-shell vlo-onb vlo-onb--step-${paso + 1}`}>
      <BrandFlowHero
        key={paso}
        imageSrc={escena.imageSrc}
        imageAlt={escena.imageAlt}
        eyebrow={escena.eyebrow}
        title={escena.title}
        description={escena.description}
        actionLabel="Saltar"
        onAction={() => terminar("/")}
        variant={escena.variant}
      />

      <section className="vlo-flow-sheet vlo-onb__sheet">
        <div className="vlo-onb__progress" aria-label={`Paso ${paso + 1} de ${TOTAL}`}>
          {Array.from({ length: TOTAL }, (_, indice) => (
            <span key={indice} className={indice <= paso ? "is-active" : ""}/>
          ))}
        </div>

        <div className="vlo-onb__content">
          {paso === 0 && (
            <div className="vlo-onb__welcome">
              <div className="vlo-onb__process">
                <div>
                  <span className="vlo-onb__process-number">1</span>
                  <span className="vlo-onb__process-icon"><Eye size={28} weight="bold"/></span>
                  <b>MIRALOO</b>
                </div>
                <i aria-hidden="true"/>
                <div>
                  <span className="vlo-onb__process-number">2</span>
                  <span className="vlo-onb__process-icon"><Gavel size={28} weight="bold"/></span>
                  <b>SUBELOO</b>
                </div>
                <i aria-hidden="true"/>
                <div>
                  <span className="vlo-onb__process-number">3</span>
                  <span className="vlo-onb__process-icon"><Trophy size={28} weight="bold"/></span>
                  <b>RECIBELOO</b>
                </div>
              </div>

            </div>
          )}

          {paso === 1 && (
            <div className="vlo-onb__demo">
              <div className="vlo-onb__reward-copy">
                <b>Desliza y recibe $1</b>
              </div>

              <div className="vlo-onb__subeloo">
                <SlideToBid
                  key={bonusIntento}
                  prominent
                  label="SUBELOO"
                  successLabel={successLabel}
                  holdSuccess
                  disabled={subido}
                  onConfirm={reclamarBono}
                />
              </div>
              <p className={`vlo-onb__demo-help${subido ? " is-success" : ""}`}>
                {bonusEstado === "error"
                  ? "No pudimos activar tu bono. Desliza otra vez."
                  : bonusEstado === "ganado"
                    ? "$1 acreditado. Abriendo tu billetera…"
                    : bonusEstado === "acreditado"
                      ? "Este usuario ya recibió su bono."
                      : bonusEstado === "cuenta"
                        ? "Crea tu cuenta para usarlo."
                        : "Solo para ofertas · no retirable"}
              </p>
            </div>
          )}
        </div>

        <footer className="vlo-onb__footer">
          {paso < TOTAL - 1 && (
            <button type="button" className="vlo-onb__continue" onClick={siguiente}>
              CONTINUAR
            </button>
          )}

          {paso > 0 && (
            <button type="button" className="vlo-onb__back" onClick={atras} disabled={subido}>
              <CaretLeft size={16} weight="bold"/> Atrás
            </button>
          )}
          <span className="vlo-onb__mantra">{BRAND.mantra}</span>
        </footer>
      </section>
    </main>
  );
}
