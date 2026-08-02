"use client";

import Image from "next/image";
import { Eye, Gavel, PlayCircle, Trophy } from "@phosphor-icons/react";
import { BRAND } from "@subastas-ve/shared";
import { Logo } from "./Logo";

const PASOS = [
  { titulo: "MIRALOO", texto: "Descubre productos en directo.", Icono: Eye },
  { titulo: "SUBELOO", texto: "Sube tu oferta en segundos.", Icono: Gavel },
  { titulo: "RECIBELOO", texto: "Gana y coordina la entrega.", Icono: Trophy },
];

/**
 * Entrada de marca. Presenta Vendeloo como una plataforma de ventas en vivo;
 * la puja aparece como la mecánica, no como el nombre del producto.
 */
export function Hero({
  onCrearCuenta,
  onIniciarSesion,
  onVerComoFunciona,
  onEntrarSinCuenta,
}: {
  onCrearCuenta: () => void;
  onIniciarSesion: () => void;
  onVerComoFunciona: () => void;
  onEntrarSinCuenta: () => void;
}) {
  return (
    <main className="vlo-entry">
      <section className="vlo-entry__hero" aria-labelledby="entrada-titulo">
        <Image
          src="/brand/venta-en-vivo-headphones.png"
          alt="Audífonos presentados en una venta en vivo de Vendeloo"
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          className="vlo-entry__art"
        />

        <div className="vlo-entry__brand">
          <Logo tamano={29} color="#fff"/>
        </div>

        <h1 id="entrada-titulo" className="lv-display vlo-entry__title">
          Comprar<br/>en vivo es<br/>así de fácil.
        </h1>

        <div className="vlo-entry__live-card" aria-label="Ejemplo de una venta en vivo">
          <span className="vlo-entry__live"><i/> EN VIVO</span>
          <span className="vlo-entry__live-copy">Ahora mismo</span>
          <span className="vlo-entry__divider"/>
          <span className="vlo-entry__bid-label">Precio actual</span>
          <strong className="lv-display">$42</strong>
          <span className="vlo-entry__bid-help">27 ofertas</span>
        </div>
      </section>

      <section className="vlo-entry__sheet">
        <div className="vlo-entry__mantra" aria-label={BRAND.mantra}>{BRAND.mantra}</div>
        <div className="vlo-entry__steps" aria-label="Cómo funciona Vendeloo">
          {PASOS.map(({ titulo, texto, Icono }, index) => (
            <div className="vlo-entry__step" key={titulo}>
              <div className="vlo-entry__step-icon">
                <span>{index + 1}</span>
                <Icono size={30} weight="regular" aria-hidden="true"/>
              </div>
              <b>{titulo}</b>
              <p>{texto}</p>
            </div>
          ))}
        </div>

        <div className="vlo-entry__actions">
          <button onClick={onCrearCuenta} className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg">
            Crear cuenta gratis
          </button>
          <button onClick={onIniciarSesion} className="lv-btn lv-btn--outline lv-btn--block lv-btn--lg vlo-entry__login">
            Ya tengo cuenta
          </button>
          <button onClick={onVerComoFunciona} className="vlo-entry__how">
            <PlayCircle size={30} weight="regular" aria-hidden="true"/>
            Ver cómo funciona
          </button>
          <button onClick={onEntrarSinCuenta} className="vlo-entry__guest">
            Explorar sin cuenta
          </button>
        </div>
      </section>
    </main>
  );
}
