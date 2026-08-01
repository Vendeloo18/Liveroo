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

    let recargando = false;
    const alCambiarControlador = () => {
      if (recargando) return;
      recargando = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", alCambiarControlador);

    const buscarActualizacion = () => {
      navigator.serviceWorker.getRegistration()
        .then(reg => reg?.update())
        .catch(() => undefined);
    };

    buscarActualizacion();
    const alVolver = () => { if (document.visibilityState === "visible") buscarActualizacion(); };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", alCambiarControlador);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  return null;
}
