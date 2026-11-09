#!/usr/bin/env node
/**
 * Copies our original launcher icons and splash screen into the Capacitor Android project
 * (replacing the template's default images). Run after `node tools/make-icons.mjs`.
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "apps/app");
const res = join(app, "android/app/src/main/res");
if (!existsSync(res))
  throw new Error("Android project not found: run `pnpm --filter @kladka/app exec cap add android` first");

const tauri = (src, out) =>
  execSync(`pnpm exec tauri icon "${src}" -o "${out}"`, { cwd: app, stdio: "inherit" });

const full = mkdtempSync(join(tmpdir(), "kladka-icon-"));
const fg = mkdtempSync(join(tmpdir(), "kladka-fg-"));
tauri(join(root, "assets/icon-1024.png"), full);
tauri(join(root, "assets/icon-foreground-1024.png"), fg);

for (const d of readdirSync(join(full, "android"))) {
  if (!d.startsWith("mipmap-") || d.includes("anydpi")) continue;
  mkdirSync(join(res, d), { recursive: true });
  cpSync(join(full, "android", d, "ic_launcher.png"), join(res, d, "ic_launcher.png"));
  cpSync(join(full, "android", d, "ic_launcher_round.png"), join(res, d, "ic_launcher_round.png"));
  cpSync(join(fg, "android", d, "ic_launcher_foreground.png"), join(res, d, "ic_launcher_foreground.png"));
}
writeFileSync(
  join(res, "values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2563EB</color>\n</resources>\n`,
);

// splash: one density-independent image instead of the template's per-density images
for (const d of readdirSync(res)) {
  if (d.startsWith("drawable") && existsSync(join(res, d, "splash.png"))) rmSync(join(res, d, "splash.png"));
  if (/^drawable-(land|port)-/.test(d) && readdirSync(join(res, d)).length === 0)
    rmSync(join(res, d), { recursive: true });
}
mkdirSync(join(res, "drawable-nodpi"), { recursive: true });
cpSync(join(root, "assets/splash-2732.png"), join(res, "drawable-nodpi/splash.png"));
rmSync(full, { recursive: true, force: true });
rmSync(fg, { recursive: true, force: true });
console.log("Android icons and splash updated.");
