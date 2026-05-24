import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../components/ui/AuthProvider";
import { BottomNavWrapper } from "../components/ui/BottomNavWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Liveroo — Subastas en vivo",
  description: "El marketplace de subastas en vivo de Venezuela",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Liveroo" },
};

export const viewport: Viewport = {
  themeColor: "#080818",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <BottomNavWrapper/>
        </AuthProvider>
      </body>
    </html>
  );
}
