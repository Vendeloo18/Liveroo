"use client";

import confetti from "canvas-confetti";
import { useEffect } from "react";

const COLORS = ["#ff5a00", "#ff8a33", "#ffd166", "#ffffff", "#159447"];

export function celebrateFullScreen(count = 320) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "9999",
  });
  document.body.appendChild(canvas);

  const fire = confetti.create(canvas, { resize: true, useWorker: false });

  const common = {
    colors: COLORS,
    ticks: 340,
    gravity: 0.78,
    decay: 0.93,
    scalar: 1.06,
    zIndex: 9999,
    disableForReducedMotion: false,
  } as const;
  const motionScale = reduceMotion ? 0.65 : 1;
  const sideCount = Math.max(55, Math.round(count * 0.3 * motionScale));
  const centerCount = Math.max(75, Math.round(count * 0.4 * motionScale));

  fire({ ...common, particleCount: sideCount, angle: 62, spread: 88, startVelocity: 58, origin: { x: 0, y: 0.72 } });
  fire({ ...common, particleCount: sideCount, angle: 118, spread: 88, startVelocity: 58, origin: { x: 1, y: 0.72 } });

  const timers = [
    window.setTimeout(() => {
      fire({ ...common, particleCount: centerCount, angle: 90, spread: 135, startVelocity: 48, origin: { x: 0.5, y: 0.24 } });
    }, 140),
    window.setTimeout(() => {
      fire({ ...common, particleCount: Math.round(centerCount * 0.65), angle: 90, spread: 150, startVelocity: 34, origin: { x: 0.5, y: 0.5 } });
    }, 360),
    window.setTimeout(() => canvas.remove(), 4600),
  ];

  return () => {
    timers.forEach(timer => window.clearTimeout(timer));
    canvas.remove();
  };
}

export function Confetti({ count = 320 }: { count?: number }) {
  useEffect(() => celebrateFullScreen(count), [count]);
  return null;
}
