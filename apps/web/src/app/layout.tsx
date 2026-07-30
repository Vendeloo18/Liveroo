import type { Metadata, Viewport } from "next";
import { Archivo, Anton, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BRAND, brandCssVariables } from "@subastas-ve/shared";
import { AuthProvider } from "../components/ui/AuthProvider";
import { BottomNavWrapper } from "../components/ui/BottomNavWrapper";
import { PushForeground } from "../components/ui/PushForeground";

// Tres tipografías, cada una con un trabajo, siguiendo los assets de marca:
//
//  · Archivo      — cuerpo. Grotesca legible con cifras tabulares.
//  · Anton        — títulos y precios. Condensada muy pesada, en
//                   mayúsculas, como el logotipo y los titulares.
//  · JetBrains Mono — datos: contadores, número de lote, viewers, @usuario.
//                   En los assets todo lo numérico va monoespaciado.
//
// Si más adelante aparece la tipografía real de la marca, se cambia aquí
// y en apps/mobile/src/theme.ts.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-cuerpo",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: BRAND.name },
};

export const viewport: Viewport = {
  // La barra del navegador toma el naranja de la marca
  themeColor: BRAND.palette.accent,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Las variables de fuente van en <html> y no en <body>: globals.css
    // las consume desde :root, y si viven en el body no existen ahí y toda
    // la tipografía cae al fallback sin avisar.
    <html lang="es" className={`${archivo.variable} ${anton.variable} ${mono.variable}`}>
      <head>
        {/* Los colores de marca salen de packages/shared/src/brand.ts, el
            mismo archivo que consume el móvil. globals.css trae valores por
            defecto; esto los sobrescribe para que haya un solo origen. */}
        <style dangerouslySetInnerHTML={{ __html: `:root{${brandCssVariables()}}` }}/>
      </head>
      <body>
        <AuthProvider>
          {children}
          <PushForeground/>
          <BottomNavWrapper/>
        </AuthProvider>
      </body>
    </html>
  );
}
