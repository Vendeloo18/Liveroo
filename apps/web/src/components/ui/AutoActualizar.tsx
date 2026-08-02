"use client";
import { useEffect } from "react";

// =============================================================
// AutoActualizar — que nadie se quede con una versión vieja
// =============================================================
// La app es PWA: el service worker guarda copia de todo para que
// funcione sin señal. El precio es que, tras un despliegue, el
// teléfono puede seguir mostrando la versión anterior hasta que
// alguien recargue dos veces — el usuario lo vive como "no se
// cargó el cambio".
//
// Aquí: en cuanto un service worker NUEVO toma el control, se
// recarga una sola vez (guardia anti-bucle). Además se pregunta
// por actualizaciones al abrir la app y al volver a ella.
// =============================================================

export function AutoActualizar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Recargar a mitad de una puja es peor que quedarse con la versión
    // vieja: al espectador de un vivo se le va el video y la cuenta
    // regresiva justo cuando está ofertando. En esas pantallas se espera
    // a que salga, y ahí sí se recarga.
    const enVivo = () => /^\/(shows|seller\/show)\//.test(window.location.pathname);

    let recargando = false;
    let pendiente = false;
    const recargar = () => {
      if (recargando) return;
      if (enVivo()) { pendiente = true; return; }
      recargando = true;
      window.location.reload();
    };
    const alCambiarControlador = () => recargar();

    // Al salir del vivo (o al volver a la pestaña ya fuera de él) se
    // aplica la actualización que quedó esperando.
    const alNavegar = () => { if (pendiente && !enVivo()) recargar(); };
    window.addEventListener("popstate", alNavegar);
    const intervalo = setInterval(alNavegar, 4000);
    navigator.serviceWorker.addEventListener("controllerchange", alCambiarControlador);

    const buscarActualizacion = () => {
      navigator.serviceWorker.getRegistration()
        .then(reg => reg?.update())
        .catch(() => undefined);
    };

    if (!enVivo()) buscarActualizacion();
    const alVolver = () => { if (document.visibilityState === "visible" && !enVivo()) buscarActualizacion(); };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", alCambiarControlador);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("popstate", alNavegar);
      clearInterval(intervalo);
    };
  }, []);

  return null;
}
