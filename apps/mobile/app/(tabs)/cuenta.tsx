import React from "react";
import { View, Text, ScrollView, useWindowDimensions, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";
import { color, space, text as T, font, APP_MAX_WIDTH } from "../../src/theme";
import { Panel, Fila, Insignia, Boton, Vacio, Avatar } from "../../src/components/ui";

const ETIQUETA: Record<string, { texto: string; tono: "accent" | "soft" | "live" }> = {
  approved: { texto: "Vendedor verificado", tono: "accent" },
  pending: { texto: "Solicitud en revisión", tono: "soft" },
  suspended: { texto: "Cuenta suspendida", tono: "live" },
};

export default function Cuenta() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile, signOut } = useAuthStore();
  const contenido = Math.min(width, APP_MAX_WIDTH);

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top + 10 }}>
        <Text style={{ ...T.title, paddingHorizontal: space.lg, paddingBottom: 12 }}>Mi cuenta</Text>
        <Vacio titulo="No has iniciado sesión" texto="Entra para ver tus ofertas, órdenes y perfil.">
          <View style={{ paddingHorizontal: space.lg }}>
            <Boton onPress={() => router.push("/login")}>Entrar</Boton>
          </View>
        </Vacio>
      </View>
    );
  }

  const etiqueta = profile.sellerStatus ? ETIQUETA[profile.sellerStatus] : undefined;
  const p = profile as any;

  const salir = () => {
    Alert.alert("Cerrar sesión", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: () => signOut() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{
        paddingTop: insets.top + 10, paddingHorizontal: space.lg, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: color.line,
      }}>
        <Text style={T.title}>Mi cuenta</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24, alignItems: "center" }}>
        <View style={{ width: contenido, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>

          {profile.sellerStatus === "approved" && !p.whatsapp && (
            <Panel style={{ backgroundColor: "rgba(232,163,0,0.12)", borderColor: "transparent" }}>
              <Text style={{ color: color.warnInk, fontSize: 13, lineHeight: 19 }}>
                <Text style={{ fontWeight: font.bold }}>Falta tu WhatsApp. </Text>
                Quien gane una de tus ventas no tiene cómo contactarte. Agrégalo desde la web por ahora.
              </Text>
            </Panel>
          )}

          <Panel style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Avatar nombre={profile.displayName} uri={p.avatar} tam={56}/>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: font.extrabold, color: color.ink }}>
                {profile.displayName ?? "Usuario"}
              </Text>
              <Text numberOfLines={1} style={T.dim}>{profile.email}</Text>
              {etiqueta ? <Insignia tono={etiqueta.tono} style={{ marginTop: 7 }}>{etiqueta.texto}</Insignia> : null}
            </View>
          </Panel>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              ["Compras", profile.totalPurchases ?? 0],
              ["Ventas", profile.totalSales ?? 0],
              ["Rating", profile.ratingAvg ? `${profile.ratingAvg.toFixed(1)}★` : "—"],
            ].map(([l, v]) => (
              <Panel key={String(l)} style={{ flex: 1, alignItems: "center", paddingVertical: 13 }}>
                <Text style={{ ...T.price, fontSize: 19 }}>{v}</Text>
                <Text style={{ ...T.eyebrow, marginTop: 2 }}>{l}</Text>
              </Panel>
            ))}
          </View>

          <Panel style={{ paddingVertical: 2 }}>
            <Fila onPress={() => router.push("/actividad")}>
              <Text style={{ fontSize: 15, color: color.ink }}>Mis órdenes</Text>
              <Text style={T.dim}>›</Text>
            </Fila>
            <Fila onPress={() => router.push("/explorar")} ultima>
              <Text style={{ fontSize: 15, color: color.ink }}>Explorar ventas</Text>
              <Text style={T.dim}>›</Text>
            </Fila>
          </Panel>

          <Boton variante="soft" onPress={salir}>Cerrar sesión</Boton>
        </View>
      </ScrollView>
    </View>
  );
}
