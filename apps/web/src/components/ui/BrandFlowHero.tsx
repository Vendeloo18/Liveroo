"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Logo } from "./Logo";

type HeroVariant = "entry" | "products" | "headphones";

export function BrandFlowHero({
  imageSrc,
  imageAlt,
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  variant,
}: {
  imageSrc: string;
  imageAlt: string;
  eyebrow: string;
  title: ReactNode;
  description: string;
  actionLabel: string;
  onAction: () => void;
  variant: HeroVariant;
}) {
  return (
    <section className={`vlo-flow-hero vlo-flow-hero--${variant}`}>
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        priority
        sizes="(max-width: 480px) 100vw, 480px"
        className="vlo-flow-hero__art"
      />

      <header className="vlo-flow-hero__top">
        <Logo tamano={29} color="#fff"/>
        <button type="button" className="vlo-flow-hero__action" onClick={onAction}>
          {actionLabel}
        </button>
      </header>

      <div className="vlo-flow-hero__copy">
        <div className="vlo-flow-hero__eyebrow">{eyebrow}</div>
        <h1 className="vlo-flow-hero__title">{title}</h1>
        <p className="vlo-flow-hero__description">{description}</p>
      </div>
    </section>
  );
}
