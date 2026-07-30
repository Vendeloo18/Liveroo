// Config dinámica en vez de app.json: el nombre sale de
// packages/shared/src/brand.ts, el mismo sitio que usan la web y las
// pantallas. Con app.json había que acordarse de cambiarlo aparte.
import type { ExpoConfig } from "expo/config";
// Se lee el JSON directo y no el paquete del workspace: el cargador de
// configuración de Expo transpila este archivo pero no los .ts que
// importe, y con un import del paquete se rompe al arrancar.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BRAND = require("../../packages/shared/src/brand.json");

const config: ExpoConfig = {
  name: BRAND.name,
  slug: "vendeloo",
  scheme: "vendeloo",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: { supportsTablet: false, bundleIdentifier: "app.vendeloo.mobile" },
  android: {
    package: "app.vendeloo.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/icon-adaptativo.png",
      backgroundColor: BRAND.palette.accent,
    },
  },
  web: { bundler: "metro", output: "single", favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    [
      "expo-image-picker",
      {
        // Textos de permiso que iOS exige mostrar. Sin esto la app se
        // rechaza en la App Store y en Android el permiso sale genérico.
        photosPermission: "Vendeloo necesita tus fotos para publicar los productos que vendes.",
        cameraPermission: "Vendeloo usa la cámara para que tomes fotos de tus productos al publicar.",
      },
    ],
  ],
  experiments: { typedRoutes: true },
};

export default config;
