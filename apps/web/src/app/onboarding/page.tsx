"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  ArrowRight,
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

const TOTAL = 2;

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
    description: "Elige cuánto subir y gana $1 para comenzar.",
    imageSrc: "/brand/onboarding-productos-live-v3.png",
    imageAlt: "Consola portátil, cámara instantánea y reloj inteligente disponibles en Vendeloo",
    variant: "showcase" as const,
  },
];

type BonusEstado = "listo" | "procesando" | "ganado" | "acreditado" | "cuenta" | "error";

export default function OnboardingPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [paso, setPaso] = useState(0);
  const [pujaDemo, setPujaDemo] = useState(4);
  const [inc, setInc] = useState(1);
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
    setBonusEstado("procesando");

    if (!profile) {
      try {
        localStorage.setItem("vlo_onb", "1");
        localStorage.setItem("vlo_welcome_bonus_pending", "1");
      } catch { /* modo privado */ }
      setBonusEstado("cuenta");
      setTimeout(() => router.push("/login?crear=1&bonus=1"), 1200);
      return;
    }

    try {
      const response = await httpsCallable(functions, "claimWelcomeBonus")({});
      const data = response.data as { status?: "awarded" | "already_claimed" };
      setPujaDemo(valor => valor + inc);
      setBonusEstado(data.status === "already_claimed" ? "acreditado" : "ganado");
      try { localStorage.setItem("vlo_onb", "1"); } catch { /* modo privado */ }
      setTimeout(() => router.push("/wallet"), 1800);
    } catch (error) {
      console.error("No se pudo acreditar el bono de bienvenida", error);
      setSubido(false);
      setBonusEstado("error");
      setBonusIntento(intentos => intentos + 1);
    }
  };

  const successLabel = bonusEstado === "procesando"
    ? "ACTIVANDO TU $1…"
    : bonusEstado === "ganado"
      ? "¡GANASTE $1!"
      : bonusEstado === "acreditado"
        ? "TU $1 YA ESTÁ ACREDITADO"
        : bonusEstado === "cuenta"
          ? "¡LISTO! CREA TU CUENTA"
          : "¡SUBELOO!";

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
                  <p>Únete a una venta y descubre productos increíbles.</p>
                </div>
                <i aria-hidden="true"/>
                <div>
                  <span className="vlo-onb__process-number">2</span>
                  <span className="vlo-onb__process-icon"><Gavel size={28} weight="bold"/></span>
                  <b>SUBELOO</b>
                  <p>Sube tu oferta en segundos con un solo gesto.</p>
                </div>
                <i aria-hidden="true"/>
                <div>
                  <span className="vlo-onb__process-number">3</span>
                  <span className="vlo-onb__process-icon"><Trophy size={28} weight="bold"/></span>
                  <b>RECIBELOO</b>
                  <p>Si quedas de primero, coordina la entrega.</p>
                </div>
              </div>

            </div>
          )}

          {paso === 1 && (
            <div className="vlo-onb__demo">
              <div className="vlo-onb__demo-product">
                <Image
                  src="/brand/onboarding-productos-live-v3.png"
                  alt="Combo tecnológico de la oferta de práctica"
                  width={1254}
                  height={1254}
                />
                <div>
                  <span>Tu primer SUBELOO</span>
                  <b>Combo tecnológico</b>
                  <small>Práctica sin costo · bono real al terminar</small>
                </div>
                <em>BONO +$1</em>
              </div>

              <div className="vlo-onb__price-card">
                <div>
                  <span>Ahora va en</span>
                  <strong>${pujaDemo}</strong>
                </div>
                <ArrowRight size={23} weight="bold" aria-hidden="true"/>
                <div>
                  <span>Con +${inc} ofreces</span>
                  <strong className="is-accent">${pujaDemo + inc}</strong>
                </div>
              </div>

              <p className="vlo-onb__increment-label">Elige cuánto quieres subir</p>
              <div className="vlo-onb__increments" aria-label="Cuánto quieres subir">
                {[1, 5, 10].map(valor => (
                  <button
                    type="button"
                    key={valor}
                    className={inc === valor ? "is-selected" : ""}
                    aria-pressed={inc === valor}
                    disabled={subido}
                    onClick={() => setInc(valor)}
                  >
                    SUBIR ${valor}
                  </button>
                ))}
              </div>

              <div className="vlo-onb__subeloo">
                <SlideToBid
                  key={bonusIntento}
                  prominent
                  label={profile ? "SUBELOO Y GANA $1" : "SUBELOO Y ACTIVA TU $1"}
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
                        ? "Crea tu cuenta para guardar el dólar."
                        : "Arrastra el círculo hasta el final"}
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
