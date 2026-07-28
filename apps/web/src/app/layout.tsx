import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../components/ui/AuthProvider";
import { BottomNavWrapper } from "../components/ui/BottomNavWrapper";

// Grotesca con pesos hasta 900 y cifras tabulares: los precios y los
// contadores no bailan al cambiar de dígito.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Liveroo — Subastas en vivo",
  description: "El marketplace de subastas en vivo de Venezuela",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Liveroo" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={archivo.className}>
        <AuthProvider>
          {children}
          <BottomNavWrapper/>
        </AuthProvider>
      </body>
    </html>
  );
}
