import { defineConfig, devices } from "@playwright/test";

// Locally we can reuse the installed Microsoft Edge (KLADKA_BROWSER_CHANNEL=msedge);
// CI installs Playwright's Chromium.
const channel = process.env.KLADKA_BROWSER_CHANNEL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    locale: "ru-RU",
    colorScheme: "light",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
    ...(channel ? { channel } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(channel ? { channel } : {}) } }],
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
