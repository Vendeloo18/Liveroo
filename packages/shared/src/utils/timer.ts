// =============================================================
// Utilidades de temporizador de subasta
// =============================================================

import { Timestamp } from "firebase/firestore";

/**
 * Calcula los segundos restantes en la subasta activa.
 * Usa la fecha del servidor (auctionEndsAt) como fuente de verdad.
 * El cliente NUNCA extiende el timer: eso lo hace Cloud Function.
 */
export function calcSecondsRemaining(auctionEndsAt: Timestamp | undefined): number {
  if (!auctionEndsAt) return 0;
  const nowMs = Date.now();
  const endsMs = auctionEndsAt.toMillis();
  const diff = Math.floor((endsMs - nowMs) / 1000);
  return Math.max(0, diff);
}

/**
 * Formatea segundos como MM:SS
 * @example formatTimer(90) → "1:30"
 */
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Determina si la subasta está a punto de cerrar (últimos N segundos)
 */
export function isUrgent(secondsRemaining: number, threshold = 10): boolean {
  return secondsRemaining > 0 && secondsRemaining <= threshold;
}
