import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { platform } from "./platform/platform";
import "@fontsource-variable/inter/wght.css";
import "./styles/app.css";
import "./styles/polish.css";
import "./styles/ux.css";

// press ripple starts where the finger/cursor touched the button
document.addEventListener(
  "pointerdown",
  (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".btn, .chip");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--rx", String(e.clientX - r.left) + "px");
    el.style.setProperty("--ry", String(e.clientY - r.top) + "px");
  },
  { passive: true },
);

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
