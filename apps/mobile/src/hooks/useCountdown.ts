import { useEffect, useState } from "react";

/**
 * Misma lógica que apps/web/src/hooks/useCountdown.ts.
 * Tic de un segundo cuando falta menos de una hora, de un minuto cuando
 * falta más: no tiene sentido re-renderizar 60 veces por minuto para
 * mover un "3d 4h", y en móvil eso además gasta batería.
 */
export function useCountdown(endsAt: any) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) { setMs(null); return; }
    const fin = endsAt?.toMillis?.() ?? new Date(endsAt).getTime();
    if (!isFinite(fin)) { setMs(null); return; }

    const tick = () => setMs(Math.max(0, fin - Date.now()));
    tick();

    const intervalo = fin - Date.now() > 3600_000 ? 60_000 : 1000;
    const t = setInterval(tick, intervalo);
    return () => clearInterval(t);
  }, [endsAt]);

  const vencida = ms !== null && ms <= 0;
  const urgente = ms !== null && ms > 0 && ms < 600_000;

  let texto = "";
  if (ms === null) texto = "";
  else if (ms <= 0) texto = "Finalizada";
  else {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) texto = `${d}d ${h}h`;
    else if (h > 0) texto = `${h}h ${m}m`;
    else texto = `${m}:${String(sec).padStart(2, "0")}`;
  }

  return { texto, urgente, vencida, ms };
}
