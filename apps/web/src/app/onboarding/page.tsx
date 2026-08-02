"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { doc, updateDoc } from "firebase/firestore";
import {
  Broadcast,
  CaretLeft,
  CheckCircle,
  ClockCountdown,
  Eye,
  Gavel,
  Tag,
  Trophy,
} from "@phosphor-icons/react";
import { BRAND } from "@subastas-ve/shared";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { Logo } from "../../components/ui/Logo";
import { SlideToBid } from "../../components/ui/SlideToBid";

const TOTAL = 3;

const escenas = [
  {
    eyebrow: "Bienvenido a Vendeloo",
    title: <>MIRALOO.<br/>SUBELOO.<br/>RECIBELOO.</>,
    description: "Comprar en vivo ahora se siente rápido, claro y emocionante.",
  },
  {
    eyebrow: "Compra a tu ritmo",
    title: <>DOS FORMAS.<br/>UNA MISMA<br/>EMOCIÓN.</>,
    description: "Elige cómo quieres descubrir tu próxima compra.",
  },
  {
    eyebrow: "Pruébalo sin saldo",
    title: <>AHORA TE<br/>TOCA A TI.</>,
    description: "Desliza SUBELOO. Esta práctica no usa dinero real.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [paso, setPaso] = useState(0);
  const [modo, setModo] = useState<"vivo" | "dias">("vivo");
  const [pujaDemo, setPujaDemo] = useState(4);
  const [inc, setInc] = useState(1);
  const [subido, setSubido] = useState(false);

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

  return (
    <main className={`vlo-onb vlo-onb--step-${paso + 1}`}>
      <section className="vlo-onb__hero">
        <Tag className="vlo-onb__mark" weight="fill" aria-hidden="true"/>
        {paso < 2 && (
          <Image
            key={paso}
            src={paso === 0 ? "/brand/onboarding-productos.png" : "/brand/onboarding-formas.png"}
            alt={paso === 0
              ? "Control, teléfono y zapatos disponibles en Vendeloo"
              : "Reloj inteligente y zapatos disponibles en Vendeloo"}
            width={1024}
            height={1536}
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
          )}

          {paso === 1 && (
            <div className="vlo-onb__modes" role="radiogroup" aria-label="Forma de comprar">
              <button
                type="button"
                role="radio"
                aria-checked={modo === "vivo"}
                className={`vlo-onb__mode${modo === "vivo" ? " is-selected" : ""}`}
                onClick={() => setModo("vivo")}
              >
                <span className="vlo-onb__mode-icon"><Broadcast size={25} weight="bold"/></span>
                <span className="vlo-onb__mode-copy">
                  <span className="vlo-onb__mode-kicker"><i/> LIVE · AHORA MISMO</span>
                  <b>Venta en vivo</b>
                  <small>MIRALOO en vivo, descubre el producto y usa SUBELOO al instante.</small>
                  <span className="vlo-onb__mode-meta">Ahora $18 · 42 mirando</span>
                </span>
                <CheckCircle className="vlo-onb__mode-check" size={25} weight="fill"/>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={modo === "dias"}
                className={`vlo-onb__mode${modo === "dias" ? " is-selected" : ""}`}
                onClick={() => setModo("dias")}
              >
                <span className="vlo-onb__mode-icon"><ClockCountdown size={25} weight="bold"/></span>
                <span className="vlo-onb__mode-copy">
                  <span className="vlo-onb__mode-kicker">ABIERTA · HORAS O DÍAS</span>
                  <b>Venta abierta</b>
                  <small>Deja tu oferta con calma. Te avisamos si alguien la supera.</small>
                  <span className="vlo-onb__mode-meta">Cierra mañana · 16 ofertas</span>
                </span>
                <CheckCircle className="vlo-onb__mode-check" size={25} weight="fill"/>
              </button>
            </div>
          )}

          {paso === 2 && (
            <div className="vlo-onb__demo">
              <div className="vlo-onb__demo-product">
                <Image
                  src="/brand/venta-en-vivo-headphones.png"
                  alt="Audífonos inalámbricos de la oferta de práctica"
                  width={1135}
                  height={1386}
                />
                <div>
                  <span>Producto de práctica</span>
                  <b>Audífonos inalámbricos</b>
                  <small>Oferta inicial · $4</small>
                </div>
                <em>DEMO</em>
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
                  prominent
                  label={`SUBELOO · $${pujaDemo + inc}`}
                  successLabel="¡TE PUSISTE DE PRIMERO!"
                  holdSuccess
                  disabled={subido}
                  onConfirm={() => {
                    setSubido(true);
                    setPujaDemo(valor => valor + inc);
                    setTimeout(() => terminar("/"), 1450);
                  }}
                />
              </div>
              <p className={`vlo-onb__demo-help${subido ? " is-success" : ""}`}>
                {subido ? "Listo. Entrando a Vendeloo…" : "Arrastra el círculo hasta el final"}
              </p>
            </div>
          )}
        </div>

        <footer className="vlo-onb__footer">
          {paso < TOTAL - 1 && (
            <button type="button" className="vlo-onb__continue" onClick={siguiente}>
              {paso === 1
                ? `Continuar con ${modo === "vivo" ? "venta en vivo" : "venta abierta"}`
                : "Descubrir cómo comprar"}
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
