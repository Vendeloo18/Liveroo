// =============================================================
// SISTEMA VISUAL — espejo de apps/web/src/app/globals.css
// =============================================================
// Los mismos tokens que la web, como objetos de React Native.
// Para rebrandear se cambian accent, accentInk e ink, igual que allá.
// Si cambias algo aquí, cámbialo también en globals.css o las dos
// plataformas se separan.
// =============================================================

export const color = {
  accent: "#c6f24e",
  accentInk: "#10120a",
  accentSoft: "#f2ffd1",

  ink: "#0b0b0d",
  ink2: "#62626d",
  ink3: "#9a9aa6",
  ink4: "#c4c4cd",

  bg: "#ffffff",
  surface: "#ffffff",
  surface2: "#f5f5f7",
  surface3: "#ebebef",
  line: "#e6e6ea",
  lineStrong: "#d5d5dc",

  live: "#f5333f",
  ok: "#14a44d",
  warn: "#e8a300",
  warnInk: "#8a6200",

  // Superficie oscura: la vista de show en vivo
  darkBg: "#0b0b0d",
  onDark: "#ffffff",
  onDark2: "rgba(255,255,255,0.66)",
  onDark3: "rgba(255,255,255,0.42)",
} as const;

export const radius = {
  card: 14,
  btn: 12,
  pill: 999,
  sm: 10,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;

// Archivo no viene con Expo por defecto; hasta cargarla con expo-font
// se usa la de sistema, que en iOS y Android también es una grotesca.
export const font = {
  black: "900" as const,
  extrabold: "800" as const,
  bold: "700" as const,
  semibold: "600" as const,
  medium: "500" as const,
  regular: "400" as const,
};

export const text = {
  wordmark: { fontSize: 26, fontWeight: font.black, letterSpacing: -1.1, color: color.ink },
  title: { fontSize: 20, fontWeight: font.extrabold, letterSpacing: -0.6, color: color.ink },
  section: { fontSize: 17, fontWeight: font.extrabold, letterSpacing: -0.5, color: color.ink },
  body: { fontSize: 15, fontWeight: font.regular, color: color.ink },
  cardTitle: { fontSize: 13.5, fontWeight: font.bold, lineHeight: 18, color: color.ink },
  price: { fontSize: 17, fontWeight: font.black, letterSpacing: -0.5, color: color.ink },
  priceXl: { fontSize: 32, fontWeight: font.black, letterSpacing: -1.2, color: color.ink },
  eyebrow: {
    fontSize: 9.5, fontWeight: font.bold, letterSpacing: 0.9,
    textTransform: "uppercase" as const, color: color.ink3,
  },
  muted: { fontSize: 13, color: color.ink2 },
  dim: { fontSize: 12, color: color.ink3 },
  label: { fontSize: 11.5, fontWeight: font.bold, color: color.ink2 },
};

export const APP_MAX_WIDTH = 480;
export const TAB_BAR_HEIGHT = 76;
