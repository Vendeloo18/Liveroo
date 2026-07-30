// =============================================================
// SISTEMA VISUAL — espejo de apps/web/src/app/globals.css
// =============================================================
// Los tokens estructurales (grises, líneas, semánticos) viven aquí y su
// equivalente en globals.css. Los COLORES DE MARCA no se repiten: salen
// de packages/shared/src/brand.ts, el mismo archivo que consume la web.
// Rebrandear es editar ese archivo y nada más.
// =============================================================

import { BRAND } from "@subastas-ve/shared";

export const color = {
  accent: BRAND.palette.accent,
  accentInk: BRAND.palette.accentInk,
  accentLight: BRAND.palette.accentLight,
  accentStrong: BRAND.palette.accentStrong,
  accentDeep: BRAND.palette.accentDeep,
  accentDarkest: BRAND.palette.accentDarkest,
  accentSoft: BRAND.palette.accentSoft,
  accentTint: BRAND.palette.accentTint,
  accentDisabled: BRAND.palette.accentDisabled,
  accentMuted: BRAND.palette.accentMuted,

  ink: BRAND.palette.ink,
  ink2: "#62626d",
  ink3: "#9a9aa6",
  ink4: "#c4c4cd",

  bg: "#ffffff",
  surface: "#ffffff",
  surface2: "#f7f5f3",
  surface3: "#eeeae6",
  line: "#eae5e0",
  lineStrong: "#d8d1ca",

  // "En vivo" usa la rampa de la marca, no rojo: asi lo definen los
  // assets. El rojo queda solo para errores de verdad.
  live: BRAND.palette.accent,
  urgent: BRAND.palette.accentStrong,
  ok: "#14a44d",
  warn: "#e8a300",
  warnInk: "#8a6200",
  error: "#e02c39",

  // Superficie oscura: la vista de show en vivo
  darkBg: "#0b0b0d",
  onDark: "#ffffff",
  onDark2: "rgba(255,255,255,0.66)",
  onDark3: "rgba(255,255,255,0.42)",
} as const;

export const radius = {
  card: 22,
  media: 18,
  btn: 999,
  pill: 999,
  sm: 12,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;

// Las carga app/_layout.tsx con expo-font. En React Native la familia se
// elige por nombre de archivo, no por fontWeight, asi que cada peso es
// una familia distinta.
export const familia = {
  display: "Anton_400Regular",
  cuerpo: "Archivo_400Regular",
  cuerpoMedium: "Archivo_500Medium",
  cuerpoSemi: "Archivo_600SemiBold",
  cuerpoBold: "Archivo_700Bold",
  cuerpoExtra: "Archivo_800ExtraBold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
} as const;

// Se conservan para el codigo que aun pasa fontWeight sueltos.
export const font = {
  black: "900" as const,
  extrabold: "800" as const,
  bold: "700" as const,
  semibold: "600" as const,
  medium: "500" as const,
  regular: "400" as const,
};

export const text = {
  wordmark: { fontFamily: familia.display, fontSize: 28, letterSpacing: 0.3, color: color.ink },
  title: { fontFamily: familia.display, fontSize: 22, letterSpacing: 0.3, color: color.ink },
  section: { fontFamily: familia.display, fontSize: 20, letterSpacing: 0.3, color: color.ink },
  body: { fontFamily: familia.cuerpo, fontSize: 15, color: color.ink },
  cardTitle: { fontFamily: familia.display, fontSize: 15, lineHeight: 17, letterSpacing: 0.2, color: color.ink },
  // El precio va en naranja: es el cambio mas visible del rebranding.
  price: { fontFamily: familia.display, fontSize: 20, letterSpacing: 0.2, color: color.accent },
  priceXl: { fontFamily: familia.display, fontSize: 38, letterSpacing: 0.2, color: color.accent },
  eyebrow: {
    fontFamily: familia.monoMedium, fontSize: 10, letterSpacing: 1.2,
    textTransform: "uppercase" as const, color: color.ink3,
  },
  // Datos: contador, lote, viewers, @usuario.
  dato: { fontFamily: familia.mono, fontSize: 12, color: color.ink2 },
  muted: { fontFamily: familia.cuerpo, fontSize: 13, color: color.ink2 },
  dim: { fontFamily: familia.cuerpo, fontSize: 12, color: color.ink3 },
  label: { fontFamily: familia.cuerpoBold, fontSize: 11.5, color: color.ink2 },
};

export const APP_MAX_WIDTH = 480;
export const TAB_BAR_HEIGHT = 76;
