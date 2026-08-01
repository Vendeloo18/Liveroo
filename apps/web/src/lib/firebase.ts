// =============================================================
// Firebase client SDK — configuración e inicialización
// =============================================================

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

// Un espacio de más al pegar la variable en Vercel no se ve en ninguna
// pantalla y rompe cosas sin dar error: el messagingSenderId venía con un
// espacio al inicio (13 caracteres en vez de 12) y con eso FCM no podía
// emitir un token. Se limpia siempre, no solo esa clave.
const env = (v: string | undefined) => (v ?? "").trim();

const firebaseConfig = {
  apiKey: env(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: env(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: env(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: env(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: env(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: env(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

// Singleton
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export const storage = getStorage(app);

// App Check (anti-bots) — pre-cableado: se activa SOLO cuando exista
// NEXT_PUBLIC_RECAPTCHA_SITE_KEY en Vercel. Sin la clave es un no-op,
// así que se puede desplegar hoy y encender el día que se registre la
// app en Firebase Console → App Check (reCAPTCHA v3, modo monitor).
const recaptchaKey = env(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
if (typeof window !== "undefined" && recaptchaKey) {
  import("firebase/app-check")
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaKey),
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch(() => undefined);
}

// Mensajería (solo en browser)
export async function getMessagingInstance() {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
}

// Emuladores en desarrollo
if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
  connectStorageEmulator(storage, "localhost", 9199);
  console.info("🔧 Usando emuladores de Firebase");
}

// Persistencia offline (PWA)
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Persistencia offline: múltiples pestañas abiertas");
    } else if (err.code === "unimplemented") {
      console.warn("Persistencia offline no soportada en este navegador");
    }
  });
}

export { app };
