import type { CapacitorConfig } from "@capacitor/cli";
import appConfig from "./app.config.json" with { type: "json" };

const config: CapacitorConfig = {
  appId: appConfig.appId,
  appName: appConfig.name,
  webDir: "dist",
  android: {
    // The app is fully offline: no cleartext traffic, no remote debugging in release builds.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#f4f1ec",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
