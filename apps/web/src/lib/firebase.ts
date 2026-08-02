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

// App Check (anti-bots) con reCAPTCHA Enterprise.
//
// APAGADO A PROPÓSITO (2026-08-02). Desde Venezuela las llamadas a
// www.google.com/recaptcha fallaban de forma intermitente con
// ERR_SOCKET_NOT_CONNECTED, y cada operación de Firestore y de Auth se
// quedaba esperando un token que nunca llegaba: la app tardaba muchísimo
// o directamente no cargaba. Como App Check está en modo OBSERVACIÓN en
// la consola de Firebase (no bloquea nada), se estaba pagando toda esa
// lentitud a cambio de cero protección.
//
// Para volver a encenderlo: poner NEXT_PUBLIC_APPCHECK=on en Vercel y
// redesplegar. Antes de hacerlo hay que confirmar que reCAPTCHA carga de
// forma estable desde la red de los usuarios reales, no solo desde una
// oficina — si no, se repite el problema para todos.
const appCheckEncendido = env(process.env.NEXT_PUBLIC_APPCHECK) === "on";
const recaptchaEnterpriseKey = env(
  process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY,
);
if (typeof window !== "undefined" && appCheckEncendido && recaptchaEnterpriseKey) {
  import("firebase/app-check")
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaEnterpriseKey),
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch((error: unknown) => {
      console.warn("App Check no pudo inicializarse", error);
    });
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
