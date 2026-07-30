// =============================================================
// MARCA — fuente única de verdad
// =============================================================
// Los valores viven en brand.json, no aquí. Es JSON a propósito: el
// cargador de configuración de Expo transpila app.config.ts pero NO los
// .ts que importe del workspace, así que con un .ts se rompía al leer
// la config de la app móvil. JSON lo lee cualquiera.
//
// Quién consume esto:
//   · web    → layout.tsx inyecta las variables CSS
//   · móvil  → src/theme.ts importa la paleta
//   · Expo   → app.config.ts lee el JSON directo
//
// Para rebrandear se edita brand.json.
//
// Los valores de color salen de los assets de marca en /assets,
// muestreados de botones.png, chips-estados.png, hero-app.png y
// card-lote.png.
// =============================================================

import datos from "./brand.json";

export interface Marca {
  name: string;
  tagline: string;
  description: string;
  supportEmail: string;
  palette: {
    /** Acción principal: pujar, entrar al vivo, el precio actual. */
    accent: string;
    /** Texto encima del acento. En esta marca es blanco. */
    accentInk: string;
    /** Hover, y la marca de agua del hero. */
    accentLight: string;
    /** Acción secundaria y chips de dato (timer, lote, viewers). */
    accentStrong: string;
    /** Presionado, y el chip "vas ganando". */
    accentDeep: string;
    /** Lo más oscuro: "te superaron", botón "crear cuenta". */
    accentDarkest: string;
    /** Fondo suave, para avisos y realces. */
    accentSoft: string;
    /** Tinte durazno de las superficies de imagen. */
    accentTint: string;
    /** Sin acción posible: subasta cerrada. */
    accentDisabled: string;
    /** Cerrado y neutro: el chip "vendido". */
    accentMuted: string;
    /** Tinta principal de todo el texto. */
    ink: string;
  };
}

export const BRAND: Marca = datos;

/**
 * Las variables CSS que la web necesita, derivadas de la paleta.
 * Se inyectan en el layout para que el CSS y React usen el mismo origen.
 */
export function brandCssVariables(): string {
  const p = BRAND.palette;
  return [
    `--accent:${p.accent}`,
    `--accent-ink:${p.accentInk}`,
    `--accent-light:${p.accentLight}`,
    `--accent-strong:${p.accentStrong}`,
    `--accent-deep:${p.accentDeep}`,
    `--accent-darkest:${p.accentDarkest}`,
    `--accent-soft:${p.accentSoft}`,
    `--accent-tint:${p.accentTint}`,
    `--accent-disabled:${p.accentDisabled}`,
    `--accent-muted:${p.accentMuted}`,
    `--ink:${p.ink}`,
  ].join(";");
}
