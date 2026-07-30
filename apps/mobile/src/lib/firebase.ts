// =============================================================
// Firebase para móvil
// =============================================================
// Se usa el SDK de JavaScript, el mismo que la web, y no
// @react-native-firebase: así el motor de pujas, los tipos y la lógica
// de packages/shared son literalmente el mismo código en las dos
// plataformas, y la app corre en Expo Go sin compilación nativa.
//
// La única diferencia real es dónde se guarda la sesión: en móvil hay
// que decírselo con AsyncStorage o el usuario tiene que volver a entrar
// cada vez que abre la app.
// =============================================================

import { Platform } from "react-native";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Los valores llegan por app.json → extra, o por variables EXPO_PUBLIC_*
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
// El .trim() por lo mismo que en la web: el messagingSenderId venía con un
// espacio al inicio y con eso FCM no emite token, sin dar error en ninguna
// parte. Un valor pegado a mano puede traer espacios en cualquier clave.
const cfg = (clave: string, fallback = "") =>
  (process.env[`EXPO_PUBLIC_FIREBASE_${clave}`] ?? extra[clave] ?? fallback).trim();

const firebaseConfig = {
  apiKey: cfg("API_KEY"),
  authDomain: cfg("AUTH_DOMAIN", "instacompras-fe791.firebaseapp.com"),
  projectId: cfg("PROJECT_ID", "instacompras-fe791"),
  storageBucket: cfg("STORAGE_BUCKET"),
  messagingSenderId: cfg("MESSAGING_SENDER_ID"),
  appId: cfg("APP_ID"),
};

const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// initializeAuth solo puede llamarse una vez por app; en recargas de
// Fast Refresh hay que caer a getAuth.
let _auth: Auth;
if (Platform.OS === "web") {
  _auth = getAuth(app);
} else {
  try {
    // getReactNativePersistence existe en el bundle nativo de
    // @firebase/auth (campo "react-native" → dist/rn), que Metro resuelve,
    // pero no está declarado en los tipos del entry web. De ahí el require
    // diferido: con un import estático no compila y ensucia el bundle web.
    const { getReactNativePersistence } = require("firebase/auth") as {
      getReactNativePersistence: (almacen: unknown) => any;
    };
    _auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    _auth = getAuth(app);
  }
}

export const auth = _auth;
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export const storage = getStorage(app);
export { app };
