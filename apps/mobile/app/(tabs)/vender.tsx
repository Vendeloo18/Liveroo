import React from "react";
import { View, Text, ScrollView, useWindowDimensions, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";
import { color, space, text as T, font, APP_MAX_WIDTH } from "../../src/theme";
import { Panel, Boton, Vacio } from "../../src/components/ui";

// Publicar desde el móvil implica subir fotos, que necesita permisos de
// cámara y galería. Hasta implementarlo, se manda a la web en vez de
// mostrar un formulario que no puede completar la parte importante.
// TODO: cuando el proyecto de Vercel se renombre, actualizar esta URL.
const WEB = "https://liveroo-web.vercel.app";

export default function Vender() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useAuthStore();
  const contenido = Math.min(width, APP_MAX_WIDTH);

  const Cabecera = () => (
    <View style={{
      paddingTop: insets.top + 10, paddingHorizontal: space.lg, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: color.line,
    }}>
      <Text style={T.title}>Vender</Text>
    </View>
  );

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <Cabecera/>
        <Vacio titulo="Entra para vender">
          <View style={{ paddingHorizontal: space.lg }}>
            <Boton onPress={() => router.push("/login")}>Entrar</Boton>
          </View>
        </Vacio>
      </View>
    );
  }

  const aprobado = profile.sellerStatus === "approved";

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Cabecera/>
      <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 24 }}>
        <View style={{ width: contenido, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>
          <Panel>
            <Text style={{ fontSize: 16, fontWeight: font.bold, color: color.ink, marginBottom: 6 }}>
              {aprobado ? "Publica desde la web" : "Todavía no eres vendedor"}
            </Text>
            <Text style={{ ...T.muted, lineHeight: 21 }}>
              {aprobado
                ? "Publicar necesita subir fotos, y esa parte todavía no está en el móvil. Desde la web puedes crear subastas, shows y gestionar tus ventas."
                : "Un administrador revisa cada cuenta antes de habilitarla. Es lo que evita que cualquiera publique en la plataforma."}
            </Text>
            <Boton style={{ marginTop: 14 }} onPress={() => Linking.openURL(`${WEB}/seller`)}>
              Abrir el panel en la web
            </Boton>
          </Panel>
        </View>
      </ScrollView>
    </View>
  );
}
