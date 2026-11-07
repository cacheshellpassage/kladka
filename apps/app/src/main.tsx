import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { platform } from "./platform/platform";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker only for the web/PWA build (Tauri and Capacitor ship files locally anyway).
if (
  platform() === "web" &&
  import.meta.env.PROD &&
  "serviceWorker" in navigator &&
  location.protocol.startsWith("http")
) {
  void import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}

// Android back button: navigate back instead of closing the app.
if (platform() === "android") {
  void import("@capacitor/app").then(({ App: CapApp }) =>
    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack || location.hash.length > 2) history.back();
      else void CapApp.exitApp();
    }),
  );
}
