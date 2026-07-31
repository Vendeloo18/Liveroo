"use client";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

// /admin es la consola de administración: interfaz de escritorio propia,
// sin la barra inferior de la app de compradores.
const HIDE_ON = ["/login", "/onboarding", "/shows/", "/admin"];

export function BottomNavWrapper() {
  const pathname = usePathname();
  const hide = HIDE_ON.some(p => pathname.startsWith(p));
  if (hide) return null;
  return <BottomNav/>;
}
