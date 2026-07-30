import React from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { color, radius, text as T, familia } from "../theme";
import { useCountdown } from "../hooks/useCountdown";
import { Insignia } from "./ui";

export interface DatosSubasta {
  id: string;
  title?: string;
  imageURL?: string;
  imageURLs?: string[];
  currentBidUsd?: number;
  startingPriceUsd?: number;
  sellerName?: string;
  endsAt?: any;
  bidsCount?: number;
  status?: string;
  mode?: string;
  category?: string;
}

/**
 * Espejo de apps/web/src/components/auction/AuctionCard.tsx, siguiendo
 * assets/card-lote.png: superficie en durazno con su propio radio, el
 * contador en mono arriba a la derecha, el vendedor dentro de la imagen
 * y el precio en naranja.
 */
export function AuctionCard({ subasta, ancho }: { subasta: DatosSubasta; ancho: number }) {
  const router = useRouter();
  const { texto, urgente, vencida } = useCountdown(subasta.endsAt);

  const foto = subasta.imageURL ?? subasta.imageURLs?.[0];
  const precio = subasta.currentBidUsd ?? subasta.startingPriceUsd ?? 0;
  const pujas = subasta.bidsCount ?? 0;
  const meta = pujas > 0
    ? `${subasta.sellerName} · ${pujas} ${pujas === 1 ? "puja" : "pujas"}`
    : subasta.sellerName;

  return (
    <Pressable
      onPress={() => router.push(`/auctions/${subasta.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: ancho,
        backgroundColor: color.surface,
        borderWidth: 1,
        borderColor: color.line,
        borderRadius: radius.card,
        overflow: "hidden",
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View style={{
        aspectRatio: 1,
        backgroundColor: color.accentTint,
        borderRadius: radius.media,
        overflow: "hidden",
        margin: 6,
        marginBottom: 0,
      }}>
        {foto ? (
          <Image source={{ uri: foto }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={160}/>
        ) : null}

        {subasta.mode === "live" && (
          <Insignia tono="live" style={{ position: "absolute", top: 8, left: 8 }}>EN VIVO</Insignia>
        )}

        {/* Contador arriba a la derecha, en monoespaciada */}
        <View style={{
          position: "absolute", top: 8, right: 8,
          backgroundColor: urgente && !vencida ? color.accent : color.accentStrong,
          borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4,
        }}>
          <Text style={{ fontFamily: familia.monoMedium, fontSize: 10.5, color: "#fff" }}>
            {vencida ? "cerrada" : texto}
          </Text>
        </View>

        {/* Vendedor dentro de la imagen. Lleva sombra porque aquí va sobre
            una foto, no sobre el durazno plano del asset. */}
        {meta ? (
          <View style={{
            position: "absolute", bottom: 8, left: 8, right: 8,
            flexDirection: "row", alignItems: "center", gap: 6,
          }}>
            <View style={{
              width: 18, height: 18, borderRadius: 9,
              backgroundColor: color.accentSoft,
              borderWidth: 1.5, borderColor: color.accent,
            }}/>
            <Text numberOfLines={1} style={{
              flex: 1, fontFamily: familia.mono, fontSize: 10, color: "#fff",
              textShadowColor: "rgba(0,0,0,0.6)",
              textShadowRadius: 3,
              textShadowOffset: { width: 0, height: 1 },
            }}>
              {meta}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ padding: 10 }}>
        <Text numberOfLines={2} style={{ ...T.cardTitle, minHeight: 34, marginBottom: 9 }}>
          {subasta.title ?? "Sin título"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={T.eyebrow}>{pujas > 0 ? "Puja actual" : "Precio inicial"}</Text>
            <Text style={T.price}>${precio.toFixed(2)}</Text>
          </View>
          <View style={{
            backgroundColor: color.accent, borderRadius: radius.pill,
            paddingHorizontal: 15, paddingVertical: 8,
          }}>
            <Text style={{ color: color.accentInk, fontFamily: familia.cuerpoExtra, fontSize: 12 }}>Pujar</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
