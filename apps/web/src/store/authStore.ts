// =============================================================
// Zustand Store — Autenticación y perfil de usuario
// =============================================================

import { create } from "zustand";
import { type UserProfile } from "@subastas-ve/shared";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface AuthState {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (params: {
    email: string;
    password: string;
    displayName: string;
    whatsapp?: string;
  }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  _init: () => () => void; // returns unsubscribe
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  profile: null,
  loading: true,
  error: null,

  signIn: async (email, password) => {
    set({ error: null, loading: true });
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      set({ error: mapFirebaseError(err.code), loading: false });
      throw err;
    }
  },

  signUp: async ({ email, password, displayName, whatsapp }) => {
    set({ error: null, loading: true });
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      // Crear perfil en Firestore
      const profile: Omit<UserProfile, "createdAt" | "updatedAt"> & {
        createdAt: any;
        updatedAt: any;
      } = {
        uid: user.uid,
        email,
        displayName,
        whatsapp: whatsapp ?? null,
        role: "buyer",
        // "none" y no undefined: las reglas exigen el campo presente, y
        // Firestore rechaza valores undefined al escribir.
        sellerStatus: "none",
        ratingAvg: 0,
        ratingCount: 0,
        totalSales: 0,
        totalPurchases: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", user.uid), profile);
    } catch (err: any) {
      set({ error: mapFirebaseError(err.code), loading: false });
      throw err;
    }
  },

  signInWithGoogle: async () => {
    set({ error: null, loading: true });
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      // Crear perfil en Firestore solo si no existe
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? "Usuario",
          avatar: user.photoURL ?? null,
          whatsapp: null,
          role: "buyer",
          sellerStatus: "none",
          ratingAvg: 0,
          ratingCount: 0,
          totalSales: 0,
          totalPurchases: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      set({ error: mapFirebaseError(err.code), loading: false });
      throw err;
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({ firebaseUser: null, profile: null });
  },

  // Sin esto, quien olvidaba su clave perdía el acceso a su saldo: no
  // había ninguna vía de recuperación en toda la app.
  resetPassword: async (email) => {
    set({ error: null });
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e: any) {
      // No se revela si el correo existe: la respuesta es la misma.
      if (e?.code === "auth/invalid-email") {
        set({ error: mapFirebaseError(e.code) });
        throw e;
      }
    }
  },

  clearError: () => set({ error: null }),

  _init: () => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (user) => {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (!user) {
        set({ firebaseUser: null, profile: null, loading: false });
        return;
      }

      set({ firebaseUser: user, loading: true });

      // Escuchar perfil en tiempo real
      profileUnsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (snap.exists()) {
          set({ profile: snap.data() as UserProfile, loading: false });
        } else {
          // Una cuenta de Authentication nunca debe quedar huérfana si la
          // creación inicial del perfil falló por red o por reglas. Se repara
          // con el mismo perfil seguro de comprador; el snapshot se actualiza
          // solo cuando Firestore confirme la escritura.
          setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email ?? "",
            displayName: user.displayName ?? "Usuario",
            avatar: user.photoURL ?? null,
            whatsapp: null,
            role: "buyer",
            sellerStatus: "none",
            ratingAvg: 0,
            ratingCount: 0,
            totalSales: 0,
            totalPurchases: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch((err: any) => {
            set({ error: mapFirebaseError(err?.code), loading: false });
          });
        }
      });
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  },
}));

function mapFirebaseError(code: string): string {
  const map: Record<string, string> = {
    "auth/user-not-found": "No existe una cuenta con ese email",
    "auth/wrong-password": "Contraseña incorrecta",
    "auth/email-already-in-use": "Ya existe una cuenta con ese email",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres",
    "auth/invalid-email": "Email inválido",
    "auth/too-many-requests": "Demasiados intentos. Intenta más tarde.",
    // Firebase devuelve invalid-credential por contraseña incorrecta cuando
    // está activa la protección de enumeración de correos.
    "auth/invalid-credential": "Correo o contraseña incorrectos",
    "auth/network-request-failed": "Sin conexión. Revisa tu internet e intenta otra vez.",
    "auth/popup-blocked": "Tu navegador bloqueó la ventana de Google. Entra con tu correo.",
    "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
    "auth/cancelled-popup-request": "Cerraste la ventana de Google antes de terminar.",
    "auth/operation-not-supported-in-this-environment": "Google no funciona dentro de WhatsApp. Abre el link en tu navegador o entra con tu correo.",
    "permission-denied": "No pudimos preparar tu perfil. Actualiza la app e inténtalo otra vez.",
  };
  return map[code] ?? "Error desconocido. Intenta de nuevo.";
}
