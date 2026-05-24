"use client";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

const HIDE_ON = ["/login", "/onboarding", "/shows/"];

export function BottomNavWrapper() {
  const pathname = usePathname();
  const hide = HIDE_ON.some(p => pathname.startsWith(p));
  if (hide) return null;
  return <BottomNav/>;
}
