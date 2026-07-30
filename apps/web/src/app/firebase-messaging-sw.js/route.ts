// =============================================================
// /firebase-messaging-sw.js — service worker de notificaciones
// =============================================================
// Va como ruta y no como archivo en public/ por dos razones:
//
//   1. Un archivo estático no puede leer process.env, así que habría que
//      escribir la config de Firebase a mano en el código. Dos fuentes de
//      verdad para las mismas seis claves.
//   2. El script tiene que estar en la raíz para poder pedir cualquier
//      alcance. push.ts lo registra en
//      /firebase-cloud-messaging-push-scope y no en "/", porque next-pwa
//      ya tiene su sw.js de workbox ahí y dos workers no pueden controlar
//      el mismo alcance.
//
// Los valores que inyecta son los mismos que ya viajan en el bundle del
// cliente: identificadores públicos del proyecto, no secretos. Lo que
// protege la base son las reglas de Firestore, no esconder el appId.
// =============================================================

// .trim() por lo mismo que en lib/firebase.ts: un espacio invisible al
// pegar la variable rompía la emisión de tokens sin dar error.
const env = (v: string | undefined) => (v ?? "").trim();

const CONFIG = {
  apiKey: env(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: env(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: env(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: env(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: env(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: env(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

// La misma versión que usa la app (apps/web/package.json → firebase). Los
// scripts compat son los únicos que corren dentro de un worker: el SDK
// modular usa import y aquí no hay módulos ES.
const SDK = "10.14.1";

export const dynamic = "force-static";

export function GET() {
  const sw = `
// Generado por src/app/firebase-messaging-sw.js/route.ts — no editar a mano.
importScripts("https://www.gstatic.com/firebasejs/${SDK}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${SDK}/firebase-messaging-compat.js");

// Todo el arranque de FCM va dentro de un try. Si firebase.messaging()
// lanza —pasa en navegadores sin indexedDB en el worker, o con los avisos
// bloqueados— y el error sube al nivel superior, falla la evaluación del
// script y con eso el registro entero del service worker. El síntoma es
// "ServiceWorker script evaluation failed", que no dice nada de FCM.
//
// Así el worker siempre se instala: si FCM no arranca simplemente no hay
// avisos en segundo plano, que es lo que ese navegador podía dar de todas
// formas. El clic sobre un aviso se sigue manejando abajo.
try {
  firebase.initializeApp(${JSON.stringify(CONFIG)});

  firebase.messaging().onBackgroundMessage((payload) => {
    const d = payload.data || {};
    const n = payload.notification || {};

    self.registration.showNotification(n.title || "Vendeloo", {
      body: n.body || "",
      // Los iconos están en la raíz de public/, no en /icons/. Con una ruta
      // que no existe el aviso sale sin icono y sin avisar de nada.
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Un aviso por subasta: si te superan tres veces seguidas ves el
      // último, no tres notificaciones apiladas.
      tag: d.auctionId || d.showId || "vendeloo",
      renotify: true,
      data: d,
    });
  });
} catch (err) {
  console.warn("[Vendeloo] FCM no disponible en este navegador:", err && err.message);
}

// Al tocar el aviso, abrir la pantalla que corresponde. Si ya hay una
// pestaña de Vendeloo abierta se reutiliza en vez de abrir otra.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const d = event.notification.data || {};
  // El type manda: una subasta ganada trae auctionId y orderId, y lo que
  // toca es ir al pedido para pagarlo, no a la subasta ya cerrada.
  const destino = d.type === "auction_won" || d.type === "order_confirmed"
        ? "/orders/" + d.orderId
    : d.type === "outbid"
        ? "/auctions/" + d.auctionId
    : d.type === "show_starting_soon"
        ? "/shows/" + d.showId
    : "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if (cliente.url.includes(self.location.origin) && "focus" in cliente) {
          cliente.navigate(destino);
          return cliente.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
`.trimStart();

  return new Response(sw, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Sin Service-Worker-Allowed: el alcance que pide push.ts
      // (/firebase-cloud-messaging-push-scope) es más angosto que la ruta
      // del script, así que no hace falta ampliar nada.
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
