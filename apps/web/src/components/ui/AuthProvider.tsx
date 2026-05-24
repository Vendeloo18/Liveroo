"use client";
import { useEffect } from "react";
import { useAuthStore } from "../../store/authStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { _init } = useAuthStore();

  useEffect(() => {
    const unsub = _init();
    return unsub;
  }, []);

  return <>{children}</>;
}
