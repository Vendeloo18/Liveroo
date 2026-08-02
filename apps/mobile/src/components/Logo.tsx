import React from "react";
import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { BRAND, SIMBOLO_PATH } from "@subastas-ve/shared";
import { color as tema, familia } from "../theme";

/**
 * Espejo de apps/web/src/components/ui/Logo.tsx.
 * El trazado del símbolo sale de shared, así que las dos plataformas
 * dibujan exactamente la misma etiqueta.
 */
export function Logo({
  variante = "lockup",
  tamano = 29,
  color,
}: {
  variante?: "lockup" | "apilado" | "simbolo";
  tamano?: number;
  color?: string;
}) {
  const tinta = color ?? tema.accent;

  const simbolo = (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
      <Path d={SIMBOLO_PATH} fill={tinta} fillRule="evenodd" clipRule="evenodd"/>
    </Svg>
  );

  if (variante === "simbolo") {
    return <View accessibilityRole="image" accessibilityLabel={BRAND.name}>{simbolo}</View>;
  }

  const apilado = variante === "apilado";

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={BRAND.name}
      style={{
        flexDirection: apilado ? "column" : "row",
        alignItems: apilado ? "flex-start" : "center",
        gap: apilado ? tamano * 0.24 : tamano * 0.3,
      }}
    >
      {simbolo}
      <Text style={{
        fontFamily: familia.campaign,
        fontSize: tamano * 0.95,
        letterSpacing: 0.4,
        color: tinta,
        // Anton trae mucho espacio arriba; esto lo alinea con el símbolo
        includeFontPadding: false,
      }}>
        {BRAND.name.toUpperCase()}
      </Text>
    </View>
  );
}
