// Primitivas de interfaz — equivalentes a las clases .lv-* de la web.

import React from "react";
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet,
  type ViewStyle, type TextStyle, type StyleProp,
} from "react-native";
import { color, radius, space, text as T, font } from "../theme";

type Variante = "accent" | "primary" | "soft" | "outline" | "danger";
type Tamano = "sm" | "md" | "lg";

export function Boton({
  children, onPress, variante = "accent", tamano = "md",
  disabled, cargando, style, block = true,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variante?: Variante;
  tamano?: Tamano;
  disabled?: boolean;
  cargando?: boolean;
  style?: StyleProp<ViewStyle>;
  block?: boolean;
}) {
  const fondo: Record<Variante, string> = {
    accent: color.accent, primary: color.accent, soft: color.surface2,
    outline: "transparent", danger: color.live,
  };
  const tinta: Record<Variante, string> = {
    accent: color.accentInk, primary: color.accentInk, soft: color.ink,
    outline: color.ink, danger: "#fff",
  };
  const alto = tamano === "sm" ? 36 : tamano === "lg" ? 54 : 46;

  return (
    <Pressable
      onPress={disabled || cargando ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          height: alto,
          borderRadius: tamano === "sm" ? radius.sm : radius.btn,
          backgroundColor: fondo[variante],
          alignItems: "center", justifyContent: "center", flexDirection: "row",
          paddingHorizontal: tamano === "sm" ? 14 : 18,
          alignSelf: block ? "stretch" : "flex-start",
          opacity: disabled ? 0.42 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
          ...(variante === "outline"
            ? { borderWidth: 1.5, borderColor: color.lineStrong }
            : null),
        },
        style,
      ]}
    >
      {cargando
        ? <ActivityIndicator size="small" color={tinta[variante]}/>
        : <Text style={{ color: tinta[variante], fontWeight: font.extrabold, fontSize: tamano === "sm" ? 13 : 15 }}>
            {children}
          </Text>}
    </Pressable>
  );
}

export function Insignia({
  children, tono = "soft", style,
}: {
  children: React.ReactNode;
  tono?: "soft" | "accent" | "live" | "flotante";
  style?: StyleProp<ViewStyle>;
}) {
  const fondo = { soft: color.surface2, accent: color.accent, live: color.live, flotante: "rgba(11,11,13,0.72)" }[tono];
  const tinta = { soft: color.ink2, accent: color.accentInk, live: "#fff", flotante: "#fff" }[tono];
  return (
    <View style={[{ backgroundColor: fondo, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" }, style]}>
      <Text style={{ color: tinta, fontSize: 10.5, fontWeight: font.extrabold }}>{children}</Text>
    </View>
  );
}

export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[estilos.panel, style]}>{children}</View>;
}

export function Fila({
  children, onPress, ultima,
}: { children: React.ReactNode; onPress?: () => void; ultima?: boolean }) {
  const contenido = (
    <View style={[estilos.fila, ultima && { borderBottomWidth: 0 }]}>{children}</View>
  );
  return onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{contenido}</Pressable>
    : contenido;
}

export function Aviso({
  children, tono = "neutral",
}: { children: React.ReactNode; tono?: "neutral" | "ok" | "bad" | "warn" }) {
  const fondo = {
    neutral: color.surface2,
    ok: "rgba(20,164,77,0.1)",
    bad: "rgba(245,51,63,0.09)",
    warn: "rgba(232,163,0,0.12)",
  }[tono];
  const tinta = { neutral: color.ink2, ok: color.ok, bad: color.live, warn: color.warnInk }[tono];
  return (
    <View style={{ backgroundColor: fondo, borderRadius: radius.card, padding: 13 }}>
      <Text style={{ color: tinta, fontSize: 13, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function Vacio({
  titulo, texto, children,
}: { titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: 72, paddingHorizontal: 24, alignItems: "center" }}>
      <Text style={{ fontSize: 15, fontWeight: font.bold, color: color.ink2, marginBottom: 4, textAlign: "center" }}>
        {titulo}
      </Text>
      {texto ? <Text style={{ ...T.dim, textAlign: "center" }}>{texto}</Text> : null}
      {children ? <View style={{ marginTop: 16, alignSelf: "stretch" }}>{children}</View> : null}
    </View>
  );
}

export function Cargando() {
  return (
    <View style={{ paddingVertical: 64, alignItems: "center" }}>
      <ActivityIndicator color={color.ink3}/>
    </View>
  );
}

export function Avatar({ nombre, uri, tam = 34 }: { nombre?: string; uri?: string; tam?: number }) {
  if (uri) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Image } = require("expo-image");
    return <Image source={{ uri }} style={{ width: tam, height: tam, borderRadius: tam / 2 }} contentFit="cover"/>;
  }
  return (
    <View style={{
      width: tam, height: tam, borderRadius: tam / 2, backgroundColor: color.accent,
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ color: color.accentInk, fontWeight: font.extrabold, fontSize: tam * 0.4 }}>
        {(nombre ?? "?")[0]?.toUpperCase()}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  panel: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
    padding: space.lg,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
});
