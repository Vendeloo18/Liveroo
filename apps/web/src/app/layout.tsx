import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { BRAND, brandCssVariables } from "@subastas-ve/shared";
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
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: BRAND.name },
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
      <head>
        {/* Los colores de marca salen de packages/shared/src/brand.ts, el
            mismo archivo que consume el móvil. globals.css trae valores por
            defecto; esto los sobrescribe para que haya un solo origen. */}
        <style dangerouslySetInnerHTML={{ __html: `:root{${brandCssVariables()}}` }}/>
      </head>
      <body className={archivo.className}>
        <AuthProvider>
          {children}
          <BottomNavWrapper/>
        </AuthProvider>
      </body>
    </html>
  );
}
