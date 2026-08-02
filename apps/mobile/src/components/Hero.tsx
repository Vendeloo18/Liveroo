import React from "react";
import { ScrollView, Text, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { color, familia, font, APP_MAX_WIDTH } from "../theme";
import { Boton } from "./ui";
import { Logo } from "./Logo";
import { BRAND } from "@subastas-ve/shared";

const PASOS = [
  ["1", "MIRALOO", "Descubre productos en directo."],
  ["2", "SUBELOO", "Sube tu oferta en segundos."],
  ["3", "RECIBELOO", "Gana y coordina la entrega."],
] as const;

/** Entrada móvil alineada con la nueva promesa: ventas en vivo. */
export function Hero({
  onCrearCuenta,
  onIniciarSesion,
  onVerComoFunciona,
  onEntrarSinCuenta,
}: {
  onCrearCuenta: () => void;
  onIniciarSesion: () => void;
  onVerComoFunciona: () => void;
  onEntrarSinCuenta: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const contenido = Math.min(width, APP_MAX_WIDTH);
  const heroH = Math.max(455, Math.min(height * 0.58, 540));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{ minHeight: height, alignItems: "center" }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: contenido, minHeight: height, backgroundColor: "#fff" }}>
        <View style={{ height: heroH, overflow: "hidden", backgroundColor: color.accent }}>
          <Image
            source={require("../../assets/brand/venta-en-vivo-headphones.png")}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            contentFit="cover"
            contentPosition="center"
          />

          <View style={{ position: "absolute", left: 22, top: insets.top + 22 }}>
            <Logo tamano={30} color="#fff"/>
          </View>

          <Text style={{
            position: "absolute", left: 22, right: 16, top: insets.top + 84,
            fontFamily: familia.display, fontSize: Math.min(contenido * 0.142, 66),
            lineHeight: Math.min(contenido * 0.126, 58), color: "#fff",
            letterSpacing: 0.4, includeFontPadding: false,
          }}>
            {"COMPRAR\nEN VIVO ES\nASÍ DE FÁCIL."}
          </Text>

          <View style={{
            position: "absolute", left: 22, bottom: 22, width: 134, padding: 13,
            borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.34)",
            backgroundColor: "rgba(171,65,0,0.45)",
          }}>
            <View style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: "#f32128" }}>
              <Text style={{ color: "#fff", fontFamily: familia.cuerpoExtra, fontSize: 11 }}>● EN VIVO</Text>
            </View>
            <Text style={{ marginTop: 9, color: "#fff", fontFamily: familia.cuerpoBold, fontSize: 10 }}>AHORA MISMO</Text>
            <View style={{ width: 42, height: 1, marginVertical: 9, backgroundColor: "rgba(255,255,255,0.34)" }}/>
            <Text style={{ color: "#fff", fontFamily: familia.cuerpoBold, fontSize: 10 }}>PRECIO ACTUAL</Text>
            <Text style={{ color: "#fff", fontFamily: familia.display, fontSize: 38, lineHeight: 42 }}>$42</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontFamily: familia.cuerpoBold, fontSize: 8 }}>27 OFERTAS</Text>
          </View>
        </View>

        <View style={{ flex: 1, marginTop: -1, paddingHorizontal: 22, paddingTop: 24, paddingBottom: insets.bottom + 18, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: "#fff" }}>
          <Text style={{ marginBottom: 17, color: color.accent, fontFamily: familia.cuerpoExtra, fontSize: 10, letterSpacing: 1.1, textAlign: "center" }}>
            {BRAND.mantra}
          </Text>
          <View style={{ flexDirection: "row", gap: 9 }}>
            {PASOS.map(([numero, titulo, texto]) => (
              <View key={numero} style={{ flex: 1, alignItems: "center" }}>
                <View style={{ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: color.accentTint }}>
                  <Text style={{ color: color.accent, fontFamily: familia.display, fontSize: 27 }}>{numero}</Text>
                </View>
                <Text style={{ marginTop: 7, color: color.ink, fontFamily: familia.cuerpoBold, fontSize: 15 }}>{titulo}</Text>
                <Text style={{ marginTop: 3, color: color.ink2, fontFamily: familia.cuerpo, fontSize: 10.5, lineHeight: 14, textAlign: "center" }}>{texto}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 10, marginTop: 22 }}>
            <Boton tamano="lg" onPress={onCrearCuenta}>Crear cuenta gratis</Boton>
            <Boton tamano="lg" variante="outline" onPress={onIniciarSesion} style={{ borderColor: color.accent }}>
              <Text style={{ color: color.accent, fontWeight: font.extrabold, fontSize: 15 }}>Ya tengo cuenta</Text>
            </Boton>
            <Pressable onPress={onVerComoFunciona} style={{ alignSelf: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: color.accent, fontFamily: familia.cuerpoBold, fontSize: 14 }}>▷  Ver cómo funciona</Text>
            </Pressable>
            <Pressable onPress={onEntrarSinCuenta} style={{ alignSelf: "center", paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: color.ink2, fontFamily: familia.cuerpoBold, fontSize: 12.5, textDecorationLine: "underline", textDecorationColor: color.accent }}>Explorar sin cuenta</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
