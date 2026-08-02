import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Anton_400Regular } from "@expo-google-fonts/anton";
import {
  Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold,
  Archivo_700Bold, Archivo_800ExtraBold,
} from "@expo-google-fonts/archivo";
import { useAuthStore } from "../src/store/authStore";
import { color } from "../src/theme";

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);

  // Las mismas dos tipografías que la web: Anton para titulares y Archivo
  // para toda la interfaz, incluidos datos y precios secundarios.
  const [fuentesListas] = useFonts({
    Anton_400Regular,
    Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold,
    Archivo_700Bold, Archivo_800ExtraBold,
  });

  // Un solo listener de sesión para toda la app
  useEffect(() => init(), [init]);

  // Sin esperar a las fuentes hay un salto visible: el texto entra con la
  // de sistema y brinca al montar Anton, que es mucho más estrecha.
  if (!fuentesListas) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark"/>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: "none" }}/>
        <Stack.Screen name="auctions/[id]"/>
        <Stack.Screen name="login" options={{ animation: "slide_from_bottom" }}/>
      </Stack>
    </SafeAreaProvider>
  );
}
