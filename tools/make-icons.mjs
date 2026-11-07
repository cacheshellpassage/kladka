#!/usr/bin/env node
/**
 * Generates the original app icon (an isometric staircase of three blocks — "step by step")
 * as SVG and renders PNG sizes with a headless browser (Edge/Chrome/Playwright Chromium).
 * Output: apps/app/public/icons/*, assets/icon-1024.png, assets/splash-2732.png (CC0).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "packages/renderer-cli/package.json"));
const { chromium } = require("playwright-core");

const C = {
  bg1: "#df7f52",
  bg2: "#a3462a",
  top: "#fff5ea",
  left: "#f3cfb5",
  right: "#e7a983",
  line: "#7a3218",
};

function cube(x, y, a) {
  const dx = a * 0.866,
    dy = a * 0.5;
  const P0 = [x, y],
    P1 = [x + dx, y + dy],
    P2 = [x, y + a],
    P3 = [x - dx, y + dy];
  const down = (p) => [p[0], p[1] + a];
  const poly = (pts, fill) =>
    `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="${fill}" stroke="${C.line}" stroke-width="${(a * 0.045).toFixed(1)}" stroke-linejoin="round"/>`;
  return [
    poly([P3, P2, down(P2), down(P3)], C.left),
    poly([P2, P1, down(P1), down(P2)], C.right),
    poly([P0, P1, P2, P3], C.top),
  ].join("");
}

/** Staircase: columns of 1, 2, 3 cubes stepping to the right/back. */
function staircase(cx, cy, a) {
  const dx = a * 0.866,
    dy = a * 0.5;
  const parts = [];
  const cols = [1, 2, 3];
  // draw from back (right, top) to front so faces overlap correctly: columns go along +x iso (right-up)
  for (let c = cols.length - 1; c >= 0; c--) {
    for (let h = 0; h < cols[c]; h++) {
      const x = cx + (c - 1) * dx;
      const y = cy - (c - 1) * dy - h * a;
      parts.push(cube(x, y, a));
    }
  }
  return parts.join("");
}

function iconSvg({ size = 512, maskable = false } = {}) {
  const pad = maskable ? 0 : 0;
  const r = maskable ? 0 : 112;
  const a = maskable ? 58 : 74;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient></defs>
  <rect x="${pad}" y="${pad}" width="${512 - 2 * pad}" height="${512 - 2 * pad}" rx="${r}" fill="url(#g)"/>
  <g>${staircase(256, 256, a)}</g>
</svg>`;
}

const iconsDir = join(root, "apps/app/public/icons");
const assetsDir = join(root, "assets");
mkdirSync(iconsDir, { recursive: true });
mkdirSync(assetsDir, { recursive: true });
writeFileSync(join(iconsDir, "icon.svg"), iconSvg());
writeFileSync(join(iconsDir, "icon-maskable.svg"), iconSvg({ maskable: true }));
writeFileSync(join(assetsDir, "icon.svg"), iconSvg());

async function launch() {
  const args = ["--disable-gpu"];
  for (const opt of [{}, { channel: "msedge" }, { channel: "chrome" }]) {
    try {
      return await chromium.launch({ headless: true, args, ...opt });
    } catch {
      /* try next */
    }
  }
  throw new Error("No Chromium-based browser found for rendering icons");
}

const browser = await launch();
const page = await browser.newPage();
async function render(svg, size, out, bg = "transparent") {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:${bg}">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`,
  );
  writeFileSync(
    out,
    await page.screenshot({
      omitBackground: bg === "transparent",
      clip: { x: 0, y: 0, width: size, height: size },
    }),
  );
}
await render(iconSvg(), 192, join(iconsDir, "icon-192.png"));
await render(iconSvg(), 512, join(iconsDir, "icon-512.png"));
await render(iconSvg({ maskable: true }), 512, join(iconsDir, "icon-maskable-512.png"));
await render(iconSvg(), 1024, join(assetsDir, "icon-1024.png"));
await render(iconSvg({ maskable: true }), 1024, join(assetsDir, "icon-foreground-1024.png"));
// splash: icon centred on the light background
await page.setViewportSize({ width: 1366, height: 1366 });
await page.setContent(
  `<html><body style="margin:0;width:1366px;height:1366px;display:grid;place-items:center;background:#f4f1ec;font-family:system-ui">
  <div style="text-align:center">${iconSvg({ size: 360 })}<div style="margin-top:28px;font-size:64px;font-weight:700;color:#1f2328">Кладка</div></div></body></html>`,
);
writeFileSync(
  join(assetsDir, "splash-2732.png"),
  await page.screenshot({ clip: { x: 0, y: 0, width: 1366, height: 1366 }, scale: "device" }),
);
await browser.close();
console.log("Icons written to apps/app/public/icons and assets/");
