"use client";

import confetti from "canvas-confetti";
import { useEffect } from "react";

const COLORS = ["#ff5a00", "#ff8a33", "#ffd166", "#ffffff", "#159447"];

export function celebrateFullScreen(count = 320) {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return () => undefined;
  }

  const common = {
    colors: COLORS,
    ticks: 340,
    gravity: 0.78,
    decay: 0.93,
    scalar: 1.06,
    zIndex: 9999,
    disableForReducedMotion: true,
  } as const;
  const sideCount = Math.max(70, Math.round(count * 0.3));
  const centerCount = Math.max(100, Math.round(count * 0.4));

  confetti({ ...common, particleCount: sideCount, angle: 62, spread: 88, startVelocity: 58, origin: { x: 0, y: 0.72 } });
  confetti({ ...common, particleCount: sideCount, angle: 118, spread: 88, startVelocity: 58, origin: { x: 1, y: 0.72 } });

  const timers = [
    window.setTimeout(() => {
      confetti({ ...common, particleCount: centerCount, angle: 90, spread: 135, startVelocity: 48, origin: { x: 0.5, y: 0.24 } });
    }, 140),
    window.setTimeout(() => {
      confetti({ ...common, particleCount: Math.round(centerCount * 0.65), angle: 90, spread: 150, startVelocity: 34, origin: { x: 0.5, y: 0.5 } });
    }, 360),
  ];

  return () => timers.forEach(timer => window.clearTimeout(timer));
}

export function Confetti({ count = 320 }: { count?: number }) {
  useEffect(() => celebrateFullScreen(count), [count]);
  return null;
}
