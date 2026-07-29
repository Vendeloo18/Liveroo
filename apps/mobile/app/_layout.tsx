import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "../src/store/authStore";
import { color } from "../src/theme";

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);

  // Un solo listener de sesión para toda la app
  useEffect(() => init(), [init]);

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
