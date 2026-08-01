"use client";
import { useEffect, useState } from "react";

/**
 * Cuenta regresiva hasta `endsAt`, que puede venir como Timestamp de
 * Firestore, Date o milisegundos. Tictaquea cada segundo mientras falte
 * menos de un día (para que se vea bajar en tiempo real) y cada minuto si
 * falta más — no tiene sentido re-renderizar cada segundo un "3d 4h".
 */
export function useCountdown(endsAt: any) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) { setMs(null); return; }
    const fin = endsAt?.toMillis?.() ?? new Date(endsAt).getTime();
    if (!isFinite(fin)) { setMs(null); return; }

    const tick = () => setMs(Math.max(0, fin - Date.now()));
    tick();

    const restante = fin - Date.now();
    // Bajo un día: cada segundo, para que se vea correr el reloj. Más de un
    // día: cada minuto (los segundos no se muestran).
    const intervalo = restante > 86400_000 ? 60_000 : 1000;
    const t = setInterval(tick, intervalo);
    return () => clearInterval(t);
  }, [endsAt]);

  const vencida = ms !== null && ms <= 0;
  const urgente = ms !== null && ms > 0 && ms < 600_000; // menos de 10 min

  let texto = "";
  if (ms === null) texto = "";
  else if (ms <= 0) texto = "Finalizada";
  else {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const p2 = (n: number) => String(n).padStart(2, "0");
    // Más de un día: "3d 4h". Bajo un día: reloj corriendo con segundos —
    // "1:37:05" con hora, "37:05" sin hora. Se lee como tiempo (dos puntos)
    // y se ve bajar en vivo.
    if (d > 0) texto = `${d}d ${h}h`;
    else if (h > 0) texto = `${h}:${p2(m)}:${p2(sec)}`;
    else texto = `${m}:${p2(sec)}`;
  }

  return { texto, urgente, vencida, ms };
}
