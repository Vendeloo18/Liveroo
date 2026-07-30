// Config dinámica en vez de app.json: el nombre sale de
// packages/shared/src/brand.ts, el mismo sitio que usan la web y las
// pantallas. Con app.json había que acordarse de cambiarlo aparte.
import type { ExpoConfig } from "expo/config";
import { BRAND } from "@subastas-ve/shared";

const config: ExpoConfig = {
  name: BRAND.name,
  slug: "liveroo",
  scheme: "liveroo",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: { supportsTablet: false, bundleIdentifier: "app.liveroo.mobile" },
  android: { package: "app.liveroo.mobile" },
  web: { bundler: "metro", output: "single" },
  plugins: ["expo-router"],
  experiments: { typedRoutes: true },
};

export default config;
