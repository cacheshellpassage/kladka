import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import appConfig from "./app.config.json" with { type: "json" };

// One web bundle for PWA, Tauri (desktop) and Capacitor (Android).
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // registered manually (skipped inside Tauri/Capacitor)
      includeAssets: ["icons/*.png", "icons/*.svg"],
      manifest: {
        name: `${appConfig.name} — ${appConfig.subtitle.en}`,
        short_name: appConfig.name,
        description: appConfig.description.en,
        lang: "ru",
        theme_color: "#c8643c",
        background_color: "#f4f1ec",
        display: "standalone",
        orientation: "any",
        // installed desktop PWA: open .schem/.litematic/.nbt files with the app (File Handling API)
        file_handlers: [
          {
            action: "./",
            accept: { "application/octet-stream": [".schem", ".litematic", ".nbt", ".kbuild"] },
          },
        ],
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,json,kbuild,txt,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "index.html",
      },
    }),
  ],
  worker: { format: "es" },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
    sourcemap: false,
  },
  server: { port: 5173, strictPort: false },
});
