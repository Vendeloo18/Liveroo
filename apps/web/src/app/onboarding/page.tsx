"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  CaretLeft,
  Eye,
  Gavel,
  Tag,
  Trophy,
} from "@phosphor-icons/react";
import { BRAND } from "@subastas-ve/shared";
import { db, functions } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { Logo } from "../../components/ui/Logo";
import { SlideToBid } from "../../components/ui/SlideToBid";

const TOTAL = 2;

const escenas = [
  {
    eyebrow: "Bienvenido a Vendeloo",
    title: <>MIRALOO.<br/>SUBELOO.<br/>RECIBELOO.</>,
    description: "Comprar en vivo ahora se siente rápido, claro y emocionante.",
  },
  {
    eyebrow: "Pruébalo y gana $1",
    title: <>AHORA TE<br/>TOCA A TI.</>,
    description: "Desliza SUBELOO y recibe tu primer dólar para comprar.",
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
    <main className={`vlo-onb vlo-onb--step-${paso + 1}`}>
      <section className="vlo-onb__hero">
        <Tag className="vlo-onb__mark" weight="fill" aria-hidden="true"/>
        {paso < TOTAL && (
          <Image
            key={paso}
            src={paso === 0
              ? "/brand/onboarding-productos-v2.png"
              : "/brand/onboarding-audifonos-v2.png"}
            alt={paso === 0
              ? "Control, teléfono y zapatos disponibles en Vendeloo"
              : "Audífonos inalámbricos para practicar SUBELOO"}
            width={paso === 1 ? 1536 : 1254}
            height={paso === 1 ? 1024 : 1254}
            priority
            className="vlo-onb__hero-product"
          />
        )}

        <header className="vlo-onb__top">
          <Logo tamano={29} color="#fff"/>
          <button type="button" className="vlo-onb__skip" onClick={() => terminar("/")}>
            Saltar
          </button>
        </header>

        <div className="vlo-onb__hero-copy" key={paso}>
          <div className="vlo-onb__eyebrow">{escena.eyebrow}</div>
          <h1 className="vlo-onb__title">{escena.title}</h1>
          <p className="vlo-onb__description">{escena.description}</p>
        </div>
      </section>

      <section className="vlo-onb__sheet">
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

              <div className="vlo-onb__live-sample">
                <Image src="/brand/onboarding-productos-v2.png" alt="Productos en vivo ahora" width={1254} height={1254}/>
                <div>
                  <span><i/> EN VIVO AHORA</span>
                  <b>Tu próxima compra puede estar aquí</b>
                  <small>Productos desde $4 · vendedores de Venezuela</small>
                </div>
                <em>MIRALOO</em>
              </div>
            </div>
          )}

          {paso === 1 && (
            <div className="vlo-onb__demo">
              <div className="vlo-onb__demo-product">
                <Image
                  src="/brand/onboarding-audifonos-v2.png"
                  alt="Audífonos inalámbricos de la oferta de práctica"
                  width={1536}
                  height={1024}
                />
                <div>
                  <span>Tu primer SUBELOO</span>
                  <b>Audífonos inalámbricos</b>
                  <small>Práctica sin costo · bono real al terminar</small>
                </div>
                <em>BONO +$1</em>
              </div>

              <div className="vlo-onb__price-card">
                <div>
                  <span>Precio actual</span>
                  <strong>${pujaDemo}</strong>
                </div>
                <i aria-hidden="true"/>
                <div>
                  <span>Tu oferta</span>
                  <strong className="is-accent">${pujaDemo + inc}</strong>
                </div>
              </div>

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
                    +${valor}
                  </button>
                ))}
              </div>

              <div className="vlo-onb__subeloo">
                <SlideToBid
                  key={bonusIntento}
                  prominent
                  label={profile ? "DESLIZA Y GANA $1" : "DESLIZA Y ACTIVA TU $1"}
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
              Probar SUBELOO y ganar $1
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
