import type { Metadata, Viewport } from "next";
import { Archivo, Anton } from "next/font/google";
import "./globals.css";
import { BRAND, brandCssVariables } from "@subastas-ve/shared";
import { AuthProvider } from "../components/ui/AuthProvider";
import { BottomNavWrapper } from "../components/ui/BottomNavWrapper";
import { PushForeground } from "../components/ui/PushForeground";
import { AutoActualizar } from "../components/ui/AutoActualizar";

// Dos tipografías, cada una con un trabajo claro en toda la aplicación:
//
//  · Archivo — interfaz, cuerpo, botones, cifras, datos y formularios.
//  · Anton   — únicamente titulares de campaña y cifras protagonistas.
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

export const metadata: Metadata = {
  // Sin metadataBase, Next resuelve las imágenes de Open Graph como rutas
  // relativas y WhatsApp o Twitter no las encuentran: al compartir un link
  // sale sin preview. El dominio sale de packages/shared, el mismo archivo
  // que consume el móvil.
  metadataBase: new URL(BRAND.url),
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "es_VE",
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    url: BRAND.url,
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: BRAND.name }],
  },
  twitter: {
    card: "summary",
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    images: ["/icon-512.png"],
  },
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
  // Sin maximumScale: bloquear el zoom rompe la accesibilidad (WCAG) y a
  // quien necesita agrandar para leer. iOS moderno lo ignoraba igual.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Las variables de fuente van en <html> y no en <body>: globals.css
    // las consume desde :root, y si viven en el body no existen ahí y toda
    // la tipografía cae al fallback sin avisar.
    <html lang="es" className={`${archivo.variable} ${anton.variable}`}>
      <head>
        {/* Los colores de marca salen de packages/shared/src/brand.ts, el
            mismo archivo que consume el móvil. globals.css trae valores por
            defecto; esto los sobrescribe para que haya un solo origen. */}
        <style dangerouslySetInnerHTML={{ __html: `:root{${brandCssVariables()}}` }}/>
      </head>
      <body>
        <AutoActualizar/>
        <AuthProvider>
          {children}
          <PushForeground/>
          <BottomNavWrapper/>
        </AuthProvider>
      </body>
    </html>
  );
}
