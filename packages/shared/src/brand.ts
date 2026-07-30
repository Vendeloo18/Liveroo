// =============================================================
// MARCA — fuente única de verdad
// =============================================================
// Nombre, textos de marca y colores de acento. Lo consumen las dos
// plataformas:
//   · web    → apps/web/src/app/layout.tsx inyecta las variables CSS
//   · móvil  → apps/mobile/src/theme.ts las importa directo
//
// Para rebrandear se edita SOLO este archivo. Nada más.
// =============================================================

export const BRAND = {
  /** Nombre visible. Aparece en el logotipo, el título y los textos. */
  name: "Liveroo",

  /** Una línea que explica qué es. Se usa en login y metadatos. */
  tagline: "Subastas en vivo de Venezuela",

  /** Descripción larga, para metadatos y tiendas de apps. */
  description: "Puja en vivo con vendedores venezolanos y coordina la entrega directo con ellos.",

  /** Correo de soporte que ve el usuario. */
  supportEmail: "soporte@liveroo.app",

  /**
   * Colores de marca.
   *
   * accent es el color de "acción de dinero": pujar, vender, ganar.
   * accentInk es el texto que va encima de accent — tiene que dar
   * contraste suficiente (mínimo 4.5:1) o los botones se vuelven
   * ilegibles.
   * ink es la tinta principal de todo el texto.
   *
   * Los grises, líneas y semánticos (rojo de "en vivo", verde de
   * confirmado) no cambian con la marca: viven en globals.css y theme.ts.
   */
  palette: {
    accent: "#c6f24e",
    accentInk: "#10120a",
    accentSoft: "#f2ffd1",
    ink: "#0b0b0d",
  },
} as const;

/**
 * Las variables CSS que la web necesita, derivadas de BRAND.palette.
 * Se inyectan en el layout para que el CSS y React usen el mismo origen.
 */
export function brandCssVariables(): string {
  const p = BRAND.palette;
  return [
    `--accent:${p.accent}`,
    `--accent-ink:${p.accentInk}`,
    `--accent-soft:${p.accentSoft}`,
    `--ink:${p.ink}`,
  ].join(";");
}
