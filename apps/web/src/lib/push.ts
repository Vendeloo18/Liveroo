// =============================================================
// Notificaciones push (FCM web)
// =============================================================
// Las Cloud Functions ya mandan avisos con messaging.send({ token }):
// "te superaron", "ganaste la subasta", "show por empezar". Lo que
// faltaba era que el navegador consiga ese token y lo guarde en
// /users/{uid}.fcmToken, que es donde las Functions lo buscan.
//
// Hace falta la clave VAPID del proyecto:
//   Firebase Console → Cloud Messaging → Certificados web push
//   → Generar par de claves → copiar a NEXT_PUBLIC_FIREBASE_VAPID_KEY
//
// Sin ella no se pide permiso ni se molesta al usuario: la app funciona
// igual, solo que los avisos se quedan dentro de la pantalla Avisos.
// =============================================================

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, getMessagingInstance } from "./firebase";

const VAPID = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "").trim();

export type EstadoPush =
  | "sin-configurar"   // falta la clave VAPID en el proyecto
  | "no-soportado"     // el navegador no puede (Safari viejo, iOS sin PWA)
  | "denegado"         // el usuario dijo no; no se puede volver a pedir
  | "pendiente"        // se puede pedir permiso
  | "activo";          // permiso dado y token guardado

/** Qué se puede hacer aquí y ahora, sin pedirle nada al usuario. */
export async function estadoPush(): Promise<EstadoPush> {
  if (!VAPID) return "sin-configurar";
  if (typeof window === "undefined") return "no-soportado";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "no-soportado";
  if (!(await getMessagingInstance())) return "no-soportado";

  if (Notification.permission === "denied") return "denegado";
  if (Notification.permission === "granted") return "activo";
  return "pendiente";
}

/**
 * Pide permiso, obtiene el token y lo guarda en el perfil.
 * Devuelve el estado resultante; nunca lanza.
 */
export async function activarPush(uid: string): Promise<EstadoPush> {
  try {
    if (!VAPID) return "sin-configurar";

    const messaging = await getMessagingInstance();
    if (!messaging) return "no-soportado";

    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return permiso === "denied" ? "denegado" : "pendiente";

    // El service worker recibe los avisos con la app cerrada
    const registro = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const { getToken } = await import("firebase/messaging");
    const token = await getToken(messaging, {
      vapidKey: VAPID,
      serviceWorkerRegistration: registro,
    });
    if (!token) return "pendiente";

    // Aquí es donde las Functions lo van a buscar
    await updateDoc(doc(db, "users", uid), { fcmToken: token, updatedAt: serverTimestamp() });
    return "activo";
  } catch (err) {
    console.error("No se pudo activar las notificaciones:", err);
    return "pendiente";
  }
}

/**
 * Deja de recibir. No se puede revocar el permiso del navegador desde
 * JavaScript, así que se borra el token: las Functions dejan de tener a
 * dónde mandar y no se envía nada.
 */
export async function desactivarPush(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "users", uid), { fcmToken: null, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error("No se pudo desactivar las notificaciones:", err);
  }
}

/** Avisos que llegan con la app abierta: el navegador no los muestra solo. */
export async function escucharEnPrimerPlano(alRecibir: (titulo: string, cuerpo: string) => void) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => undefined;
  const { onMessage } = await import("firebase/messaging");
  return onMessage(messaging, (payload) => {
    alRecibir(payload.notification?.title ?? "", payload.notification?.body ?? "");
  });
}
