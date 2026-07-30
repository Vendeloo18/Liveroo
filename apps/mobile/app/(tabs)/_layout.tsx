import React from "react";
import { View, Text, Platform } from "react-native";
import { Tabs } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { color, font, TAB_BAR_HEIGHT } from "../../src/theme";

// Mismos iconos y mismo orden que la barra inferior de la web
const ICONOS: Record<string, string> = {
  index: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  explorar: "M21 21l-4.35-4.35",
  vender: "M12 5v14M5 12h14",
  actividad: "M3 12h4l3 8 4-16 3 8h4",
  cuenta: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
};

function Icono({ nombre, activo }: { nombre: string; activo: boolean }) {
  const tinta = activo ? color.accent : color.ink3;

  // El de vender va en una pastilla del color de acción, como en la web
  if (nombre === "vender") {
    return (
      <View style={{
        width: 40, height: 30, borderRadius: 9, backgroundColor: color.accent,
        alignItems: "center", justifyContent: "center",
      }}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
             stroke={color.accentInk} strokeWidth={3} strokeLinecap="round">
          <Path d={ICONOS.vender}/>
        </Svg>
      </View>
    );
  }

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke={tinta} strokeWidth={activo ? 2.4 : 1.9} strokeLinecap="round" strokeLinejoin="round">
      {nombre === "explorar" && <Circle cx={11} cy={11} r={7}/>}
      <Path d={ICONOS[nombre]}/>
    </Svg>
  );
}

const etiqueta = (texto: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 10, fontWeight: font.bold, color: focused ? color.accent : color.ink3 }}>
    {texto}
  </Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: TAB_BAR_HEIGHT,
          paddingTop: 9,
          paddingBottom: Platform.OS === "ios" ? 22 : 10,
          backgroundColor: color.bg,
          borderTopColor: color.line,
        },
        tabBarItemStyle: { gap: 2 },
      }}
    >
      <Tabs.Screen name="index" options={{
        tabBarIcon: ({ focused }) => <Icono nombre="index" activo={focused}/>,
        tabBarLabel: etiqueta("Inicio"),
      }}/>
      <Tabs.Screen name="explorar" options={{
        tabBarIcon: ({ focused }) => <Icono nombre="explorar" activo={focused}/>,
        tabBarLabel: etiqueta("Explorar"),
      }}/>
      <Tabs.Screen name="vender" options={{
        tabBarIcon: () => <Icono nombre="vender" activo/>,
        tabBarLabel: etiqueta("Vender"),
      }}/>
      <Tabs.Screen name="actividad" options={{
        tabBarIcon: ({ focused }) => <Icono nombre="actividad" activo={focused}/>,
        tabBarLabel: etiqueta("Actividad"),
      }}/>
      <Tabs.Screen name="cuenta" options={{
        tabBarIcon: ({ focused }) => <Icono nombre="cuenta" activo={focused}/>,
        tabBarLabel: etiqueta("Cuenta"),
      }}/>
    </Tabs>
  );
}
