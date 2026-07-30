// =============================================================
// /firebase-messaging-sw.js — service worker de notificaciones
// =============================================================
// Va como ruta y no como archivo en public/ por dos razones:
//
//   1. Un archivo estático no puede leer process.env, así que habría que
//      escribir la config de Firebase a mano en el código. Dos fuentes de
//      verdad para las mismas seis claves.
//   2. FCM exige que el service worker se sirva desde la raíz del sitio
//      para que su alcance cubra toda la app. Esta ruta responde en
//      /firebase-messaging-sw.js, que es exactamente la raíz.
//
// Los valores que inyecta son los mismos que ya viajan en el bundle del
// cliente: identificadores públicos del proyecto, no secretos. Lo que
// protege la base son las reglas de Firestore, no esconder el appId.
// =============================================================

const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const dynamic = "force-static";

export function GET() {
  // Los scripts compat son los únicos que corren dentro de un service
  // worker; el SDK modular usa import y aquí no hay módulos ES.
  const sw = `
// Generado por src/app/firebase-messaging-sw.js/route.ts — no editar a mano.
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(CONFIG)});

const messaging = firebase.messaging();

// Avisos con la app cerrada o en otra pestaña.
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const n = payload.notification || {};

  self.registration.showNotification(n.title || "Vendeloo", {
    body: n.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // Un aviso por subasta: si te superan tres veces seguidas ves el
    // último, no tres notificaciones apiladas.
    tag: d.auctionId || d.showId || "vendeloo",
    renotify: true,
    data: d,
  });
});

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
        ? "/live/" + d.showId
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
      "Service-Worker-Allowed": "/",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
