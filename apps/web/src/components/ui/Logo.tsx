import { BRAND, SIMBOLO_PATH } from "@subastas-ve/shared";

/**
 * El logotipo. Tres variantes, todas basadas en assets/:
 *   · "lockup"  — símbolo + nombre en horizontal (logo-lockup-*.png)
 *   · "apilado" — símbolo arriba, nombre debajo (logo-apilado-*.png)
 *   · "simbolo" — solo la etiqueta
 *
 * El color lo hereda del contexto con currentColor, así el mismo
 * componente sirve en naranja sobre blanco y en blanco sobre naranja.
 */
export function Logo({
  variante = "lockup",
  tamano = 28,
  color,
  className,
}: {
  variante?: "lockup" | "apilado" | "simbolo";
  /** Alto del símbolo en px. El nombre se escala en proporción. */
  tamano?: number;
  /** Por defecto hereda del contexto. */
  color?: string;
  className?: string;
}) {
  const simbolo = (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill={color ?? "currentColor"}
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      <path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/>
    </svg>
  );

  if (variante === "simbolo") {
    return <span className={className} role="img" aria-label={BRAND.name}>{simbolo}</span>;
  }

  const apilado = variante === "apilado";

  return (
    <span
      className={className}
      role="img"
      aria-label={BRAND.name}
      style={{
        display: "inline-flex",
        flexDirection: apilado ? "column" : "row",
        alignItems: apilado ? "flex-start" : "center",
        gap: apilado ? tamano * 0.28 : tamano * 0.32,
        color: color ?? "currentColor",
      }}
    >
      {simbolo}
      <span
        className="lv-wordmark"
        style={{ fontSize: tamano * 0.92, color: "inherit", lineHeight: 1 }}
      >
        {BRAND.name}
      </span>
    </span>
  );
}
