import React from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { color, radius, text as T, font } from "../theme";
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

export function AuctionCard({ subasta, ancho }: { subasta: DatosSubasta; ancho: number }) {
  const router = useRouter();
  const { texto, urgente, vencida } = useCountdown(subasta.endsAt);
  const foto = subasta.imageURL ?? subasta.imageURLs?.[0];
  const precio = subasta.currentBidUsd ?? subasta.startingPriceUsd ?? 0;
  const pujas = subasta.bidsCount ?? 0;

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
      <View style={{ width: "100%", aspectRatio: 1, backgroundColor: color.surface2 }}>
        {foto ? (
          <Image source={{ uri: foto }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={160}/>
        ) : null}

        {subasta.mode === "live" && (
          <Insignia tono="live" style={{ position: "absolute", top: 8, left: 8 }}>EN VIVO</Insignia>
        )}

        <Insignia
          tono={urgente && !vencida ? "live" : "flotante"}
          style={{ position: "absolute", bottom: 8, left: 8 }}
        >
          {vencida ? "Finalizada" : texto}
        </Insignia>

        {pujas > 0 && (
          <Insignia tono="flotante" style={{ position: "absolute", top: 8, right: 8 }}>
            {pujas} {pujas === 1 ? "puja" : "pujas"}
          </Insignia>
        )}
      </View>

      <View style={{ padding: 10 }}>
        <Text numberOfLines={2} style={{ ...T.cardTitle, minHeight: 36, marginBottom: 8 }}>
          {subasta.title ?? "Sin título"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={T.eyebrow}>{pujas > 0 ? "Puja actual" : "Precio inicial"}</Text>
            <Text style={T.price}>${precio.toFixed(2)}</Text>
          </View>
          <View style={{ backgroundColor: color.accent, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: color.accentInk, fontWeight: font.extrabold, fontSize: 12 }}>Pujar</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
