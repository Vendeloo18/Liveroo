// =============================================================
// Store de autenticación — espejo de apps/web/src/store/authStore.ts
// =============================================================
// Misma forma que en la web para que las pantallas se lean igual en
// las dos plataformas. Cambia solo cómo se persiste la sesión, que ya
// resuelve lib/firebase.ts.
// =============================================================

import { create } from "zustand";
import { type UserProfile } from "@subastas-ve/shared";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface AuthState {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (p: { email: string; password: string; displayName: string }) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  profile: null,
  loading: true,
  error: null,

  clearError: () => set({ error: null }),

  signIn: async (email, password) => {
    set({ error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      set({ error: traducirError(err.code) });
      throw err;
    }
  },

  signUp: async ({ email, password, displayName }) => {
    set({ error: null });
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      // Las reglas exigen role "buyer" y sellerStatus "none" al crear:
      // nadie nace vendedor ni admin.
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email,
        displayName,
        avatar: null,
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
    } catch (err: any) {
      set({ error: traducirError(err.code) });
      throw err;
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({ firebaseUser: null, profile: null });
  },

  // Se llama una vez desde el layout raíz
  init: () => {
    let unsubPerfil: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubPerfil?.();
      unsubPerfil = null;

      if (!user) {
        set({ firebaseUser: null, profile: null, loading: false });
        return;
      }

      set({ firebaseUser: user });
      unsubPerfil = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => set({ profile: snap.exists() ? (snap.data() as UserProfile) : null, loading: false }),
        () => set({ loading: false })
      );
    });

    return () => { unsubPerfil?.(); unsubAuth(); };
  },
}));

function traducirError(code?: string): string {
  switch (code) {
    case "auth/invalid-email": return "Ese correo no es válido";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Correo o contraseña incorrectos";
    case "auth/email-already-in-use": return "Ese correo ya tiene una cuenta";
    case "auth/weak-password": return "La contraseña necesita al menos 6 caracteres";
    case "auth/network-request-failed": return "Sin conexión. Revisa tu internet.";
    case "auth/too-many-requests": return "Demasiados intentos. Espera un momento.";
    default: return "No se pudo completar. Intenta de nuevo.";
  }
}
