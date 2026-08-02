"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDoubleRight, Check } from "@phosphor-icons/react";

/**
 * SUBELOO: el gesto distintivo de Vendeloo.
 *
 * La etiqueta queda centrada de verdad, la perilla responde sin depender del
 * ritmo de render de React y el mismo control funciona con puntero, tacto y
 * teclado. `prominent` crea la versión grande usada en el onboarding.
 */
export function SlideToBid({
  label,
  onConfirm,
  disabled,
  color = "var(--accent)",
  successLabel = "¡Oferta registrada!",
  holdSuccess = false,
  prominent = false,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  color?: string;
  successLabel?: string;
  holdSuccess?: boolean;
  prominent?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const startRef = useRef(0);
  const draggingRef = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);

  const height = prominent ? 64 : 52;
  const knob = prominent ? 54 : 44;
  const pad = (height - knob) / 2;
  const maxX = () => Math.max(0, (trackRef.current?.offsetWidth ?? 320) - knob - pad * 2);

  const moveTo = (value: number) => {
    const next = Math.max(0, Math.min(maxX(), value));
    xRef.current = next;
    setX(next);
  };

  const reset = () => {
    setDone(false);
    moveTo(0);
  };

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const confirm = () => {
    if (disabled || done) return;
    draggingRef.current = false;
    moveTo(maxX());
    setDone(true);
    setDragging(false);
    try { navigator.vibrate?.(45); } catch { /* vibración opcional */ }
    onConfirm();
    if (!holdSuccess) {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(reset, 1150);
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || done) return;
    draggingRef.current = true;
    setDragging(true);
    startRef.current = event.clientX - xRef.current;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    moveTo(event.clientX - startRef.current);
  };

  const release = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (xRef.current >= maxX() * 0.72) confirm();
    else moveTo(0);
  };

  const progress = maxX() > 0 ? Math.min(1, x / maxX()) : 0;
  const nearEnd = progress > 0.76 && !done;

  return (
    <div
      ref={trackRef}
      className={`vlo-subeloo${prominent ? " vlo-subeloo--prominent" : ""}${done ? " is-done" : ""}${dragging ? " is-dragging" : ""}`}
      style={{
        "--subeloo-color": color,
        "--subeloo-height": `${height}px`,
        "--subeloo-knob": `${knob}px`,
        "--subeloo-pad": `${pad}px`,
        "--subeloo-x": `${x}px`,
        "--subeloo-progress": `${Math.max(0.12, progress) * 100}%`,
        opacity: disabled && !done ? 0.48 : 1,
      } as React.CSSProperties}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-disabled={disabled || undefined}
    >
      <div className="vlo-subeloo__fill" aria-hidden="true"/>

      <div className="vlo-subeloo__label" aria-live="polite">
        {done ? (
          <><Check size={prominent ? 22 : 18} weight="bold"/>{successLabel}</>
        ) : nearEnd ? (
          "SUELTA PARA SUBIRLO"
        ) : (
          label
        )}
      </div>

      <button
        type="button"
        className="vlo-subeloo__knob"
        aria-label={done ? successLabel : `Deslizar ${label}`}
        disabled={disabled || done}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            confirm();
          }
        }}
      >
        {done
          ? <Check size={prominent ? 25 : 21} weight="bold"/>
          : <CaretDoubleRight size={prominent ? 27 : 23} weight="bold"/>}
      </button>
    </div>
  );
}
