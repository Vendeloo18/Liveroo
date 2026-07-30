import React, { useEffect, useState } from "react";
import { View, Text, Image as RNImage, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { BRAND, SIMBOLO_PATH } from "@subastas-ve/shared";
import { db } from "../lib/firebase";
import { useCountdown } from "../hooks/useCountdown";
import { color, radius, space, familia, APP_MAX_WIDTH } from "../theme";
import { Boton } from "./ui";
import { Logo } from "./Logo";

interface Destacada {
  id: string; title?: string; imageURL?: string; imageURLs?: string[];
  currentBidUsd?: number; sellerName?: string; endsAt?: any; mode?: string;
}

/**
 * Espejo de apps/web/src/components/ui/Hero.tsx, siguiendo
 * assets/hero-app.png — que es justamente un mockup de teléfono.
 *
 * La tarjeta muestra una subasta ACTIVA DE VERDAD; si no hay ninguna, no
 * se muestra nada. Nada de productos ni precios de ejemplo.
 */
export function Hero({
  onCrearCuenta,
  onIniciarSesion,
  onEntrarSinCuenta,
}: {
  onCrearCuenta: () => void;
  onIniciarSesion: () => void;
  onEntrarSinCuenta: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [destacada, setDestacada] = useState<Destacada | null>(null);

  useEffect(() => {
    const q = query(collection(db, "auctions"), where("status", "==", "active"), limit(6));
    return onSnapshot(q, s => {
      if (s.empty) { setDestacada(null); return; }
      const ms = (v: any) => v?.toMillis?.() ?? Infinity;
      const orden = s.docs
        .map(d => ({ id: d.id, ...d.data() } as Destacada))
        .sort((a, b) => ms(a.endsAt) - ms(b.endsAt));
      setDestacada(orden[0]);
    }, () => setDestacada(null));
  }, []);

  const contenido = Math.min(width, APP_MAX_WIDTH);
  const marcaAgua = contenido * 1.1;

  return (
    <View style={{ flex: 1, backgroundColor: color.accent, overflow: "hidden" }}>

      {/* Etiqueta gigante de fondo */}
      <View style={{ position: "absolute", right: -marcaAgua * 0.22, top: "16%", opacity: 0.55 }} pointerEvents="none">
        <Svg width={marcaAgua} height={marcaAgua} viewBox="0 0 24 24">
          <Path d={SIMBOLO_PATH} fill={color.accentLight} fillRule="evenodd" clipRule="evenodd"/>
        </Svg>
      </View>

      <View style={{
        flex: 1, width: contenido, alignSelf: "center",
        paddingHorizontal: space.lg + 4,
        paddingTop: insets.top + 30,
        paddingBottom: insets.bottom + 24,
      }}>
        <Logo tamano={32} color="#fff"/>

        {/* Titular apilado con interlínea cerrada, como el asset */}
        <Text style={{
          fontFamily: familia.display,
          fontSize: Math.min(contenido * 0.155, 62),
          lineHeight: Math.min(contenido * 0.135, 54),
          letterSpacing: 0.5,
          color: "#fff",
          marginTop: 24,
          includeFontPadding: false,
        }}>
          {"SUBASTAS\nEN VIVO\nDESDE $1"}
        </Text>

        <Text style={{
          fontFamily: familia.cuerpoSemi,
          fontSize: 16, lineHeight: 23,
          color: "rgba(255,255,255,0.92)",
          marginTop: 18, maxWidth: 320,
        }}>
          {BRAND.description}
        </Text>

        <View style={{ flex: 1, minHeight: 20 }}/>

        {destacada ? <TarjetaDestacada subasta={destacada}/> : null}

        <View style={{ gap: 10, marginTop: 16 }}>
          <Boton tamano="lg" onPress={onEntrarSinCuenta} style={{ backgroundColor: "#fff" }}>
            <Text style={{ color: color.accent, fontFamily: familia.cuerpoExtra, fontSize: 15 }}>
              Entrar sin cuenta
            </Text>
          </Boton>
          <Boton tamano="lg" onPress={onCrearCuenta} style={{ backgroundColor: color.accentDarkest }}>
            <Text style={{ color: "#fff", fontFamily: familia.cuerpoExtra, fontSize: 15 }}>
              Crear cuenta
            </Text>
          </Boton>
          <Text
            onPress={onIniciarSesion}
            style={{
              textAlign: "center", color: "rgba(255,255,255,0.92)",
              fontFamily: familia.cuerpoBold, fontSize: 13.5, paddingVertical: 8,
            }}
          >
            Ya tengo cuenta · Iniciar sesión
          </Text>
        </View>
      </View>
    </View>
  );
}

function TarjetaDestacada({ subasta }: { subasta: Destacada }) {
  const { texto, vencida } = useCountdown(subasta.endsAt);
  const foto = subasta.imageURL ?? subasta.imageURLs?.[0];

  return (
    <View style={{
      backgroundColor: "#fff", borderRadius: 24, padding: 14,
      flexDirection: "row", alignItems: "center", gap: 14,
    }}>
      <View style={{
        width: 78, height: 78, borderRadius: 16, overflow: "hidden",
        backgroundColor: color.accentTint,
      }}>
        {foto ? <Image source={{ uri: foto }} style={{ width: "100%", height: "100%" }} contentFit="cover"/> : null}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{
          fontFamily: familia.display, textTransform: "uppercase",
          fontSize: 16, lineHeight: 17,
          letterSpacing: 0.2, color: color.ink, includeFontPadding: false,
        }}>
          {subasta.title}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <Text style={{
            fontFamily: familia.display, fontSize: 24, color: color.accent,
            includeFontPadding: false,
          }}>
            ${(subasta.currentBidUsd ?? 0).toFixed(0)}
          </Text>
          {!vencida ? (
            <View style={{
              backgroundColor: color.accentStrong, borderRadius: radius.pill,
              paddingHorizontal: 9, paddingVertical: 3,
            }}>
              <Text style={{ fontFamily: familia.monoMedium, fontSize: 10.5, color: "#fff" }}>{texto}</Text>
            </View>
          ) : null}
        </View>

        {subasta.sellerName ? (
          <Text style={{ fontFamily: familia.mono, fontSize: 11, color: color.accentMuted, marginTop: 3 }}>
            {subasta.sellerName}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
